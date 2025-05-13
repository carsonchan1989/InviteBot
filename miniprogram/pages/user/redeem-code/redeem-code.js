Page({
  data: {
    code: '',
    isLoading: false,
    redeemResult: null,
    showResult: false,
    remainingUsage: 0
  },

  onLoad: function (options) {
    this.getUserInfo();
  },

  // 获取用户信息
  getUserInfo: function () {
    const app = getApp();
    
    // 从全局数据中获取基本信息
    this.setData({
      remainingUsage: app.globalData.remainingUsage || 0
    });

    // 从数据库获取完整用户信息
    wx.cloud.callFunction({
      name: 'getUser',
      success: res => {
        console.log('[云函数] [getUser] 调用成功', res);
        
        if (res.result && res.result.code === 0) {
          const userData = res.result.data;
          
          this.setData({
            remainingUsage: userData.remainingUsage || 0
          });
          
          // 更新全局数据
          app.globalData.remainingUsage = userData.remainingUsage || 0;
        }
      },
      fail: err => {
        console.error('[云函数] [getUser] 调用失败', err);
      }
    });
  },

  // 输入框内容变化
  onCodeInput: function (e) {
    this.setData({
      code: e.detail.value.toUpperCase().trim()
    });
  },

  // 清空输入
  clearInput: function () {
    this.setData({
      code: ''
    });
  },

  // 使用邀请码
  redeemCode: function () {
    // 检查输入
    if (!this.data.code) {
      wx.showToast({
        title: '请输入邀请码',
        icon: 'none'
      });
      return;
    }

    if (this.data.isLoading) return;
    
    this.setData({
      isLoading: true
    });
    
    wx.showLoading({
      title: '兑换中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'manageInvitationCodes',
      data: {
        action: 'redeemCode',
        code: this.data.code
      },
      success: res => {
        console.log('[云函数] [manageInvitationCodes] 兑换邀请码', res);
        
        // 更新结果显示
        if (res.result && res.result.code === 0) {
          this.setData({
            redeemResult: {
              success: true,
              msg: '邀请码兑换成功',
              addedUsage: res.result.data.addedUsage,
              currentUsage: res.result.data.currentUsage
            },
            showResult: true,
            remainingUsage: res.result.data.currentUsage,
            code: ''
          });
          
          // 更新全局数据
          const app = getApp();
          app.globalData.remainingUsage = res.result.data.currentUsage;
        } else {
          this.setData({
            redeemResult: {
              success: false,
              msg: res.result.msg || '邀请码兑换失败'
            },
            showResult: true
          });
        }
      },
      fail: err => {
        console.error('[云函数] [manageInvitationCodes] 兑换邀请码失败', err);
        this.setData({
          redeemResult: {
            success: false,
            msg: '兑换失败，请重试'
          },
          showResult: true
        });
      },
      complete: () => {
        this.setData({
          isLoading: false
        });
        wx.hideLoading();
      }
    });
  },

  // 关闭结果提示
  closeResult: function () {
    this.setData({
      showResult: false,
      redeemResult: null
    });
  },

  // 返回我的页面
  goBack: function () {
    wx.navigateBack();
  }
}); 