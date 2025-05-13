Page({
  data: {
    userId: '',
    userData: {
      nickName: '',
      openid: '',
      role: 'beautician',
      remainingUsage: 0,
      createdAt: '',
      createTime: ''
    },
    loading: true
  },

  onLoad: function(options) {
    if (options.id) {
      this.setData({
        userId: options.id
      });
      this.fetchUserData();
    } else {
      wx.showToast({
        title: '用户ID不存在',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 获取用户数据
  fetchUserData: function() {
    var that = this;
    wx.showLoading({
      title: '加载中',
      mask: true
    });

    wx.cloud.callFunction({
      name: 'manageUsers',
      data: {
        action: 'getUserById',
        userId: this.data.userId
      },
      success: function(res) {
        wx.hideLoading();
        console.log('[云函数] [manageUsers] 获取用户详情成功', res);
        
        if (res.result && res.result.code === 0) {
          var user = res.result.data;
          
          // 格式化时间
          var createDate = user.createdAt ? new Date(user.createdAt) : new Date();
          var createTime = createDate.getFullYear() + '-' + 
                          String(createDate.getMonth() + 1).padStart(2, '0') + '-' + 
                          String(createDate.getDate()).padStart(2, '0');
          
          that.setData({
            userData: {
              nickName: user.nickName || '',
              openid: user.openid || '',
              role: user.role || 'beautician',
              remainingUsage: user.remainingUsage || 0,
              createdAt: user.createdAt,
              createTime: createTime
            },
            loading: false
          });
        } else {
          wx.showToast({
            title: res.result && res.result.msg ? res.result.msg : '获取用户详情失败',
            icon: 'none'
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('[云函数] [manageUsers] 获取用户详情失败', err);
        wx.showToast({
          title: '获取用户详情失败',
          icon: 'none'
        });
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      }
    });
  },

  // 角色选择变化
  onRoleChange: function(e) {
    const roleIndex = parseInt(e.detail.value);
    const role = roleIndex === 0 ? 'admin' : 'beautician';
    
    this.setData({
      'userData.role': role
    });
  },

  // 剩余次数输入变化
  onRemainingUsageChange: function(e) {
    const value = e.detail.value;
    let remainingUsage = parseInt(value);
    
    if (isNaN(remainingUsage) || remainingUsage < 0) {
      remainingUsage = 0;
    }
    
    this.setData({
      'userData.remainingUsage': remainingUsage
    });
  },

  // 保存用户信息
  saveUser: function() {
    var that = this;
    wx.showLoading({
      title: '保存中',
      mask: true
    });

    wx.cloud.callFunction({
      name: 'manageUsers',
      data: {
        action: 'updateUser',
        userId: this.data.userId,
        data: {
          role: this.data.userData.role,
          remainingUsage: this.data.userData.remainingUsage
        }
      },
      success: function(res) {
        wx.hideLoading();
        console.log('[云函数] [manageUsers] 更新用户成功', res);
        
        if (res.result && res.result.code === 0) {
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        } else {
          wx.showToast({
            title: res.result && res.result.msg ? res.result.msg : '保存失败',
            icon: 'none'
          });
        }
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('[云函数] [manageUsers] 更新用户失败', err);
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    });
  },

  // 取消编辑
  cancelEdit: function() {
    wx.navigateBack();
  }
}); 