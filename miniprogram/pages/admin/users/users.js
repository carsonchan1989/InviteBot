Page({
  data: {
    userList: [],
    loading: true,
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,
    searchValue: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    filterRole: 'all'
  },

  onLoad: function() {
    this.fetchUserList();
  },

  onPullDownRefresh: function() {
    var that = this;
    this.setData({
      currentPage: 1,
      userList: []
    }, function() {
      that.fetchUserList();
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom: function() {
    if (this.data.currentPage < this.data.totalPages) {
      var that = this;
      this.setData({
        currentPage: this.data.currentPage + 1
      }, function() {
        that.fetchUserList(true);
      });
    }
  },

  // 获取用户列表
  fetchUserList: function(append) {
    var that = this;
    append = append || false;
    
    this.setData({ loading: true });

    wx.cloud.callFunction({
      name: 'manageUsers',
      data: {
        action: 'getUsers',
        page: this.data.currentPage,
        pageSize: this.data.pageSize,
        searchValue: this.data.searchValue,
        sortBy: this.data.sortBy,
        sortOrder: this.data.sortOrder,
        filterRole: this.data.filterRole === 'all' ? '' : this.data.filterRole
      },
      success: function(res) {
        console.log('[云函数] [manageUsers] 获取用户列表成功', res);
        
        if (res.result && res.result.code === 0) {
          var users = res.result.data.users || [];
          var processedUsers = [];
          
          for (var i = 0; i < users.length; i++) {
            var user = users[i];
            // 计算已使用次数
            var totalUsage = user.totalUsage || 0;
            var remainingUsage = user.remainingUsage || 0;
            var usedUsage = totalUsage - remainingUsage;
            
            // 格式化时间
            var createDate = user.createdAt ? new Date(user.createdAt) : new Date();
            var createTime = createDate.getFullYear() + '-' + 
                            String(createDate.getMonth() + 1).padStart(2, '0') + '-' + 
                            String(createDate.getDate()).padStart(2, '0');
            
            // 创建新对象而不使用扩展运算符
            var processedUser = {
              _id: user._id,
              openid: user.openid,
              nickName: user.nickName,
              avatarUrl: user.avatarUrl,
              role: user.role,
              remainingUsage: user.remainingUsage,
              totalUsage: user.totalUsage,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt,
              // 添加处理后的字段
              createTime: createTime,
              usedUsage: usedUsage,
              roleName: user.role === 'admin' ? '管理员' : '美容师'
            };
            
            processedUsers.push(processedUser);
          }
          
          // 更新数据
          if (append) {
            var newUserList = that.data.userList.concat(processedUsers);
            that.setData({
              userList: newUserList,
              totalPages: res.result.data.totalPages || 1,
              loading: false
            });
          } else {
            that.setData({
              userList: processedUsers,
              totalPages: res.result.data.totalPages || 1,
              loading: false
            });
          }
        } else {
          wx.showToast({
            title: res.result && res.result.msg ? res.result.msg : '获取用户列表失败',
            icon: 'none'
          });
          that.setData({ loading: false });
        }
      },
      fail: function(err) {
        console.error('[云函数] [manageUsers] 获取用户列表失败', err);
        wx.showToast({
          title: '获取用户列表失败',
          icon: 'none'
        });
        that.setData({ loading: false });
      }
    });
  },

  // 搜索框输入事件
  onSearchInput: function(e) {
    this.setData({
      searchValue: e.detail.value
    });
  },

  // 执行搜索
  onSearch: function() {
    var that = this;
    this.setData({
      currentPage: 1,
      userList: []
    }, function() {
      that.fetchUserList();
    });
  },

  // 清除搜索
  onSearchClear: function() {
    var that = this;
    this.setData({
      searchValue: '',
      currentPage: 1,
      userList: []
    }, function() {
      that.fetchUserList();
    });
  },

  // 筛选角色变化
  onFilterRoleChange: function(e) {
    var that = this;
    this.setData({
      filterRole: e.detail.value,
      currentPage: 1,
      userList: []
    }, function() {
      that.fetchUserList();
    });
  },

  // 排序方式变化
  onSortChange: function(e) {
    var value = e.detail.value;
    var sortBy, sortOrder;
    
    switch(value) {
      case 'createTime_desc':
        sortBy = 'createdAt';
        sortOrder = 'desc';
        break;
      case 'createTime_asc':
        sortBy = 'createdAt';
        sortOrder = 'asc';
        break;
      case 'usage_desc':
        sortBy = 'remainingUsage';
        sortOrder = 'desc';
        break;
      case 'usage_asc':
        sortBy = 'remainingUsage';
        sortOrder = 'asc';
        break;
      default:
        sortBy = 'createdAt';
        sortOrder = 'desc';
    }
    
    var that = this;
    this.setData({
      sortBy: sortBy,
      sortOrder: sortOrder,
      currentPage: 1,
      userList: []
    }, function() {
      that.fetchUserList();
    });
  },

  // 编辑用户
  editUser: function(e) {
    const userId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/admin/users/edit/edit?id=${userId}`
    });
  },

  // 增加使用次数
  addUsage: function(e) {
    var userId = e.currentTarget.dataset.id;
    var userName = e.currentTarget.dataset.name || '该用户';
    var that = this;
    
    wx.showModal({
      title: '增加使用次数',
      content: '请输入要为' + userName + '增加的使用次数',
      editable: true,
      placeholderText: '请输入数字',
      success: function(res) {
        if (res.confirm) {
          var usageToAdd = parseInt(res.content);
          
          if (isNaN(usageToAdd) || usageToAdd <= 0) {
            wx.showToast({
              title: '请输入有效的数字',
              icon: 'none'
            });
            return;
          }
          
          that.doAddUsage(userId, usageToAdd);
        }
      }
    });
  },
  
  // 执行增加使用次数
  doAddUsage: function(userId, count) {
    var that = this;
    wx.showLoading({
      title: '处理中',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'manageUsers',
      data: {
        action: 'addUsageCount',
        userId: userId,
        data: {
          count: count
        }
      },
      success: function(res) {
        wx.hideLoading();
        console.log('[云函数] [manageUsers] 增加使用次数成功', res);
        
        if (res.result && res.result.code === 0) {
          wx.showToast({
            title: '增加成功',
            icon: 'success'
          });
          
          // 刷新用户列表
          that.fetchUserList();
        } else {
          wx.showToast({
            title: res.result && res.result.msg ? res.result.msg : '增加失败',
            icon: 'none'
          });
        }
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('[云函数] [manageUsers] 增加使用次数失败', err);
        wx.showToast({
          title: '增加失败',
          icon: 'none'
        });
      }
    });
  },

  // 添加新用户
  addNewUser: function() {
    wx.navigateTo({
      url: '/pages/admin/users/add/add'
    });
  }
}); 