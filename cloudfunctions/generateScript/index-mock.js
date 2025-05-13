// 模拟wx-server-sdk和云数据库
const mockWxServerSdk = {
  DYNAMIC_CURRENT_ENV: 'test-env',
  init: () => {},
  getWXContext: () => {
    console.log('[模拟WX] 获取微信上下文');
    return {
      OPENID: 'test-openid',
      APPID: 'test-appid',
      UNIONID: 'test-unionid',
      ENV: 'test-env'
    };
  },
  database: () => ({
    collection: (collectionName) => ({
      add: async (data) => {
        console.log(`[模拟数据库] 添加数据到集合 ${collectionName}:`, data.data);
        return { _id: `mock-id-${Date.now()}` };
      },
      doc: (id) => ({
        update: async (data) => {
          console.log(`[模拟数据库] 更新集合 ${collectionName} 文档 ${id}:`, data.data);
          return { updated: 1 };
        },
        get: async () => {
          console.log(`[模拟数据库] 获取集合 ${collectionName} 文档 ${id}`);
          if (collectionName === 'tasks') {
            return {
              data: {
                status: 'completed',
                inviteInfo: {
                  inviteTarget: '张三',
                  inviteDate: '2025-05-20',
                  inviteReason: '肌肤护理需求',
                  inviteProject: '面部护理-深层清洁'
                },
                scripts: [
                  {
                    reason: '肌肤状态',
                    content: '张三您好！这是一条测试话术。'
                  },
                  {
                    reason: '节气保养',
                    content: '张三好久不见！这是第二条测试话术。'
                  },
                  {
                    reason: '个性化邀约',
                    content: '亲爱的张三，这是第三条测试话术。'
                  }
                ]
              }
            };
          }
          return { data: null };
        }
      }),
      where: (query) => {
        console.log(`[模拟数据库] 查询集合 ${collectionName}:`, query);
        return {
          get: async () => {
            if (collectionName === 'users' && query.openid === 'test-openid') {
              return {
                data: [
                  {
                    _id: 'mock-user-id',
                    openid: query.openid,
                    role: 'beautician',
                    remainingUsage: 10,
                    createdAt: Date.now(),
                    updatedAt: Date.now()
                  }
                ]
              };
            }
            return { data: [] };
          }
        };
      }
    })
  })
};

// 模拟axios
const mockAxios = {
  defaults: {
    timeout: 25000
  },
  post: async (url, data, config) => {
    console.log('[模拟Axios] 发送POST请求:', url);
    // 模拟大模型返回的格式
    return {
      data: {
        choices: [
          {
            message: {
              content: `1.time：${data.messages[1].content.includes('张三') ? '张三' : '测试客户'}好久不见啦！💕 最近忙什么呢？都好一阵子没来做护理了呢~想问下"2025-05-20"有空吗？我们店里新上了"面部护理-深层清洁"，特别适合您现在的肌肤护理需求情况，不如来做个护理，好好放松一下吧~期待您的光临哦！😊

2.period：${data.messages[1].content.includes('张三') ? '张三' : '测试客户'}您好！😊 距离上次护理已经过去两周了，按照您的肌肤状态，这会是最佳的护理周期呢！"2025-05-20"有时间来体验"面部护理-深层清洁"吗？正好现在是解决肌肤护理需求的黄金时期，不要错过哦！期待您的到来~🌸

3.enjoy：${data.messages[1].content.includes('张三') ? '张三' : '测试客户'}亲爱的~🌹 想犒劳一下自己吗？"2025-05-20"为什么不来享受一下我们的"面部护理-深层清洁"呢？这个项目特别舒服，能让您忘掉所有烦恼，同时还能解决您的肌肤护理需求问题！全身心放松的感觉，真的超级棒的！您值得拥有这样的享受时光~✨

4.skin：${data.messages[1].content.includes('张三') ? '张三' : '测试客户'}亲，注意到您的肌肤最近可能有些肌肤护理需求的问题呢~🔍 我们的"面部护理-深层清洁"正好可以改善这种状况！"2025-05-20"有空来做个护理吗？专业仪器配合精准手法，让肌肤问题不再困扰您！护理后肌肤会水润有光泽，手摸起来超级滑嫩呢！💦

5.body：${data.messages[1].content.includes('张三') ? '张三' : '测试客户'}您好！💪 您知道吗？良好的身体状态是美丽的基础！最近因为肌肤护理需求，可能会让您感到疲惫。"2025-05-20"有空来体验我们的"面部护理-深层清洁"吗？这个项目能帮助调理气血、放松肌肉，让您整个人焕然一新！健康与美丽，缺一不可哦~🌿

6.jieqi：${data.messages[1].content.includes('张三') ? '张三' : '测试客户'}您好！🌞 现在正值节气变化，对肌肤与身体是个不小的挑战呢！这时候的肌肤护理需求问题更需要专业护理。"2025-05-20"要不要来体验我们的"面部护理-深层清洁"？顺应节气养生，让您随时保持最佳状态！节气养护，事半功倍哦！🍃

7.weather：${data.messages[1].content.includes('张三') ? '张三' : '测试客户'}亲爱的！☔ 最近天气变化好大，这样的天气最容易引起肌肤护理需求了！为了不让天气影响您的美丽，"2025-05-20"要不要来做个"面部护理-深层清洁"？针对性解决天气带来的问题，让您不管外面刮风下雨，肌肤状态依然完美！天气再变，美丽不变！🌈

8.people：${data.messages[1].content.includes('张三') ? '张三' : '测试客户'}您知道吗？😲 最近好多顾客都来体验"面部护理-深层清洁"呢！特别是有肌肤护理需求问题的顾客，反馈简直太好了！"2025-05-20"您要不要也来试试？真的很多人都爱上这个护理了，效果非常惊艳！不要错过大家都在体验的好项目哦！👍`
            }
          }
        ]
      }
    };
  }
};

// 导出模拟模块
module.exports = {
  cloud: mockWxServerSdk,
  axios: mockAxios
}; 