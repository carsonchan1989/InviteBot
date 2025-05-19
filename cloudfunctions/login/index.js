// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({  env: "cloud1-5gr0cuqod1d81d0f"});

const db = cloud.database();
const usersCollection = db.collection('users');

// 初始化数据库集合
async function initCollections() {
  try {
    console.log('开始初始化数据库集合...');
    // 检查集合是否存在，如不存在则创建
    try {
      await db.createCollection('users');
      console.log('users集合创建成功');
    } catch (err) {
      // 如果集合已存在，会报错，这是正常的
      console.log('users集合已存在或创建失败:', err.message);
    }
  } catch (error) {
    console.error('初始化数据库集合失败:', error);
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  // 先初始化集合
  await initCollections();
  
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