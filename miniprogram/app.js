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
    
    // 应用启动时获取用户剩余使用次数和信息
    this.getUserInfo().then(userInfo => {
      console.log('应用启动完成，用户信息:', userInfo);
      this.globalData.isAppReady = true;
    }).catch(err => {
      console.error('获取用户信息失败:', err);
      this.globalData.isAppReady = true;
    });
  },

  // 获取用户信息并保存到全局
  getGlobalUserInfo: function() {
    // 获取本地存储的用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.isLoggedIn = true;
      this.globalData.role = userInfo.role || 'beautician';
      console.log('从本地存储获取用户信息:', userInfo);
    }
  },
  
  // 获取用户信息和剩余使用次数
  getUserInfo: function() {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'getUser',
        success: res => {
          console.log('[云函数] [getUser] 调用成功', res);
          if (res.result && res.result.code === 0) {
            const userData = res.result.data;
            
            // 更新全局数据
            this.globalData.remainingUsage = userData.remainingUsage || 0;
            this.globalData.role = userData.role || 'beautician';
            
            // 更新用户信息
            if (!this.globalData.userInfo) {
              this.globalData.userInfo = {
                openid: userData.openid,
                role: userData.role || 'beautician'
              };
              this.globalData.isLoggedIn = true;
            }
            
            // 更新头像和昵称
            if (userData.avatarUrl) {
              this.globalData.userInfo.avatarUrl = userData.avatarUrl;
            }
            
            if (userData.nickName) {
              this.globalData.userInfo.nickName = userData.nickName;
            }
            
            // 保存到本地
            wx.setStorageSync('userInfo', this.globalData.userInfo);
            
            console.log('获取到用户信息并更新全局数据:', userData);
            console.log('更新后的全局用户信息:', this.globalData.userInfo);
            
            resolve(this.globalData.userInfo);
          } else {
            console.log('获取用户信息失败:', res);
            reject(res);
          }
        },
        fail: err => {
          console.error('[云函数] [getUser] 调用失败', err);
          reject(err);
        }
      });
    });
  },

  // 全局数据
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    role: '', // admin或beautician
    remainingUsage: 0, // 剩余使用次数
    tempInviteInfo: null, // 临时存储邀约信息
    tempScriptData: null, // 临时存储生成的话术数据
    isAppReady: false
  }
});
