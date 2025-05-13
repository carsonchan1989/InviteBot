Page({
  data: {},

  onLoad: function (options) {
    // 页面加载时自动跳转到admin页面
    wx.switchTab({
      url: '/pages/admin/admin'
    });
  }
}) 