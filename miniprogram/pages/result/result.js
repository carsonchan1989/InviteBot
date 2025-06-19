Page({
  data: {
    scriptList: [],
    inviteInfo: null,
    taskId: null,
    isPolling: false,
    currentIndex: 0, // 当前选中的话术索引
    snapshotId: '', // 快照ID
    isFromShare: false, // 是否来自分享
    hasTriedLoadSnapshot: false // 是否已尝试加载过快照
  },

  onLoad: function(options) {
    console.log('result页面onLoad参数:', options);
    
    const app = getApp();
    
    // 检查是否是从分享链接进入的快照页面
    if (options.snapshot) {
      console.log('从分享链接进入快照页面，快照ID:', options.snapshot);
      this.setData({
        snapshotId: options.snapshot,
        isFromShare: true
      });
      
      // 加载快照数据
      this.loadSnapshot(options.snapshot);
      return;
    }
    
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
        title: '正在生成话术\n请耐心等待60秒',
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
      console.log('没有传递参数，显示空白结果页');
    }
  },

  onShow: function() {
    // 当页面显示时，检查是否需要重新尝试加载快照
    if (this.data.isFromShare && this.data.snapshotId && !this.data.hasTriedLoadSnapshot) {
      this.loadSnapshot(this.data.snapshotId);
    }
  },

  // 加载快照数据
  loadSnapshot: function(snapshotId) {
    if (!snapshotId) {
      console.error('快照ID为空，无法加载快照');
      return;
    }
    
    this.setData({ hasTriedLoadSnapshot: true });
    
    wx.showLoading({
      title: '加载分享内容...',
      mask: true
    });
    
    // 调用云函数获取快照数据
    wx.cloud.callFunction({
      name: 'manageSnapshots',
      data: {
        action: 'getSnapshot',
        snapshotId: snapshotId
      },
      success: res => {
        console.log('[云函数] [getSnapshot] 调用成功:', res.result);
        
        if (res.result && res.result.code === 0) {
          const snapshotData = res.result.data;
          
          // 检查用户是否已注册
          if (!res.result.isRegistered) {
            console.log('用户未注册，保存快照ID并跳转到登录页');
            
            // 将快照ID存储在本地，以便登录后返回
            wx.setStorageSync('pendingSnapshotId', snapshotId);
            
            wx.hideLoading();
            wx.showModal({
              title: '查看分享内容',
              content: '登录后即可查看分享的话术内容',
              confirmText: '去登录',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.redirectTo({
                    url: '/pages/login/login?returnToSnapshot=true'
                  });
                }
              }
            });
            return;
          }
          
          // 用户已注册，可以查看快照内容
          this.setData({
            scriptList: snapshotData.scriptList || [],
            inviteInfo: snapshotData.inviteInfo || null
          });
          
          console.log('成功加载快照数据，脚本数量:', this.data.scriptList.length);
          
          wx.hideLoading();
          wx.showToast({
            title: '加载成功',
            icon: 'success'
          });
        } else {
          console.error('获取快照失败:', res.result);
          wx.hideLoading();
          wx.showToast({
            title: '获取分享内容失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('[云函数] [getSnapshot] 调用失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 保存快照并分享
  saveSnapshot: function() {
    // 验证数据完整性
    if (!this.data.scriptList || this.data.scriptList.length === 0) {
      console.error('无有效数据可分享');
      wx.showToast({
        title: '无有效数据可分享',
        icon: 'none'
      });
      return Promise.reject('无有效数据可分享');
    }
    
    // 如果已经有了快照ID，直接返回
    if (this.data.snapshotId) {
      console.log('已有快照ID，无需重新保存:', this.data.snapshotId);
      return Promise.resolve({ snapshotId: this.data.snapshotId });
    }
    
    wx.showLoading({
      title: '准备分享...',
      mask: true
    });
    
    // 调用云函数保存快照
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'manageSnapshots',
        data: {
          action: 'saveSnapshot',
          data: {
            scriptList: this.data.scriptList,
            inviteInfo: this.data.inviteInfo
          }
        },
        success: res => {
          console.log('[云函数] [saveSnapshot] 调用成功:', res.result);
          
          if (res.result && res.result.code === 0 && res.result.data && res.result.data.snapshotId) {
            // 保存快照ID到页面数据
            this.setData({
              snapshotId: res.result.data.snapshotId
            });
            
            wx.hideLoading();
            resolve({ snapshotId: res.result.data.snapshotId });
          } else {
            console.error('保存快照失败:', res.result);
            wx.hideLoading();
            wx.showToast({
              title: '准备分享失败',
              icon: 'none'
            });
            reject('保存快照失败');
          }
        },
        fail: err => {
          console.error('[云函数] [saveSnapshot] 调用失败:', err);
          wx.hideLoading();
          wx.showToast({
            title: '网络错误，请重试',
            icon: 'none'
          });
          reject(err);
        }
      });
    });
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
    // 如果是从分享链接进入的，返回首页而不是返回上一页
    if (this.data.isFromShare) {
      wx.switchTab({
        url: '/pages/index/index'
      });
    } else {
      wx.navigateBack();
    }
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
      title: '开始重新生成\n请耐心等待60秒',
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
            scriptList: res.result.data.scripts || [],
            snapshotId: '' // 清空快照ID，因为内容已更新
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
            isPolling: true,
            snapshotId: '' // 清空快照ID，因为内容已更新
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
    
    // 渐进式轮询间隔：第一次45秒，第二次25秒，第三次15秒，之后每5秒
    let pollingInterval = 5000; // 默认5秒
    if (retryCount === 0) {
      pollingInterval = 45000; // 第一次等待45秒
      console.log('首次轮询，等待45秒...');
    } else if (retryCount === 1) {
      pollingInterval = 25000; // 第二次等待25秒
      console.log('第二次轮询，等待25秒...');
    } else if (retryCount === 2) {
      pollingInterval = 15000; // 第三次等待15秒
      console.log('第三次轮询，等待15秒...');
    } else {
      console.log('后续轮询，每5秒一次...');
    }
    
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
    
    // 更新加载提示，告知用户当前状态
    if (retryCount === 0) {
      wx.showLoading({
        title: '正在生成中',
        mask: true
      });
    } else if (retryCount === 1) {
      wx.showLoading({
        title: '继续生成中\n请耐心等待',
        mask: true
      });
    } else if (retryCount > 5) {
      wx.showLoading({
        title: '生成需要较长时间\n请继续等待',
        mask: true
      });
    }
    
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
          this.setData({ 
            isPolling: false,
            snapshotId: '' // 清空快照ID，因为这是新生成的内容
          });
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
  },

  // 分享给朋友
  onShareAppMessage: function() {
    // 先保存快照
    return this.saveSnapshot().then(result => {
      const snapshotId = result.snapshotId;
      
      // 默认值
      let shareTitle = '美容师邀约话术生成器';
      let shareContent = '';
      
      try {
        if (this.data.scriptList && this.data.scriptList.length > 0) {
          // 使用当前选中的话术作为分享内容
          const currentIndex = parseInt(this.data.currentIndex || 0);
          if (currentIndex >= 0 && currentIndex < this.data.scriptList.length) {
            const currentScript = this.data.scriptList[currentIndex];
            
            // 根据不同的数据类型处理
            if (typeof currentScript === 'string') {
              // 如果是字符串，直接使用
              if (currentScript.length > 0) {
                shareContent = currentScript.slice(0, Math.min(30, currentScript.length)) + '...';
                shareTitle = '为您生成的专业邀约话术';
              }
            } 
            else if (typeof currentScript === 'object') {
              if (currentScript.content && typeof currentScript.content === 'string' && currentScript.content.length > 0) {
                // 如果有content字符串属性
                shareContent = currentScript.content.slice(0, Math.min(30, currentScript.content.length)) + '...';
                shareTitle = '为您生成的专业邀约话术';
              } 
              else if (currentScript.reason && typeof currentScript.reason === 'string' && currentScript.reason.length > 0) {
                // 如果有reason字符串属性
                shareContent = currentScript.reason.slice(0, Math.min(30, currentScript.reason.length)) + '...';
                shareTitle = '为您生成的专业邀约话术';
              }
            }
          }
        }
      } catch (error) {
        console.error('准备分享内容时出错:', error);
      }
      
      return {
        title: shareTitle,
        path: `/pages/result/result?snapshot=${snapshotId}`, // 分享快照页面，而不是首页
        imageUrl: '/images/share-image.png',
        desc: shareContent
      };
    }).catch(err => {
      console.error('创建分享链接失败:', err);
      // 默认分享当前页面
      return {
        title: '美容师邀约话术生成器',
        path: '/pages/index/index',
        imageUrl: '/images/share-image.png'
      };
    });
  },
  
  // 分享到朋友圈
  onShareTimeline: function() {
    // 先保存快照
    return this.saveSnapshot().then(result => {
      const snapshotId = result.snapshotId;
      
      // 默认标题
      let shareTitle = '美容师邀约话术生成器 - 一键生成专业客户邀约话术';
      
      try {
        if (this.data.scriptList && this.data.scriptList.length > 0) {
          // 使用当前选中的话术作为分享内容
          const currentIndex = parseInt(this.data.currentIndex || 0);
          if (currentIndex >= 0 && currentIndex < this.data.scriptList.length) {
            const currentScript = this.data.scriptList[currentIndex];
            
            // 根据不同的数据类型处理
            if (typeof currentScript === 'string') {
              // 如果是字符串，直接使用
              if (currentScript.length > 0) {
                shareTitle = currentScript.slice(0, Math.min(30, currentScript.length)) + '...';
              }
            } 
            else if (typeof currentScript === 'object') {
              if (currentScript.content && typeof currentScript.content === 'string' && currentScript.content.length > 0) {
                // 如果有content字符串属性
                shareTitle = currentScript.content.slice(0, Math.min(30, currentScript.content.length)) + '...';
              } 
              else if (currentScript.reason && typeof currentScript.reason === 'string' && currentScript.reason.length > 0) {
                // 如果有reason字符串属性
                shareTitle = currentScript.reason.slice(0, Math.min(30, currentScript.reason.length)) + '...';
              }
            }
          }
        }
      } catch (error) {
        console.error('准备分享内容时出错:', error);
      }
      
      return {
        title: shareTitle,
        query: `snapshot=${snapshotId}`, // 朋友圈分享参数
        imageUrl: '/images/share-image.png'
      };
    }).catch(err => {
      console.error('创建分享链接失败:', err);
      // 默认分享
      return {
        title: '美容师邀约话术生成器 - 一键生成专业客户邀约话术',
        query: '',
        imageUrl: '/images/share-image.png'
      };
    });
  },
  
  // 记录当前查看的话术索引
  onScriptTap: function(e) {
    const index = e.currentTarget.dataset.index;
    this.setData({
      currentIndex: index
    });
  }
}); 