Page({
  data: {
    role: 'beautician',
    remainingUsage: 0,
    createTimeFormatted: '',
    createTime: null,
    avatarUrl: '',
    nickName: ''
  },

  onLoad: function(options) {
    this.getUserInfo();
  },

  onShow: function() {
    // 设置自定义tabBar的选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 1
      });
    }
    
    // 获取全局应用实例
    const app = getApp();
    
    // 检查是否需要强制刷新用户信息
    if (app.globalData.needRefreshUserInfo) {
      console.log('检测到需要刷新用户信息');
      app.globalData.needRefreshUserInfo = false; // 重置标志
      this.forceRefreshUserInfo();
    } else {
      this.getUserInfo();
    }
  },

  // 强制刷新用户信息
  forceRefreshUserInfo: function() {
    console.log('强制刷新用户信息');
    wx.showLoading({
      title: '刷新信息...',
      mask: false
    });
    
    const app = getApp();
    app.getUserInfo().then(userInfo => {
      console.log('用户信息刷新成功:', userInfo);
      this.setData({
        role: app.globalData.role || 'beautician',
        remainingUsage: app.globalData.remainingUsage || 0,
        avatarUrl: userInfo.avatarUrl || '',
        nickName: userInfo.nickName || ''
      });
      wx.hideLoading();
    }).catch(err => {
      console.error('用户信息刷新失败:', err);
      wx.hideLoading();
      wx.showToast({
        title: '信息刷新失败',
        icon: 'none'
      });
    });
  },

  // 获取用户信息
  getUserInfo: function() {
    const app = getApp();
    
    // 先从全局数据中获取基本信息
    const userInfo = app.globalData.userInfo || {};
    this.setData({
      role: app.globalData.role || 'beautician',
      remainingUsage: app.globalData.remainingUsage || 0,
      avatarUrl: userInfo.avatarUrl || '',
      nickName: userInfo.nickName || ''
    });
    
    // 显示加载中
    wx.showLoading({
      title: '加载中...',
      mask: false
    });

    // 从数据库获取完整用户信息
    wx.cloud.callFunction({
      name: 'getUser',
      success: res => {
        console.log('[云函数] [getUser] 调用成功', res);
        
        if (res.result && res.result.code === 0) {
          const userData = res.result.data;
          
          // 格式化创建时间
          let createTimeFormatted = '未知';
          if (userData.createdAt) {
            const date = new Date(userData.createdAt);
            createTimeFormatted = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
          }
          
          this.setData({
            createTimeFormatted: createTimeFormatted,
            createTime: userData.createdAt,
            role: userData.role || 'beautician',
            remainingUsage: userData.remainingUsage || 0,
            avatarUrl: userData.avatarUrl || '',
            nickName: userData.nickName || ''
          });
          
          // 更新全局数据
          app.globalData.role = userData.role || 'beautician';
          app.globalData.remainingUsage = userData.remainingUsage || 0;
          if (app.globalData.userInfo) {
            app.globalData.userInfo.nickName = userData.nickName || '';
            app.globalData.userInfo.avatarUrl = userData.avatarUrl || '';
            // 更新本地存储
            wx.setStorageSync('userInfo', app.globalData.userInfo);
          }
          console.log('个人中心页面更新用户信息:', userData);
        }
      },
      fail: err => {
        console.error('[云函数] [getUser] 调用失败', err);
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 导航到个人资料编辑页面
  navigateToProfile: function() {
    console.log('正在跳转到个人资料编辑页面...');
    wx.navigateTo({
      url: '/pages/profile/profile',
      success: () => {
        console.log('跳转个人资料编辑页面成功');
      },
      fail: (err) => {
        console.error('跳转个人资料编辑页面失败:', err);
        wx.showToast({
          title: '页面跳转失败：' + err.errMsg,
          icon: 'none'
        });
      }
    });
  },

  // 导航到用户管理页面
  navigateToUserManage: function() {
    if (this.data.role !== 'admin') {
      wx.showToast({
        title: '无权限访问',
        icon: 'none'
      });
      return;
    }
    
    console.log('正在跳转到用户管理页面...');
    wx.navigateTo({
      url: '/pages/admin/users/users',
      success: () => {
        console.log('跳转用户管理页面成功');
      },
      fail: (err) => {
        console.error('跳转用户管理页面失败:', err);
        wx.showToast({
          title: '页面跳转失败：' + err.errMsg,
          icon: 'none'
        });
      }
    });
  },

  // 导航到项目管理页面
  navigateToProjectManage: function() {
    if (this.data.role !== 'admin') {
      wx.showToast({
        title: '无权限访问',
        icon: 'none'
      });
      return;
    }
    
    console.log('正在跳转到项目管理页面...');
    wx.navigateTo({
      url: '/pages/admin/projects/projects',
      success: () => {
        console.log('跳转项目管理页面成功');
      },
      fail: (err) => {
        console.error('跳转项目管理页面失败:', err);
        wx.showToast({
          title: '页面跳转失败：' + err.errMsg,
          icon: 'none'
        });
      }
    });
  },

  // 导航到使用统计页面
  navigateToUsageStats: function() {
    if (this.data.role !== 'admin') {
      wx.showToast({
        title: '无权限访问',
        icon: 'none'
      });
      return;
    }
    
    console.log('正在跳转到使用统计页面...');
    wx.navigateTo({
      url: '/pages/admin/statistics/statistics',
      success: () => {
        console.log('跳转使用统计页面成功');
      },
      fail: (err) => {
        console.error('跳转使用统计页面失败:', err);
        wx.showToast({
          title: '页面跳转失败：' + err.errMsg,
          icon: 'none'
        });
      }
    });
  },

  // 导航到邀请码管理页面
  navigateToInvitationCodes: function() {
    if (this.data.role !== 'admin') {
      wx.showToast({
        title: '无权限访问',
        icon: 'none'
      });
      return;
    }
    
    console.log('正在跳转到邀请码管理页面...');
    wx.navigateTo({
      url: '/pages/admin/invitation-codes/invitation-codes',
      success: () => {
        console.log('跳转邀请码管理页面成功');
      },
      fail: (err) => {
        console.error('跳转邀请码管理页面失败:', err);
        wx.showToast({
          title: '页面跳转失败：' + err.errMsg,
          icon: 'none'
        });
      }
    });
  },

  // 导航到兑换邀请码页面
  navigateToRedeemCode: function() {
    console.log('正在跳转到兑换邀请码页面...');
    wx.navigateTo({
      url: '/pages/user/redeem-code/redeem-code',
      success: () => {
        console.log('跳转兑换邀请码页面成功');
      },
      fail: (err) => {
        console.error('跳转兑换邀请码页面失败:', err);
        wx.showToast({
          title: '页面跳转失败：' + err.errMsg,
          icon: 'none'
        });
      }
    });
  },

  // 导航到历史记录页面
  navigateToHistory: function() {
    console.log('正在跳转到生成历史页面...');
    wx.navigateTo({
      url: '/pages/history/history',
      success: () => {
        console.log('跳转生成历史页面成功');
      },
      fail: (err) => {
        console.error('跳转生成历史页面失败:', err);
        wx.showToast({
          title: '页面跳转失败：' + err.errMsg,
          icon: 'none'
        });
      }
    });
  },

  // 联系管理员
  contactAdmin: function() {
    wx.showModal({
      title: '联系管理员',
      content: '如需增加使用次数或有其他问题，请联系管理员：\n电话：13800138000\n微信：admin123',
      showCancel: false
    });
  },

  // 关于我们
  showAbout: function() {
    wx.showModal({
      title: '关于我们',
      content: '美容师邀约话术生成器\n版本：1.0.0\n为美容师提供专业客户邀约话术，帮助提升客户转化率。',
      showCancel: false
    });
  },

  // 退出登录
  logout: function() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出登录吗？',
      success: res => {
        if (res.confirm) {
          // 清除本地存储的用户信息
          wx.removeStorageSync('userInfo');
          
          // 重置全局数据
          const app = getApp();
          app.globalData.userInfo = null;
          app.globalData.isLoggedIn = false;
          app.globalData.role = '';
          app.globalData.remainingUsage = 0;
          
          // 跳转到登录页
          wx.reLaunch({
            url: '/pages/login/login'
          });
        }
      }
    });
  }
}); 