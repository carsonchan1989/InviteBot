// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const historyCollection = db.collection('histories');
const usersCollection = db.collection('users');
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { page = 1, pageSize = 10 } = event;
  
  console.log('getHistory云函数开始执行，参数:', event);
  
  try {
    // 查询是否是管理员
    const userResult = await usersCollection.where({
      openid: openid
    }).get();
    
    if (!userResult.data || userResult.data.length === 0) {
      return {
        code: -1,
        msg: '用户不存在',
        data: null
      };
    }
    
    const user = userResult.data[0];
    const isAdmin = user.role === 'admin';
    
    // 构建查询条件 - 管理员可以查看所有历史，普通用户只能查看自己的
    let query = {};
    if (!isAdmin) {
      query.openid = openid;
    }
    
    // 计算分页
    const skip = (page - 1) * pageSize;
    
    // 查询总数
    const countResult = await historyCollection.where(query).count();
    const total = countResult.total;
    
    // 查询列表
    const historyResult = await historyCollection
      .where(query)
      .orderBy('createdAt', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();
    
    // 如果是管理员，获取用户信息来展示用户名称
    let historyList = historyResult.data;
    
    if (isAdmin && historyList.length > 0) {
      // 提取所有用户ID
      const userIds = [...new Set(historyList.map(item => item.openid))];
      
      // 批量查询用户信息
      const userInfos = {};
      for (const uid of userIds) {
        const userInfo = await usersCollection.where({
          openid: uid
        }).get();
        
        if (userInfo.data && userInfo.data.length > 0) {
          userInfos[uid] = userInfo.data[0];
        }
      }
      
      // 为每条历史添加用户信息
      historyList = historyList.map(item => {
        const userInfo = userInfos[item.openid];
        return {
          ...item,
          userName: userInfo ? (userInfo.nickName || '未命名用户') : '未知用户'
        };
      });
    }
    
    return {
      code: 0,
      msg: '获取成功',
      data: {
        list: historyList,
        pagination: {
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          totalPages: Math.ceil(total / pageSize)
        },
        isAdmin
      }
    };
  } catch (error) {
    console.error('getHistory云函数执行出错:', error);
    return {
      code: -1,
      msg: '获取历史记录失败',
      error: error.message
    };
  }
}; 