// 云函数入口文件
const cloud = require('wx-server-sdk');
const axios = require('axios');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 设置axios默认超时时间为30秒，避免请求超时
axios.defaults.timeout = 30000;

const db = cloud.database();
const usersCollection = db.collection('users');
const historyCollection = db.collection('histories');
const tasksCollection = db.collection('tasks');

// DeepSeek API配置 - 更新为最新的端点和格式
const API_URL = 'https://api.siliconflow.cn/v1';  // 使用siliconflow.cn的官方API端点
const MODEL = 'Pro/deepseek-ai/DeepSeek-R1';  // 正确的模型名称
const API_KEY = 'sk-zenjhfgpeauztirirbzjshbvzuvqhqidkfkqwtmmenennmaa';

// 带重试机制的API调用函数，增加重试次数为2次，给予更多尝试机会
async function callAPIWithRetry(data, headers, taskId, maxRetries = 2) {
  let lastError;
  
  // 先更新任务状态为正在调用API
  if (taskId) {
    try {
      await tasksCollection.doc(taskId).update({
        data: {
          apiCallStatus: 'calling',
          updatedAt: Date.now()
        }
      });
      console.log(`已更新任务${taskId}状态为正在调用API`);
    } catch (err) {
      console.error(`更新任务状态失败:`, err);
    }
  }
  
  for (let i = 0; i <= maxRetries; i++) {
    try {
      console.log(`尝试调用API，第${i + 1}次尝试`);
      
      // 添加开始时间记录
      const startTime = Date.now();
      
      // 打印完整请求内容和头部（去除敏感信息）
      console.log('API请求内容:', JSON.stringify(data, null, 2));
      console.log('API请求头部:', JSON.stringify({
        ...headers,
        'Authorization': headers.Authorization ? '已隐藏' : undefined
      }, null, 2));

      let response;
      
      // 根据stream参数决定使用哪种方式请求
      if (data.stream) {
        console.log('使用流式请求模式');
        // 流式响应处理
        const fullContent = await handleStreamResponse(API_URL, data, headers, taskId);
        
        // 构造类似非流式响应的结构，便于后续处理
        response = {
          data: {
            choices: [
              {
                message: {
                  content: fullContent
                }
              }
            ]
          }
        };
      } else {
        // 在请求中明确设置超时时间
        response = await axios.post(`${API_URL}/chat/completions`, data, { 
          headers,
          timeout: 30000 // 明确在请求中设置30秒超时
        });
      }
      
      // 添加耗时记录
      const endTime = Date.now();
      console.log(`API调用成功，耗时 ${endTime - startTime}ms`);
      console.log('API响应状态: 成功');
      
      // 仅记录响应数据的关键部分，避免日志过大
      if (response.data && response.data.choices && response.data.choices.length > 0) {
        console.log('API响应内容前100字符:', response.data.choices[0].message.content.substring(0, 100) + '...');
      }
      
      // 更新任务状态为API调用成功
      if (taskId) {
        try {
          await tasksCollection.doc(taskId).update({
            data: {
              apiCallStatus: 'success',
              apiResponseTime: endTime - startTime,
              updatedAt: Date.now()
            }
          });
        } catch (err) {
          console.error(`更新任务API状态失败:`, err);
        }
      }
      
      return response;
    } catch (error) {
      console.error(`API调用失败，第${i + 1}次尝试:`, error.message);
      
      // 记录详细错误信息
      let errorDetails = {
        message: error.message,
        code: error.code || '未知错误码'
      };
      
      // 特别强调超时错误的处理
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        console.error('API请求超时，当前超时设置为:', axios.defaults.timeout, 'ms');
        console.error('考虑增加超时时间或检查API服务器响应速度');
        errorDetails.timeout = true;
        errorDetails.timeoutValue = axios.defaults.timeout;
      }
      
      if (error.response) {
        errorDetails.status = error.response.status;
        errorDetails.data = error.response.data;
        console.error('API错误响应状态:', error.response.status);
        console.error('API错误响应数据:', JSON.stringify(error.response.data, null, 2));
        
        // 检查是否是API密钥问题
        if (error.response.status === 401 || 
            (error.response.data && error.response.data.error && 
             (error.response.data.error.includes('auth') || 
              error.response.data.error.includes('token') ||
              error.response.data.error.includes('key')))) {
          console.error('API认证失败，可能是API密钥无效或过期');
          errorDetails.authProblem = true;
        }
      } else if (error.request) {
        errorDetails.request = '请求发送但未收到响应';
        console.error('API请求发送但未收到响应，可能是网络问题或服务器未响应');
      } else {
        errorDetails.type = '发送请求前出错';
        console.error('API请求发送前出错，可能是配置问题:', error.message);
      }
      
      // 更新任务状态为API调用失败
      if (taskId) {
        try {
          await tasksCollection.doc(taskId).update({
            data: {
              apiCallStatus: 'failed',
              apiError: JSON.stringify(errorDetails),
              updatedAt: Date.now()
            }
          });
        } catch (err) {
          console.error(`更新任务API错误状态失败:`, err);
        }
      }
      
      lastError = error;
      
      // 最后一次尝试失败，直接抛出错误
      if (i === maxRetries) {
        throw error;
      }
      
      // 等待一段时间后重试，避免频繁请求，增加等待时间
      await new Promise(resolve => setTimeout(resolve, 5000)); // 增加到5秒等待时间
    }
  }
}

// 处理流式响应的函数
async function handleStreamResponse(apiUrl, data, headers, taskId) {
  return new Promise(async (resolve, reject) => {
    try {
      // 创建一个用于存储完整响应的变量
      let fullContent = '';
      let isFirstChunk = true;
      let chunkCount = 0;
      
      // 使用axios创建响应流
      const response = await axios({
        method: 'post',
        url: `${apiUrl}/chat/completions`,
        data: data,
        headers: headers,
        responseType: 'stream',
        timeout: 120000 // 流式响应使用更长的超时时间
      });
      
      console.log('成功建立流式连接');
      
      // 更新任务状态为正在接收流数据
      if (taskId) {
        try {
          await tasksCollection.doc(taskId).update({
            data: {
              apiCallStatus: 'streaming',
              streamStartTime: Date.now(),
              updatedAt: Date.now()
            }
          });
        } catch (err) {
          console.error(`更新任务流状态失败:`, err);
        }
      }
      
      // 处理响应数据流
      response.data.on('data', async (chunk) => {
        try {
          // 将二进制数据转换为字符串
          const chunkStr = chunk.toString();
          chunkCount++;
          
          // 调试信息
          if (isFirstChunk) {
            console.log('收到首个数据块，长度:', chunkStr.length);
            isFirstChunk = false;
          }
          
          if (chunkCount % 10 === 0) {
            console.log(`已收到 ${chunkCount} 个数据块`);
          }
          
          // 按行分割数据
          const lines = chunkStr
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(line => {
              // 移除"data: "前缀
              if (line.startsWith('data: ')) {
                return line.substring(6);
              }
              return line;
            });
          
          // 处理每一行数据
          for (const line of lines) {
            // 跳过心跳信息
            if (line === '[DONE]') {
              console.log('收到流结束标记');
              continue;
            }
            
            try {
              // 尝试解析JSON
              const parsedData = JSON.parse(line);
              
              // 检查是否有内容更新
              if (parsedData.choices && 
                  parsedData.choices[0] && 
                  parsedData.choices[0].delta && 
                  parsedData.choices[0].delta.content) {
                // 将新内容添加到完整响应中
                fullContent += parsedData.choices[0].delta.content;
              }
            } catch (parseError) {
              console.log('无法解析数据块:', line, parseError.message);
            }
          }
          
          // 每收到10个数据块更新一次任务状态，避免过于频繁的数据库操作
          if (taskId && chunkCount % 10 === 0) {
            try {
              await tasksCollection.doc(taskId).update({
                data: {
                  streamProgress: chunkCount,
                  contentLength: fullContent.length,
                  updatedAt: Date.now()
                }
              });
            } catch (err) {
              // 忽略更新错误，不影响主流程
              console.log('更新流进度失败，继续处理:', err.message);
            }
          }
        } catch (e) {
          console.error('处理数据块时出错:', e);
        }
      });
      
      // 处理流结束事件
      response.data.on('end', async () => {
        console.log('流响应完成，总计收到数据块:', chunkCount);
        console.log('完整内容长度:', fullContent.length);
        
        // 更新任务状态为流数据接收完成
        if (taskId) {
          try {
            await tasksCollection.doc(taskId).update({
              data: {
                apiCallStatus: 'stream_completed',
                streamEndTime: Date.now(),
                totalChunks: chunkCount,
                finalContentLength: fullContent.length,
                updatedAt: Date.now()
              }
            });
          } catch (err) {
            console.error(`更新流完成状态失败:`, err);
          }
        }
        
        resolve(fullContent);
      });
      
      // 处理错误
      response.data.on('error', (err) => {
        console.error('流响应出错:', err);
        reject(err);
      });
    } catch (error) {
      console.error('创建流请求失败:', error);
      reject(error);
    }
  });
}

// 调用AI模型生成话术的函数
async function generateByAI(inviteInfo, taskId) {
  try {
    console.log('开始生成话术，传入信息:', JSON.stringify(inviteInfo, null, 2));
    
    // 更新任务状态为准备调用AI
    if (taskId) {
      try {
        await tasksCollection.doc(taskId).update({
          data: {
            processingStage: 'preparing_prompt',
            updatedAt: Date.now()
          }
        });
      } catch (err) {
        console.error('更新任务状态失败:', err);
      }
    }
    
    // 构建提示词
    // 处理多个项目的情况
    let projectsText = `- 推荐项目1：${inviteInfo.inviteProject}`;
    if (inviteInfo.inviteProject2) {
      projectsText += `\n- 推荐项目2：${inviteInfo.inviteProject2}`;
    }
    if (inviteInfo.inviteProject3) {
      projectsText += `\n- 推荐项目3：${inviteInfo.inviteProject3}`;
    }
    
    const prompt = `
### 角色
你是一名美容师，需要邀约客户到店接受护理

### 技能
1.你具备很强的客户邀约能力,可以通过话术邀请客户到门店进行护理.
2.你具备丰富的皮肤护理知识和养生知识.
3.你可以根据情况编写不同切入角度的邀约话术，邀约客户到店.
4.你对邀约客户有着深刻的人性洞察与理解.

### 要求
1.根据客户输入的内容，生成邀约客户的话术，每条话术内容在100字左右;
2.内容口语化，风趣幽默，有emoji表情;
3.邀约项目和时间用""明确标识出来，并且不能改动项目名称
4.如果有多个项目，项目名称之间用"+"号连接
5.对客户的称呼不能更改，直接用${inviteInfo.inviteTarget}
6.话术生成角度如下：(1)太久没来的角度;(2)项目护理周期的角度;(3)享受的角度;(4)皮肤护理需要的角度;(5)身体养生需要的角度;(6)节气对人的影响的角度;(7)近期天气对人的影响的角度;(8)从众心理的角度.
7.话术生成请按以上角度顺序以及按格式生成

### 格式
1.time：
2.period：
3.enjoy：
4.skin：
5.body：
6.jieqi：
7.weather：
8.people：

### 客户信息
- 客户称呼：${inviteInfo.inviteTarget}
- 邀约日期：${inviteInfo.inviteDate}
- 邀约理由：${inviteInfo.inviteReason}
${projectsText}

### 限制
1.不要改动项目名称
2.不要强调送东西
3.不要说名额有限等内容

请严格按照要求的格式直接生成8个不同角度的话术，不要有多余的解释或前言。回复格式必须是：
1.time：话术内容
2.period：话术内容
3.enjoy：话术内容
4.skin：话术内容
5.body：话术内容
6.jieqi：话术内容
7.weather：话术内容
8.people：话术内容`;

    console.log('使用的提示词:', prompt);

    // 更新任务状态为正在调用AI
    if (taskId) {
      try {
        await tasksCollection.doc(taskId).update({
          data: {
            processingStage: 'calling_api',
            updatedAt: Date.now()
          }
        });
      } catch (err) {
        console.error('更新任务状态失败:', err);
      }
    }

    // 修改API请求参数，符合DeepSeek的API规范
    const apiData = {
      model: MODEL,
      messages: [
        {role: 'system', content: '你是一位专业的美容顾问助手，擅长生成专业、亲切的客户邀约话术。'},
        {role: 'user', content: prompt}
      ],
      temperature: 0.7,
      max_tokens: 1200,
      stream: true,  // 启用流式响应
      timeout_seconds: 25 // 明确告诉模型需要快速响应
    };
    
    // 确保请求头格式正确
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    };

    console.log('准备发送API请求...');
    console.log(`API端点: ${API_URL}, 模型: ${MODEL}, 最大令牌数: ${apiData.max_tokens}`);
    console.log('请求时间戳:', Date.now(), '当前时间:', new Date().toLocaleString());
    
    // 使用重试机制调用API，并传递taskId以便更新状态
    const response = await callAPIWithRetry(apiData, headers, taskId);
    console.log('API请求成功，收到响应, 时间戳:', Date.now(), '当前时间:', new Date().toLocaleString());

    // 更新任务状态为解析响应
    if (taskId) {
      try {
        await tasksCollection.doc(taskId).update({
          data: {
            processingStage: 'parsing_response',
            updatedAt: Date.now()
          }
        });
      } catch (err) {
        console.error('更新任务状态失败:', err);
      }
    }

    // 解析API返回的内容
    let scripts = [];
    let isModelGenerated = false; // 标记是否由大模型生成

    try {
      // 确保响应数据格式符合预期
      if (!response.data || !response.data.choices || !response.data.choices[0] || !response.data.choices[0].message) {
        console.error('API响应数据格式异常:', JSON.stringify(response.data, null, 2));
        throw new Error('API响应数据格式异常');
      }
      
      const content = response.data.choices[0].message.content;
      console.log('API返回原始内容:', content);
      
      // 解析8个话术角度的内容
      const timeMatch = content.match(/1\.time：([\s\S]*?)(?=2\.period：|$)/);
      const periodMatch = content.match(/2\.period：([\s\S]*?)(?=3\.enjoy：|$)/);
      const enjoyMatch = content.match(/3\.enjoy：([\s\S]*?)(?=4\.skin：|$)/);
      const skinMatch = content.match(/4\.skin：([\s\S]*?)(?=5\.body：|$)/);
      const bodyMatch = content.match(/5\.body：([\s\S]*?)(?=6\.jieqi：|$)/);
      const jieqiMatch = content.match(/6\.jieqi：([\s\S]*?)(?=7\.weather：|$)/);
      const weatherMatch = content.match(/7\.weather：([\s\S]*?)(?=8\.people：|$)/);
      const peopleMatch = content.match(/8\.people：([\s\S]*?)(?=$)/);
      
      // 检查是否成功解析了全部8个话术
      const allMatches = [
        timeMatch, periodMatch, enjoyMatch, skinMatch, 
        bodyMatch, jieqiMatch, weatherMatch, peopleMatch
      ];
      
      // 记录每个匹配的结果，帮助调试
      console.log('匹配结果:', allMatches.map((match, index) => {
        const key = ['time', 'period', 'enjoy', 'skin', 'body', 'jieqi', 'weather', 'people'][index];
        return {
          key,
          matched: match ? true : false,
          content: match ? match[1].substring(0, 20) + '...' : null
        };
      }));
      
      if (allMatches.every(match => match && match[1] && match[1].trim().length > 0)) {
        isModelGenerated = true;
        console.log('成功解析全部8个话术，使用大模型生成结果');

        // 添加到结果数组中
        scripts = [
          { reason: '太久没来', key: 'time', content: timeMatch[1].trim(), isAIGenerated: true },
          { reason: '护理周期', key: 'period', content: periodMatch[1].trim(), isAIGenerated: true },
          { reason: '享受角度', key: 'enjoy', content: enjoyMatch[1].trim(), isAIGenerated: true },
          { reason: '皮肤护理', key: 'skin', content: skinMatch[1].trim(), isAIGenerated: true },
          { reason: '身体养生', key: 'body', content: bodyMatch[1].trim(), isAIGenerated: true },
          { reason: '节气影响', key: 'jieqi', content: jieqiMatch[1].trim(), isAIGenerated: true },
          { reason: '天气影响', key: 'weather', content: weatherMatch[1].trim(), isAIGenerated: true },
          { reason: '从众心理', key: 'people', content: peopleMatch[1].trim(), isAIGenerated: true }
        ];
      } else {
        console.error('未能成功解析全部8个话术，API返回的内容格式可能不符合预期');
        console.error('解析结果:', JSON.stringify(allMatches.map(m => m ? true : false)));
        
        // 尝试拼接部分成功的内容
        const partialScripts = [];
        for (let i = 0; i < allMatches.length; i++) {
          const match = allMatches[i];
          const key = ['time', 'period', 'enjoy', 'skin', 'body', 'jieqi', 'weather', 'people'][i];
          const reason = ['太久没来', '护理周期', '享受角度', '皮肤护理', '身体养生', '节气影响', '天气影响', '从众心理'][i];
          
          if (match && match[1] && match[1].trim().length > 0) {
            partialScripts.push({
              reason,
              key,
              content: match[1].trim(),
              isAIGenerated: true,
              isPartial: true
            });
          }
        }
        
        // 如果至少有一个匹配成功，使用部分结果
        if (partialScripts.length > 0) {
          console.log(`部分解析成功，共匹配到${partialScripts.length}个话术`);
          scripts = partialScripts;
          isModelGenerated = true;
          // 修改整体结构保持统一
          throw new Error('部分内容格式不符合预期，但已获取部分结果');
        } else {
          throw new Error('API返回内容格式不符合预期，无法解析');
        }
      }
      
      console.log('成功生成话术:', JSON.stringify(scripts, null, 2));
    } catch (parseError) {
      console.error('解析API返回内容失败:', parseError);
      if (response && response.data && response.data.choices && response.data.choices[0]) {
        console.error('解析失败的内容:', response.data.choices[0].message.content);
      } else {
        console.error('解析失败，无法获取API返回内容');
      }
      
      // 如果是部分解析成功，并且已经有scripts数据，直接返回
      if (scripts && scripts.length > 0 && isModelGenerated) {
        console.log('使用部分解析成功的结果');
        return scripts;
      }
      
      throw new Error('解析API返回内容失败: ' + parseError.message);
    }

    return scripts;
  } catch (error) {
    // 增强错误日志记录
    const errorDetails = {
      message: error.message || '未知错误',
      stack: error.stack || '无堆栈信息',
      code: error.code || '未知错误码',
      isAxiosError: error.isAxiosError || false
    };
    
    // 如果是Axios错误，记录更详细的请求和响应信息
    if (error.isAxiosError) {
      // 响应信息
      if (error.response) {
        errorDetails.response = {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        };
      }
      
      // 请求信息
      if (error.config) {
        errorDetails.request = {
          url: error.config.url,
          method: error.config.method,
          timeout: error.config.timeout
        };
      }
      
      // 是否超时
      errorDetails.isTimeout = error.code === 'ECONNABORTED' || error.message.includes('timeout');
    }
    
    console.error('调用AI生成话术失败详细信息:', JSON.stringify(errorDetails, null, 2));
    
    // 更新任务状态为生成失败
    if (taskId) {
      try {
        await tasksCollection.doc(taskId).update({
          data: {
            processingStage: 'generation_failed',
            generationError: JSON.stringify(errorDetails),
            updatedAt: Date.now()
          }
        });
      } catch (err) {
        console.error('更新任务状态失败:', err);
      }
    }
    
    throw new Error('生成话术失败: ' + error.message);
  }
}

// 获取极简的错误回退话术
function getEmergencyScripts(inviteInfo, errorReason = null) {
  console.log('使用紧急回退话术，原因:', errorReason || '系统错误');
  
  if (!inviteInfo) {
    inviteInfo = {
      inviteTarget: '客户',
      inviteDate: '近期',
      inviteReason: '护理需求',
      inviteProject: '护理项目'
    };
  }
  
  // 处理多个项目
  let projectText = inviteInfo.inviteProject;
  if (inviteInfo.inviteProject2) {
    projectText += `+${inviteInfo.inviteProject2}`;
  }
  if (inviteInfo.inviteProject3) {
    projectText += `+${inviteInfo.inviteProject3}`;
  }
  
  // 根据错误原因生成不同的紧急话术
  const errorMessage = errorReason ? 
    (errorReason.includes('API') ? 'AI服务暂时不可用' : 
     errorReason.includes('超时') ? '系统响应超时' : 
     errorReason.includes('格式') ? '内容格式不匹配' : 
     '系统生成失败') : '系统生成失败';
  
  return [
    {
      reason: errorMessage,
      key: 'emergency',
      content: `${inviteInfo.inviteTarget}您好！我们诚挚邀请您在"${inviteInfo.inviteDate}"莅临体验"${projectText}"。这个项目对您的${inviteInfo.inviteReason}非常有帮助。期待您的光临！`,
      isAIGenerated: false,
      isEmergency: true,
      errorReason: errorReason
    }
  ];
}

// 创建生成任务
async function createGenerateTask(userData, openid, inviteInfo, isRegenerate) {
  try {
    // 创建任务记录，添加更多状态字段
    const taskData = {
      userId: userData._id,
      openid: openid,
      inviteInfo: inviteInfo,
      isRegenerate: isRegenerate,
      status: 'pending', // pending, processing, completed, completed_with_fallback, failed
      processingStage: 'created', // created, preparing_prompt, calling_api, parsing_response, generation_failed, completed
      apiCallStatus: 'not_started', // not_started, calling, success, failed
      apiResponseTime: null,
      apiError: null,
      generationError: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      startProcessingAt: null,
      completedAt: null,
      scripts: null,
      error: null,
      isAIGenerated: false
    };
    
    const taskResult = await tasksCollection.add({
      data: taskData
    });
    
    console.log('创建生成任务成功, taskId:', taskResult._id);
    
    // 异步执行生成过程
    generateScriptAsync(taskResult._id, userData, openid, inviteInfo, isRegenerate).catch(error => {
      console.error('异步生成话术出错:', error);
    });
    
    return taskResult._id;
  } catch (error) {
    console.error('创建生成任务出错:', error);
    throw error;
  }
}

// 异步执行话术生成
async function generateScriptAsync(taskId, userData, openid, inviteInfo, isRegenerate) {
  try {
    console.log(`开始执行任务 ${taskId} 的话术生成`);
    
    // 更新任务状态为开始处理
    await tasksCollection.doc(taskId).update({
      data: {
        status: 'processing',
        processingStage: 'started',
        startProcessingAt: Date.now(),
        updatedAt: Date.now()
      }
    });
    
    // 尝试生成话术
    let scripts = [];
    let isAIGenerated = false;
    let errorMessage = null;
    let processingStage = 'completed';
    
    try {
      // 直接调用AI模型生成，不再使用默认内容，传入taskId以便更新状态
      scripts = await generateByAI(inviteInfo, taskId);
      isAIGenerated = true;
      console.log('AI话术生成成功');
    } catch (genError) {
      // 记录错误信息
      errorMessage = genError.message;
      processingStage = 'failed_with_fallback';
      console.error('AI话术生成失败，使用紧急回退话术:', genError);
      // 使用极简紧急话术
      scripts = getEmergencyScripts(inviteInfo, errorMessage);
      isAIGenerated = false;
    }
    
    // 如果不是重新生成，需要扣减次数和保存历史
    if (!isRegenerate) {
      // 扣减使用次数
      console.log('扣减使用次数');
      await usersCollection.doc(userData._id).update({
        data: {
          remainingUsage: userData.remainingUsage - 1,
          updatedAt: Date.now()
        }
      });
      
      // 保存生成历史
      console.log('保存生成历史');
      await historyCollection.add({
        data: {
          userId: userData._id,
          openid: openid,
          inviteInfo: inviteInfo,
          scripts: scripts,
          isAIGenerated: isAIGenerated,
          createdAt: Date.now()
        }
      });
    }
    
    // 更新任务状态
    const updateData = {
      status: errorMessage ? 'completed_with_fallback' : 'completed',
      processingStage: processingStage,
      scripts: scripts,
      isAIGenerated: isAIGenerated,
      completedAt: Date.now(),
      updatedAt: Date.now()
    };
    
    if (errorMessage) {
      updateData.error = errorMessage;
    }
    
    await tasksCollection.doc(taskId).update({
      data: updateData
    });
    
    console.log(`任务 ${taskId} 执行完成，是否使用AI生成: ${isAIGenerated}`);
  } catch (error) {
    console.error(`任务 ${taskId} 执行失败:`, error);
    
    // 更新任务状态为失败
    await tasksCollection.doc(taskId).update({
      data: {
        status: 'failed',
        processingStage: 'failed',
        error: error.message || error.toString(),
        completedAt: Date.now(),
        updatedAt: Date.now()
      }
    });
  }
}

// 初始化数据库集合，确保所需集合存在
async function initCollections() {
  try {
    console.log('开始初始化数据库集合...');
    const collections = ['tasks', 'users', 'histories'];
    const db = cloud.database();
    
    for (const collName of collections) {
      try {
        // 尝试查询集合，如果能查询说明已存在
        await db.collection(collName).count();
        console.log(`集合 ${collName} 已存在`);
      } catch (err) {
        if (err.errCode === -502005 || err.message.includes('collection not exists')) {
          try {
            // 创建集合
            await db.createCollection(collName);
            console.log(`成功创建集合 ${collName}`);
          } catch (createErr) {
            console.error(`创建集合 ${collName} 失败:`, createErr);
            // 如果创建失败，记录原始错误信息供后续排查
            console.error('原始错误信息:', JSON.stringify({
              message: createErr.message,
              stack: createErr.stack,
              errCode: createErr.errCode
            }, null, 2));
          }
        } else {
          console.error(`检查集合 ${collName} 时出错:`, err);
        }
      }
    }
    console.log('数据库集合初始化完成');
  } catch (error) {
    console.error('初始化数据库集合失败:', error);
    console.error('详细错误信息:', JSON.stringify({
      message: error.message,
      stack: error.stack,
      errCode: error.errCode
    }, null, 2));
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('generateScript云函数开始执行，传入参数:', event);
  
  // 先初始化数据库集合，确保所需集合都存在
  await initCollections();
  
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { inviteInfo, isRegenerate, action, taskId } = event;
  
  // 根据action参数处理不同的请求类型
  if (action === 'getTaskResult') {
    // 获取任务结果
    try {
      if (!taskId) {
        return {
          code: -1,
          msg: '缺少taskId参数'
        };
      }
      
      const taskResult = await tasksCollection.doc(taskId).get();
      if (!taskResult.data) {
        return {
          code: -1,
          msg: '任务不存在'
        };
      }
      
      const task = taskResult.data;
      
      // 处理不同的任务状态
      if (task.status === 'pending' || task.status === 'processing') {
        // 返回更详细的处理阶段信息
        let statusMessage = '任务正在处理中';
        let statusDetails = {};
        
        if (task.processingStage) {
          switch(task.processingStage) {
            case 'created':
              statusMessage = '任务已创建，等待处理';
              break;
            case 'started':
              statusMessage = '任务开始处理';
              break;
            case 'preparing_prompt':
              statusMessage = '正在准备生成话术';
              break;
            case 'calling_api':
              statusMessage = '正在调用AI接口';
              break;
            case 'parsing_response':
              statusMessage = '正在解析AI响应';
              break;
            case 'generation_failed':
              statusMessage = '生成过程出错，准备回退';
              break;
            default:
              statusMessage = '任务正在处理中';
          }
          
          statusDetails.stage = task.processingStage;
        }
        
        if (task.apiCallStatus) {
          statusDetails.apiStatus = task.apiCallStatus;
        }
        
        return {
          code: 1,
          msg: statusMessage,
          data: { 
            status: task.status,
            details: statusDetails
          }
        };
      } else if (task.status === 'failed') {
        return {
          code: -1,
          msg: '生成话术失败',
          error: task.error,
          details: {
            processingStage: task.processingStage,
            apiCallStatus: task.apiCallStatus,
            apiError: task.apiError,
            generationError: task.generationError
          }
        };
      } else if (task.status === 'completed' || task.status === 'completed_with_fallback') {
        // 查询最新的用户使用次数
        const userResult = await usersCollection.where({
          openid: openid
        }).get();
        
        return {
          code: 0,
          msg: task.status === 'completed_with_fallback' ? '生成部分成功(使用备用话术)' : '生成成功',
          data: {
            scripts: task.scripts,
            inviteInfo: task.inviteInfo,
            isAIGenerated: task.isAIGenerated,
            processingTime: task.completedAt ? (task.completedAt - task.createdAt) : null,
            apiResponseTime: task.apiResponseTime
          },
          remainingUsage: userResult.data[0].remainingUsage
        };
      }
    } catch (error) {
      console.error('获取任务结果出错:', error);
      return {
        code: -1,
        msg: '获取任务结果失败',
        error: error.message || error.toString()
      };
    }
  } else if (action === 'test') {
    // 测试模式 - 使用一条测试内容，避免默认内容
    const testInviteInfo = inviteInfo || {
      inviteTarget: '测试客户',
      inviteDate: '2025-05-15',
      inviteReason: '测试理由',
      inviteProject: '测试项目'
    };
    
    return {
      code: 0,
      msg: '测试模式',
      data: {
        scripts: [
          {
            reason: '测试话术',
            key: 'test',
            content: `这是一条测试话术。${testInviteInfo.inviteTarget}您好，我们邀请您在"${testInviteInfo.inviteDate}"体验"${testInviteInfo.inviteProject}"，帮助解决您的${testInviteInfo.inviteReason}问题。`,
            isAIGenerated: false,
            isTest: true
          }
        ],
        inviteInfo: testInviteInfo,
        isAIGenerated: false
      },
      remainingUsage: isRegenerate ? 10 : 9
    };
  } else {
    // 创建生成话术任务
    try {
      // 查询用户信息
      console.log('查询用户信息，openid:', openid);
      const userResult = await usersCollection.where({
        openid: openid
      }).get();
      
      if (!userResult.data || userResult.data.length === 0) {
        console.log('用户不存在');
        return {
          code: -1,
          msg: '用户不存在，请重新登录'
        };
      }
      
      const userData = userResult.data[0];
      console.log('用户信息:', userData);
      
      // 参数验证
      if (!inviteInfo) {
        console.error('缺少inviteInfo参数');
        return {
          code: -1,
          msg: '缺少邀约信息，请重新提交'
        };
      }
      
      // 验证inviteInfo对象是否包含所需字段
      const requiredFields = ['inviteTarget', 'inviteDate', 'inviteReason', 'inviteProject'];
      const missingFields = requiredFields.filter(field => !inviteInfo[field]);
      
      if (missingFields.length > 0) {
        console.error('邀约信息不完整，缺少字段:', missingFields);
        return {
          code: -1,
          msg: `邀约信息不完整，请填写: ${missingFields.join(', ')}`
        };
      }
      
      // 检查剩余使用次数（仅在非重新生成时检查）
      if (!isRegenerate && userData.remainingUsage <= 0) {
        console.log('用户使用次数已用完');
        return {
          code: -1,
          msg: '使用次数已用完，请联系管理员增加次数'
        };
      }
      
      // 创建生成任务
      const taskId = await createGenerateTask(userData, openid, inviteInfo, isRegenerate);
      
      // 直接返回任务ID，客户端使用轮询方式获取结果
      return {
        code: 1, // 使用1表示任务创建成功，但结果还未生成
        msg: '任务已创建，请稍后查询结果',
        data: {
          taskId: taskId
        },
        remainingUsage: isRegenerate ? userData.remainingUsage : userData.remainingUsage - 1
      };
    } catch (error) {
      console.error('创建生成任务出错:', error);
      return {
        code: -1,
        msg: '生成话术失败，请重试',
        error: error.message || error.toString()
      };
    }
  }
}; 