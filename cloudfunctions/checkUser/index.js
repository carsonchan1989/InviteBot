// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const usersCollection = db.collection('users');

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  console.log('检查用户是否已注册，openid:', openid);
  
  try {
    // 查询用户是否存在
    const userResult = await usersCollection.where({
      openid: openid
    }).get();
    
    // 用户存在，返回用户信息
    if (userResult.data && userResult.data.length > 0) {
      const userData = userResult.data[0];
      
      console.log('用户已注册:', userData);
      
      // 检查用户是否有头像和昵称
      const hasProfile = !!userData.avatarUrl && !!userData.nickName;
      
      return {
        code: 0,
        msg: '用户已注册',
        isRegistered: true,
        hasProfile: hasProfile,
        userInfo: {
          nickName: userData.nickName || '',
          avatarUrl: userData.avatarUrl || '',
          role: userData.role || 'beautician'
        }
      };
    } 
    // 用户不存在，需要注册
    else {
      console.log('用户未注册');
      return {
        code: 0,
        msg: '用户未注册',
        isRegistered: false,
        userInfo: null
      };
    }
  } catch (error) {
    console.error('检查用户是否注册出错:', error);
    return {
      code: -1,
      msg: '检查用户是否注册失败',
      error: error.message || error
    };
  }
}; 