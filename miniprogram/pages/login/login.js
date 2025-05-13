Page({
  data: {
    isLoading: false,
    hasUserAgreed: false  // 用户是否同意授权
  },

  onLoad: function(options) {
    // 检查是否已经登录，如果已登录则直接跳转到首页
    const app = getApp();
    if (app.globalData.isLoggedIn) {
      this.redirectToIndex();
    }
  },

  // 切换用户同意状态
  toggleAgreement: function() {
    this.setData({
      hasUserAgreed: !this.data.hasUserAgreed
    });
  },

  // 用户登录
  login: function() {
    // 检查用户是否同意授权
    if (!this.data.hasUserAgreed) {
      wx.showToast({
        title: '请先同意授权获取头像和昵称',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    const that = this;
    if (this.data.isLoading) return;
    
    // 设置加载状态
    this.setData({ isLoading: true });

    // 显示加载中
    wx.showLoading({
      title: '登录中...',
      mask: true
    });

    // 先获取用户信息
    wx.getUserProfile({
      desc: '用于完善会员资料', // 简短而描述准确的提示
      success: (userRes) => {
        console.log('获取用户信息成功', userRes);
        const userInfo = userRes.userInfo;
        
        // 调用云函数进行登录，并传递用户信息
        wx.cloud.callFunction({
          name: 'login',
          data: {
            userInfo: userInfo
          },
          success: res => {
            console.log('[云函数] [login] 调用成功', res);
            // 添加更多详细日志
            console.log('返回结果详情:', JSON.stringify(res.result));
            
            if (res.result && res.result.code === 0) {
              const { openid, role, remainingUsage, nickName, avatarUrl } = res.result;
              
              console.log('登录成功，用户角色:', role, '剩余使用次数:', remainingUsage);
              
              // 更新全局数据
              const app = getApp();
              app.globalData.userInfo = {
                openid: openid,
                role: role || 'beautician', // 默认为美容师角色
                nickName: nickName,
                avatarUrl: avatarUrl
              };
              app.globalData.isLoggedIn = true;
              app.globalData.role = role || 'beautician';
              app.globalData.remainingUsage = remainingUsage || 0;

              // 保存到本地
              wx.setStorageSync('userInfo', app.globalData.userInfo);

              // 显示成功提示
              wx.showToast({
                title: '登录成功',
                icon: 'success',
                duration: 1500
              });

              // 延迟跳转，让用户看到成功提示
              setTimeout(() => {
                this.redirectToIndex();
              }, 1500);
            } else {
              // 登录失败处理
              const errMsg = res.result ? res.result.msg : '登录失败，请重试';
              console.error('登录失败:', errMsg);
              wx.showToast({
                title: errMsg,
                icon: 'none',
                duration: 2000
              });
            }
          },
          fail: err => {
            console.error('[云函数] [login] 调用失败', err);
            wx.showToast({
              title: '登录失败: ' + (err.errMsg || '请重试'),
              icon: 'none',
              duration: 2000
            });
          },
          complete: () => {
            this.setData({ isLoading: false });
            wx.hideLoading();
          }
        });
      },
      fail: (err) => {
        console.error('获取用户信息失败', err);
        wx.showToast({
          title: '获取用户信息失败: ' + (err.errMsg || '请允许授权'),
          icon: 'none',
          duration: 2000
        });
        this.setData({ isLoading: false });
        wx.hideLoading();
      }
    });
  },

  // 跳转到首页
  redirectToIndex: function() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  },

  // 显示隐私政策
  showPrivacyPolicy: function() {
    wx.showModal({
      title: '隐私政策',
      content: '本应用尊重并保护所有使用服务用户的个人隐私权。为了给您提供更准确、更有个性化的服务，本应用会按照本隐私权政策的规定使用和披露您的个人信息。',
      showCancel: false
    });
  },

  // 显示用户协议
  showUserAgreement: function() {
    wx.showModal({
      title: '用户协议',
      content: '欢迎您使用美容师邀约话术生成器小程序。在使用本服务前，请您务必仔细阅读并透彻理解本协议，特别是免除或者限制责任的条款以及开通或使用某项服务的单独协议。',
      showCancel: false
    });
  }
}); 