// 本地测试云函数
const cloudFunction = require('./index');

// 模拟云函数上下文
const context = {};

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
console.log('开始测试云函数...');
runTests().then(() => {
  console.log('测试完成');
}); 