Page({
  data: {
    scriptList: [],
    inviteInfo: null,
    taskId: null,
    isPolling: false
  },

  onLoad: function(options) {
    console.log('result页面onLoad参数:', options);
    
    const app = getApp();
    
    // 根据模式获取数据
    if (options.mode === 'direct') {
      // 直接从全局变量获取数据
      if (app.globalData.tempScriptData) {
        console.log('从全局变量获取话术数据:', app.globalData.tempScriptData);
        
        this.setData({ 
          scriptList: app.globalData.tempScriptData.scripts || [],
          inviteInfo: app.globalData.tempInviteInfo || null
        });
        
        console.log('设置scriptList完成:', this.data.scriptList.length);
      } else {
        console.error('全局变量中未找到话术数据');
        wx.showToast({
          title: '获取话术失败',
          icon: 'none'
        });
      }
    } 
    // 处理taskId模式 - 开始轮询获取结果
    else if (options.mode === 'task' && options.taskId) {
      const taskId = options.taskId;
      console.log('收到taskId:', taskId);
      
      this.setData({
        taskId: taskId,
        isPolling: true,
        inviteInfo: app.globalData.tempInviteInfo || null
      });
      
      // 显示加载中
      wx.showLoading({
        title: '正在生成话术',
        mask: true
      });
      
      // 开始轮询获取结果
      this.pollTaskResult(taskId);
    } 
    // 兼容旧版本的参数传递方式
    else if (options.scriptData) {
      try {
        const scriptData = JSON.parse(decodeURIComponent(options.scriptData));
        console.log('解析后的话术数据:', scriptData);
        
        this.setData({ 
          scriptList: scriptData.scripts || [],
          inviteInfo: scriptData.inviteInfo || null
        });
        
        console.log('设置scriptList完成:', this.data.scriptList.length);
      } catch (e) {
        console.error('解析话术数据失败:', e);
        wx.showToast({
          title: '获取话术失败',
          icon: 'none'
        });
      }
    } 
    // 兼容旧版本的taskId模式
    else if (options.taskId) {
      console.log('使用旧版本参数收到taskId:', options.taskId);
      
      this.setData({
        taskId: options.taskId,
        isPolling: true
      });
      
      if (options.inviteInfo) {
        try {
          const inviteInfo = JSON.parse(decodeURIComponent(options.inviteInfo));
          console.log('解析后的邀约信息:', inviteInfo);
          
          this.setData({
            inviteInfo: inviteInfo
          });
        } catch (e) {
          console.error('解析邀约信息失败:', e);
          // 尝试从全局变量获取
          if (app.globalData.tempInviteInfo) {
            this.setData({
              inviteInfo: app.globalData.tempInviteInfo
            });
          }
        }
      } else if (app.globalData.tempInviteInfo) {
        // 从全局变量获取邀约信息
        this.setData({
          inviteInfo: app.globalData.tempInviteInfo
        });
      }
      
      // 显示加载中
      wx.showLoading({
        title: '正在生成话术',
        mask: true
      });
      
      // 开始轮询获取结果
      this.pollTaskResult(options.taskId);
    } else {
      console.error('缺少必要参数, options:', options);
      wx.showToast({
        title: '页面参数错误',
        icon: 'none'
      });
    }
  },

  // 复制文本到剪贴板
  copyText: function(e) {
    const text = e.currentTarget.dataset.text;
    wx.setClipboardData({
      data: text,
      success: function() {
        wx.showToast({
          title: '复制成功',
          icon: 'success'
        });
      },
      fail: function() {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        });
      }
    });
  },

  // 返回到邀约信息输入页面
  backToIndex: function() {
    wx.navigateBack();
  },

  // 重新生成话术
  regenerate: function() {
    if (!this.data.inviteInfo) {
      wx.showToast({
        title: '邀约信息不完整，无法重新生成',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '重新生成中，请耐心等待60秒',
      mask: true
    });

    // 调用生成话术的云函数，使用真实API生成
    wx.cloud.callFunction({
      name: 'generateScript',
      data: {
        inviteInfo: this.data.inviteInfo,
        isRegenerate: true
      },
      timeout: 120000,
      success: res => {
        console.log('[云函数] [generateScript] 重新生成调用成功', res);
        console.log('[云函数] [generateScript] 详细结果:', JSON.stringify(res.result));
        
        if (res.result && res.result.code === 0) {
          // 更新页面数据
          this.setData({
            scriptList: res.result.data.scripts || []
          });
          
          // 保持页面滚动到顶部，让用户看到新生成的内容
          wx.pageScrollTo({
            scrollTop: 0,
            duration: 300
          });
          
          wx.showToast({
            title: '重新生成成功',
            icon: 'success'
          });
        } else if (res.result && res.result.code === 1) {
          // 任务创建成功，但需要轮询获取结果
          const taskId = res.result.data.taskId;
          
          this.setData({
            taskId: taskId,
            isPolling: true
          });
          
          // 开始轮询获取结果
          this.pollTaskResult(taskId);
        } else {
          console.error('重新生成返回错误结果:', res.result);
          wx.showToast({
            title: res.result && res.result.msg ? res.result.msg : '重新生成失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('[云函数] [generateScript] 重新生成调用失败', err);
        wx.showToast({
          title: '重新生成失败，请重试',
          icon: 'none'
        });
      },
      complete: () => {
        if (!this.data.isPolling) {
          wx.hideLoading();
        }
      }
    });
  },
  
  // 轮询任务结果
  pollTaskResult: function(taskId, retryCount = 0) {
    const maxRetries = 30; // 最多轮询30次，大约5分钟
    const pollingInterval = 5000; // 每5秒轮询一次
    
    if (retryCount >= maxRetries) {
      this.setData({ isPolling: false });
      wx.hideLoading();
      wx.showToast({
        title: '生成话术超时，请重试',
        icon: 'none'
      });
      return;
    }
    
    console.log(`开始第${retryCount+1}次轮询任务结果，taskId:`, taskId);
    
    // 查询任务结果
    wx.cloud.callFunction({
      name: 'generateScript',
      data: {
        action: 'getTaskResult',
        taskId: taskId
      },
      timeout: 10000,
      success: res => {
        console.log(`[云函数] [getTaskResult] 第${retryCount+1}次查询结果:`, res);
        console.log('查询结果详情:', JSON.stringify(res.result));
        
        if (res.result && res.result.code === 0) { // 任务完成
          this.setData({ isPolling: false });
          wx.hideLoading();
          
          // 验证返回的数据格式
          if (res.result.data && Array.isArray(res.result.data.scripts)) {
            // 更新页面数据
            this.setData({
              scriptList: res.result.data.scripts || []
            });
            
            console.log('成功设置scriptList数据，长度:', this.data.scriptList.length);
            
            // 保持页面滚动到顶部，让用户看到新生成的内容
            wx.pageScrollTo({
              scrollTop: 0,
              duration: 300
            });
            
            wx.showToast({
              title: '生成成功',
              icon: 'success'
            });
          } else {
            console.error('返回数据格式错误:', res.result.data);
            wx.showToast({
              title: '数据格式错误，请重试',
              icon: 'none'
            });
          }
        } else if (res.result && res.result.code === 1) { // 任务处理中
          // 继续轮询
          setTimeout(() => {
            this.pollTaskResult(taskId, retryCount + 1);
          }, pollingInterval);
        } else { // 任务失败
          this.setData({ isPolling: false });
          wx.hideLoading();
          wx.showToast({
            title: res.result && res.result.msg ? res.result.msg : '生成失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('[云函数] [getTaskResult] 查询失败', err);
        
        // 查询失败，但不一定是任务失败，可能是网络问题，继续轮询
        setTimeout(() => {
          this.pollTaskResult(taskId, retryCount + 1);
        }, pollingInterval);
      }
    });
  }
}); 