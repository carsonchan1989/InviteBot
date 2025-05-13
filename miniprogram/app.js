// app.js

App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        // env 参数说明：
        //   env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会默认请求到哪个云环境的资源
        //   此处请填入环境 ID, 环境 ID 可打开云控制台查看
        //   如不填则使用默认环境（第一个创建的环境）
        env: "cloud1-3gb7yftx2e6266de",
        traceUser: true,
      });
    }

    // 获取用户信息
    this.getGlobalUserInfo();
    
    // 应用启动时获取用户剩余使用次数
    this.getUserRemainingUsage();
  },

  // 获取用户信息并保存到全局
  getGlobalUserInfo: function() {
    // 获取本地存储的用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.isLoggedIn = true;
    }
  },
  
  // 获取用户剩余使用次数
  getUserRemainingUsage: function() {
    wx.cloud.callFunction({
      name: 'getUser',
      success: res => {
        console.log('[云函数] [getUser] 调用成功', res);
        if (res.result && res.result.code === 0) {
          this.globalData.remainingUsage = res.result.data.remainingUsage || 0;
          console.log('获取到用户剩余使用次数:', this.globalData.remainingUsage);
        } else {
          console.log('获取用户信息失败:', res);
        }
      },
      fail: err => {
        console.error('[云函数] [getUser] 调用失败', err);
      }
    });
  },

  // 全局数据
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    role: '', // admin或beautician
    remainingUsage: 0, // 剩余使用次数
    tempInviteInfo: null, // 临时存储邀约信息
    tempScriptData: null // 临时存储生成的话术数据
  }
});
