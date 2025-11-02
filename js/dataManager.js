// 数据管理系统 - 完整修复版（包含分类数据同步）
class DataManager {
    constructor() {
    this.basePath = 'StreamFlix_data';
        this.isInitialized = false;
        this.initPromise = null;
        this.initializationAttempts = 0;
        this.maxInitializationAttempts = 3;
        
        console.log('DataManager 构造函数调用');
        
        // 重新定义方法，确保正确的 this 绑定
        this.index = {
            add: this.addIndex.bind(this),
            remove: this.removeIndex.bind(this),
            getAll: this.getAllIndex.bind(this)
        };

        this.folder = {
            getAll: this.getAllFolder.bind(this),
            save: this.saveFolder.bind(this),
            getItem: this.getFolderItem.bind(this),
            saveItem: this.saveFolderItem.bind(this),
            deleteItem: this.deleteFolderItem.bind(this),
            getAllItems: this.getAllFolderItems.bind(this)
        };

        this.user = {
            login: this.userLogin.bind(this),
            register: this.userRegister.bind(this),
            getById: this.getUserById.bind(this),
            update: this.updateUser.bind(this),
            syncUserData: this.syncUserData.bind(this),
            getAll: this.getAllUsers.bind(this),
            search: this.searchUsers.bind(this)
        };

        this.video = {
            getRecommended: this.getRecommendedVideos.bind(this),
            getById: this.getVideoById.bind(this),
            getByUser: this.getVideosByUser.bind(this),
            getByCategory: this.getVideosByCategory.bind(this),
            getPopular: this.getPopularVideos.bind(this),
            incrementViews: this.incrementVideoViews.bind(this),
            search: this.searchVideos.bind(this),
            create: this.createVideo.bind(this),
            update: this.updateVideo.bind(this),
            delete: this.deleteVideo.bind(this)
        };

        this.history = {
            add: this.addHistory.bind(this),
            getByUser: this.getHistoryByUser.bind(this),
            deleteByUser: this.deleteHistoryByUser.bind(this),
            deleteByVideo: this.deleteHistoryByVideo.bind(this)
        };

        this.favorite = {
            add: this.addFavorite.bind(this),
            remove: this.removeFavorite.bind(this),
            isFavorited: this.isFavorited.bind(this),
            getByUser: this.getFavoritesByUser.bind(this)
        };

        this.dynamic = {
            create: this.createDynamic.bind(this),
            getByUser: this.getDynamicsByUser.bind(this),
            update: this.updateDynamic?.bind(this),
            delete: this.deleteDynamic.bind(this),
            getByFollowing: this.getDynamicsByFollowing.bind(this)
        };

        this.search = {
            save: this.saveSearch.bind(this),
            getByUser: this.getSearchHistory.bind(this)
        };

        // 延迟初始化
        setTimeout(() => {
            this.initialize();
        }, 0);
    }

    // 获取文件夹路径
    getFolderPath(folderName) {
        return `${this.basePath}/${folderName}`;
    }

    async initialize() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise(async (resolve, reject) => {
            try {
                console.log('开始初始化 DataManager...');
                this.initializationAttempts++;
                
                // 初始化存储结构
                this.initStorage();
                
                // 确保有默认数据
                await this.ensureDefaultData();
                
                // 修复数据一致性
                this.fixDataConsistency();

                // 迁移旧版 localStorage 中的 dynamics（如果存在且尚未迁移）
                try {
                    await this.migrateLocalDynamics();
                } catch (migErr) {
                    console.warn('迁移旧 dynamics 失败，继续初始化', migErr);
                }
                
                this.isInitialized = true;
                console.log('DataManager 初始化完成');
                resolve(true);
                
            } catch (error) {
                console.error('DataManager 初始化失败:', error);
                
                if (this.initializationAttempts < this.maxInitializationAttempts) {
                    console.log(`重试初始化，尝试 ${this.initializationAttempts}/${this.maxInitializationAttempts}`);
                    setTimeout(() => {
                        this.initPromise = null;
                        this.initialize().then(resolve).catch(reject);
                    }, 1000);
                } else {
                    console.error('DataManager 初始化彻底失败');
                    this.isInitialized = false;
                    reject(new Error(`DataManager 初始化失败，已尝试 ${this.initializationAttempts} 次`));
                }
            }
        });

        return this.initPromise;
    }

    // 初始化存储结构
    initStorage() {
        console.log('初始化存储结构...');
        
        const folders = [
            'users',
            'videos', 
            'messages',
            'history',
            'dynamics',
            'search'
        ];

        folders.forEach(folder => {
            const folderKey = `${this.basePath}/${folder}`;
            try {
                const existingData = localStorage.getItem(folderKey);
                if (!existingData) {
                    const defaultValue = (folder === 'history' || folder === 'messages' || 
                                        folder === 'dynamics' || folder === 'search') ? '[]' : '{}';
                    localStorage.setItem(folderKey, defaultValue);
                    console.log(`创建文件夹: ${folderKey}`);
                }
            } catch (error) {
                console.error(`初始化文件夹 ${folderKey} 失败:`, error);
            }
        });

        const indexes = ['user_index', 'video_index'];
        indexes.forEach(index => {
            const indexKey = `${this.basePath}/${index}`;
            try {
                if (!localStorage.getItem(indexKey)) {
                    localStorage.setItem(indexKey, JSON.stringify([]));
                    console.log(`创建索引: ${indexKey}`);
                }
            } catch (error) {
                console.error(`初始化索引 ${indexKey} 失败:`, error);
            }
        });
    }

    // 确保有默认数据
    async ensureDefaultData() {
        console.log('检查默认数据...');
        
        try {
            const users = this.folder.getAllItems('users');
            console.log('现有用户数量:', users.length);
            
            if (users.length === 0) {
                console.log('没有用户数据，初始化示例数据...');
                await this.initSampleData();
            } else {
                console.log('已有用户数据，跳过示例数据初始化');
            }
            
            return true;
        } catch (error) {
            console.error('确保默认数据失败:', error);
            throw error;
        }
    }

    // 初始化示例数据
    async initSampleData() {
        console.log('初始化示例数据...');
        
        try {
                const sampleUsers = [
                {
                    id: 'user_1',
                    username: 'StreamFlix_user',
                    email: 'user@StreamFlix.com',
                    password: '123456',
                    avatar: 'assets/default-avatar.png',
                    signature: 'StreamFlix官方用户',
                    registerTime: new Date().toISOString(),
                    followers: [],
                    following: [],
                    favorites: [],
                    videos: ['video_1', 'video_2'],
                    dynamic: []
                },
                {
                    id: 'user_2',
                    username: 'video_creator',
                    email: 'creator@StreamFlix.com',
                    password: '123456',
                    avatar: 'assets/default-avatar.png',
                    signature: '热爱创作视频的UP主',
                    registerTime: new Date().toISOString(),
                    followers: ['user_1'],
                    following: ['user_1'],
                    favorites: ['video_1'],
                    videos: ['video_3'],
                    dynamic: []
                }
            ];

                const sampleVideos = [
                {
                    id: 'video_1',
                    title: '欢迎来到StreamFlix',
                    description: '这是一个示例视频，欢迎使用我们的视频平台！',
                    authorId: 'user_1',
                    authorName: 'StreamFlix_user',
                    cover: 'assets/demoCover.png',
                    video: ['assets/demoVideo.mp4'],
                    likes: 25,
                    likedBy: ['user_2'],
                    comments: [
                        {
                            id: 'comment_1',
                            authorId: 'user_2',
                            authorName: 'video_creator',
                            authorAvatar: 'assets/default-avatar.png',
                            content: '很棒的视频！',
                            publishTime: new Date().toISOString(),
                            likes: 2,
                            likedBy: ['user_1']
                        }
                    ],
                    tags: ['欢迎', '示例', '教程'],
                    category: 'life', // 使用英文分类ID
                    categoryName: '生活', // 添加中文分类名称
                    uploadTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    privacy: 'public'
                },
                {
                    id: 'video_2',
                    title: 'JavaScript 入门教程',
                    description: '学习 JavaScript 基础知识',
                    authorId: 'user_1',
                    authorName: 'StreamFlix_user',
                    cover: 'assets/demoCover.png',
                    video: ['assets/demoVideo.mp4'],
                    views: 89,
                    likes: 15,
                    likedBy: [],
                    comments: [],
                    tags: ['JavaScript', '编程', '教程'],
                    category: 'technology', // 使用英文分类ID
                    categoryName: '科技', // 添加中文分类名称
                    uploadTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                    privacy: 'public'
                },
                {
                    id: 'video_3',
                    title: '美食制作分享',
                    description: '教你制作美味佳肴',
                    authorId: 'user_2',
                    authorName: 'video_creator',
                    cover: 'assets/demoCover.png', 
                    video: ['assets/demoVideo.mp4'], 
                    views: 234,
                    likes: 42,
                    likedBy: ['user_1'],
                    comments: [],
                    tags: ['美食', '烹饪', '生活'],
                    category: 'life', // 使用英文分类ID
                    categoryName: '生活', // 添加中文分类名称
                    uploadTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                    privacy: 'public'
                }
            ];

            sampleUsers.forEach(user => {
                this.folder.saveItem('users', user.id, user);
                this.index.add('user', user.id);
            });

            sampleVideos.forEach(video => {
                this.folder.saveItem('videos', video.id, video);
                this.index.add('video', video.id);
            });

            console.log('示例数据初始化完成');
            return true;
        } catch (error) {
            console.error('初始化示例数据失败:', error);
            throw error;
        }
    }

    // 修复数据一致性问题
    fixDataConsistency() {
        try {
            console.log('修复数据一致性...');
            
            // 修复用户数据
            const users = this.folder.getAllItems('users');
            users.forEach(user => {
                if (!user.followers) user.followers = [];
                if (!user.following) user.following = [];
                if (!user.favorites) user.favorites = [];
                if (!user.videos) user.videos = [];
                if (!user.dynamic) user.dynamic = [];
                
                this.folder.saveItem('users', user.id, user);
            });

            // 修复视频数据，特别是分类数据
            const videos = this.folder.getAllItems('videos');
            videos.forEach(video => {
                if (!video.views) video.views = 0;
                if (!video.likes) video.likes = 0;
                if (!video.likedBy) video.likedBy = [];
                if (!video.comments) video.comments = [];
                if (!video.tags) video.tags = [];
                
                // 修复分类数据
                this.fixVideoCategory(video);
                
                this.folder.saveItem('videos', video.id, video);
            });
            
            console.log('数据一致性修复完成');
        } catch (error) {
            console.error('修复数据一致性时出错:', error);
            throw error;
        }
    }

    // 修复视频分类数据
    fixVideoCategory(video) {
        if (!video.category) return;
        
        // 分类映射表
        const categoryMap = {
            'technology': '科技',
            'life': '生活',
            'dance': '舞蹈',
            'game': '游戏',
            'movie': '影视',
            'music': '音乐',
            'animation': '动画',
            'entertainment': '娱乐',
            '科技': 'technology',
            '生活': 'life',
            '舞蹈': 'dance',
            '游戏': 'game',
            '影视': 'movie',
            '音乐': 'music',
            '动画': 'animation',
            '娱乐': 'entertainment'
        };
        
        // 如果category是中文，转换为英文，并设置categoryName
        if (categoryMap[video.category] && video.category.length <= 2) {
            // 中文分类，转换为英文
            const englishCategory = categoryMap[video.category];
            video.category = englishCategory;
            if (!video.categoryName) {
                video.categoryName = categoryMap[englishCategory]; // 获取中文名称
            }
        } else if (!video.categoryName) {
            // 英文分类，设置中文名称
            video.categoryName = categoryMap[video.category] || video.category;
        }
    }

    // 等待初始化完成的方法
    async waitForInitialization() {
        if (this.isInitialized) {
            return true;
        }
        return await this.initialize();
    }

    // 索引管理方法
    addIndex(type, id) {
        try {
            const indexKey = `${this.basePath}/${type}_index`;
            const index = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem(indexKey), []) : JSON.parse(localStorage.getItem(indexKey) || '[]');
            if (!index.includes(id)) {
                index.push(id);
                localStorage.setItem(indexKey, JSON.stringify(index));
            }
            return true;
        } catch (error) {
            console.error(`添加索引失败:`, error);
            return false;
        }
    }

    removeIndex(type, id) {
        try {
            const indexKey = `${this.basePath}/${type}_index`;
            const index = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem(indexKey), []) : JSON.parse(localStorage.getItem(indexKey) || '[]');
            const newIndex = index.filter(item => item !== id);
            localStorage.setItem(indexKey, JSON.stringify(newIndex));
            return true;
        } catch (error) {
            console.error(`移除索引失败:`, error);
            return false;
        }
    }

    getAllIndex(type) {
        try {
            const indexKey = `${this.basePath}/${type}_index`;
            return (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem(indexKey), []) : JSON.parse(localStorage.getItem(indexKey) || '[]');
        } catch (error) {
            console.error(`获取索引失败:`, error);
            return [];
        }
    }

    // 文件夹操作方法
    getAllFolder(folderName) {
        try {
            const folderPath = this.getFolderPath(folderName);
            const folderData = localStorage.getItem(folderPath);
            
            if (folderName === 'history' || folderName === 'messages' || 
                folderName === 'dynamics' || folderName === 'search') {
                return (typeof safeJsonParse === 'function') ? safeJsonParse(folderData, []) : JSON.parse(folderData || '[]');
            }
            return (typeof safeJsonParse === 'function') ? safeJsonParse(folderData, {}) : JSON.parse(folderData || '{}');
        } catch (e) {
            console.error(`解析文件夹 ${folderName} 数据失败:`, e);
            return folderName === 'history' || folderName === 'messages' || 
                   folderName === 'dynamics' || folderName === 'search' ? [] : {};
        }
    }

    saveFolder(folderName, data) {
        try {
            const folderPath = this.getFolderPath(folderName);
            localStorage.setItem(folderPath, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error(`保存文件夹 ${folderName} 数据失败:`, error);
            return false;
        }
    }

    getFolderItem(folderName, id) {
        try {
            const folderData = this.folder.getAll(folderName);
            if (Array.isArray(folderData)) {
                return folderData.find(item => item.id === id) || null;
            }
            return folderData[id] || null;
        } catch (error) {
            console.error(`获取项目 ${id} 失败:`, error);
            return null;
        }
    }

    saveFolderItem(folderName, id, data) {
        try {
            const folderData = this.folder.getAll(folderName);
            if (Array.isArray(folderData)) {
                const index = folderData.findIndex(item => item.id === id);
                if (index !== -1) {
                    folderData[index] = data;
                } else {
                    folderData.push(data);
                }
            } else {
                folderData[id] = data;
            }
            const result = this.folder.save(folderName, folderData);
            return result ? data : null;
        } catch (error) {
            console.error(`保存项目 ${id} 失败:`, error);
            return null;
        }
    }

    deleteFolderItem(folderName, id) {
        try {
            const folderData = this.folder.getAll(folderName);
            let found = false;
            
            if (Array.isArray(folderData)) {
                const newData = folderData.filter(item => item.id !== id);
                found = newData.length !== folderData.length;
                if (found) {
                    this.folder.save(folderName, newData);
                }
            } else {
                if (folderData[id]) {
                    delete folderData[id];
                    found = true;
                    this.folder.save(folderName, folderData);
                }
            }
            return found;
        } catch (error) {
            console.error(`删除项目 ${id} 失败:`, error);
            return false;
        }
    }

    getAllFolderItems(folderName) {
        try {
            const folderData = this.folder.getAll(folderName);
            if (Array.isArray(folderData)) {
                return folderData;
            }
            return Object.values(folderData).filter(item => item !== null && typeof item === 'object');
        } catch (error) {
            console.error(`获取所有项目失败:`, error);
            return [];
        }
    }

    // 用户管理方法
    userLogin(username, password) {
        console.log(`尝试登录: ${username}`);
        
        try {
            const users = this.folder.getAllItems('users');
            console.log(`现有用户数量: ${users.length}`);
            
            const user = users.find(u => 
                (u.username === username || u.email === username) && 
                u.password === password
            );
            
            if (!user) {
                console.log(`登录失败: 用户名或密码错误 (${username})`);
                throw new Error('用户名或密码错误');
            }
            
            console.log(`登录成功: ${user.username} (${user.id})`);
            return user;
        } catch (error) {
            console.error('登录过程出错:', error);
            throw new Error('登录失败，请重试');
        }
    }

    userRegister(userData) {
        console.log(`尝试注册: ${userData.username}`);
        
        try {
            const users = this.folder.getAllItems('users');
            const existingUser = users.find(u => 
                u.username === userData.username || u.email === userData.email
            );
            
            if (existingUser) {
                console.log(`注册失败: 用户名或邮箱已存在 (${userData.username})`);
                throw new Error('用户名或邮箱已存在');
            }
            
            const saved = this.folder.saveItem('users', userData.id, userData);
            if (!saved) {
                console.log(`注册失败: 保存用户数据失败 (${userData.username})`);
                throw new Error('保存用户数据失败');
            }
            
            this.index.add('user', userData.id);
            console.log(`注册成功: ${userData.username} (${userData.id})`);
            
            return userData;
        } catch (error) {
            console.error('注册过程出错:', error);
            throw new Error('注册失败，请重试');
        }
    }

    getUserById(userId) {
        try {
            return this.folder.getItem('users', userId);
        } catch (error) {
            console.error(`获取用户 ${userId} 失败:`, error);
            return null;
        }
    }

    updateUser(userData) {
        try {
            if (this.folder.getItem('users', userData.id)) {
                return this.folder.saveItem('users', userData.id, userData) !== null;
            }
            return false;
        } catch (error) {
            console.error(`更新用户 ${userData.id} 失败:`, error);
            return false;
        }
    }

    syncUserData(userData) {
        try {
            const existingUser = this.folder.getItem('users', userData.id);
            if (existingUser) {
                const updatedUser = { ...existingUser, ...userData };
                this.folder.saveItem('users', userData.id, updatedUser);
                return updatedUser;
            }
            return userData;
        } catch (error) {
            console.error(`同步用户数据失败:`, error);
            return userData;
        }
    }

    getAllUsers() {
        try {
            return this.folder.getAllItems('users');
        } catch (error) {
            console.error('获取所有用户失败:', error);
            return [];
        }
    }

    searchUsers(query) {
        try {
            const users = this.folder.getAllItems('users');
            const searchTerm = query.toLowerCase();
            return users.filter(user => 
                user.username.toLowerCase().includes(searchTerm) ||
                (user.signature && user.signature.toLowerCase().includes(searchTerm))
            );
        } catch (error) {
            console.error('搜索用户失败:', error);
            return [];
        }
    }

    // 视频管理方法
    getRecommendedVideos(excludeVideoId = null, limit = 10) {
        try {
            let videos = this.folder.getAllItems('videos');
            if (excludeVideoId) {
                videos = videos.filter(v => v.id !== excludeVideoId);
            }
            return videos.sort(() => Math.random() - 0.5).slice(0, limit);
        } catch (error) {
            console.error('获取推荐视频失败:', error);
            return [];
        }
    }

    getVideoById(videoId) {
        try {
            return this.folder.getItem('videos', videoId);
        } catch (error) {
            console.error(`获取视频 ${videoId} 失败:`, error);
            return null;
        }
    }

    getVideosByUser(userId) {
        try {
            const videos = this.folder.getAllItems('videos');
            return videos.filter(v => v.authorId === userId);
        } catch (error) {
            console.error(`获取用户 ${userId} 的视频失败:`, error);
            return [];
        }
    }

    // 获取分类视频 - 改进版，支持中英文分类匹配
    getVideosByCategory(category) {
        try {
            const videos = this.folder.getAllItems('videos');
            console.log(`搜索分类 ${category} 的视频，总视频数: ${videos.length}`);
            
            // 分类映射表
            const categoryMap = {
                'technology': '科技',
                'life': '生活',
                'dance': '舞蹈',
                'game': '游戏',
                'movie': '影视',
                'music': '音乐',
                'animation': '动画',
                'entertainment': '娱乐',
                '科技': 'technology',
                '生活': 'life',
                '舞蹈': 'dance',
                '游戏': 'game',
                '影视': 'movie',
                '音乐': 'music',
                '动画': 'animation',
                '娱乐': 'entertainment'
            };
            
            // 规范化分类参数
            const normalizedCategory = categoryMap[category] || category;
            
            const filteredVideos = videos.filter(v => {
                if (!v.category) {
                    console.log(`视频 ${v.id} 没有分类字段`);
                    return false;
                }
                
                // 支持多种匹配方式
                const match = v.category === normalizedCategory || 
                             v.category === category ||
                             (v.categoryName && v.categoryName === category) ||
                             (v.categoryName && categoryMap[v.categoryName] === normalizedCategory);
                
                if (match) {
                    console.log(`找到匹配视频: ${v.title}, 分类: ${v.category}, 分类名称: ${v.categoryName}`);
                }
                
                return match;
            });
            
            console.log(`分类 ${category} 找到 ${filteredVideos.length} 个视频`);
            return filteredVideos;
        } catch (error) {
            console.error(`获取分类 ${category} 的视频失败:`, error);
            return [];
        }
    }

    getPopularVideos(limit = 10) {
        try {
            const videos = this.folder.getAllItems('videos');
            return videos
                .sort((a, b) => (b.views || 0) - (a.views || 0))
                .slice(0, limit);
        } catch (error) {
            console.error('获取热门视频失败:', error);
            return [];
        }
    }

    incrementVideoViews(videoId) {
        try {
            const video = this.folder.getItem('videos', videoId);
            if (video) {
                video.views = (video.views || 0) + 1;
                this.folder.saveItem('videos', videoId, video);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`增加视频 ${videoId} 播放量失败:`, error);
            return false;
        }
    }

    searchVideos(query) {
        try {
            const videos = this.folder.getAllItems('videos');
            const searchTerm = query.toLowerCase();
            return videos.filter(video => 
                video.title.toLowerCase().includes(searchTerm) ||
                (video.description && video.description.toLowerCase().includes(searchTerm)) ||
                (video.tags && video.tags.some(tag => tag.toLowerCase().includes(searchTerm))) ||
                video.authorName.toLowerCase().includes(searchTerm)
            );
        } catch (error) {
            console.error('搜索视频失败:', error);
            return [];
        }
    }

    createVideo(videoData) {
        try {
            // 确保分类数据正确
            this.fixVideoCategory(videoData);
            
            const saved = this.folder.saveItem('videos', videoData.id, videoData);
            if (saved) {
                this.index.add('video', videoData.id);
                return videoData;
            }
            return null;
        } catch (error) {
            console.error('创建视频失败:', error);
            return null;
        }
    }

    updateVideo(videoData) {
        try {
            // 确保分类数据正确
            this.fixVideoCategory(videoData);
            
            if (this.folder.getItem('videos', videoData.id)) {
                return this.folder.saveItem('videos', videoData.id, videoData) !== null;
            }
            return false;
        } catch (error) {
            console.error('更新视频失败:', error);
            return false;
        }
    }

    deleteVideo(videoId) {
        try {
            const deleted = this.folder.deleteItem('videos', videoId);
            if (deleted) {
                this.index.remove('video', videoId);
            }
            return deleted;
        } catch (error) {
            console.error('删除视频失败:', error);
            return false;
        }
    }

    // 历史记录方法
    addHistory(historyItem) {
        try {
            const history = this.folder.getAll('history');
            const existingIndex = history.findIndex(item => 
                item.userId === historyItem.userId && item.videoId === historyItem.videoId
            );
            
            if (existingIndex !== -1) {
                history[existingIndex] = { ...history[existingIndex], ...historyItem };
            } else {
                history.push({
                    ...historyItem,
                    watchTime: new Date().toISOString()
                });
            }
            
            return this.folder.save('history', history);
        } catch (error) {
            console.error('添加历史记录失败:', error);
            return false;
        }
    }

    getHistoryByUser(userId) {
        try {
            const history = this.folder.getAll('history');
            return history
                .filter(item => item.userId === userId)
                .sort((a, b) => new Date(b.watchTime) - new Date(a.watchTime));
        } catch (error) {
            console.error('获取用户历史记录失败:', error);
            return [];
        }
    }

    deleteHistoryByUser(userId) {
        try {
            const history = this.folder.getAll('history');
            const newHistory = history.filter(item => item.userId !== userId);
            return this.folder.save('history', newHistory);
        } catch (error) {
            console.error('删除用户历史记录失败:', error);
            return false;
        }
    }

    deleteHistoryByVideo(userId, videoId) {
        try {
            const history = this.folder.getAll('history');
            const newHistory = history.filter(item => 
                !(item.userId === userId && item.videoId === videoId)
            );
            return this.folder.save('history', newHistory);
        } catch (error) {
            console.error('删除视频历史记录失败:', error);
            return false;
        }
    }

    // 收藏管理方法
    addFavorite(userId, videoId) {
        try {
            const user = this.user.getById(userId);
            if (!user) return false;

            if (!user.favorites) user.favorites = [];
            if (!user.favorites.includes(videoId)) {
                user.favorites.push(videoId);
                return this.user.update(user);
            }
            return true;
        } catch (error) {
            console.error('添加收藏失败:', error);
            return false;
        }
    }

    removeFavorite(userId, videoId) {
        try {
            const user = this.user.getById(userId);
            if (!user || !user.favorites) return false;

            user.favorites = user.favorites.filter(id => id !== videoId);
            return this.user.update(user);
        } catch (error) {
            console.error('移除收藏失败:', error);
            return false;
        }
    }

    isFavorited(userId, videoId) {
        try {
            const user = this.user.getById(userId);
            return user && user.favorites && user.favorites.includes(videoId);
        } catch (error) {
            console.error('检查收藏状态失败:', error);
            return false;
        }
    }

    getFavoritesByUser(userId) {
        try {
            const user = this.user.getById(userId);
            if (!user || !user.favorites) return [];

            const allVideos = this.folder.getAllItems('videos');
            return allVideos.filter(video => user.favorites.includes(video.id));
        } catch (error) {
            console.error('获取用户收藏失败:', error);
            return [];
        }
    }

    // 动态管理方法
    async createDynamic(dynamicData) {
        try {
            // 处理 media 引用：如果是 data: 或 blob:，尝试转换为 Blob 并存入 storageManager
            if (dynamicData && Array.isArray(dynamicData.media) && dynamicData.media.length > 0) {
                for (let i = 0; i < dynamicData.media.length; i++) {
                    const media = dynamicData.media[i];
                    if (!media || !media.url) continue;

                    try {
                        // 已经是 indexeddb 引用，跳过
                        if (typeof media.url === 'string' && media.url.startsWith('indexeddb:')) continue;

                        // 如果 storageManager 可用，尝试将 data/blob 上传到 IndexedDB
                        if (window.storageManager && window.storageManager.isSupported) {
                            let blob = null;

                            if (typeof media.url === 'string' && media.url.startsWith('blob:')) {
                                // fetch the blob URL
                                try {
                                    const resp = await fetch(media.url);
                                    blob = await resp.blob();
                                } catch (e) {
                                    console.warn('从 blob URL 获取数据失败，跳过存储:', e);
                                }
                            } else if (typeof media.url === 'string' && media.url.startsWith('data:')) {
                                // data URL -> Blob
                                try {
                                    const parts = media.url.split(',');
                                    const matches = parts[0].match(/data:(.*?)(;base64)?$/);
                                    const isBase64 = parts[0].indexOf(';base64') !== -1;
                                    const content = parts[1] || '';
                                    let byteString;
                                    if (isBase64) {
                                        byteString = atob(content);
                                    } else {
                                        byteString = decodeURIComponent(content);
                                    }
                                    const mimeString = matches ? matches[1] : (media.type && media.type.startsWith('video/') ? 'video/*' : 'image/*');
                                    const ab = new ArrayBuffer(byteString.length);
                                    const ia = new Uint8Array(ab);
                                    for (let k = 0; k < byteString.length; k++) {
                                        ia[k] = byteString.charCodeAt(k);
                                    }
                                    blob = new Blob([ab], { type: mimeString });
                                } catch (e) {
                                    console.warn('解析 data URL 失败，跳过存储:', e);
                                }
                            }

                            if (blob) {
                                const mediaId = 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
                                try {
                                    if (media.type === 'video') {
                                        await window.storageManager.storeVideo(mediaId, blob);
                                    } else {
                                        await window.storageManager.storeImage(mediaId, blob);
                                    }
                                    // 替换为 indexeddb 引用
                                    dynamicData.media[i].url = `indexeddb:${mediaId}`;
                                    dynamicData.media[i].stored = true;
                                    dynamicData.media[i].id = mediaId;
                                } catch (storeErr) {
                                    console.warn('将媒体保存到 IndexedDB 失败，保留原始 URL 回退:', storeErr);
                                }
                            }
                        }
                    } catch (innerErr) {
                        console.warn('处理媒体项时出错，继续下一个', innerErr);
                    }
                }
            }

            const dynamics = this.folder.getAll('dynamics');
            dynamics.push(dynamicData);
            const saved = this.folder.save('dynamics', dynamics);
            if (saved) {
                // 收集已存储的 media id
                const storedIds = [];
                if (Array.isArray(dynamicData.media)) {
                    dynamicData.media.forEach(m => { if (m && m.id) storedIds.push(m.id); });
                }
                return { ok: true, dynamic: dynamicData, storedMediaIds: storedIds };
            }
            return { ok: false, error: '保存 dynamics 到存储失败' };
        } catch (error) {
            console.error('创建动态失败:', error);
            return { ok: false, error: error.message || String(error) };
        }
    }

    // 更新动态（用于点赞/评论等局部更新）
    updateDynamic(dynamicData) {
        try {
            const dynamics = this.folder.getAll('dynamics');
            const idx = dynamics.findIndex(d => d.id === dynamicData.id);
            if (idx !== -1) {
                dynamics[idx] = dynamicData;
            } else {
                dynamics.push(dynamicData);
            }
            // 使用 folder.save 保持与其它 folder 方法一致
            return this.folder.save('dynamics', dynamics);
        } catch (error) {
            console.error('更新动态失败:', error);
            return false;
        }
    }

    getDynamicsByUser(userId) {
        try {
            const dynamics = this.folder.getAll('dynamics');
            return dynamics.filter(dynamic => dynamic.authorId === userId);
        } catch (error) {
            console.error('获取用户动态失败:', error);
            return [];
        }
    }

    // 将 dynamics 列表中的 indexeddb: 引用解析为临时 object URLs（返回新的 dynamics 副本）
    async resolveMediaList(dynamics) {
        try {
            if (!Array.isArray(dynamics)) return dynamics;

            const results = JSON.parse(JSON.stringify(dynamics)); // 深拷贝，避免修改原数据

            for (let d of results) {
                if (!d.media || d.media.length === 0) continue;
                for (let m of d.media) {
                    try {
                        if (typeof m.url === 'string' && m.url.startsWith('indexeddb:') && window.storageManager && window.storageManager.isSupported) {
                            const id = m.url.replace('indexeddb:', '');
                            try {
                                if (m.type === 'video') {
                                    const rec = await window.storageManager.getVideo(id);
                                    if (rec && rec.file) {
                                        m.displayUrl = window.createObjectURLTracked ? window.createObjectURLTracked(rec.file) : URL.createObjectURL(rec.file);
                                    }
                                } else {
                                    const rec = await window.storageManager.getImage(id);
                                    if (rec && rec.file) {
                                        m.displayUrl = window.createObjectURLTracked ? window.createObjectURLTracked(rec.file) : URL.createObjectURL(rec.file);
                                    }
                                }
                            } catch (e) {
                                console.warn('从 IndexedDB 加载媒体失败:', e);
                                m.displayUrl = m.url; // fallback to original
                            }
                        } else {
                            // 非 indexeddb，直接用于显示
                            m.displayUrl = m.url;
                        }
                    } catch (e) {
                        console.warn('解析单个媒体失败:', e);
                        m.displayUrl = m.url;
                    }
                }
            }

            return results;
        } catch (error) {
            console.error('解析 media list 失败:', error);
            return dynamics;
        }
    }

    deleteDynamic(dynamicId) {
        try {
            const dynamics = this.folder.getAll('dynamics');
            const newDynamics = dynamics.filter(d => d.id !== dynamicId);
            return this.folder.save('dynamics', newDynamics);
        } catch (error) {
            console.error('删除动态失败:', error);
            return false;
        }
    }

    getDynamicsByFollowing(userId) {
        try {
            const user = this.user.getById(userId);
            if (!user || !user.following) return [];

            const dynamics = this.folder.getAll('dynamics');
            return dynamics.filter(dynamic => 
                user.following.includes(dynamic.authorId) || dynamic.authorId === userId
            );
        } catch (error) {
            console.error('获取关注动态失败:', error);
            return [];
        }
    }

    // 搜索历史管理
    saveSearch(userId, query) {
        try {
            if (!userId) {
                 let tempHistory = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('tempSearchHistory'), []) : JSON.parse(localStorage.getItem('tempSearchHistory') || '[]');
                tempHistory = tempHistory.filter(item => item !== query);
                tempHistory.unshift(query);
                tempHistory = tempHistory.slice(0, 10);
                localStorage.setItem('tempSearchHistory', JSON.stringify(tempHistory));
                return true;
            }

            const user = this.user.getById(userId);
            if (!user) return false;

            if (!user.searchHistory) user.searchHistory = [];
            
            user.searchHistory = user.searchHistory.filter(item => 
                typeof item === 'string' ? item !== query : item.query !== query
            );
            
            user.searchHistory.unshift({
                query: query,
                timestamp: new Date().toISOString()
            });
            
            user.searchHistory = user.searchHistory.slice(0, 10);
            
            return this.user.update(user);
        } catch (error) {
            console.error('保存搜索记录失败:', error);
            return false;
        }
    }

    getSearchHistory(userId) {
        try {
            if (!userId) {
                return (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('tempSearchHistory'), []) : JSON.parse(localStorage.getItem('tempSearchHistory') || '[]');
            }

            const user = this.user.getById(userId);
            return user?.searchHistory || [];
        } catch (error) {
            console.error('获取搜索历史失败:', error);
            return [];
        }
    }

    optimizeStorage() {
        try {
            console.log('开始优化存储...');
            
            // 清理过期的临时数据
            this.cleanupExpiredData();
            
            // 压缩存储数据
            this.compressStorageData();
            
            // 限制历史记录数量
            this.limitHistoryRecords();
            
            console.log('存储优化完成');
        } catch (error) {
            console.error('存储优化失败:', error);
        }
    }

    // 清理过期数据
    cleanupExpiredData() {
        try {
            // 清理30天前的历史记录
            const history = this.folder.getAll('history');
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const filteredHistory = history.filter(item => 
                new Date(item.watchTime) > thirtyDaysAgo
            );
            
            if (filteredHistory.length !== history.length) {
                this.folder.save('history', filteredHistory);
                console.log(`清理了 ${history.length - filteredHistory.length} 条历史记录`);
            }
            
            // 清理临时搜索记录
            const tempSearchHistory = safeJsonParse(localStorage.getItem('tempSearchHistory'), []);
            if (tempSearchHistory.length > 50) {
                localStorage.setItem('tempSearchHistory', JSON.stringify(tempSearchHistory.slice(0, 50)));
            }
            
        } catch (error) {
            console.error('清理过期数据失败:', error);
        }
    }

    // 压缩存储数据
    compressStorageData() {
        try {
            // 移除视频数据中的大文件字段
            const videos = this.folder.getAllItems('videos');
            videos.forEach(video => {
                // 确保不存储大文件数据
                if (video.videoUrl && video.videoUrl.startsWith('data:') && video.videoUrl.length > 10000) {
                    video.videoUrl = ''; // 清空大文件数据
                }
                if (video.cover && video.cover.startsWith('data:') && video.cover.length > 50000) {
                    video.cover = ''; // 清空大封面数据
                }
            });

            // 清理用户头像中意外存入的大 base64 字符串，避免 localStorage 膨胀
            try {
                const users = this.folder.getAllItems('users');
                users.forEach(u => {
                    if (u && u.avatar && typeof u.avatar === 'string' && u.avatar.startsWith('data:') && u.avatar.length > 20000) {
                        console.warn('发现过大的用户头像，替换为默认头像，userId=', u.id);
                        u.avatar = 'assets/default-avatar.png';
                    }
                });
                this.folder.save('users', users);
            } catch (e) {
                console.warn('清理用户头像数据失败:', e);
            }
            
            this.folder.save('videos', videos);
            console.log('视频数据压缩完成');
            
        } catch (error) {
            console.error('数据压缩失败:', error);
        }
    }

    // 限制历史记录数量
    limitHistoryRecords() {
        try {
            const history = this.folder.getAll('history');
            if (history.length > 1000) {
                // 只保留最近的1000条记录
                const limitedHistory = history
                    .sort((a, b) => new Date(b.watchTime) - new Date(a.watchTime))
                    .slice(0, 1000);
                this.folder.save('history', limitedHistory);
                console.log(`历史记录限制为1000条，清理了 ${history.length - 1000} 条记录`);
            }
        } catch (error) {
            console.error('限制历史记录失败:', error);
        }
    }

    // 检查存储空间
    checkStorage() {
        try {
            let totalSize = 0;
            for (let key in localStorage) {
                if (localStorage.hasOwnProperty(key)) {
                    totalSize += localStorage[key].length * 2; // 每个字符2字节
                }
            }
            const totalMB = (totalSize / 1024 / 1024).toFixed(2);
            console.log(`当前存储使用: ${totalMB} MB`);
            
            return {
                used: totalSize,
                usedMB: totalMB,
                warning: totalSize > 4 * 1024 * 1024 // 超过4MB警告
            };
        } catch (error) {
            console.error('检查存储空间失败:', error);
            return { used: 0, usedMB: '0', warning: false };
        }
    }

    // 在 DataManager 类中添加方法
    checkStorageManager() {
        return new Promise((resolve) => {
            if (window.storageManager && typeof window.storageManager.getSupportStatus === 'function') {
                const status = window.storageManager.getSupportStatus();
                resolve(status);
            } else {
                resolve({ supported: false, initialized: false });
            }
        });
    }

    // 将旧版 localStorage 'dynamics' 数据迁移到 DataManager 的 folder 存储中（如果尚未迁移）
    async migrateLocalDynamics() {
        try {
             const legacy = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('dynamics'), []) : JSON.parse(localStorage.getItem('dynamics') || '[]');
            if (!legacy || legacy.length === 0) return false;

            const existing = this.folder.getAll('dynamics') || [];
            // 如果已有数据则合并并去重（以 id 为准）
            const map = new Map();
            existing.forEach(d => { if (d && d.id) map.set(d.id, d); });
            legacy.forEach(d => { if (d && d.id && !map.has(d.id)) map.set(d.id, d); });

            const merged = Array.from(map.values());
            this.folder.save('dynamics', merged);

            // 删除旧的 localStorage 以避免重复来源
            localStorage.removeItem('dynamics');
            console.log(`已迁移 ${legacy.length} 条 legacy dynamics 到 DataManager 存储`);
            return true;
        } catch (error) {
            console.error('迁移 localStorage dynamics 失败:', error);
            return false;
        }
    }

    // 调试方法：显示所有视频的分类信息
    debugVideoCategories() {
        try {
            const allVideos = this.folder.getAllItems('videos');
            console.log('=== 所有视频分类信息 ===');
            allVideos.forEach(video => {
                console.log(`视频: ${video.title}, 分类: ${video.category}, 分类名称: ${video.categoryName}, ID: ${video.id}`);
            });
            console.log(`总计: ${allVideos.length} 个视频`);
            console.log('=== 结束 ===');
        } catch (error) {
            console.error('调试视频分类失败:', error);
        }
    }

    // 调试方法：显示特定分类的视频
    debugCategoryVideos(category) {
        try {
            const videos = this.getVideosByCategory(category);
            console.log(`=== ${category} 分类视频 ===`);
            videos.forEach(video => {
                console.log(`视频: ${video.title}, 分类: ${video.category}, 分类名称: ${video.categoryName}`);
            });
            console.log(`找到 ${videos.length} 个视频`);
            console.log('=== 结束 ===');
        } catch (error) {
            console.error('调试分类视频失败:', error);
        }
    }

    // 注意：原文件中存在重复的 initialize 实现，已移除后面的重复定义，保留类顶部的主 initialize 方法。

}

// 创建全局实例 - 带有错误处理
console.log('开始加载 DataManager...');
try {
    let dataManager = new DataManager();
    window.dataManager = dataManager;
    
    // 导出数据管理器
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = DataManager;
    }
} catch (error) {
    console.error('创建 DataManager 实例失败:', error);
    // 创建降级的数据管理器
    window.dataManager = {
        isInitialized: false,
        waitForInitialization: () => Promise.resolve(false),
        folder: {
            getAllItems: () => [],
            getItem: () => null,
            saveItem: () => null
        },
        user: {
            login: () => { throw new Error('DataManager 未初始化'); },
            register: () => { throw new Error('DataManager 未初始化'); },
            getById: () => null
        },
        video: {
            getRecommended: () => [],
            getById: () => null,
            getByCategory: () => [],
            search: () => []
        }
    };
}

// 在 storageManager.js 末尾替换立即执行函数
(function() {
    console.log('开始加载 StorageManager...');
    
    try {
        // 创建全局实例
        const storageManager = new StorageManager();
        
        // 确保全局可用
        window.StorageManager = StorageManager;
        window.storageManager = storageManager;
        
        console.log('StorageManager 加载成功，支持状态:', storageManager.getSupportStatus());
        
        // 自动初始化（但允许外部等待）
        storageManager.initialize().catch(error => {
            console.warn('StorageManager 自动初始化失败:', error);
            // 不阻止应用运行，使用降级方案
        });
        
    } catch (error) {
        console.error('StorageManager 创建失败:', error);
        setupFallbackStorageManager();
    }
    
    function setupFallbackStorageManager() {
        console.log('设置降级 StorageManager');
        const fallbackStorageManager = {
            isSupported: false,
            isInitialized: false,
            initialize: () => Promise.reject(new Error('存储管理器不可用')),
            getVideo: () => Promise.reject(new Error('存储管理器不可用')),
            storeVideo: () => Promise.reject(new Error('存储管理器不可用')),
            getSupportStatus: () => ({ supported: false, initialized: false })
        };
        
        window.StorageManager = class {
            constructor() {
                return fallbackStorageManager;
            }
        };
        window.storageManager = fallbackStorageManager;
    }
})();