// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({  env: "cloud1-5gr0cuqod1d81d0f"});

const db = cloud.database();
const usersCollection = db.collection('users');

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  console.log('获取用户信息，openid:', openid);
  
  try {
    // 查询用户信息
    const userResult = await usersCollection.where({
      openid: openid
    }).get();
    
    if (!userResult.data || userResult.data.length === 0) {
      return {
        code: -1,
        msg: '用户不存在，请重新登录'
      };
    }
    
    const userData = userResult.data[0];
    console.log('获取到用户信息:', userData);
    
    // 确保返回头像和昵称信息
    return {
      code: 0,
      msg: '获取成功',
      data: {
        ...userData,
        avatarUrl: userData.avatarUrl || '',
        nickName: userData.nickName || ''
      }
    };
  } catch (error) {
    console.error('获取用户信息出错:', error);
    return {
      code: -1,
      msg: '获取用户信息失败',
      error: error
    };
  }
}; 