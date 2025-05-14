Page({
  data: {
    avatarUrl: '',
    nickName: '',
    tempAvatarUrl: '',
    tempNickname: '',
    customAvatarUrl: '',
    customNickname: '',
    avatarType: 'wechat',
    nicknameType: 'wechat'
  },

  onLoad: function() {
    const app = getApp();
    const userInfo = app.globalData.userInfo || {};
    
    this.setData({
      avatarUrl: userInfo.avatarUrl || '/images/tabbar/my.png',
      nickName: userInfo.nickName || '',
      tempAvatarUrl: userInfo.avatarUrl || '/images/tabbar/my.png',
      tempNickname: userInfo.nickName || '',
      avatarType: 'wechat',
      nicknameType: 'wechat'
    });
  },

  // 选择微信头像
  selectWechatAvatar: function() {
    this.setData({
      avatarType: 'wechat'
    });
  },

  // 选择自定义头像
  selectCustomAvatar: function() {
    this.setData({
      avatarType: 'custom'
    });
  },

  // 微信头像选择回调
  onChooseAvatar: function(e) {
    this.setData({
      tempAvatarUrl: e.detail.avatarUrl
    });
  },

  // 选择相册图片作为自定义头像
  chooseImage: function() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({
          customAvatarUrl: tempFilePath,
          avatarType: 'custom'
        });
      }
    });
  },
  
  // 选择微信昵称
  selectWechatNickname: function() {
    this.setData({
      nicknameType: 'wechat'
    });
  },
  
  // 选择自定义昵称
  selectCustomNickname: function() {
    this.setData({
      nicknameType: 'custom'
    });
  },
  
  // 微信昵称输入
  onInputNickname: function(e) {
    this.setData({
      tempNickname: e.detail.value
    });
  },
  
  // 自定义昵称输入
  onInputCustomNickname: function(e) {
    this.setData({
      customNickname: e.detail.value
    });
  },
  
  // 取消编辑
  cancel: function() {
    wx.navigateBack();
  },
  
  // 保存个人资料
  saveProfile: function() {
    // 检查昵称是否为空
    if (!this.data.tempNickname) {
      wx.showToast({
        title: '昵称不能为空',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '保存中...',
      mask: true
    });
    
    let finalAvatarUrl = this.data.avatarUrl;
    let finalNickname = this.data.nickName;
    
    // 确定最终的头像URL
    if (this.data.avatarType === 'wechat' && this.data.tempAvatarUrl) {
      finalAvatarUrl = this.data.tempAvatarUrl;
    } else if (this.data.avatarType === 'custom' && this.data.customAvatarUrl) {
      finalAvatarUrl = this.data.customAvatarUrl;
    }
    
    // 确定最终的昵称
    if (this.data.nicknameType === 'wechat' && this.data.tempNickname) {
      finalNickname = this.data.tempNickname;
    } else if (this.data.nicknameType === 'custom' && this.data.customNickname) {
      finalNickname = this.data.customNickname;
    }
    
    // 处理头像 - 无论是微信头像还是自定义头像，都上传到云存储以获得永久链接
    if ((this.data.avatarType === 'wechat' && this.data.tempAvatarUrl && this.data.tempAvatarUrl.startsWith('http')) || 
        (this.data.avatarType === 'custom' && this.data.customAvatarUrl)) {
      
      const avatarToUpload = this.data.avatarType === 'wechat' ? this.data.tempAvatarUrl : this.data.customAvatarUrl;
      
      // 对于微信头像URL，需要先下载到本地临时文件
      if (this.data.avatarType === 'wechat' && avatarToUpload.startsWith('http')) {
        wx.downloadFile({
          url: avatarToUpload,
          success: res => {
            if (res.statusCode === 200) {
              this.uploadAvatarToCloud(res.tempFilePath, finalNickname);
            } else {
              console.error('下载微信头像失败', res);
              wx.hideLoading();
              wx.showToast({
                title: '头像处理失败，请重试',
                icon: 'none'
              });
            }
          },
          fail: err => {
            console.error('下载微信头像失败', err);
            wx.hideLoading();
            wx.showToast({
              title: '头像处理失败，请重试',
              icon: 'none'
            });
          }
        });
      } else {
        // 直接上传本地文件
        this.uploadAvatarToCloud(avatarToUpload, finalNickname);
      }
    } else {
      // 没有更改头像，直接更新用户资料
      this.updateUserProfile(finalAvatarUrl, finalNickname);
    }
  },
  
  // 上传头像到云存储
  uploadAvatarToCloud: function(filePath, nickname) {
    const cloudPath = `avatars/${Date.now()}-${Math.floor(Math.random() * 1000)}.png`;
    wx.cloud.uploadFile({
      cloudPath: cloudPath,
      filePath: filePath,
      success: res => {
        this.updateUserProfile(res.fileID, nickname);
      },
      fail: err => {
        console.error('上传头像失败', err);
        wx.hideLoading();
        wx.showToast({
          title: '头像上传失败，请重试',
          icon: 'none'
        });
      }
    });
  },
  
  // 更新用户资料到云数据库
  updateUserProfile: function(avatarUrl, nickName) {
    wx.cloud.callFunction({
      name: 'updateUserProfile',
      data: {
        avatarUrl: avatarUrl,
        nickName: nickName
      },
      success: res => {
        console.log('[云函数] [updateUserProfile] 调用成功', res);
        
        if (res.result && res.result.code === 0) {
          // 更新全局数据
          const app = getApp();
          if (app.globalData.userInfo) {
            app.globalData.userInfo.avatarUrl = avatarUrl;
            app.globalData.userInfo.nickName = nickName;
            // 更新本地存储
            wx.setStorageSync('userInfo', app.globalData.userInfo);
          }
          
          wx.hideLoading();
          wx.showToast({
            title: '保存成功',
            icon: 'success',
            success: () => {
              setTimeout(() => {
                wx.navigateBack();
              }, 1500);
            }
          });
        } else {
          wx.hideLoading();
          wx.showToast({
            title: '保存失败，请重试',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('[云函数] [updateUserProfile] 调用失败', err);
        wx.hideLoading();
        wx.showToast({
          title: '保存失败，请重试',
          icon: 'none'
        });
      }
    });
  }
}); 