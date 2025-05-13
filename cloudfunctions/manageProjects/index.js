// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const usersCollection = db.collection('users');
const projectsCollection = db.collection('projects');

// 初始化数据库集合
async function initCollections() {
  try {
    console.log('开始初始化数据库集合...');
    const collections = ['categories', 'projects'];
    
    for (const collName of collections) {
      try {
        // 尝试查询集合，如果能查询说明已存在
        await db.collection(collName).count();
        console.log(`集合 ${collName} 已存在`);
      } catch (err) {
        if (err.errCode === -502005 || err.message.includes('collection not exists')) {
          try {
            // 创建集合
            await db.createCollection(collName);
            console.log(`成功创建集合 ${collName}`);
            
            // 如果是categories集合，添加默认分类
            if (collName === 'categories') {
              await addDefaultCategories();
            }
          } catch (createErr) {
            console.error(`创建集合 ${collName} 失败:`, createErr);
          }
        } else {
          console.error(`检查集合 ${collName} 时出错:`, err);
        }
      }
    }
    console.log('数据库集合初始化完成');
  } catch (error) {
    console.error('初始化数据库集合失败:', error);
  }
}

// 添加默认分类和项目
async function addDefaultCategories() {
  try {
    const categoriesCollection = db.collection('categories');
    const categoriesCount = await categoriesCollection.count();
    
    // 只有当分类集合为空时才添加默认数据
    if (categoriesCount.total === 0) {
      console.log('添加默认分类数据...');
      
      const defaultCategories = [
        {
          name: '面部护理',
          items: ['基础补水', '深层清洁', '紧致提升', '美白焕肤'],
          order: 1,
          createdAt: Date.now()
        },
        {
          name: '身体护理',
          items: ['肩颈舒缓', '背部SPA', '腿部舒缓', '全身排毒'],
          order: 2,
          createdAt: Date.now()
        },
        {
          name: '全身SPA',
          items: ['精油SPA', '热石SPA', '草本SPA', '香薰SPA'],
          order: 3,
          createdAt: Date.now()
        }
      ];
      
      for (const category of defaultCategories) {
        await categoriesCollection.add({
          data: category
        });
      }
      
      console.log('添加默认分类数据完成');
    }
  } catch (error) {
    console.error('添加默认分类数据失败:', error);
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  // 先初始化数据库集合
  await initCollections();
  
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  
  try {
    // 先查询操作用户是否为管理员
    const adminResult = await usersCollection.where({
      openid: openid,
      role: 'admin'
    }).get();
    
    if (!adminResult.data || adminResult.data.length === 0) {
      return {
        code: -1,
        msg: '权限不足，仅管理员可进行此操作'
      };
    }
    
    // 根据操作类型执行不同的逻辑
    const { action, projectId, data } = event;
    
    switch (action) {
      case 'getProjects':
        return await getProjects(event);
      case 'addProject':
        return await addProject(data);
      case 'updateProject':
        return await updateProject(projectId, data);
      case 'deleteProject':
        return await deleteProject(projectId);
      default:
        return {
          code: -1,
          msg: '未知操作类型'
        };
    }
  } catch (error) {
    console.error('项目管理操作出错:', error);
    return {
      code: -1,
      msg: '操作失败，请重试',
      error: error
    };
  }
};

// 获取项目列表
async function getProjects(event) {
  const { page = 1, pageSize = 20, category = '', searchKey = '' } = event;
  const skip = (page - 1) * pageSize;
  
  let query = projectsCollection;
  
  // 如果有分类筛选
  if (category) {
    query = query.where({
      category: category
    });
  }
  
  // 如果有搜索关键字，添加查询条件
  if (searchKey) {
    query = query.where({
      projectName: db.RegExp({
        regexp: searchKey,
        options: 'i'
      })
    });
  }
  
  // 获取总数
  const countResult = await query.count();
  
  // 获取当前页数据
  const projectsResult = await query.skip(skip).limit(pageSize).orderBy('createdAt', 'desc').get();
  
  return {
    code: 0,
    msg: '获取成功',
    data: {
      list: projectsResult.data,
      total: countResult.total,
      page: page,
      pageSize: pageSize,
      pages: Math.ceil(countResult.total / pageSize)
    }
  };
}

// 添加项目
async function addProject(data) {
  try {
    const timestamp = Date.now();
    const newProject = {
      ...data,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    const result = await projectsCollection.add({
      data: newProject
    });
    
    return {
      code: 0,
      msg: '添加成功',
      data: {
        _id: result._id
      }
    };
  } catch (error) {
    console.error('添加项目失败:', error);
    return {
      code: -1,
      msg: '添加项目失败',
      error: error
    };
  }
}

// 更新项目信息
async function updateProject(projectId, data) {
  try {
    await projectsCollection.doc(projectId).update({
      data: {
        ...data,
        updatedAt: Date.now()
      }
    });
    
    return {
      code: 0,
      msg: '更新成功'
    };
  } catch (error) {
    console.error('更新项目信息失败:', error);
    return {
      code: -1,
      msg: '更新项目信息失败',
      error: error
    };
  }
}

// 删除项目
async function deleteProject(projectId) {
  try {
    await projectsCollection.doc(projectId).remove();
    
    return {
      code: 0,
      msg: '删除成功'
    };
  } catch (error) {
    console.error('删除项目失败:', error);
    return {
      code: -1,
      msg: '删除项目失败',
      error: error
    };
  }
} 