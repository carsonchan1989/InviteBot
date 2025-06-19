// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({ env: "cloud1-5gr0cuqod1d81d0f" });

const db = cloud.database();
const snapshotsCollection = db.collection('snapshots');
const usersCollection = db.collection('users');

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  console.log('manageSnapshots云函数，操作类型:', event.action);

  // 确保集合存在
  try {
    // 尝试创建集合（如果已存在则会报错，但我们会捕获这个错误）
    await db.createCollection('snapshots');
    console.log('成功创建snapshots集合');
  } catch (err) {
    // 如果集合已存在，会抛出错误，这是预期行为，我们可以忽略
    console.log('snapshots集合已存在或创建失败:', err);
  }

  switch (event.action) {
    case 'saveSnapshot':
      return await saveSnapshot(event.data, openid);
    case 'getSnapshot':
      return await getSnapshot(event.snapshotId, openid);
    default:
      return {
        code: -1,
        msg: '未知操作类型'
      };
  }
};

// 保存快照到数据库
async function saveSnapshot(data, openid) {
  try {
    // 验证数据完整性
    if (!data || !data.scriptList || !data.inviteInfo) {
      return {
        code: -1,
        msg: '快照数据不完整'
      };
    }
    
    // 查询用户信息
    const userResult = await usersCollection.where({ openid: openid }).get();
    let userInfo = null;
    if (userResult.data && userResult.data.length > 0) {
      userInfo = {
        nickName: userResult.data[0].nickName || '',
        avatarUrl: userResult.data[0].avatarUrl || ''
      };
    }
    
    // 保存快照数据
    const result = await snapshotsCollection.add({
      data: {
        scriptList: data.scriptList,
        inviteInfo: data.inviteInfo,
        createdBy: openid,
        userInfo: userInfo,
        createTime: db.serverDate(),
        viewCount: 0 // 查看次数，初始为0
      }
    });
    
    if (result._id) {
      return {
        code: 0,
        msg: '保存快照成功',
        data: {
          snapshotId: result._id
        }
      };
    } else {
      return {
        code: -1,
        msg: '保存快照失败'
      };
    }
  } catch (error) {
    console.error('保存快照出错:', error);
    return {
      code: -1,
      msg: '保存快照出错: ' + error.message,
      error: error
    };
  }
}

// 获取快照数据
async function getSnapshot(snapshotId, openid) {
  try {
    if (!snapshotId) {
      return {
        code: -1,
        msg: '快照ID不能为空'
      };
    }
    
    // 查询快照数据
    const snapshot = await snapshotsCollection.doc(snapshotId).get();
    
    if (!snapshot.data) {
      return {
        code: -1,
        msg: '快照不存在或已被删除'
      };
    }
    
    // 更新查看次数
    await snapshotsCollection.doc(snapshotId).update({
      data: {
        viewCount: db.command.inc(1)
      }
    });
    
    // 检查用户登录状态
    const userResult = await usersCollection.where({ openid: openid }).get();
    const isRegistered = userResult.data && userResult.data.length > 0;
    
    return {
      code: 0,
      msg: '获取快照成功',
      data: snapshot.data,
      isRegistered: isRegistered
    };
  } catch (error) {
    console.error('获取快照出错:', error);
    return {
      code: -1,
      msg: '获取快照出错: ' + error.message,
      error: error
    };
  }
} 