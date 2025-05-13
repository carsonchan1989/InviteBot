Page({
  data: {
    codesList: [],
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalCount: 0,
    isLoading: false,
    showCreateModal: false,
    usageCount: 10
  },

  onLoad: function (options) {
    this.getCodesList();
  },
  
  onPullDownRefresh: function () {
    this.getCodesList(() => {
      wx.stopPullDownRefresh();
    });
  },
  
  // 获取邀请码列表
  getCodesList: function (callback) {
    if (this.data.isLoading) return;
    
    this.setData({
      isLoading: true
    });
    
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'manageInvitationCodes',
      data: {
        action: 'getCodesList',
        page: this.data.currentPage,
        pageSize: this.data.pageSize
      },
      success: res => {
        console.log('[云函数] [manageInvitationCodes] 获取邀请码列表成功', res);
        
        if (res.result && res.result.code === 0) {
          // 检查返回数据结构
          const data = res.result.data || {};
          const codes = data.list || [];
          const pagination = data.pagination || {};
          
          this.setData({
            codesList: codes,
            currentPage: pagination.page || 1,
            pageSize: pagination.pageSize || 10,
            totalPages: pagination.pages || 1,
            totalCount: pagination.total || 0
          });
        } else {
          wx.showToast({
            title: res.result.msg || '获取邀请码列表失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('[云函数] [manageInvitationCodes] 获取邀请码列表失败', err);
        wx.showToast({
          title: '获取邀请码列表失败，请重试',
          icon: 'none'
        });
      },
      complete: () => {
        this.setData({
          isLoading: false
        });
        wx.hideLoading();
        
        if (callback && typeof callback === 'function') {
          callback();
        }
      }
    });
  },
  
  // 加载下一页
  loadNextPage: function () {
    if (this.data.currentPage < this.data.totalPages) {
      this.setData({
        currentPage: this.data.currentPage + 1
      }, () => {
        this.getCodesList();
      });
    }
  },
  
  // 加载上一页
  loadPrevPage: function () {
    if (this.data.currentPage > 1) {
      this.setData({
        currentPage: this.data.currentPage - 1
      }, () => {
        this.getCodesList();
      });
    }
  },
  
  // 显示创建邀请码弹窗
  showCreateModal: function () {
    this.setData({
      showCreateModal: true,
      usageCount: 10
    });
  },
  
  // 隐藏创建邀请码弹窗
  hideCreateModal: function () {
    this.setData({
      showCreateModal: false
    });
  },
  
  // 修改使用次数
  onUsageCountChange: function (e) {
    this.setData({
      usageCount: parseInt(e.detail.value) || 0
    });
  },
  
  // 创建邀请码
  createInvitationCode: function () {
    if (this.data.usageCount <= 0) {
      wx.showToast({
        title: '使用次数必须大于0',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      isLoading: true
    });
    
    wx.showLoading({
      title: '生成中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'manageInvitationCodes',
      data: {
        action: 'generateCode',
        usageCount: this.data.usageCount
      },
      success: res => {
        console.log('[云函数] [manageInvitationCodes] 生成邀请码成功', res);
        
        if (res.result && res.result.code === 0) {
          wx.showToast({
            title: '邀请码生成成功',
            icon: 'success'
          });
          
          // 关闭弹窗
          this.setData({
            showCreateModal: false
          });
          
          // 刷新列表
          this.setData({
            currentPage: 1
          }, () => {
            this.getCodesList();
          });
          
          // 复制到剪贴板
          if (res.result.data && res.result.data.code) {
            wx.setClipboardData({
              data: res.result.data.code,
              success: () => {
                wx.showToast({
                  title: '邀请码已复制到剪贴板',
                  icon: 'success'
                });
              }
            });
          }
        } else {
          wx.showToast({
            title: res.result.msg || '生成邀请码失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('[云函数] [manageInvitationCodes] 生成邀请码失败', err);
        wx.showToast({
          title: '生成邀请码失败，请重试',
          icon: 'none'
        });
      },
      complete: () => {
        this.setData({
          isLoading: false
        });
        wx.hideLoading();
      }
    });
  },
  
  // 复制邀请码
  copyCode: function (e) {
    const code = e.currentTarget.dataset.code;
    
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({
          title: '邀请码已复制',
          icon: 'success'
        });
      }
    });
  },
  
  // 删除邀请码
  deleteCode: function (e) {
    const codeId = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除该邀请码吗？删除后将无法恢复',
      success: res => {
        if (res.confirm) {
          this.setData({
            isLoading: true
          });
          
          wx.showLoading({
            title: '删除中...',
            mask: true
          });
          
          wx.cloud.callFunction({
            name: 'manageInvitationCodes',
            data: {
              action: 'deleteCode',
              codeId: codeId
            },
            success: res => {
              console.log('[云函数] [manageInvitationCodes] 删除邀请码成功', res);
              
              if (res.result && res.result.code === 0) {
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                });
                
                // 刷新列表
                this.getCodesList();
              } else {
                wx.showToast({
                  title: res.result.msg || '删除失败',
                  icon: 'none'
                });
              }
            },
            fail: err => {
              console.error('[云函数] [manageInvitationCodes] 删除邀请码失败', err);
              wx.showToast({
                title: '删除失败，请重试',
                icon: 'none'
              });
            },
            complete: () => {
              this.setData({
                isLoading: false
              });
              wx.hideLoading();
            }
          });
        }
      }
    });
  },
  
  // 格式化时间
  formatTime: function (timestamp) {
    if (!timestamp) {
      return '';
    }
    
    let date;
    if (typeof timestamp === 'object') {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else {
      return '';
    }

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }
}); 