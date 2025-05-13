// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const userCollection = db.collection('users')

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  if (!openid) {
    return {
      code: 1,
      msg: '未获取到用户身份信息',
      data: null
    }
  }

  try {
    // 需要更新的用户字段
    const updateData = {}
    
    // 只有当传入了有效值时才更新相应字段
    if (event.avatarUrl) {
      updateData.avatarUrl = event.avatarUrl
    }
    
    if (event.nickName) {
      updateData.nickName = event.nickName
    }
    
    // 添加更新时间
    updateData.updatedAt = db.serverDate()
    
    // 更新用户数据
    const res = await userCollection.where({
      openid: openid
    }).update({
      data: updateData
    })
    
    return {
      code: 0,
      msg: '更新用户资料成功',
      data: {
        updated: res.stats.updated
      }
    }
  } catch (err) {
    console.error('更新用户资料失败', err)
    return {
      code: 2,
      msg: '更新用户资料失败: ' + err.message,
      data: null
    }
  }
} 