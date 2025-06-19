Page({
  data: {
    isLoading: false,
    hasUserAgreed: false,  // 用户是否同意授权头像昵称
    hasPrivacyAgreed: false, // 用户是否同意隐私政策
    avatarUrl: '/images/tabbar/my.png',  // 默认头像
    nickName: '',  // 用户昵称
    currentStep: 1,  // 当前步骤：1-选择头像昵称, 2-同意授权, 3-登录
    isRegistered: false,  // 是否已注册用户
    showSimpleLogin: false,  // 显示简化登录界面
    returnToSnapshot: false, // 是否在登录后返回快照页面
    pendingSnapshotId: '' // 等待查看的快照ID
  },

  onLoad: function(options) {
    console.log('login页面options:', options);
    
    // 检查是否需要返回快照页面
    if (options.returnToSnapshot) {
      const pendingSnapshotId = wx.getStorageSync('pendingSnapshotId') || '';
      console.log('登录后需要返回快照页面，快照ID:', pendingSnapshotId);
      
      this.setData({
        returnToSnapshot: true,
        pendingSnapshotId: pendingSnapshotId
      });
    }
    
    // 检查是否已经登录，如果已登录则直接跳转
    const app = getApp();
    if (app.globalData.isLoggedIn) {
      this.redirectAfterLogin();
      return;
    }

    // 检查是否已注册用户
    this.checkRegisteredUser();
  },

  // 检查是否已注册用户
  checkRegisteredUser: function() {
    wx.showLoading({
      title: '加载中...',
      mask: true
    });

    wx.cloud.callFunction({
      name: 'checkUser',
      success: res => {
        console.log('[云函数] [checkUser] 调用成功', res);
        
        if (res.result && res.result.code === 0) {
          const { isRegistered, userInfo } = res.result;
          
          if (isRegistered && userInfo) {
            // 已注册用户，设置用户信息并显示简化登录界面
            this.setData({
              isRegistered: true,
              showSimpleLogin: true,
              avatarUrl: userInfo.avatarUrl || '/images/tabbar/my.png',
              nickName: userInfo.nickName || '',
              hasUserAgreed: true,  // 已注册用户默认已同意头像昵称授权
              hasPrivacyAgreed: false // 隐私协议需要用户明确勾选，不能默认同意
            });
          } else {
            // 未注册用户，显示完整注册界面
            this.setData({
              isRegistered: false,
              showSimpleLogin: false
            });
          }
        }
        
        this.updateCurrentStep();
      },
      fail: err => {
        console.error('[云函数] [checkUser] 调用失败', err);
        // 调用失败，显示完整注册界面
        this.setData({
          isRegistered: false,
          showSimpleLogin: false
        });
        this.updateCurrentStep();
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 切换头像昵称授权同意状态
  toggleAgreement: function() {
    this.setData({
      hasUserAgreed: !this.data.hasUserAgreed
    });
    this.updateCurrentStep();
  },

  // 切换隐私政策同意状态
  togglePrivacyAgreement: function() {
    this.setData({
      hasPrivacyAgreed: !this.data.hasPrivacyAgreed
    });
    this.updateCurrentStep();
  },

  // 用户选择头像
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    
    console.log('用户选择了头像，路径:', avatarUrl);
    
    this.setData({
      avatarUrl,
    });
    
    // 提前检查头像格式
    if (avatarUrl && avatarUrl.startsWith('wxfile://')) {
      console.log('检测到wxfile://格式的头像，尝试转换');
      
      // 尝试转换为临时文件路径
      wx.compressImage({
        src: avatarUrl,
        quality: 80,
        success: (res) => {
          console.log('压缩头像成功，新路径:', res.tempFilePath);
          this.setData({
            avatarUrl: res.tempFilePath
          });
          wx.showToast({
            title: '头像已选择',
            icon: 'success',
            duration: 1500
          });
        },
        fail: (err) => {
          console.error('压缩头像失败:', err);
          // 继续使用原始路径
          wx.showToast({
            title: '头像已选择',
            icon: 'success',
            duration: 1500
          });
        }
      });
    } else {
      wx.showToast({
        title: '头像已选择',
        icon: 'success',
        duration: 1500
      });
    }
    
    this.updateCurrentStep();
  },

  // 用户输入昵称
  onInputNickname(e) {
    const nickName = e.detail.value;
    this.setData({
      nickName
    });
    this.updateCurrentStep();
  },

  // 更新当前步骤
  updateCurrentStep() {
    // 如果是已注册用户且显示简化登录，直接设置为步骤3
    if (this.data.isRegistered && this.data.showSimpleLogin) {
      this.setData({
        currentStep: 3
      });
      return;
    }

    let step = 1;
    if (this.data.avatarUrl && this.data.avatarUrl !== '/images/tabbar/my.png' && this.data.nickName) {
      step = 2;
      if (this.data.hasUserAgreed && this.data.hasPrivacyAgreed) {
        step = 3;
      }
    }
    this.setData({
      currentStep: step
    });
  },

  // 检查是否可以登录
  canLogin() {
    // 已注册用户且显示简化登录界面时
    if (this.data.isRegistered && this.data.showSimpleLogin) {
      // 必须同意隐私政策才可登录
      return this.data.hasPrivacyAgreed;
    }
    
    // 修复判断逻辑，必须同意隐私政策
    const canLogin = this.data.hasUserAgreed && 
           this.data.hasPrivacyAgreed && 
           this.data.avatarUrl && 
           this.data.nickName;
    
    console.log('登录按钮状态检查:', {
      hasUserAgreed: this.data.hasUserAgreed,
      hasPrivacyAgreed: this.data.hasPrivacyAgreed,
      avatarUrl: this.data.avatarUrl,
      nickName: this.data.nickName,
      canLogin: canLogin
    });
    
    return canLogin;
  },

  // 用户登录
  login: function() {
    console.log('登录按钮被点击');
    
    // 检查是否可以登录
    if (!this.canLogin()) {
      let message = '';
      if (!this.data.avatarUrl || this.data.avatarUrl === '/images/tabbar/my.png') {
        message = '请先选择头像';
      } else if (!this.data.nickName) {
        message = '请输入昵称';
      } else if (!this.data.hasUserAgreed) {
        message = '请先同意授权获取头像和昵称';
      } else if (!this.data.hasPrivacyAgreed) {
        message = '请阅读并同意隐私政策和用户协议';
      }
      
      console.log('登录检查失败:', message);
      
      wx.showToast({
        title: message,
        icon: 'none',
        duration: 2000
      });
      return;
    }

    if (this.data.isLoading) {
      console.log('已经在登录中，忽略重复点击');
      return;
    }
    
    // 设置加载状态
    this.setData({ isLoading: true });

    // 显示加载中
    wx.showLoading({
      title: '登录中...',
      mask: true
    });

    // 检查头像，如果是临时路径且不是http开头，尝试上传到云存储
    if (this.data.avatarUrl && 
        (this.data.avatarUrl.startsWith('wxfile://') || 
         this.data.avatarUrl.startsWith('tmp') || 
         this.data.avatarUrl.startsWith('http://tmp'))) {
      console.log('检测到临时头像路径，先上传到云存储:', this.data.avatarUrl);
      this.uploadAvatarToCloud().then(fileId => {
        this.callLoginFunction(fileId);
      }).catch(err => {
        console.error('上传头像失败:', err);
        // 上传失败时使用默认头像继续登录流程
        console.log('使用默认头像继续登录');
        this.callLoginFunction('/images/tabbar/my.png');
      });
    } else {
      // 头像不是临时路径，直接调用登录函数
      this.callLoginFunction(this.data.avatarUrl);
    }
  },

  // 上传头像到云存储
  uploadAvatarToCloud: function() {
    return new Promise((resolve, reject) => {
      const cloudPath = `avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
      
      // 检查头像URL类型
      console.log('准备上传头像，路径类型:', this.data.avatarUrl);
      
      // 如果是http开头的网络图片，先下载到本地
      if (this.data.avatarUrl && this.data.avatarUrl.startsWith('http') && !this.data.avatarUrl.startsWith('http://tmp')) {
        wx.downloadFile({
          url: this.data.avatarUrl,
          success: res => {
            if (res.statusCode === 200) {
              console.log('网络图片下载成功，临时路径:', res.tempFilePath);
              // 上传下载后的临时文件
              this.uploadToCloud(res.tempFilePath, cloudPath, resolve, reject);
            } else {
              console.error('下载网络图片失败:', res);
              resolve('/images/tabbar/my.png');
            }
          },
          fail: err => {
            console.error('下载网络图片失败:', err);
            resolve('/images/tabbar/my.png');
          }
        });
      } 
      // 本地路径直接上传
      else {
        this.uploadToCloud(this.data.avatarUrl, cloudPath, resolve, reject);
      }
    });
  },
  
  // 执行上传到云存储的操作
  uploadToCloud: function(filePath, cloudPath, resolve, reject) {
    try {
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: filePath,
        success: res => {
          console.log('头像上传成功，fileID:', res.fileID);
          resolve(res.fileID);
        },
        fail: err => {
          console.error('头像上传失败, 错误详情:', err);
          // 上传失败使用默认头像
          resolve('/images/tabbar/my.png');
        }
      });
    } catch (err) {
      console.error('上传头像时发生异常:', err);
      resolve('/images/tabbar/my.png');  // 发生异常时使用默认头像
    }
  },

  // 调用登录云函数
  callLoginFunction: function(avatarUrl) {
    // 准备用户信息
    const userInfo = {
      nickName: this.data.nickName,
      avatarUrl: avatarUrl
    };
    
    console.log('准备调用login云函数，用户信息:', userInfo);
        
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
          const { openid, role, remainingUsage, nickName, avatarUrl, _id } = res.result;
          
          console.log('登录成功，用户角色:', role, '剩余使用次数:', remainingUsage);
          
          // 更新全局数据
          const app = getApp();
          app.globalData.userInfo = {
            openid: openid,
            _id: _id,
            role: role || 'beautician', // 默认为美容师角色
            nickName: nickName,
            avatarUrl: avatarUrl
          };
          app.globalData.isLoggedIn = true;
          app.globalData.isNewUser = false; // 重要：设置为false
          app.globalData.role = role || 'beautician';
          app.globalData.remainingUsage = remainingUsage || 0;

          // 保存到本地
          wx.setStorageSync('userInfo', app.globalData.userInfo);

          // 获取头像临时链接并保存
          if (avatarUrl && avatarUrl.startsWith('cloud://')) {
            wx.cloud.getTempFileURL({
              fileList: [avatarUrl],
              success: res => {
                if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
                  console.log('获取到头像临时链接:', res.fileList[0].tempFileURL);
                  app.globalData.userInfo.tempAvatarUrl = res.fileList[0].tempFileURL;
                  // 保存到本地
                  wx.setStorageSync('userInfo', app.globalData.userInfo);
                }
              }
            });
          }

          // 显示成功提示
          wx.showToast({
            title: '登录成功',
            icon: 'success',
            duration: 1500
          });

          // 延迟跳转，让用户看到成功提示
          setTimeout(() => {
            this.redirectAfterLogin();
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

  // 登录成功后的重定向处理
  redirectAfterLogin: function() {
    // 检查是否需要返回快照页面
    if (this.data.returnToSnapshot && this.data.pendingSnapshotId) {
      console.log('登录成功，返回快照页面，快照ID:', this.data.pendingSnapshotId);
      
      // 清除存储的快照ID
      wx.removeStorageSync('pendingSnapshotId');
      
      // 跳转到快照页面
      wx.redirectTo({
        url: `/pages/result/result?snapshot=${this.data.pendingSnapshotId}`
      });
    } else {
      // 如果不需要返回快照页面，则跳转到首页
      wx.switchTab({
        url: '/pages/index/index'
      });
    }
  },

  // 跳转到首页 (保留此函数，但更改为调用redirectAfterLogin)
  redirectToIndex: function() {
    this.redirectAfterLogin();
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