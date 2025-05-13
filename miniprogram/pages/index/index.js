Page({
    data: {    remainingUsage: 0,    formData: {      inviteTarget: '',      inviteDate: '',      inviteReason: '',      inviteProject: '',      inviteProject2: '',      inviteProject3: ''    },    minDate: '2023-01-01'
  },

  onLoad: function(options) {
    // 获取当前日期作为最小日期
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    this.setData({
      minDate: `${year}-${month}-${day}`
    });
    
    // 获取用户剩余使用次数
    this.getUserInfo();
  },

  onShow: function() {
    // 设置自定义tabBar的选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      });
    }
    
    // 每次页面显示时更新用户信息
    this.getUserInfo();
  },

  // 获取用户信息
  getUserInfo: function() {
    const app = getApp();
    
    // 如果应用已准备好，直接使用全局数据
    if (app.globalData.isAppReady) {
      this.setData({
        remainingUsage: app.globalData.remainingUsage || 0
      });
      console.log('首页使用全局数据，剩余次数:', app.globalData.remainingUsage);
    } else {
      // 否则等待数据加载完成
      console.log('等待用户数据加载...');
      const checkReady = setInterval(() => {
        if (app.globalData.isAppReady) {
          clearInterval(checkReady);
          this.setData({
            remainingUsage: app.globalData.remainingUsage || 0
          });
          console.log('首页数据加载完成，剩余次数:', app.globalData.remainingUsage);
        }
      }, 300);
      
      // 设置最长等待时间，避免无限等待
      setTimeout(() => {
        clearInterval(checkReady);
        console.log('等待超时，使用当前值');
      }, 5000);
    }
  },

  // 日期选择器变化事件
  bindDateChange: function(e) {
    this.setData({
      'formData.inviteDate': e.detail.value
    });
  },

  

  // 生成话术
  generateScript: function(e) {
    // 表单输入的值
    const inputData = e.detail.value;
    const formData = this.data.formData;
    
    // 合并表单数据
    formData.inviteTarget = inputData.inviteTarget || formData.inviteTarget;
    formData.inviteReason = inputData.inviteReason || formData.inviteReason;
    formData.inviteProject = inputData.inviteProject || formData.inviteProject;
    formData.inviteProject2 = inputData.inviteProject2 || formData.inviteProject2;
    formData.inviteProject3 = inputData.inviteProject3 || formData.inviteProject3;
    
    // 验证必填项
    if (!formData.inviteTarget) {
      wx.showToast({
        title: '请输入邀约对象',
        icon: 'none'
      });
      return;
    }
    
    if (!formData.inviteDate) {
      wx.showToast({
        title: '请选择邀约日期',
        icon: 'none'
      });
      return;
    }
    
    if (!formData.inviteReason) {
      wx.showToast({
        title: '请输入邀约理由',
        icon: 'none'
      });
      return;
    }
    
    if (!formData.inviteProject) {
      wx.showToast({
        title: '请输入邀约项目1',
        icon: 'none'
      });
      return;
    }
    
    // 检查剩余使用次数
    if (this.data.remainingUsage <= 0) {
      wx.showModal({
        title: '使用次数已用完',
        content: '您的使用次数已用完，请联系管理员增加次数',
        showCancel: false
      });
      return;
    }
    
    // 显示加载中
    wx.showLoading({
      title: '正在生成话术，请耐心等待60秒',
      mask: true
    });
    
    // 先将表单数据临时保存在全局
    const app = getApp();
    app.globalData.tempInviteInfo = formData;
    
    // 调用生成话术的云函数
    wx.cloud.callFunction({
      name: 'generateScript',
      data: {
        inviteInfo: formData
      },
      timeout: 120000,
      success: res => {
        console.log('[云函数] [generateScript] 调用成功', res);
        console.log('[云函数] [generateScript] 详细结果:', JSON.stringify(res.result));
        
        if (res.result && res.result.code === 0) {
          // 更新剩余使用次数
          this.setData({
            remainingUsage: res.result.remainingUsage
          });
          
          app.globalData.remainingUsage = res.result.remainingUsage;
          
          // 暂存结果数据到全局变量
          app.globalData.tempScriptData = res.result.data;
          
          // 导航到结果页面，不传递大量参数，只传递标识
          wx.navigateTo({
            url: `/pages/result/result?mode=direct`,
            fail: (navErr) => {
              console.error('导航到结果页面失败:', navErr);
              wx.showToast({
                title: '页面跳转失败，请重试',
                icon: 'none'
              });
            }
          });
        } else if (res.result && res.result.code === 1) {
          // 任务创建成功，但需要轮询获取结果
          const taskId = res.result.data.taskId;
          
          // 更新剩余使用次数
          this.setData({
            remainingUsage: res.result.remainingUsage
          });
          
          app.globalData.remainingUsage = res.result.remainingUsage;
          
          // 进入结果页面并开始轮询
          wx.navigateTo({
            url: `/pages/result/result?mode=task&taskId=${taskId}`,
            fail: (navErr) => {
              console.error('导航到结果页面失败:', navErr);
              wx.showToast({
                title: '页面跳转失败，请重试',
                icon: 'none'
              });
            }
          });
        } else {
          console.error('生成话术返回错误结果:', res.result);
          wx.showToast({
            title: res.result && res.result.msg ? res.result.msg : '生成话术失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('[云函数] [generateScript] 调用失败', err);
        wx.showToast({
          title: '生成话术失败，请重试',
          icon: 'none'
        });
      },
      complete: () => {
        wx.hideLoading();
      }
    });
  },

  // 重置表单
  resetForm: function() {
    this.setData({
      formData: {
        inviteTarget: '',
        inviteDate: '',
        inviteReason: '',
        inviteProject: '',
        inviteProject2: '',
        inviteProject3: ''
      }
    });
  }
}); 