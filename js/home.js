// 完整版首页功能 - 包含分类视频功能（修复分类数据同步）
class HomeManager {
    constructor() {
        this.currentUser = null;
        this.currentPage = this.getCurrentPageFromURL();
        this.isInitialized = false;
        this.initializationPromise = null;
        this.eventListenersBound = false;
        
        // 分类视频相关属性
        this.currentCategory = null;
        this.categoryVideos = [];
        this.filteredCategoryVideos = [];
        this.displayedCategoryVideos = [];
        this.categoryVideosPerPage = 12;
        this.currentCategoryPage = 1;
        
        console.log('HomeManager 初始化开始');
        this.init();
    }

    async init() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = new Promise(async (resolve) => {
            try {
                console.log('首页初始化...');
                
                // 等待必要的依赖
                await this.waitForDependencies();
                
                // 获取当前用户
                this.currentUser = this.getCurrentUser();
                
                this.setupEventListeners();
                this.updateNavigation();
                this.loadPageContent(this.currentPage);
                this.isInitialized = true;
                
                console.log('首页初始化完成');
                resolve(true);
            } catch (error) {
                console.error('首页初始化失败:', error);
                this.showError('页面初始化失败，请刷新页面');
                resolve(false);
            }
        });

        return this.initializationPromise;
    }

    // 等待依赖就绪
    waitForDependencies() {
        return new Promise((resolve) => {
            const maxWaitTime = 10000; // 10秒超时
            const startTime = Date.now();
            
            const checkDeps = () => {
                const dataManagerReady = typeof dataManager !== 'undefined' && dataManager && dataManager.isInitialized;
                const authManagerReady = typeof authManager !== 'undefined' && authManager && authManager.isInitialized;
                
                if (dataManagerReady && authManagerReady) {
                    console.log('所有依赖就绪');
                    resolve(true);
                } else if (Date.now() - startTime > maxWaitTime) {
                    console.warn('等待依赖超时，继续初始化');
                    resolve(false);
                } else {
                    setTimeout(checkDeps, 100);
                }
            };
            
            checkDeps();
        });
    }

    // 获取当前用户
    getCurrentUser() {
        // 尝试多种方式获取当前用户
        if (window.authManager && window.authManager.getCurrentUser) {
            return window.authManager.getCurrentUser();
        }
        if (window.currentUser) {
            return window.currentUser;
        }
        try {
            const savedUser = localStorage.getItem('currentUser');
            return savedUser ? JSON.parse(savedUser) : null;
        } catch (e) {
            console.error('获取当前用户失败:', e);
            return null;
        }
    }

    // 从URL获取当前页面
    getCurrentPageFromURL() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const tab = urlParams.get('tab');
            
            const tabMap = {
                'hot': 'hot',
                'categories': 'categories'
            };
            
            return tabMap[tab] || 'home';
        } catch (error) {
            console.error('解析URL失败:', error);
            return 'home';
        }
    }

    // 更新导航状态
    updateNavigation() {
        try {
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                item.classList.remove('active');
                if (item.dataset.page === this.currentPage) {
                    item.classList.add('active');
                }
            });
        } catch (error) {
            console.error('更新导航状态失败:', error);
        }
    }

    loadPageContent(page) {
        console.log('加载页面:', page);
        
        try {
            // 隐藏所有页面
            document.querySelectorAll('.page').forEach(pageElement => {
                pageElement.classList.remove('active');
            });

            // 显示当前页面
            const currentPageElement = document.getElementById(`${page}-page`);
            if (currentPageElement) {
                currentPageElement.classList.add('active');
            } else {
                console.warn(`页面元素未找到: ${page}-page`);
            }

            // 加载对应页面内容
            switch (page) {
                case 'home':
                    this.loadRecommendedVideos();
                    break;
                case 'hot':
                    this.loadHotVideos();
                    break;
                case 'categories':
                    this.loadCategoriesPage();
                    break;
                default:
                    console.warn('未知页面:', page);
                    this.loadRecommendedVideos();
            }

            // 更新导航状态
            this.updateNavActiveState(page);
        } catch (error) {
            console.error('加载页面内容失败:', error);
            this.showError('加载页面内容失败');
        }
    }

    // 加载分类页面
    async loadCategoriesPage() {
        console.log('加载分类页面');
        
        try {
            // 加载分类列表
            await this.loadCategories();
            
            // 设置事件监听器
            this.setupCategoryEvents();
            
            // 重置分类视频状态
            this.resetCategoryVideos();
            
        } catch (error) {
            console.error('加载分类页面失败:', error);
            this.showCategoryError('加载分类页面失败');
        }
    }

    async loadRecommendedVideos() {
        const container = document.getElementById('home-video-grid');
        if (!container) {
            console.error('视频容器未找到');
            return;
        }

        try {
            // 显示加载状态
            container.innerHTML = `
                <div class="loading-state">
                    <p>正在加载推荐视频...</p>
                </div>
            `;

            let videos = [];
            
            // 等待数据管理器就绪
            if (window.dataManager && window.dataManager.isInitialized) {
                videos = window.dataManager.video.getRecommended();
            } else {
                console.warn('数据管理器未就绪，使用备用数据');
                videos = this.getFallbackVideos();
            }
            
            if (videos && videos.length > 0) {
                this.displayVideos(videos, 'home-video-grid');
            } else {
                this.showNoVideos('home-video-grid');
            }
        } catch (error) {
            console.error('加载视频失败:', error);
            this.showError('加载视频失败，请刷新页面');
        }
    }

    // 加载热门视频
    async loadHotVideos() {
        const container = document.getElementById('hot-video-grid');
        if (!container) {
            console.error('热门视频容器未找到');
            return;
        }

        try {
            // 显示加载状态
            container.innerHTML = `
                <div class="loading-state">
                    <p>正在加载热门视频...</p>
                </div>
            `;

            let videos = [];
            
            // 等待数据管理器就绪
            if (window.dataManager && window.dataManager.isInitialized) {
                videos = window.dataManager.video.getPopular();
            } else {
                console.warn('数据管理器未就绪，使用备用数据');
                videos = this.getFallbackVideos();
            }
            
            if (videos && videos.length > 0) {
                this.displayVideos(videos, 'hot-video-grid');
            } else {
                this.showNoVideos('hot-video-grid');
            }
        } catch (error) {
            console.error('加载热门视频失败:', error);
            this.showError('加载热门视频失败，请刷新页面');
        }
    }

    // 加载分类列表
    async loadCategories() {
        const container = document.getElementById('categories-grid');
        if (!container) {
            console.error('分类容器未找到');
            return;
        }

        try {
            // 定义分类
            const categories = [
                { id: 'technology', name: '科技', icon: '💻', color: '#4A90E2', description: '探索科技前沿与创新' },
                { id: 'life', name: '生活', icon: '🏠', color: '#50E3C2', description: '分享日常生活点滴' },
                { id: 'dance', name: '舞蹈', icon: '📚', color: '#F5A623', description: '共享表演与舞蹈技巧' },
                { id: 'game', name: '游戏', icon: '🎮', color: '#BD10E0', description: '游戏攻略与精彩时刻' },
                { id: 'movie', name: '影视', icon: '⚽', color: '#7ED321', description: '体育赛事与健身指导' },
                { id: 'music', name: '音乐', icon: '🎵', color: '#FF6B6B', description: '音乐欣赏与创作分享' },
                { id: 'animation', name: '动画', icon: '🍔', color: '#9B59B6', description: '消遣时刻与自由创造' },
                { id: 'entertainment', name: '娱乐', icon: '🎬', color: '#E74C3C', description: '娱乐内容与轻松时刻' }
            ];

            container.innerHTML = categories.map(category => `
                <div class="category-card" data-category="${category.id}" 
                     style="border-left: 4px solid ${category.color}">
                    <div class="category-icon">${category.icon}</div>
                    <div class="category-name">${this.escapeHtml(category.name)}</div>
                    <div class="category-description">${this.escapeHtml(category.description)}</div>
                </div>
            `).join('');

        } catch (error) {
            console.error('加载分类失败:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <p>加载分类失败</p>
                    <button class="btn btn-primary mt-20" onclick="homeManager.loadCategories()">
                        重新加载
                    </button>
                </div>
            `;
        }
    }

    displayVideos(videos, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        try {
            container.innerHTML = videos.map(video => `
                <div class="video-card" data-video-id="${video.id}">
                    <img src="${video.cover}" alt="${video.title}" class="video-cover"
                         onerror="this.src='assets/demoCover.png'">
                    <div class="video-info">
                        <div class="video-title">${this.escapeHtml(video.title)}</div>
                        <div class="video-meta">
                            <span class="video-author" data-author-id="${video.authorId}">${this.escapeHtml(video.authorName)}</span>
                            <span>${this.formatViews(video.views)}播放</span>
                        </div>
                    </div>
                </div>
            `).join('');

            // 绑定点击事件
            this.bindVideoEvents(container);
        } catch (error) {
            console.error('显示视频失败:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <p>显示视频失败</p>
                    <button class="btn btn-primary mt-20" onclick="homeManager.loadRecommendedVideos()">
                        重新加载
                    </button>
                </div>
            `;
        }
    }

    // 绑定视频事件
    bindVideoEvents(container) {
        if (!container) return;

        // 视频卡片点击事件
        container.querySelectorAll('.video-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // 如果点击的是作者名字，不触发视频播放
                if (e.target.classList.contains('video-author')) {
                    return;
                }
                const videoId = card.dataset.videoId;
                this.playVideo(videoId);
            });
        });

        // 作者点击事件
        container.querySelectorAll('.video-author').forEach(author => {
            author.addEventListener('click', (e) => {
                e.stopPropagation();
                const authorId = author.dataset.authorId;
                this.viewUserProfile(authorId);
            });
        });
    }

    // 播放视频
    playVideo(videoId) {
        if (this.currentUser) {
            // 记录观看历史
            if (window.dataManager && window.dataManager.history) {
                window.dataManager.history.add({
                    userId: this.currentUser.id,
                    videoId: videoId,
                    progress: 0
                });
            }
        }
        window.location.href = `video-play.html?id=${videoId}`;
    }

    // 查看用户资料
    viewUserProfile(userId) {
        window.location.href = `user.html?id=${userId}`;
    }

    setupEventListeners() {
        if (this.eventListenersBound) {
            console.log('事件监听器已绑定，跳过');
            return;
        }

        console.log('设置事件监听器');
        
        // 使用事件委托处理导航点击
        document.addEventListener('click', (e) => {
            const navItem = e.target.closest('.nav-item');
            if (navItem && navItem.dataset.page) {
                e.preventDefault();
                e.stopPropagation();
                const page = navItem.dataset.page;
                this.handleNavigation(page);
            }
        });

        // 搜索功能
        const searchInput = document.getElementById('headerSearch');
        if (searchInput) {
            // 移除现有监听器
            const newSearchInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newSearchInput, searchInput);
            
            newSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performSearch(e.target.value);
                }
            });
        }

        // 监听认证状态变化
        window.addEventListener('authStateChanged', (e) => {
            console.log('首页收到认证状态变化');
            this.currentUser = e.detail.user;
            this.updateNavigation();
        });

        this.eventListenersBound = true;
    }

    // 设置分类事件监听器
    setupCategoryEvents() {
        // 分类卡片点击事件
        document.addEventListener('click', (e) => {
            const categoryCard = e.target.closest('.category-card');
            if (categoryCard) {
                const category = categoryCard.dataset.category;
                this.loadCategoryVideos(category);
            }
        });
        
        // 分类排序选择
        const sortSelect = document.getElementById('categorySortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                if (this.currentCategory) {
                    this.applyCategoryFilters();
                }
            });
        }
        
        // 分类加载更多按钮
        const loadMoreBtn = document.getElementById('categoryLoadMoreBtn');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', () => {
                this.loadMoreCategoryVideos();
            });
        }
    }

    handleNavigation(page) {
        console.log('导航到:', page);
        
        try {
            const navigationMap = {
                'home': () => {
                    this.currentPage = 'home';
                    this.loadPageContent('home');
                    this.updateURL('home');
                },
                'hot': () => {
                    this.currentPage = 'hot';
                    this.loadPageContent('hot');
                    this.updateURL('hot');
                },
                'categories': () => {
                    this.currentPage = 'categories';
                    this.loadPageContent('categories');
                    this.updateURL('categories');
                },
                'dynamic': () => {
                    if (this.requireLogin()) {
                        window.location.href = 'dynamic.html';
                    }
                },
                'favorites': () => this.requireLogin('profile.html?tab=favorites'),
                'history': () => this.requireLogin('history.html'), 
                'messages': () => this.requireLogin('message.html'),
                'profile': () => this.requireLogin('profile.html'),
                'upload': () => this.requireLogin('upload.html')
            };

            const action = navigationMap[page];
            if (action) {
                action();
            } else {
                console.warn('未知的页面:', page);
            }
        } catch (error) {
            console.error('导航处理失败:', error);
            this.showError('导航失败，请重试');
        }
    }

    requireLogin(redirectPage = null) {
        if (this.currentUser) {
            if (redirectPage) {
                window.location.href = redirectPage;
            }
            return true;
        } else {
            if (confirm('此功能需要登录，是否前往登录页面？')) {
                window.location.href = 'login.html';
            }
            return false;
        }
    }

    // 刷新视频
    refreshVideos() {
        console.log('刷新视频列表');
        switch (this.currentPage) {
            case 'home':
                this.loadRecommendedVideos();
                break;
            case 'hot':
                this.loadHotVideos();
                break;
            case 'categories':
                this.loadCategoriesPage();
                break;
        }
    }

    // 重置分类视频状态
    resetCategoryVideos() {
        this.currentCategory = null;
        this.categoryVideos = [];
        this.filteredCategoryVideos = [];
        this.displayedCategoryVideos = [];
        this.currentCategoryPage = 1;
        
        // 隐藏视频区域
        const videoSection = document.getElementById('categoryVideoSection');
        if (videoSection) {
            videoSection.style.display = 'none';
        }
        
        // 更新视频计数
        const videoCount = document.getElementById('categoryVideoCount');
        if (videoCount) {
            videoCount.textContent = '选择分类查看视频';
        }
    }

    // 加载分类视频 - 改进版，支持分类数据同步
    async loadCategoryVideos(category) {
        console.log('加载分类视频:', category);
        const container = document.getElementById('category-video-grid');
        if (!container) {
            console.error('分类视频容器未找到');
            return;
        }

        try {
            // 显示加载状态
            container.innerHTML = `
                <div class="loading-state">
                    <p>正在加载${this.getCategoryName(category)}视频...</p>
                </div>
            `;

            // 显示视频区域
            const videoSection = document.getElementById('categoryVideoSection');
            if (videoSection) {
                videoSection.style.display = 'block';
            }
            
            // 隐藏加载更多按钮
            const loadMoreContainer = document.getElementById('categoryLoadMoreContainer');
            if (loadMoreContainer) {
                loadMoreContainer.style.display = 'none';
            }

            let videos = [];
            
            // 等待数据管理器就绪
            if (window.dataManager && window.dataManager.isInitialized) {
                console.log('使用 DataManager 获取分类视频');
                videos = window.dataManager.video.getByCategory(category);
                
                // 如果没找到视频，尝试备用方法
                if (videos.length === 0) {
                    console.log('直接查询未找到视频，尝试备用查询...');
                    const allVideos = window.dataManager.folder.getAllItems('videos');
                    console.log('所有视频:', allVideos.length);
                    
                    // 手动过滤
                    videos = allVideos.filter(v => {
                        if (!v.category) {
                            console.log(`视频 ${v.id} 没有分类字段`);
                            return false;
                        }
                        
                        // 分类映射
                        const categoryMap = {
                            'technology': '科技',
                            'life': '生活',
                            'dance': '舞蹈',
                            'game': '游戏',
                            'movie': '影视',
                            'music': '音乐',
                            'animation': '动画',
                            'entertainment': '娱乐'
                        };
                        
                        const normalizedCategory = categoryMap[category] || category;
                        const match = v.category === normalizedCategory || 
                                     v.category === category ||
                                     (v.categoryName && v.categoryName === this.getCategoryName(category));
                        
                        if (match) {
                            console.log(`手动找到匹配视频: ${v.title}, 分类: ${v.category}, 分类名称: ${v.categoryName}`);
                        }
                        
                        return match;
                    });
                }
            } else {
                console.warn('数据管理器未就绪，使用备用数据');
                videos = this.getCategoryFallbackVideos(category);
            }
            
            console.log(`找到 ${videos.length} 个分类视频`);
            
            this.currentCategory = category;
            this.categoryVideos = videos;
            this.currentCategoryPage = 1;
            
            if (videos && videos.length > 0) {
                this.applyCategoryFilters();
            } else {
                this.showNoCategoryVideos(category);
            }
        } catch (error) {
            console.error('加载分类视频失败:', error);
            this.showCategoryError('加载视频失败，请刷新页面');
        }
    }

    // 应用分类筛选和排序
    applyCategoryFilters() {
        const sortSelect = document.getElementById('categorySortSelect');
        
        let filteredVideos = [...this.categoryVideos];
        
        // 应用排序
        if (sortSelect) {
            switch (sortSelect.value) {
                case 'newest':
                    filteredVideos.sort((a, b) => new Date(b.uploadTime) - new Date(a.uploadTime));
                    break;
                case 'popular':
                    filteredVideos.sort((a, b) => (b.views || 0) - (a.views || 0));
                    break;
                case 'likes':
                    filteredVideos.sort((a, b) => (b.likes || 0) - (a.likes || 0));
                    break;
            }
        }
        
        this.filteredCategoryVideos = filteredVideos;
        this.displayCategoryVideos();
    }

    // 显示分类视频
    displayCategoryVideos() {
        const container = document.getElementById('category-video-grid');
        if (!container) return;

        try {
            // 计算当前页要显示的视频
            const startIndex = (this.currentCategoryPage - 1) * this.categoryVideosPerPage;
            const endIndex = startIndex + this.categoryVideosPerPage;
            this.displayedCategoryVideos = this.filteredCategoryVideos.slice(0, endIndex);
            
            if (this.displayedCategoryVideos.length === 0) {
                this.showNoCategoryVideos(this.currentCategory);
                return;
            }
            
            container.innerHTML = this.displayedCategoryVideos.map(video => `
                <div class="video-card" data-video-id="${video.id}">
                    <img src="${video.cover}" alt="${video.title}" class="video-cover"
                         onerror="this.src='assets/demoCover.png'">
                    <div class="video-info">
                        <div class="video-title">${this.escapeHtml(video.title)}</div>
                        <div class="video-meta">
                            <span class="video-author" data-author-id="${video.authorId}">${this.escapeHtml(video.authorName)}</span>
                            <span>${this.formatViews(video.views)}播放</span>
                        </div>
                    </div>
                </div>
            `).join('');

            // 更新视频计数
            this.updateCategoryVideoCount();
            
            // 显示/隐藏加载更多按钮
            const loadMoreContainer = document.getElementById('categoryLoadMoreContainer');
            if (loadMoreContainer) {
                if (this.filteredCategoryVideos.length > this.displayedCategoryVideos.length) {
                    loadMoreContainer.style.display = 'block';
                } else {
                    loadMoreContainer.style.display = 'none';
                }
            }

            // 绑定视频事件
            this.bindVideoEvents(container);

        } catch (error) {
            console.error('显示分类视频失败:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <p>显示视频失败</p>
                    <button class="btn btn-primary mt-20" onclick="homeManager.loadCategoryVideos('${this.currentCategory}')">
                        重新加载
                    </button>
                </div>
            `;
        }
    }

    // 加载更多分类视频
    loadMoreCategoryVideos() {
        this.currentCategoryPage++;
        this.displayCategoryVideos();
    }

    // 更新分类视频计数
    updateCategoryVideoCount() {
        const videoCount = document.getElementById('categoryVideoCount');
        if (videoCount) {
            const total = this.filteredCategoryVideos.length;
            const displayed = this.displayedCategoryVideos.length;
            const categoryName = this.getCategoryName(this.currentCategory);
            videoCount.textContent = `${categoryName} - 显示 ${displayed} / ${total} 个视频`;
        }
    }

    // 获取分类名称
    getCategoryName(categoryId) {
        const categories = {
            'technology': '科技',
            'life': '生活',
            'dance': '舞蹈',
            'game': '游戏',
            'movie': '影视',
            'music': '音乐',
            'animation': '动画',
            'entertainment': '娱乐'
        };
        
        return categories[categoryId] || '未知';
    }

    // 显示无分类视频状态
    showNoCategoryVideos(category) {
        const container = document.getElementById('category-video-grid');
        if (container) {
            const categoryName = this.getCategoryName(category);
            container.innerHTML = `
                <div class="empty-state">
                    <p>暂无${categoryName}视频内容</p>
                    <button class="btn btn-primary mt-20" onclick="homeManager.loadCategoryVideos('${category}')">
                        重新加载
                    </button>
                </div>
            `;
        }
        
        // 更新视频计数
        const videoCount = document.getElementById('categoryVideoCount');
        if (videoCount) {
            const categoryName = this.getCategoryName(category);
            videoCount.textContent = `${categoryName} - 暂无视频`;
        }
        
        // 隐藏加载更多按钮
        const loadMoreContainer = document.getElementById('categoryLoadMoreContainer');
        if (loadMoreContainer) {
            loadMoreContainer.style.display = 'none';
        }
    }

    // 显示分类错误
    showCategoryError(message) {
        const container = document.getElementById('category-video-grid');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>${message}</p>
                    <button class="btn btn-primary mt-20" onclick="homeManager.loadCategoriesPage()">
                        重新加载
                    </button>
                </div>
            `;
        }
    }

    // 获取备用视频数据
    getFallbackVideos() {
        return [
            {
                id: 'fallback_1',
                title: '示例视频 1',
                authorId: 'user_1',
                authorName: '示例作者',
                cover: 'assets/demoCover.png',
                views: 100,
                description: '这是一个示例视频'
            },
            {
                id: 'fallback_2',
                title: '示例视频 2',
                authorId: 'user_2',
                authorName: '另一个作者',
                cover: 'assets/demoCover.png',
                views: 150,
                description: '这是另一个示例视频'
            }
        ];
    }

    // 获取分类备用视频数据
    getCategoryFallbackVideos(category) {
        const categoryName = this.getCategoryName(category);
        return [
            {
                id: `fallback_${category}_1`,
                title: `${categoryName}示例视频 1`,
                authorId: 'user_1',
                authorName: '示例作者',
                cover: 'assets/demoCover.png',
                views: 100,
                description: `这是一个${categoryName}示例视频`,
                uploadTime: new Date().toISOString(),
                likes: 10,
                category: category,
                categoryName: categoryName
            },
            {
                id: `fallback_${category}_2`,
                title: `${categoryName}示例视频 2`,
                authorId: 'user_2',
                authorName: '另一个作者',
                cover: 'assets/demoCover.png',
                views: 150,
                description: `这是另一个${categoryName}示例视频`,
                uploadTime: new Date(Date.now() - 86400000).toISOString(),
                likes: 15,
                category: category,
                categoryName: categoryName
            },
            {
                id: `fallback_${category}_3`,
                title: `${categoryName}示例视频 3`,
                authorId: 'user_3',
                authorName: '第三个作者',
                cover: 'assets/demoCover.png',
                views: 200,
                description: `这是第三个${categoryName}示例视频`,
                uploadTime: new Date(Date.now() - 172800000).toISOString(),
                likes: 20,
                category: category,
                categoryName: categoryName
            }
        ];
    }

    // 显示无视频状态
    showNoVideos(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>暂无视频内容</p>
                    <button class="btn btn-primary mt-20" onclick="homeManager.refreshVideos()">
                        重新加载
                    </button>
                </div>
            `;
        }
    }

    // 更新URL
    updateURL(page) {
        try {
            const url = new URL(window.location);
            if (page === 'home') {
                url.searchParams.delete('tab');
            } else {
                url.searchParams.set('tab', page);
            }
            window.history.replaceState({}, '', url);
        } catch (error) {
            console.error('更新URL失败:', error);
        }
    }

    // 更新导航活跃状态
    updateNavActiveState(page) {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });
    }

    // 格式化播放量
    formatViews(views) {
        if (!views) return '0';
        if (views >= 10000) {
            return (views / 10000).toFixed(1) + '万';
        }
        return views.toString();
    }

    performSearch(query) {
        if (query && query.trim()) {
            console.log('执行搜索:', query);
            // 确保使用正确的路径
            const searchUrl = `search.html?q=${encodeURIComponent(query.trim())}`;
            window.location.href = searchUrl;
        }
    }

    showError(message) {
        const container = document.getElementById('home-video-grid');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>${message}</p>
                    <button class="btn btn-primary mt-20" onclick="homeManager.loadRecommendedVideos()">
                        重新加载
                    </button>
                </div>
            `;
        }
    }

    // HTML转义
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 调试方法：显示所有视频的分类信息
    debugVideoCategories() {
        if (window.dataManager && window.dataManager.isInitialized) {
            window.dataManager.debugVideoCategories();
        } else {
            console.warn('DataManager 未初始化，无法调试');
        }
    }

    // 调试方法：显示特定分类的视频
    debugCategoryVideos(category) {
        if (window.dataManager && window.dataManager.isInitialized) {
            window.dataManager.debugCategoryVideos(category);
        } else {
            console.warn('DataManager 未初始化，无法调试');
        }
    }
}

// 初始化首页 - 带有错误处理
let homeManager;

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，初始化首页...');
    try {
        // 防止重复初始化
        if (!window.homeManager) {
            homeManager = new HomeManager();
            window.homeManager = homeManager;
        } else {
            console.log('首页管理器已存在，跳过初始化');
        }
    } catch (error) {
        console.error('首页初始化失败:', error);
        // 显示友好的错误信息
        const container = document.getElementById('home-video-grid');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>页面加载失败</p>
                    <button class="btn btn-primary mt-20" onclick="window.location.reload()">
                        刷新页面
                    </button>
                </div>
            `;
        }
    }
});

// 全局错误处理
window.addEventListener('error', function(e) {
    console.error('全局错误:', e.error);
});

// 未处理的Promise拒绝
window.addEventListener('unhandledrejection', function(e) {
    console.error('未处理的Promise拒绝:', e.reason);
});