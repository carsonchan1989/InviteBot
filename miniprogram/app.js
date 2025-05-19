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
        env: "cloud1-5gr0cuqod1d81d0f",
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
      // 如果获取用户信息失败，并且不是因为网络原因，则认为用户未登录
      if (err.errCode !== -1) {
        this.globalData.isNewUser = true;
      }
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
      
      // 检查头像URL是否为云文件ID格式，如果不是则可能是临时链接，需要刷新用户信息
      if (userInfo.avatarUrl && !userInfo.avatarUrl.startsWith('cloud://')) {
        console.log('检测到头像可能是临时链接，将在启动时刷新用户信息');
        this.globalData.needRefreshUserInfo = true;
      }
    } else {
      // 本地没有用户信息，标记为新用户
      this.globalData.isNewUser = true;
      console.log('本地没有用户信息，可能是新用户');
    }
  },
  
  // 获取用户信息和剩余使用次数
  getUserInfo: function() {
    return new Promise((resolve, reject) => {
      // 如果是新用户且没有本地用户信息，直接返回错误
      if (this.globalData.isNewUser && !this.globalData.userInfo) {
        console.log('新用户需要先登录');
        reject({errCode: -100, errMsg: '用户未登录'});
        return;
      }

      wx.cloud.callFunction({
        name: 'getUser',
        success: res => {
          console.log('[云函数] [getUser] 调用成功', res);
          if (res.result && res.result.code === 0) {
            const userData = res.result.data;
            
            // 更新全局数据
            this.globalData.remainingUsage = userData.remainingUsage || 0;
            this.globalData.role = userData.role || 'beautician';
            this.globalData.isNewUser = false;
            
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
              
              // 测试头像URL是否有效
              if (userData.avatarUrl.startsWith('cloud://') || userData.avatarUrl.startsWith('http')) {
                this.testImageUrl(userData.avatarUrl);
              }
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
            // 如果返回用户不存在的错误，标记为新用户
            if (res.result && res.result.code === -1 && res.result.msg === '用户不存在，请重新登录') {
              this.globalData.isNewUser = true;
              wx.removeStorageSync('userInfo');
              this.globalData.userInfo = null;
              this.globalData.isLoggedIn = false;
            }
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

  // 测试图片URL是否有效
  testImageUrl: function(url) {
    // 对于云存储文件，不需要测试，直接返回
    if (url.startsWith('cloud://')) {
      console.log('云存储图片无需测试有效性:', url);
      return;
    }
    
    console.log('测试头像URL是否有效:', url);
    wx.getImageInfo({
      src: url,
      success: res => {
        console.log('头像URL有效:', res);
      },
      fail: err => {
        console.error('头像URL无效，将使用默认头像:', err);
        // 如果头像无效，可以设置为默认头像
        this.globalData.userInfo.avatarUrl = '/images/tabbar/my.png';
        wx.setStorageSync('userInfo', this.globalData.userInfo);
      }
    });
  },

  // 全局数据
  globalData: {
    userInfo: null,
    isLoggedIn: false,
    isNewUser: false,  // 标记是否为新用户
    role: '', // admin或beautician
    remainingUsage: 0, // 剩余使用次数
    tempInviteInfo: null, // 临时存储邀约信息
    tempScriptData: null, // 临时存储生成的话术数据
    isAppReady: false,
    needRefreshUserInfo: false // 标记是否需要刷新用户信息
  }
});
