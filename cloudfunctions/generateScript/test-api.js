// 测试DeepSeek API连通性
const axios = require('axios');

// DeepSeek API配置
const API_URL = 'https://api.siliconflow.cn/v1';
const MODEL = 'Pro/deepseek-ai/DeepSeek-R1';
const API_KEY = 'sk-zenjhfgpeauztirirbzjshbvzuvqhqidkfkqwtmmenennmaa';

async function testAPI() {
  console.log('===== DeepSeek API 连通性测试 =====');
  console.log('开始时间:', new Date().toLocaleString());
  console.log('目标API:', API_URL);
  console.log('测试模型:', MODEL);
  
  try {
    console.log('\n>> 发送简单测试请求...');
    const startTime = Date.now();
    
    const response = await axios.post(
      `${API_URL}/chat/completions`,
      {
        model: MODEL,
        messages: [
          {role: 'system', content: '你是一个简短回答问题的助手。'},
          {role: 'user', content: '你好，这是一个API连通性测试，请回复"连接成功"。'}
        ],
        temperature: 0.7,
        max_tokens: 50
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        timeout: 30000 // 30秒超时
      }
    );
    
    const duration = Date.now() - startTime;
    
    console.log('\n>> 请求成功!');
    console.log('响应时间:', duration, 'ms');
    console.log('状态码:', response.status);
    console.log('响应头:', JSON.stringify(response.headers, null, 2));
    console.log('响应内容:', JSON.stringify(response.data, null, 2));
    
    // 验证响应内容
    if (response.data && response.data.choices && response.data.choices.length > 0) {
      const content = response.data.choices[0].message.content;
      console.log('\n>> 模型回复内容:', content);
    }
    
    console.log('\n>> API连接测试成功 ✓');
    console.log('总结: API可以正常连接，响应时间:', duration, 'ms');
    
    return true;
  } catch (error) {
    console.error('\n>> API连接测试失败 ✗');
    
    const errorInfo = {
      message: error.message,
      code: error.code
    };
    
    if (error.isAxiosError) {
      errorInfo.isAxiosError = true;
      
      if (error.response) {
        // 服务器返回了错误状态码
        errorInfo.response = {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          headers: error.response.headers
        };
        console.error('服务器错误响应:', JSON.stringify(errorInfo.response, null, 2));
      } else if (error.request) {
        // 请求已发送但没有收到响应
        errorInfo.requestSent = true;
        errorInfo.noResponse = true;
        console.error('已发送请求但未收到响应，可能是网络问题或超时');
      } else {
        // 设置请求时发生错误
        errorInfo.requestError = true;
        console.error('设置请求时发生错误');
      }
      
      // 请求配置信息
      if (error.config) {
        errorInfo.config = {
          url: error.config.url,
          method: error.config.method,
          timeout: error.config.timeout,
          headers: error.config.headers ? {
            // 过滤敏感信息
            ...error.config.headers,
            Authorization: '已隐藏'
          } : undefined
        };
      }
    }
    
    console.error('错误详情:', JSON.stringify(errorInfo, null, 2));
    
    // 提供可能的解决方案
    console.log('\n>> 可能的解决方案:');
    
    if (error.code === 'ECONNREFUSED') {
      console.log('- API服务器可能未运行或无法访问');
      console.log('- 检查网络连接和防火墙设置');
    } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.log('- 请求超时，API服务器响应过慢');
      console.log('- 可能需要增加超时时间或检查API服务状态');
    } else if (error.response && error.response.status === 401) {
      console.log('- API密钥可能已过期或无效');
      console.log('- 检查并更新API_KEY');
    } else if (error.response && error.response.status === 403) {
      console.log('- 无权访问该API或模型');
      console.log('- 检查账号权限和模型访问权限');
    } else if (error.response && error.response.status === 429) {
      console.log('- 请求过于频繁，API速率限制');
      console.log('- 减少请求频率或增加调用间隔');
    } else {
      console.log('- 检查API文档确认请求格式是否正确');
      console.log('- 联系API提供商获取更多帮助');
    }
    
    return false;
  } finally {
    console.log('\n测试结束时间:', new Date().toLocaleString());
    console.log('===== 测试完成 =====');
  }
}

// 直接运行测试
testAPI()
  .then(success => {
    if (success) {
      console.log('\n恭喜！API可以正常连接和使用。');
    } else {
      console.log('\n请根据上述错误信息排查问题。');
    }
  })
  .catch(err => {
    console.error('测试过程中发生未捕获错误:', err);
  }); 