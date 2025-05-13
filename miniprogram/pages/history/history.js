Page({
  data: {
    historyList: [],
    currentPage: 1,
    pageSize: 10,
    totalPages: 1,
    totalCount: 0,
    isLoading: false,
    isAdmin: false,
    isRefreshing: false, // 是否正在下拉刷新中
    loadingMore: false, // 是否正在加载更多
    loadingAnimActive: false // 加载动画状态
  },

  onLoad: function(options) {
    this.setData({ loadingAnimActive: true });
    this.getHistoryList(() => {
      setTimeout(() => {
        this.setData({ loadingAnimActive: false });
      }, 500);
    });
  },
  
  onPullDownRefresh: function() {
    this.setData({
      isRefreshing: true,
      currentPage: 1 // 重置为第一页
    });
    
    this.getHistoryList(() => {
      this.setData({ isRefreshing: false });
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function() {
    // 滚动到底部时自动加载下一页
    if (this.data.currentPage < this.data.totalPages && !this.data.loadingMore) {
      this.loadNextPage();
    }
  },
  
  // 获取历史记录列表
  getHistoryList: function(callback) {
    if (this.data.isLoading) return;
    
    this.setData({
      isLoading: true
    });
    
    !this.data.isRefreshing && wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'getHistory',
      data: {
        page: this.data.currentPage,
        pageSize: this.data.pageSize
      },
      success: res => {
        console.log('[云函数] [getHistory] 获取历史记录成功', res);
        
        if (res.result && res.result.code === 0) {
          const data = res.result.data || {};
          const historyList = data.list || [];
          const pagination = data.pagination || {};
          const isAdmin = data.isAdmin || false;
          
          // 格式化每条历史记录的时间
          const formattedList = historyList.map(item => {
            return {
              ...item,
              formattedTime: this.formatTime(item.createdAt)
            };
          });
          
          this.setData({
            historyList: formattedList,
            currentPage: pagination.page || 1,
            pageSize: pagination.pageSize || 10,
            totalPages: pagination.totalPages || 1,
            totalCount: pagination.total || 0,
            isAdmin: isAdmin
          });

          // 如果没有数据，显示提示
          if (formattedList.length === 0 && !this.data.isRefreshing) {
            wx.showToast({
              title: '暂无历史记录',
              icon: 'none',
              duration: 2000
            });
          }
        } else {
          wx.showToast({
            title: res.result && res.result.msg ? res.result.msg : '获取历史记录失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('[云函数] [getHistory] 获取历史记录失败', err);
        wx.showToast({
          title: '获取历史记录失败，请重试',
          icon: 'none'
        });
      },
      complete: () => {
        this.setData({
          isLoading: false,
          loadingMore: false
        });
        !this.data.isRefreshing && wx.hideLoading();
        
        if (callback && typeof callback === 'function') {
          callback();
        }
      }
    });
  },
  
  // 加载下一页
  loadNextPage: function() {
    if (this.data.currentPage < this.data.totalPages) {
      this.setData({
        currentPage: this.data.currentPage + 1,
        loadingMore: true
      }, () => {
        wx.showToast({
          title: '加载更多...',
          icon: 'loading',
          duration: 500
        });
        this.getHistoryList(() => {
          wx.showToast({
            title: '加载成功',
            icon: 'success',
            duration: 500
          });
        });
      });
    } else {
      wx.showToast({
        title: '已经是最后一页啦',
        icon: 'none',
        duration: 1500
      });
    }
  },
  
  // 加载上一页
  loadPrevPage: function() {
    if (this.data.currentPage > 1) {
      this.setData({
        currentPage: this.data.currentPage - 1
      }, () => {
        wx.showToast({
          title: '加载上一页',
          icon: 'loading',
          duration: 500
        });
        this.getHistoryList();
      });
    } else {
      wx.showToast({
        title: '已经是第一页啦',
        icon: 'none',
        duration: 1500
      });
    }
  },
  
  // 查看详情
  viewDetail: function(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.historyList[index];
    
    if (!item) return;
    
    // 先震动反馈
    wx.vibrateShort({
      type: 'medium'
    });

    // 显示加载中
    wx.showLoading({
      title: '加载详情...',
      mask: true
    });
    
    // 跳转到结果页，将历史记录中的话术数据传递过去
    setTimeout(() => {
      wx.hideLoading();
      wx.navigateTo({
        url: `/pages/result/result?scriptData=${encodeURIComponent(JSON.stringify({
          scripts: item.scripts,
          inviteInfo: item.inviteInfo
        }))}`,
        fail: (err) => {
          console.error('跳转结果页面失败:', err);
          wx.showToast({
            title: '页面跳转失败，请重试',
            icon: 'none'
          });
        }
      });
    }, 500);
  },

  // 显示生成统计
  showStatistics: function() {
    wx.showToast({
      title: `共生成${this.data.totalCount}条记录`,
      icon: 'none',
      duration: 2000
    });
  },
  
  // 格式化时间
  formatTime: function(timestamp) {
    if (!timestamp) {
      return '';
    }
    
    let date;
    if (typeof timestamp === 'object') {
      date = timestamp;
    } else if (typeof timestamp === 'string') {
      date = new Date(timestamp);
    } else if (typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      return '';
    }

    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // 一小时内显示"xx分钟前"
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return minutes <= 0 ? '刚刚' : `${minutes}分钟前`;
    }
    
    // 一天内显示"今天 HH:MM"
    if (date.getDate() === now.getDate() && 
        date.getMonth() === now.getMonth() && 
        date.getFullYear() === now.getFullYear()) {
      const hour = date.getHours().toString().padStart(2, '0');
      const minute = date.getMinutes().toString().padStart(2, '0');
      return `今天 ${hour}:${minute}`;
    }
    
    // 昨天显示"昨天 HH:MM"
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.getDate() === yesterday.getDate() && 
        date.getMonth() === yesterday.getMonth() && 
        date.getFullYear() === yesterday.getFullYear()) {
      const hour = date.getHours().toString().padStart(2, '0');
      const minute = date.getMinutes().toString().padStart(2, '0');
      return `昨天 ${hour}:${minute}`;
    }
    
    // 其它时间显示完整日期
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    
    return `${year}-${month}-${day} ${hour}:${minute}`;
  }
}); 