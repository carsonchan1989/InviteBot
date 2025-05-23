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

    // 获取本地存储的用户信息，但每次都强制从服务器刷新一次
    this.getGlobalUserInfo();
    
    // 应用启动时强制从服务器获取用户最新信息
    this.getUserInfo(true).then(userInfo => {
      console.log('应用启动完成，用户信息:', userInfo);
      this.globalData.isAppReady = true;
    }).catch(err => {
      console.error('获取用户信息失败:', err);
      this.globalData.isAppReady = true;
      
      // 检查错误信息，判断是否是"用户不存在"
      if (err && err.result && err.result.msg === '用户不存在，请重新登录') {
        console.log('用户不存在，标记为新用户');
        this.globalData.isNewUser = true;
        this.globalData.isLoggedIn = false;
        wx.removeStorageSync('userInfo');
      }
      // 如果获取用户信息失败，并且不是因为网络原因，则认为用户未登录
      else if (err.errCode !== -1) {
        console.log('登录状态异常，标记为新用户');
        this.globalData.isNewUser = true;
        this.globalData.isLoggedIn = false;
      }
    });
  },

  // 获取用户信息并保存到全局
  getGlobalUserInfo: function() {
    // 获取本地存储的用户信息
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo && userInfo.openid) {
      this.globalData.userInfo = userInfo;
      this.globalData.isLoggedIn = true;
      this.globalData.role = userInfo.role || 'beautician';
      console.log('从本地存储获取用户信息:', userInfo);
      
      // 始终在启动时刷新用户信息，确保头像等数据最新
      this.globalData.needRefreshUserInfo = true;
    } else {
      // 本地没有用户信息，标记为新用户
      this.globalData.isNewUser = true;
      this.globalData.isLoggedIn = false;
      console.log('本地没有用户信息，可能是新用户');
    }
  },
  
  // 获取用户信息和剩余使用次数
  getUserInfo: function(forceRefresh = false) {
    return new Promise((resolve, reject) => {
      // 如果是新用户且没有本地用户信息，直接返回错误
      if (this.globalData.isNewUser && !this.globalData.userInfo && !forceRefresh) {
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
            this.globalData.isLoggedIn = true;
            
            // 更新用户信息
            if (!this.globalData.userInfo) {
              this.globalData.userInfo = {
                openid: userData.openid,
                _id: userData._id,
                role: userData.role || 'beautician'
              };
            } else {
              // 确保_id字段存在
              this.globalData.userInfo._id = userData._id;
            }
            
            // 更新头像和昵称
            if (userData.avatarUrl) {
              this.globalData.userInfo.avatarUrl = userData.avatarUrl;
              
              // 如果是云存储路径，获取临时访问链接
              if (userData.avatarUrl.startsWith('cloud://')) {
                wx.cloud.getTempFileURL({
                  fileList: [userData.avatarUrl],
                  success: res => {
                    if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
                      console.log('获取到头像临时链接:', res.fileList[0].tempFileURL);
                      this.globalData.userInfo.tempAvatarUrl = res.fileList[0].tempFileURL;
                      // 保存到本地
                      wx.setStorageSync('userInfo', this.globalData.userInfo);
                    }
                  },
                  fail: err => {
                    console.error('获取头像临时链接失败:', err);
                  }
                });
              } else {
                // 如果不是云存储路径，将头像上传到云存储
                this.uploadAndUpdateAvatar(userData.avatarUrl);
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
            console.log('获取用户信息失败:', res.result);
            // 如果返回用户不存在的错误，标记为新用户
            if (res.result && res.result.code === -1 && res.result.msg === '用户不存在，请重新登录') {
              this.globalData.isNewUser = true;
              this.globalData.isLoggedIn = false;
              wx.removeStorageSync('userInfo');
              this.globalData.userInfo = null;
            }
            reject(res);
          }
        },
        fail: err => {
          console.error('[云函数] [getUser] 调用失败', err);
          // 网络错误时不要清除本地登录状态
          if (err.errCode !== -1) {
            this.globalData.isLoggedIn = false;
          }
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
        // 如果头像无效，使用默认头像
        this.globalData.userInfo.avatarUrl = '/images/tabbar/my.png';
        wx.setStorageSync('userInfo', this.globalData.userInfo);
      }
    });
  },

  // 上传头像到云存储并更新用户资料
  uploadAndUpdateAvatar: function(avatarUrl) {
    // 如果是本地文件路径或http(s)链接
    if (avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('wxfile://') || avatarUrl.startsWith('/tmp'))) {
      console.log('检测到非云存储头像，准备上传到云存储:', avatarUrl);
      
      // 对于网络图片，先下载到本地临时文件
      if (avatarUrl.startsWith('http')) {
        wx.downloadFile({
          url: avatarUrl,
          success: res => {
            if (res.statusCode === 200) {
              this.uploadAvatarToCloud(res.tempFilePath);
            } else {
              console.error('下载头像失败', res);
              this.globalData.userInfo.avatarUrl = '/images/tabbar/my.png';
              wx.setStorageSync('userInfo', this.globalData.userInfo);
            }
          },
          fail: err => {
            console.error('下载头像失败', err);
            this.globalData.userInfo.avatarUrl = '/images/tabbar/my.png';
            wx.setStorageSync('userInfo', this.globalData.userInfo);
          }
        });
      } else {
        // 直接上传本地文件
        this.uploadAvatarToCloud(avatarUrl);
      }
    } else {
      // 如果都不是，使用默认头像
      console.log('无法识别的头像URL格式，使用默认头像');
      this.globalData.userInfo.avatarUrl = '/images/tabbar/my.png';
      wx.setStorageSync('userInfo', this.globalData.userInfo);
    }
  },

  // 上传头像到云存储
  uploadAvatarToCloud: function(filePath) {
    const cloudPath = `avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`;
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: res => {
        console.log('头像上传云存储成功，fileID:', res.fileID);
        
        // 更新用户资料中的头像为云存储路径
        wx.cloud.callFunction({
          name: 'updateUserProfile',
          data: {
            avatarUrl: res.fileID
          },
          success: updateRes => {
            console.log('用户头像更新成功:', updateRes);
            
            // 更新全局数据和本地存储
            this.globalData.userInfo.avatarUrl = res.fileID;
            
            // 获取临时访问链接
            wx.cloud.getTempFileURL({
              fileList: [res.fileID],
              success: tempRes => {
                if (tempRes.fileList && tempRes.fileList[0] && tempRes.fileList[0].tempFileURL) {
                  this.globalData.userInfo.tempAvatarUrl = tempRes.fileList[0].tempFileURL;
                }
                // 保存到本地
                wx.setStorageSync('userInfo', this.globalData.userInfo);
              }
            });
          },
          fail: err => {
            console.error('更新用户头像失败:', err);
          }
        });
      },
      fail: err => {
        console.error('上传头像到云存储失败:', err);
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
