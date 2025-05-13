Component({
  data: {
    selected: 0,
    color: "#999999",
    selectedColor: "#7B55D0",
    list: [{
      pagePath: "/pages/index/index",
      text: "话术生成",
      iconPath: "/images/tabbar/icon-generate.png",
      selectedIconPath: "/images/tabbar/icon-generate-selected.png"
    }, {
      pagePath: "/pages/admin/admin",
      text: "我的",
      iconPath: "/images/tabbar/icon-my.png",
      selectedIconPath: "/images/tabbar/icon-my-selected.png"
    }]
  },
  attached() {
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({
        url
      });
      this.setData({
        selected: data.index
      });
    }
  }
}) 