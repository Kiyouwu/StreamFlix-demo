// navigation.js - 修复版

// 通用导航管理系统 - 修复版
class NavigationManager {
    constructor() {
        this.currentUser = null;
        this.isInitialized = false;
        console.log('NavigationManager 初始化开始');
        // 在全局设置当前路径，便于其它模块（legacy代码）直接使用 currentPage
        try {
            window.currentPage = window.location.pathname || '';
        } catch (e) {
            window.currentPage = '';
        }
        
        // 延迟初始化，确保 DOM 已加载
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initialize();
            });
        } else {
            setTimeout(() => this.initialize(), 100);
        }
    }

    async initialize() {
        if (this.isInitialized) return;
        
        try {
            console.log('NavigationManager 开始初始化');
            
            // 等待认证管理器就绪
            await this.waitForAuthManager();
            
            // 获取当前用户
            this.currentUser = this.getCurrentUser();
            console.log('NavigationManager 当前用户:', this.currentUser?.username);
            
            // 绑定事件
            this.bindNavigationEvents();
            
            // 更新UI
            this.updateActiveNav();
            this.updateAuthUI();
            
            this.isInitialized = true;
            console.log('NavigationManager 初始化完成');
            
        } catch (error) {
            console.error('NavigationManager 初始化失败:', error);
            // 降级处理：仍然尝试绑定基本事件
            this.bindNavigationEvents();
        }
    }

    // 等待认证管理器就绪
    async waitForAuthManager() {
        const maxWaitTime = 5000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            if (window.authManager && typeof window.authManager.getCurrentUser === 'function') {
                return true;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.warn('等待 AuthManager 超时，使用降级模式');
        return false;
    }

    bindNavigationEvents() {
        console.log('绑定导航事件');
        
        try {
            // 使用事件委托处理导航点击
            document.addEventListener('click', (e) => {
                const navItem = e.target.closest('.nav-item');
                if (navItem && navItem.dataset.page) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('导航点击:', navItem.dataset.page);
                    this.navigateToPage(navItem.dataset.page);
                }
            });

            // 搜索功能
            const searchInputs = document.querySelectorAll('.search-input, #headerSearch, #mainSearch');
            searchInputs.forEach(input => {
                // 移除现有监听器
                const newInput = input.cloneNode(true);
                input.parentNode.replaceChild(newInput, input);
                
                newInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        const query = e.target.value.trim();
                        if (query) {
                            console.log('搜索:', query);
                            this.performSearch(query);
                        }
                    }
                });
            });

            // 监听认证状态变化
            window.addEventListener('authStateChanged', (e) => {
                console.log('导航管理器收到认证状态变化');
                this.currentUser = e.detail.user;
                this.updateAuthUI();
            });

        } catch (error) {
            console.error('绑定导航事件失败:', error);
        }
    }

    getCurrentUser() {
        // 尝试多种方式获取当前用户
        try {
            if (window.authManager && typeof window.authManager.getCurrentUser === 'function') {
                return window.authManager.getCurrentUser();
            }
            if (window.currentUser) {
                return window.currentUser;
            }
            const savedUser = localStorage.getItem('currentUser');
            if (typeof safeJsonParse === 'function') {
                return safeJsonParse(savedUser, null);
            }
            return savedUser ? JSON.parse(savedUser) : null;
        } catch (e) {
            console.error('获取当前用户失败:', e);
            return null;
        }
    }

    navigateToPage(page) {
        console.log('导航到页面:', page);
        
        const pageMap = {
            'home': 'index.html',
            'hot': 'index.html?tab=hot',
            'categories': 'index.html?tab=categories',
            'dynamic': 'dynamic.html',
            'favorites': 'profile.html?tab=favorites',
            'history': 'history.html',
            'messages': 'message.html',
            'profile': 'profile.html',
            'upload': 'upload.html'
        };

        const targetPage = pageMap[page];
        if (targetPage) {
            // 检查需要登录的页面
            const protectedPages = ['favorites', 'history', 'messages', 'profile', 'upload', 'dynamic'];
            if (protectedPages.includes(page)) {
                const user = this.getCurrentUser();
                if (!user) {
                    console.log('需要登录的页面，当前用户未登录');
                    if (confirm('此功能需要登录，是否前往登录页面？')) {
                        window.location.href = 'login.html';
                    }
                    return;
                }
            }

            console.log('跳转到:', targetPage);
            window.location.href = targetPage;
        } else {
            console.warn('未知页面:', page);
            window.location.href = 'index.html';
        }
    }

    performSearch(query) {
        if (query && query.trim()) {
            console.log('执行搜索:', query);
            const searchUrl = `search.html?q=${encodeURIComponent(query.trim())}`;
            window.location.href = searchUrl;
        }
    }

    updateActiveNav() {
        try {
            const currentPage = this.getCurrentPage();
            console.log('当前页面:', currentPage);
            
            const navItems = document.querySelectorAll('.nav-item');
            navItems.forEach(item => {
                item.classList.remove('active');
                if (item.dataset.page === currentPage) {
                    item.classList.add('active');
                    console.log('设置活跃导航:', item.dataset.page);
                }
            });
        } catch (error) {
            console.error('更新活跃导航失败:', error);
        }
    }

    updateAuthUI() {
        try {
            const headerActions = document.getElementById('headerActions');
            if (!headerActions) {
                console.log('headerActions 元素未找到');
                return;
            }

            const user = this.getCurrentUser();
            console.log('更新认证UI，当前用户:', user ? user.username : '未登录');

            if (user) {
                // 显示消息入口与用户头像并附加下拉菜单（包含个人主页、设置、退出）
                // 将消息按钮放在头像左侧，以便于用户快速访问消息中心
                headerActions.innerHTML = `
                    <div id="avatarContainer" class="avatar-container" style="display:flex; align-items:center; width:100%; justify-content:flex-end; gap:8px;">
                        <button class="icon-btn" id="headerMessageBtn" title="消息" onclick="window.location.href='message.html'"><div><p1><img src="assets/messageIcon.png", width="25px", height="25px"></p1></div><p2>消息</p2><span id="messageBadge" class="message-badge" style="display: none"; font-size:0.7em; margin-left:4px;"></span></button>
                        <button class="icon-btn" id="headerDyanamicBtn" title="动态" onclick="window.location.href='dynamic.html'"><div><p1><img src="assets/dynamicIcon.png", width="25px", height="25px"></p1></div><p2>动态</p2><span id="dynamicBadge" class="dynamic-badge" style="display: none"; font-size:0.7em; margin-left:4px;"></span></button>
                        <button class="icon-btn" id="headerFavoritesBtn" title="收藏" onclick="window.location.href='profile.html'"><div><p1><img src="assets/favoritesIcon.png", width="25px", height="25px"></p1></div><p2>收藏</p2><span id="favoritesBadge" class="favorites-badge" style="display: none"; font-size:0.7em; margin-left:4px;"></span></button>
                        <button class="icon-btn" id="headerHistoryBtn" title="历史" onclick="window.location.href='history.html'"><div><p1><img src="assets/historyIcon.png", width="25px", height="25px"></p1></div><p2>历史</p2><span id="historyBadge" class="history-badge" style="display: none"; font-size:0.7em; margin-left:4px;"></span></button>
                        <img src="${user.avatar || 'assets/default-avatar.png'}" alt="avatar" class="header-avatar" id="headerAvatar" />
                        <div class="avatar-menu hidden" id="avatarMenu">
                            <div class="avatar-menu-item" data-action="profile">个人主页</div>
                            <div class="avatar-menu-item" data-action="settings">设置</div>
                            <div class="avatar-menu-item" data-action="logout">退出登录</div>
                        </div>
                    </div>
                `;
                // 绑定菜单行为
                this.attachAvatarMenu(headerActions, user);
                // 绑定消息按钮（如果存在的话）
                try {
                    const msgBtn = headerActions.querySelector('#headerMessageBtn');
                    if (msgBtn) {
                        msgBtn.removeEventListener('click', this._onHeaderMessageClick);
                        this._onHeaderMessageClick = () => { window.location.href = 'message.html'; };
                        msgBtn.addEventListener('click', this._onHeaderMessageClick);
                    }
                } catch (err) {
                    console.warn('消息按钮绑定失败', err);
                }
            } else {
                headerActions.innerHTML = `
                    <button class="btn btn-primary" onclick="window.location.href='login.html'">登录</button>
                    <button class="btn btn-secondary" onclick="window.location.href='register.html'">注册</button>
                `;
            }
        } catch (error) {
            console.error('更新认证UI失败:', error);
        }
    }

    // 绑定头像下拉菜单的行为（切换、项点击、外部点击关闭）
    attachAvatarMenu(headerActions, user) {
        try {
            if (!headerActions) return;

            const avatarContainer = headerActions.querySelector('#avatarContainer');
            if (!avatarContainer) return;

            const avatar = avatarContainer.querySelector('#headerAvatar');
            const menu = avatarContainer.querySelector('#avatarMenu');

            if (!avatar || !menu) return;

            // 清理已有的文档点击监听器，避免重复绑定
            if (this._avatarDocClick && typeof this._avatarDocClick === 'function') {
                document.removeEventListener('click', this._avatarDocClick);
                this._avatarDocClick = null;
            }

            // 切换菜单显示
            const toggleMenu = (e) => {
                e.stopPropagation();
                menu.classList.toggle('hidden');
            };

            // 点击菜单项处理
            const onMenuClick = (e) => {
                const item = e.target.closest('.avatar-menu-item');
                if (!item) return;
                const action = item.dataset.action;
                if (action === 'profile') {
                    window.location.href = 'profile.html';
                } else if (action === 'settings') {
                    // 如果没有设置页，先跳转到 profile 作为占位
                    if (window.location) window.location.href = 'settings.html';
                } else if (action === 'logout') {
                    if (window.authManager && typeof window.authManager.logout === 'function') {
                        window.authManager.logout();
                    } else {
                        localStorage.removeItem('currentUser');
                        window.currentUser = null;
                        window.location.href = 'index.html';
                    }
                }
                menu.classList.add('hidden');
            };

            avatar.removeEventListener('click', toggleMenu);
            avatar.addEventListener('click', toggleMenu);

            menu.removeEventListener('click', onMenuClick);
            menu.addEventListener('click', onMenuClick);

            // 点击页面其他地方关闭菜单
            this._avatarDocClick = (e) => {
                if (!avatarContainer.contains(e.target)) {
                    menu.classList.add('hidden');
                }
            };

            document.addEventListener('click', this._avatarDocClick);

        } catch (error) {
            console.error('attachAvatarMenu 绑定失败:', error);
        }
    }

    // 退出登录
    logout() {
        console.log('导航管理器处理退出登录');
        if (window.authManager && window.authManager.logout) {
            window.authManager.logout();
        } else {
            // 降级处理
            localStorage.removeItem('currentUser');
            window.currentUser = null;
            window.location.href = 'index.html';
        }
    }

    getCurrentPage() {
        try {
            const path = window.location.pathname;
            const urlParams = new URLSearchParams(window.location.search);
            
            console.log('当前路径:', path);
            
            // 获取文件名
            const fileName = path.split('/').pop() || 'index.html';
            console.log('文件名:', fileName);
            
            // 处理首页的不同标签页
            if (fileName === 'index.html' || path === '/' || path.endsWith('/')) {
                const tab = urlParams.get('tab');
                console.log('首页标签:', tab);
                if (tab === 'hot') return 'hot';
                if (tab === 'categories') return 'categories';
                return 'home';
            }
            
            // 页面映射
            const pageMap = {
                'index.html': 'home',
                'dynamic.html': 'dynamic',
                'profile.html': 'profile',
                'upload.html': 'upload',
                'search.html': 'home',
                'history.html': 'history',
                'message.html': 'messages',
                'login.html': 'home',
                'register.html': 'home'
            };
            
            const page = pageMap[fileName] || 'home';
            console.log('对应页面:', page);
            return page;
        } catch (error) {
            console.error('获取当前页面失败:', error);
            return 'home';
        }
    }

    // 静态方法：快速导航
    static navigateTo(page) {
        if (window.navigationManager) {
            window.navigationManager.navigateToPage(page);
        } else {
            // 创建临时实例
            const tempNav = new NavigationManager();
            setTimeout(() => tempNav.navigateToPage(page), 100);
        }
    }

    // 静态方法：快速搜索
    static search(query) {
        if (window.navigationManager) {
            window.navigationManager.performSearch(query);
        } else {
            // 创建临时实例
            const tempNav = new NavigationManager();
            setTimeout(() => tempNav.performSearch(query), 100);
        }
    }
}

// 全局初始化函数
function initializeNavigation() {
    console.log('开始初始化导航系统');
    
    if (window.navigationManager) {
        console.log('NavigationManager 已存在，跳过初始化');
        return window.navigationManager;
    }
    
    try {
        const navigationManager = new NavigationManager();
        window.navigationManager = navigationManager;
        
        // 全局导航函数
        window.navigateToPage = (page) => {
            navigationManager.navigateToPage(page);
        };
        
        window.performSearch = (query) => {
            navigationManager.performSearch(query);
        };
        
        console.log('导航系统初始化完成');
        return navigationManager;
    } catch (error) {
        console.error('导航系统初始化失败:', error);
        
        // 降级处理
        window.navigationManager = {
            navigateToPage: (page) => {
                window.location.href = page + '.html';
            },
            performSearch: (query) => {
                window.location.href = `search.html?q=${encodeURIComponent(query)}`;
            }
        };
        
        window.navigateToPage = window.navigationManager.navigateToPage;
        window.performSearch = window.navigationManager.performSearch;
        
        return window.navigationManager;
    }
}

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeNavigation);
} else {
    setTimeout(initializeNavigation, 0);
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NavigationManager, initializeNavigation };
}