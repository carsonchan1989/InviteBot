// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const codesCollection = db.collection('invitation_codes');
const usersCollection = db.collection('users');
const _ = db.command;

// 生成随机邀请码
function generateRandomCode(length = 8) {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除容易混淆的字符
  let code = '';
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { action } = event;
  
  console.log('manageInvitationCodes云函数开始执行，操作类型:', action);
  
  try {
    // 确保集合存在
    try {
      await db.createCollection('invitation_codes');
      console.log('invitation_codes集合创建成功');
    } catch (err) {
      console.log('invitation_codes集合已存在或创建失败:', err);
    }

    // 根据操作类型执行不同的功能
    switch (action) {
      case 'generateCode':
        return await generateInvitationCode(event, wxContext);
      case 'getCodesList':
        return await getInvitationCodesList(event, wxContext);
      case 'deleteCode':
        return await deleteInvitationCode(event, wxContext);
      case 'redeemCode':
        return await redeemInvitationCode(event, wxContext);
      default:
        return {
          code: -1,
          msg: '未知的操作类型',
          data: null
        };
    }
  } catch (error) {
    console.error('manageInvitationCodes云函数执行出错:', error);
    return {
      code: -1,
      msg: '操作失败，请重试',
      error: error.message
    };
  }
};

// 生成邀请码
async function generateInvitationCode(event, wxContext) {
  const { usageCount = 10 } = event;
  const adminId = wxContext.OPENID;
  
  // 检查权限 - 必须是管理员
  const adminUser = await usersCollection.where({
    openid: adminId,
    role: 'admin'
  }).get();
  
  if (!adminUser.data || adminUser.data.length === 0) {
    return {
      code: -1,
      msg: '权限不足，仅管理员可生成邀请码',
      data: null
    };
  }
  
  // 生成唯一的邀请码
  let code;
  let isUnique = false;
  
  while (!isUnique) {
    code = generateRandomCode(8);
    
    // 检查是否已存在
    const existingCode = await codesCollection.where({
      code: code
    }).get();
    
    if (existingCode.data.length === 0) {
      isUnique = true;
    }
  }
  
  // 保存到数据库
  const now = new Date();
  const codeData = {
    code: code,
    usageCount: parseInt(usageCount) || 5,
    isUsed: false,
    createdBy: adminId,
    createdAt: now,
    redeemedBy: null,
    redeemedAt: null
  };
  
  const result = await codesCollection.add({
    data: codeData
  });
  
  if (result._id) {
    return {
      code: 0,
      msg: '邀请码生成成功',
      data: {
        ...codeData,
        _id: result._id
      }
    };
  } else {
    return {
      code: -1,
      msg: '邀请码生成失败',
      data: null
    };
  }
}

// 获取邀请码列表
async function getInvitationCodesList(event, wxContext) {
  const { page = 1, pageSize = 10 } = event;
  const adminId = wxContext.OPENID;
  
  // 检查权限 - 必须是管理员
  const adminUser = await usersCollection.where({
    openid: adminId,
    role: 'admin'
  }).get();
  
  if (!adminUser.data || adminUser.data.length === 0) {
    return {
      code: -1,
      msg: '权限不足，仅管理员可查看邀请码列表',
      data: null
    };
  }
  
  // 计算分页
  const skip = (page - 1) * pageSize;
  
  // 查询总数
  const countResult = await codesCollection.count();
  const total = countResult.total;
  
  // 查询列表
  const listResult = await codesCollection
    .orderBy('createdAt', 'desc')
    .skip(skip)
    .limit(pageSize)
    .get();
  
  // 返回结果
  return {
    code: 0,
    msg: '查询成功',
    data: {
      list: listResult.data,
      pagination: {
        total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        pages: Math.ceil(total / pageSize)
      }
    }
  };
}

// 删除邀请码
async function deleteInvitationCode(event, wxContext) {
  const { codeId } = event;
  const adminId = wxContext.OPENID;
  
  // 检查权限 - 必须是管理员
  const adminUser = await usersCollection.where({
    openid: adminId,
    role: 'admin'
  }).get();
  
  if (!adminUser.data || adminUser.data.length === 0) {
    return {
      code: -1,
      msg: '权限不足，仅管理员可删除邀请码',
      data: null
    };
  }
  
  // 检查邀请码是否存在
  const codeResult = await codesCollection.doc(codeId).get();
  
  if (!codeResult.data) {
    return {
      code: -1,
      msg: '邀请码不存在',
      data: null
    };
  }
  
  // 如果邀请码已被使用，不允许删除
  if (codeResult.data.isUsed) {
    return {
      code: -1,
      msg: '邀请码已被使用，无法删除',
      data: null
    };
  }
  
  // 删除邀请码
  await codesCollection.doc(codeId).remove();
  
  return {
    code: 0,
    msg: '邀请码删除成功',
    data: null
  };
}

// 兑换邀请码
async function redeemInvitationCode(event, wxContext) {
  const { code } = event;
  const userId = wxContext.OPENID;
  
  // 检查用户是否存在
  const userResult = await usersCollection.where({
    openid: userId
  }).get();
  
  if (!userResult.data || userResult.data.length === 0) {
    return {
      code: -1,
      msg: '用户不存在',
      data: null
    };
  }
  
  const user = userResult.data[0];
  
  // 检查邀请码是否存在且有效
  const codeResult = await codesCollection.where({
    code: code,
    isUsed: false
  }).get();
  
  if (!codeResult.data || codeResult.data.length === 0) {
    return {
      code: -1,
      msg: '邀请码无效或已被使用',
      data: null
    };
  }
  
  const invitationCode = codeResult.data[0];
  const usageCount = invitationCode.usageCount || 10;
  
  // 使用邀请码 - 更新邀请码状态
  const now = new Date();
  await codesCollection.doc(invitationCode._id).update({
    data: {
      isUsed: true,
      redeemedBy: userId,
      redeemedAt: now
    }
  });
  
  // 更新用户使用次数
  const currentUsage = user.remainingUsage || 0;
  const newUsage = currentUsage + usageCount;
  
  await usersCollection.doc(user._id).update({
    data: {
      remainingUsage: newUsage
    }
  });
  
  // 记录兑换记录
  const redeemLogCollection = db.collection('redeem_logs');
  try {
    await db.createCollection('redeem_logs');
  } catch (err) {
    console.log('redeem_logs集合已存在或创建失败:', err);
  }
  
  await redeemLogCollection.add({
    data: {
      userId,
      codeId: invitationCode._id,
      code: code,
      usageCount,
      redeemedAt: now
    }
  });
  
  return {
    code: 0,
    msg: '邀请码兑换成功',
    data: {
      addedUsage: usageCount,
      currentUsage: newUsage
    }
  };
} 