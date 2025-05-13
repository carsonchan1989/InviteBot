// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const usersCollection = db.collection('users');

// 初始化数据库集合
async function initCollections() {
  try {
    console.log('开始初始化数据库集合...');
    const collections = ['users', 'projects', 'categories', 'histories', 'tasks'];
    
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
          }
        } else {
          console.error(`检查集合 ${collName} 时出错:`, err);
        }
      }
    }
    console.log('数据库集合初始化完成');
  } catch (error) {
    console.error('初始化数据库集合失败:', error);
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  // 先初始化数据库集合
  await initCollections();
  
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  const { action, userId, data } = event;
  
  // 根据action参数处理不同请求
  try {
    switch (action) {
      case 'getUsers':
        const { page, pageSize, searchValue, sortBy, sortOrder, filterRole } = event;
        return await getUsers(page, pageSize, searchValue, sortBy, sortOrder, filterRole);
      case 'getUser':
        return await getUser(userId);
      case 'addUser':
        return await addUser(data);
      case 'updateUser':
        return await updateUser(userId, data);
      case 'deleteUser':
        return await deleteUser(userId);
      case 'addUsageCount':
        return await addUsageCount(userId, data.count);
      case 'getStatistics':
        console.log('获取统计数据...');
        return await getStatistics();
      default:
        return {
          code: -1,
          msg: `未知操作: ${action}`
        };
    }
  } catch (error) {
    console.error(`执行操作 ${action} 时出错:`, error);
    return {
      code: -1,
      msg: `执行操作失败: ${error.message || error}`
    };
  }
};

// 获取统计数据
async function getStatistics() {
  try {
    const usersResult = await usersCollection.count();
    const totalUsers = usersResult.total || 0;
    
    // 活跃用户（30天内有登录记录的用户）
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const activeUsersResult = await usersCollection.where({
      lastLoginTime: db.command.gt(thirtyDaysAgo)
    }).count();
    const activeUsers = activeUsersResult.total || 0;
    
    // 总生成次数
    const historiesCollection = db.collection('histories');
    const historiesResult = await historiesCollection.count();
    const totalGenerated = historiesResult.total || 0;
    
    return {
      code: 0,
      msg: '获取统计数据成功',
      data: {
        totalUsers,
        activeUsers,
        totalGenerated
      }
    };
  } catch (error) {
    console.error('获取统计数据失败:', error);
    return {
      code: -1,
      msg: '获取统计数据失败: ' + error.message
    };
  }
}

// 获取用户列表
async function getUsers(page = 1, pageSize = 10, searchValue = '', sortBy = 'createdAt', sortOrder = 'desc', filterRole = '') {
  try {
    // 构建查询条件
    let query = usersCollection;
    
    // 添加搜索条件
    if (searchValue) {
      // 模糊搜索，可以根据openid、昵称等字段
      query = query.where(db.command.or([
        {
          nickName: db.RegExp({
            regexp: searchValue,
            options: 'i'
          })
        },
        {
          openid: db.RegExp({
            regexp: searchValue,
            options: 'i'
          })
        }
      ]));
    }
    
    // 添加角色过滤
    if (filterRole) {
      query = query.where({
        role: filterRole
      });
    }
    
    // 获取总数
    const countResult = await query.count();
    const total = countResult.total;
    
    // 计算总页数
    const totalPages = Math.ceil(total / pageSize);
    
    // 添加排序
    const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';
    query = query.orderBy(sortBy, sortDirection);
    
    // 分页
    const users = await query
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();
    
    return {
      code: 0,
      msg: '获取用户列表成功',
      data: {
        users: users.data,
        total,
        currentPage: page,
        pageSize,
        totalPages
      }
    };
  } catch (error) {
    console.error('获取用户列表失败:', error);
    return {
      code: -1,
      msg: '获取用户列表失败: ' + error.message
    };
  }
}

// 更新用户信息
async function updateUser(userId, data) {
  try {
    await usersCollection.doc(userId).update({
      data: {
        ...data,
        updatedAt: Date.now()
      }
    });
    
    return {
      code: 0,
      msg: '更新成功'
    };
  } catch (error) {
    console.error('更新用户信息失败:', error);
    return {
      code: -1,
      msg: '更新用户信息失败',
      error: error
    };
  }
}

// 删除用户
async function deleteUser(userId) {
  try {
    await usersCollection.doc(userId).remove();
    
    return {
      code: 0,
      msg: '删除成功'
    };
  } catch (error) {
    console.error('删除用户失败:', error);
    return {
      code: -1,
      msg: '删除用户失败',
      error: error
    };
  }
}

// 增加使用次数
async function addUsageCount(userId, count) {
  if (!count || count <= 0) {
    return {
      code: -1,
      msg: '增加次数必须大于0'
    };
  }
  
  try {
    // 获取当前用户信息
    const userResult = await usersCollection.doc(userId).get();
    if (!userResult.data) {
      return {
        code: -1,
        msg: '用户不存在'
      };
    }
    
    const currentCount = userResult.data.remainingUsage || 0;
    
    // 更新使用次数
    await usersCollection.doc(userId).update({
      data: {
        remainingUsage: currentCount + count,
        updatedAt: Date.now()
      }
    });
    
    return {
      code: 0,
      msg: '增加次数成功',
      data: {
        oldCount: currentCount,
        addedCount: count,
        newCount: currentCount + count
      }
    };
  } catch (error) {
    console.error('增加使用次数失败:', error);
    return {
      code: -1,
      msg: '增加使用次数失败',
      error: error
    };
  }
} 