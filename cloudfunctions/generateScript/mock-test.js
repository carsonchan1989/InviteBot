// 本地测试云函数(使用mock模拟)
const mocks = require('./index-mock');

// 在测试前将模拟对象注入全局
global.wx = { cloud: mocks.cloud };

// 先备份原来的require函数
const originalRequire = require;

// 修改require函数，拦截特定模块的请求
require = function(modulePath) {
  if (modulePath === 'wx-server-sdk') {
    return mocks.cloud;
  } else if (modulePath === 'axios') {
    return mocks.axios;
  }
  return originalRequire.apply(this, arguments);
};

// 加载云函数
const cloudFunction = require('./index');

// 还原require函数
require = originalRequire;

// 模拟云函数上下文
const context = {
  env: 'test-env'
};

// 测试用例1：测试模式
async function testCase1() {
  console.log('====== 测试用例1：测试模式 ======');
  const event = {
    action: 'test'
  };
  
  try {
    const result = await cloudFunction.main(event, context);
    console.log('结果:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('测试失败:', error);
    return null;
  }
}

// 测试用例2：创建任务 - 参数错误
async function testCase2() {
  console.log('====== 测试用例2：创建任务 - 参数错误 ======');
  const event = {
    // 缺少inviteInfo
  };
  
  try {
    const result = await cloudFunction.main(event, context);
    console.log('结果:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('测试失败:', error);
    return null;
  }
}

// 测试用例3：创建任务 - 有效参数
async function testCase3() {
  console.log('====== 测试用例3：创建任务 - 有效参数 ======');
  const event = {
    inviteInfo: {
      inviteTarget: '张三',
      inviteDate: '2025-05-20',
      inviteReason: '肌肤护理需求',
      inviteProject: '面部护理-深层清洁'
    }
  };
  
  try {
    const result = await cloudFunction.main(event, context);
    console.log('结果:', JSON.stringify(result, null, 2));
    
    // 如果成功创建任务，测试获取任务结果
    if (result.code === 1 && result.data && result.data.taskId) {
      console.log('\n====== 测试用例3.1：获取任务结果 ======');
      const taskEvent = {
        action: 'getTaskResult',
        taskId: result.data.taskId
      };
      
      try {
        const taskResult = await cloudFunction.main(taskEvent, context);
        console.log('任务结果:', JSON.stringify(taskResult, null, 2));
      } catch (error) {
        console.error('获取任务结果失败:', error);
      }
    }
    
    return result;
  } catch (error) {
    console.error('测试失败:', error);
    return null;
  }
}

// 运行所有测试用例
async function runTests() {
  await testCase1();
  console.log('\n');
  
  await testCase2();
  console.log('\n');
  
  await testCase3();
}

// 执行测试
console.log('开始本地模拟测试云函数...');
runTests().then(() => {
  console.log('测试完成');
}); 