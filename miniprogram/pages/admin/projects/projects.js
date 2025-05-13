Page({
  data: {
    projectList: [],
    categories: [],
    loading: true,
    currentCategory: '',
    editMode: false,
    currentProject: null,
    newCategoryName: '',
    newItemName: '',
    showAddCategory: false,
    showAddItem: false
  },

  onLoad: function() {
    this.fetchProjectList();
  },

  onPullDownRefresh: function() {
    this.fetchProjectList();
    wx.stopPullDownRefresh();
  },

  // 获取项目列表
  fetchProjectList: function() {
    var that = this;
    this.setData({ loading: true });

    wx.cloud.callFunction({
      name: 'manageProjects',
      data: {
        action: 'getProjects'
      },
      success: function(res) {
        console.log('[云函数] [manageProjects] 获取项目列表成功', res);
        
        if (res.result && res.result.code === 0) {
          var categories = res.result.data.categories || [];
          var categoryNames = [];
          
          // 提取分类名称
          for (var i = 0; i < categories.length; i++) {
            categoryNames.push(categories[i].name);
          }
          
          that.setData({
            projectList: categories,
            categories: categoryNames,
            loading: false,
            currentCategory: categories.length > 0 ? categories[0].name : ''
          });
        } else {
          wx.showToast({
            title: res.result && res.result.msg ? res.result.msg : '获取项目列表失败',
            icon: 'none'
          });
          that.setData({ loading: false });
        }
      },
      fail: function(err) {
        console.error('[云函数] [manageProjects] 获取项目列表失败', err);
        wx.showToast({
          title: '获取项目列表失败',
          icon: 'none'
        });
        that.setData({ loading: false });
      }
    });
  },

  // 切换分类
  changeCategory: function(e) {
    var category = e.currentTarget.dataset.category;
    this.setData({ currentCategory: category });
  },

  // 新增分类按钮
  showAddCategoryInput: function() {
    this.setData({ 
      showAddCategory: true,
      newCategoryName: '' 
    });
  },

  // 取消添加分类
  cancelAddCategory: function() {
    this.setData({ showAddCategory: false });
  },

  // 新分类名输入
  onNewCategoryInput: function(e) {
    this.setData({ newCategoryName: e.detail.value });
  },

  // 确认添加分类
  confirmAddCategory: function() {
    var newCategoryName = this.data.newCategoryName;
    var categories = this.data.categories;
    var that = this;
    
    if (!newCategoryName.trim()) {
      wx.showToast({
        title: '分类名称不能为空',
        icon: 'none'
      });
      return;
    }
    
    // 检查分类是否已存在
    var categoryExists = false;
    for (var i = 0; i < categories.length; i++) {
      if (categories[i] === newCategoryName) {
        categoryExists = true;
        break;
      }
    }
    
    if (categoryExists) {
      wx.showToast({
        title: '该分类已存在',
        icon: 'none'
      });
      return;
    }
    
    wx.showLoading({
      title: '添加中',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'manageProjects',
      data: {
        action: 'addCategory',
        categoryName: newCategoryName
      },
      success: function(res) {
        wx.hideLoading();
        console.log('[云函数] [manageProjects] 添加分类成功', res);
        
        if (res.result && res.result.code === 0) {
          // 更新本地数据
          var updatedCategories = categories.slice();
          updatedCategories.push(newCategoryName);
          
          var updatedProjectList = that.data.projectList.slice();
          updatedProjectList.push({
            name: newCategoryName,
            items: []
          });
          
          that.setData({
            categories: updatedCategories,
            projectList: updatedProjectList,
            showAddCategory: false,
            currentCategory: newCategoryName
          });
          
          wx.showToast({
            title: '添加成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: res.result && res.result.msg ? res.result.msg : '添加分类失败',
            icon: 'none'
          });
        }
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('[云函数] [manageProjects] 添加分类失败', err);
        wx.showToast({
          title: '添加分类失败',
          icon: 'none'
        });
      }
    });
  },

  // 删除分类
  deleteCategory: function(e) {
    var category = e.currentTarget.dataset.category;
    var that = this;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除"' + category + '"分类吗？该分类下的所有项目都将被删除。',
      success: function(res) {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中',
            mask: true
          });
          
          wx.cloud.callFunction({
            name: 'manageProjects',
            data: {
              action: 'deleteCategory',
              categoryName: category
            },
            success: function(res) {
              wx.hideLoading();
              console.log('[云函数] [manageProjects] 删除分类成功', res);
              
              if (res.result && res.result.code === 0) {
                // 更新本地数据
                var updatedCategories = [];
                for (var i = 0; i < that.data.categories.length; i++) {
                  if (that.data.categories[i] !== category) {
                    updatedCategories.push(that.data.categories[i]);
                  }
                }
                
                var updatedProjectList = [];
                for (var i = 0; i < that.data.projectList.length; i++) {
                  if (that.data.projectList[i].name !== category) {
                    updatedProjectList.push(that.data.projectList[i]);
                  }
                }
                
                that.setData({
                  categories: updatedCategories,
                  projectList: updatedProjectList,
                  currentCategory: updatedCategories.length > 0 ? updatedCategories[0] : ''
                });
                
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                });
              } else {
                wx.showToast({
                  title: res.result && res.result.msg ? res.result.msg : '删除分类失败',
                  icon: 'none'
                });
              }
            },
            fail: function(err) {
              wx.hideLoading();
              console.error('[云函数] [manageProjects] 删除分类失败', err);
              wx.showToast({
                title: '删除分类失败',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  },

  // 新增项目按钮
  showAddItemInput: function() {
    this.setData({ 
      showAddItem: true,
      newItemName: '' 
    });
  },

  // 取消添加项目
  cancelAddItem: function() {
    this.setData({ showAddItem: false });
  },

  // 新项目名输入
  onNewItemInput: function(e) {
    this.setData({ newItemName: e.detail.value });
  },

  // 确认添加项目
  confirmAddItem: function() {
    var newItemName = this.data.newItemName;
    var currentCategory = this.data.currentCategory;
    var that = this;
    
    if (!newItemName.trim()) {
      wx.showToast({
        title: '项目名称不能为空',
        icon: 'none'
      });
      return;
    }
    
    // 查找当前分类的项目列表
    var currentCategoryItems = [];
    for (var i = 0; i < that.data.projectList.length; i++) {
      if (that.data.projectList[i].name === currentCategory) {
        currentCategoryItems = that.data.projectList[i].items || [];
        break;
      }
    }
    
    // 检查项目是否已存在
    for (var i = 0; i < currentCategoryItems.length; i++) {
      if (currentCategoryItems[i] === newItemName) {
        wx.showToast({
          title: '该项目已存在',
          icon: 'none'
        });
        return;
      }
    }
    
    wx.showLoading({
      title: '添加中',
      mask: true
    });
    
    wx.cloud.callFunction({
      name: 'manageProjects',
      data: {
        action: 'addItem',
        categoryName: currentCategory,
        itemName: newItemName
      },
      success: function(res) {
        wx.hideLoading();
        console.log('[云函数] [manageProjects] 添加项目成功', res);
        
        if (res.result && res.result.code === 0) {
          // 更新本地数据
          var updatedProjectList = that.data.projectList.slice();
          
          for (var i = 0; i < updatedProjectList.length; i++) {
            if (updatedProjectList[i].name === currentCategory) {
              var items = updatedProjectList[i].items || [];
              items.push(newItemName);
              updatedProjectList[i].items = items;
              break;
            }
          }
          
          that.setData({
            projectList: updatedProjectList,
            showAddItem: false
          });
          
          wx.showToast({
            title: '添加成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: res.result && res.result.msg ? res.result.msg : '添加项目失败',
            icon: 'none'
          });
        }
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('[云函数] [manageProjects] 添加项目失败', err);
        wx.showToast({
          title: '添加项目失败',
          icon: 'none'
        });
      }
    });
  },

  // 删除项目
  deleteItem: function(e) {
    var category = e.currentTarget.dataset.category;
    var item = e.currentTarget.dataset.item;
    var that = this;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除"' + item + '"项目吗？',
      success: function(res) {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中',
            mask: true
          });
          
          wx.cloud.callFunction({
            name: 'manageProjects',
            data: {
              action: 'deleteItem',
              categoryName: category,
              itemName: item
            },
            success: function(res) {
              wx.hideLoading();
              console.log('[云函数] [manageProjects] 删除项目成功', res);
              
              if (res.result && res.result.code === 0) {
                // 更新本地数据
                var updatedProjectList = that.data.projectList.slice();
                
                for (var i = 0; i < updatedProjectList.length; i++) {
                  if (updatedProjectList[i].name === category) {
                    var items = [];
                    for (var j = 0; j < updatedProjectList[i].items.length; j++) {
                      if (updatedProjectList[i].items[j] !== item) {
                        items.push(updatedProjectList[i].items[j]);
                      }
                    }
                    updatedProjectList[i].items = items;
                    break;
                  }
                }
                
                that.setData({
                  projectList: updatedProjectList
                });
                
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                });
              } else {
                wx.showToast({
                  title: res.result && res.result.msg ? res.result.msg : '删除项目失败',
                  icon: 'none'
                });
              }
            },
            fail: function(err) {
              wx.hideLoading();
              console.error('[云函数] [manageProjects] 删除项目失败', err);
              wx.showToast({
                title: '删除项目失败',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  }
}); 