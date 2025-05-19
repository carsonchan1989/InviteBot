// 上传云函数脚本
console.log('开始准备上传云函数...');

// 需要上传的云函数列表
const functions = [
  'login',
  'checkUser',
  'generateScript',
  'getUser',
  'manageUsers',
  'manageProjects',
  'updateUserProfile'
];

// 云环境ID
const envId = 'cloud1-5gr0cuqod1d81d0f';

// 打印上传命令提示
console.log('\n=== 请在命令行中执行以下命令上传云函数 ===');
functions.forEach(func => {
  console.log(`cd cloudfunctions/${func} && npm install && cd ../.. && tcb fn upload --env ${envId} --name ${func}`);
});

console.log('\n或者使用微信开发者工具上传:');
console.log('1. 右键点击 cloudfunctions 文件夹');
console.log('2. 选择"上传并部署：云端安装依赖"');
console.log('3. 选择云环境 ID:', envId);
console.log('4. 选择全部云函数'); 