Page({
  data: {
    loading: true,
    totalUsers: 0,
    activeUsers: 0,
    totalGenerated: 0
  },

  onLoad: function(options) {
    this.fetchStatistics();
  },

  onPullDownRefresh: function() {
    this.fetchStatistics();
    wx.stopPullDownRefresh();
  },

  // 获取统计数据
  fetchStatistics: function() {
    var that = this;
    this.setData({ loading: true });

    // 调用云函数获取统计数据
    wx.cloud.callFunction({
      name: 'manageUsers',
      data: {
        action: 'getStatistics'
      },
      success: function(res) {
        console.log('[云函数] [manageUsers] 获取统计数据成功', res);
        
        if (res.result && res.result.code === 0) {
          var stats = res.result.data || {};
          
          that.setData({
            totalUsers: stats.totalUsers || 0,
            activeUsers: stats.activeUsers || 0,
            totalGenerated: stats.totalGenerated || 0,
            loading: false
          });
        } else {
          wx.showToast({
            title: res.result && res.result.msg ? res.result.msg : '获取统计数据失败',
            icon: 'none'
          });
          that.setData({ loading: false });
        }
      },
      fail: function(err) {
        console.error('[云函数] [manageUsers] 获取统计数据失败', err);
        wx.showToast({
          title: '获取统计数据失败',
          icon: 'none'
        });
        that.setData({ loading: false });
      }
    });
  }
}); 