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
  
  // 从小程序端获取用户信息
  const userInfo = event.userInfo || {};
  const nickName = userInfo.nickName;
  const avatarUrl = userInfo.avatarUrl;
  
  console.log('login云函数开始执行，用户openid:', openid);
  console.log('用户信息:', userInfo);
  
  try {
    // 查询用户是否存在
    console.log('正在查询用户是否存在...');
    const userResult = await usersCollection.where({
      openid: openid
    }).get();
    
    // 用户存在，更新用户信息并返回
    if (userResult.data && userResult.data.length > 0) {
      const userData = userResult.data[0];
      console.log('用户存在:', userData);
      
      // 如果有新的用户信息，则更新
      if (nickName || avatarUrl) {
        console.log('更新用户信息:', nickName, avatarUrl);
        const updateData = {
          updatedAt: Date.now()
        };
        
        if (nickName) {
          updateData.nickName = nickName;
        }
        
        if (avatarUrl) {
          updateData.avatarUrl = avatarUrl;
        }
        
        await usersCollection.doc(userData._id).update({
          data: updateData
        });
        
        // 更新本地userData以返回最新信息
        if (nickName) userData.nickName = nickName;
        if (avatarUrl) userData.avatarUrl = avatarUrl;
      }
      
      return {
        code: 0,
        msg: '登录成功',
        openid: openid,
        role: userData.role || 'beautician',
        remainingUsage: userData.remainingUsage || 0,
        nickName: userData.nickName || '',
        avatarUrl: userData.avatarUrl || '',
        _id: userData._id
      };
    } 
    // 用户不存在，创建新用户
    else {
      console.log('用户不存在，正在创建新用户...');
      const timestamp = Date.now();
      const newUser = {
        openid: openid,
        role: 'beautician', // 默认角色为美容师
        remainingUsage: 5, // 默认赠送5次使用机会
        createdAt: timestamp,
        updatedAt: timestamp
      };
      
      // 添加用户信息
      if (nickName) {
        newUser.nickName = nickName;
      }
      
      if (avatarUrl) {
        newUser.avatarUrl = avatarUrl;
      }
      
      try {
        console.log('添加用户到数据库:', newUser);
        const addResult = await usersCollection.add({
          data: newUser
        });
        
        console.log('用户创建成功:', addResult);
        
        return {
          code: 0,
          msg: '注册成功',
          openid: openid,
          role: 'beautician',
          remainingUsage: 5,
          nickName: nickName || '',
          avatarUrl: avatarUrl || '',
          _id: addResult._id
        };
      } catch (addError) {
        console.error('创建用户失败:', addError);
        return {
          code: -1,
          msg: '创建用户失败，请重试',
          error: addError.message || addError
        };
      }
    }
  } catch (error) {
    console.error('登录出错:', error);
    return {
      code: -1,
      msg: '登录失败，请重试',
      error: error.message || error
    };
  }
}; 