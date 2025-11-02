// 认证管理系统 - 修复版
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.isInitialized = false;
        this.isProcessing = false;
        this.initializationPromise = null;
        
        console.log('AuthManager 初始化开始');
        
        // 立即检查当前页面，如果是登录/注册页面则不检查登录状态
        const currentPage = window.location.pathname;
        if (currentPage.includes('login.html') || currentPage.includes('register.html')) {
            console.log('登录/注册页面，跳过初始登录检查');
            this.initWithoutAuthCheck();
        } else {
            this.init();
        }
    }

    cleanupStorageForLogin() {
    try {
        console.log('为登录清理存储空间...');
        
        // 清理临时搜索历史
        localStorage.removeItem('tempSearchHistory');
        
        // 清理过期的缓存数据
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);
        
        // 清理旧的消息数据
        const messages = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('StreamFlix_data/messages'), []) : JSON.parse(localStorage.getItem('StreamFlix_data/messages') || '[]');
        const recentMessages = messages.filter(msg => new Date(msg.timestamp || now).getTime() > oneDayAgo);
        localStorage.setItem('StreamFlix_data/messages', JSON.stringify(recentMessages));
        
        console.log('存储空间清理完成');
    } catch (error) {
        console.error('清理存储空间失败:', error);
    }
}

    async init() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = new Promise(async (resolve) => {
            try {
                console.log('开始初始化认证系统...');
                
                // 等待数据管理器就绪
                await this.waitForDataManager();
                
                // 检查登录状态
                this.checkLoginStatus();
                
                // 绑定表单事件
                this.bindAuthForms();
                
                // 初始化全局监听器
                this.initGlobalListeners();
                
                this.isInitialized = true;
                console.log('AuthManager 初始化完成');
                resolve(true);
                
            } catch (error) {
                console.error('AuthManager 初始化失败:', error);
                this.showMessage('系统初始化失败，请刷新页面', 'error');
                resolve(false);
            }
        });

        return this.initializationPromise;
    }

    // 无认证检查的初始化（用于登录/注册页面）
    async initWithoutAuthCheck() {
        try {
            console.log('无认证检查初始化...');
            
            // 等待数据管理器就绪
            await this.waitForDataManager();
            
            // 只绑定表单事件，不检查登录状态
            this.bindAuthForms();
            
            // 初始化全局监听器
            this.initGlobalListeners();
            
            this.isInitialized = true;
            console.log('AuthManager 无认证检查初始化完成');
        } catch (error) {
            console.error('AuthManager 无认证检查初始化失败:', error);
        }
    }

    // 等待数据管理器就绪
    async waitForDataManager() {
        const maxWaitTime = 10000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWaitTime) {
            if (window.dataManager && typeof window.dataManager.waitForInitialization === 'function') {
                try {
                    const result = await window.dataManager.waitForInitialization();
                    if (result) {
                        console.log('DataManager 已就绪');
                        return true;
                    }
                } catch (error) {
                    console.error('等待 DataManager 时出错:', error);
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error('等待 DataManager 超时');
    }

    // 绑定认证表单事件
    bindAuthForms() {
        try {
            console.log('绑定认证表单事件...');
            
            const currentPage = window.location.pathname;
            
            // 登录表单 - 只在登录页面绑定
            if (currentPage.includes('login.html')) {
                const loginForm = document.getElementById('loginForm');
                if (loginForm) {
                    // 移除现有事件监听器
                    const newForm = loginForm.cloneNode(true);
                    loginForm.parentNode.replaceChild(newForm, loginForm);
                    
                    const loginForm = document.getElementById('loginForm');
                    if (loginForm) {
                        loginForm.addEventListener('submit', (e) => {
                            e.preventDefault();
                            this.handleLogin();
                        });
                    }
                }
            }
            
            // 注册表单 - 只在注册页面绑定
            if (currentPage.includes('register.html')) {
                const registerForm = document.getElementById('registerForm');
                if (registerForm) {
                    const newRegisterForm = registerForm.cloneNode(true);
                    registerForm.parentNode.replaceChild(newRegisterForm, registerForm);
                    
                    const registerForm = document.getElementById('registerForm');
                    if (registerForm) {
                        registerForm.addEventListener('submit', (e) => {
                            e.preventDefault();
                            this.handleRegister();
                        });
                    }
                }
            }
        } catch (error) {
            console.error('绑定认证表单失败:', error);
        }
    }

    // 初始化全局监听器
    initGlobalListeners() {
        // 监听存储变化（多标签页同步）
        window.addEventListener('storage', (e) => {
            if (e.key === 'currentUser') {
                console.log('检测到用户数据变化，重新检查登录状态');
                this.checkLoginStatus();
            }
        });

        // 监听页面可见性变化
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkLoginStatus();
            }
        });
    }

    // 检查登录状态
    checkLoginStatus() {
        try {
            console.log('检查登录状态...');
            const savedUser = localStorage.getItem('currentUser');
            
            if (savedUser) {
                 const userData = (typeof safeJsonParse === 'function') ? safeJsonParse(savedUser, null) : JSON.parse(savedUser);
                console.log('找到保存的用户:', userData.username);
                
                // 验证用户数据是否仍然存在
                if (window.dataManager && window.dataManager.isInitialized) {
                    const freshUser = window.dataManager.user.getById(userData.id);
                    if (freshUser) {
                        console.log('用户数据有效，更新当前用户');
                        this.currentUser = freshUser;
                        localStorage.setItem('currentUser', JSON.stringify(freshUser));
                    } else {
                        console.log('用户数据不存在，清除登录状态');
                        this.clearLoginState();
                    }
                } else {
                    console.log('使用缓存的用户数据');
                    this.currentUser = userData;
                }
            } else {
                console.log('没有保存的用户数据');
                this.currentUser = null;
            }
            
            this.updateGlobalAuthState();
            this.updateUIBasedOnAuth();
            
        } catch (error) {
            console.error('检查登录状态失败:', error);
            this.clearLoginState();
        }
    }

    // 更新基于认证状态的UI
    updateUIBasedOnAuth() {
        try {
            const user = this.getCurrentUser();
            const currentPage = window.location.pathname;
            
            console.log('更新UI认证状态:', user ? user.username : '未登录', '当前页面:', currentPage);
            
            // 如果是登录/注册页面且已登录，跳转到首页
            if ((currentPage.includes('login.html') || currentPage.includes('register.html')) && user) {
                console.log('已登录用户访问登录页面，跳转到首页');
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 500);
                return;
            }
            
            // 更新导航栏
            this.updateNavigationUI();
            
            // 更新页面特定元素（排除登录/注册页面）
            if (!currentPage.includes('login.html') && !currentPage.includes('register.html')) {
                this.updatePageSpecificUI();
            }
            
        } catch (error) {
            console.error('更新UI认证状态失败:', error);
        }
    }

    // 更新导航栏UI
    updateNavigationUI() {
        const user = this.getCurrentUser();
        const headerActions = document.getElementById('headerActions');

        // 优先让导航管理器渲染认证 UI（集中管理头像与菜单），若不存在再回退到本地渲染
        if (window.navigationManager && typeof window.navigationManager.updateAuthUI === 'function') {
            try {
                window.navigationManager.updateAuthUI();
                return;
            } catch (e) {
                console.warn('调用 navigationManager.updateAuthUI 失败，使用回退渲染');
            }
        }

        if (!headerActions) return;

        if (user) {
            // 渲染消息入口 + 头像（头像靠右）
            headerActions.innerHTML = `
                <div class="header-actions-inner" style="display:flex; align-items:center; gap:8px;">
                    <button class="icon-btn" id="headerMessageBtn" title="消息" onclick="window.location.href='message.html'" style="display: none"><div><p1><img src="assets/messageIcon.png", width="25px", height="25px";></p1></div><p2>消息</p2></button>
                    <button class="icon-btn" id="headerDynamicBtn" title="动态" onclick="window.location.href='dynamic.html'" style="display: none"><div><p1><img src="assets/dynamicIcon.png", width="25px", height="25px"></p1></div><p2>动态</p2></button>
                    <button class="icon-btn" id="headerFavoritesBtn" title="收藏" onclick="window.location.href='profile.html'" style="display: none"><div><p1><img src="assets/favoritesIcon.png", width="25px", height="25px"></p1></div><p2>收藏</p2></button>
                    <button class="icon-btn" id="headerHistoryBtn" title="历史" onclick="window.location.href='history.html'" style="display: none"><div><p1><img src="assets/historyIcon.png", width="25px", height="25px"></p1></div><p2>历史</p2></button>
                    <img src="${user.avatar || 'assets/default-avatar.png'}" alt="avatar" class="header-avatar" id="headerAvatar" onclick="window.location.href='profile.html'" />
                </div>
            `;
        } else {
            headerActions.innerHTML = `
                <div style="display:flex; gap:8px; align-items:center;">
                    <button class="btn btn-primary" onclick="window.location.href='login.html'">登录</button>
                    <button class="btn btn-secondary" onclick="window.location.href='register.html'">注册</button>
                </div>
            `;
        }
    }

    // 更新页面特定UI
    updatePageSpecificUI() {
        const user = this.getCurrentUser();
        const path = window.location.pathname;
        
        // 需要登录的页面检查
        const protectedPages = ['profile.html', 'upload.html', 'history.html', 'message.html'];
        const isProtectedPage = protectedPages.some(page => path.includes(page));
        
        if (isProtectedPage && !user) {
            console.log('未登录访问受保护页面:', path);
            if (confirm('此页面需要登录，是否前往登录？')) {
                window.location.href = 'login.html';
            } else {
                window.location.href = 'index.html';
            }
            return;
        }
    }

    // 处理登录
    async handleLogin() {

        // 注意：早期尝试在此处操作未定义的 user 会导致错误，实际登录逻辑在下面继续执行

        if (this.isProcessing) {
            console.log('登录请求正在处理中，请稍候...');
            return;
        }

        this.isProcessing = true;
        console.log('处理登录请求...');

        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const loginBtn = document.getElementById('loginBtn');
        
        if (!usernameInput || !passwordInput) {
            this.showMessage('表单元素未找到', 'error');
            this.isProcessing = false;
            return;
        }

        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        // 输入验证
        if (!username) {
            this.showMessage('请输入用户名或邮箱', 'error');
            this.isProcessing = false;
            return;
        }

        if (!password) {
            this.showMessage('请输入密码', 'error');
            this.isProcessing = false;
            return;
        }

        // 禁用按钮并显示加载状态
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = '<span class="loading-spinner"></span>登录中...';
        }

        try {
            console.log(`验证用户: ${username}`);
            
            // 检查 dataManager 是否可用
            if (!window.dataManager || !window.dataManager.user) {
                throw new Error('数据系统未就绪，请刷新页面重试');
            }
            
            // 使用 dataManager 进行登录验证
            const user = window.dataManager.user.login(username, password);
            
            console.log('登录成功:', user.username);
            
            // 更新用户状态
            this.currentUser = { ...user };
            try {
                localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            } catch (error) {
                if (error.name === 'QuotaExceededError') {
                    console.warn('存储空间不足，尝试清理...');
                    // 清理一些临时数据
                    // this.cleanupStorageForLogin();
                    // // 重试
                    localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                } else {
                    throw error;
                }
            }
            
            this.updateGlobalAuthState();
            this.updateUIBasedOnAuth();
            
            this.showMessage('登录成功！', 'success');
            
            // 延迟跳转，让用户看到成功消息
            setTimeout(() => {
                console.log('跳转到首页');
                // 清除敏感数据
                if (usernameInput) usernameInput.value = '';
                if (passwordInput) passwordInput.value = '';
                window.location.href = 'index.html';
            }, 1000);
            
        } catch (error) {
            console.error('登录失败:', error);
            this.showMessage(error.message || '登录失败，请重试', 'error');
            
            // 清除密码字段
            if (passwordInput) passwordInput.value = '';
        } finally {
            this.isProcessing = false;
            
            // 重新启用按钮
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = '登录';
            }
        }
    }

    // 处理注册
    async handleRegister() {
        if (this.isProcessing) {
            console.log('注册请求正在处理中，请稍候...');
            return;
        }

        this.isProcessing = true;
        console.log('处理注册请求...');

        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const registerBtn = document.getElementById('registerBtn');
        
        if (!usernameInput || !emailInput || !passwordInput || !confirmPasswordInput) {
            this.showMessage('表单元素未找到', 'error');
            this.isProcessing = false;
            return;
        }

        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        // 输入验证
        if (!username) {
            this.showMessage('请输入用户名', 'error');
            this.isProcessing = false;
            return;
        }

        if (!email) {
            this.showMessage('请输入邮箱', 'error');
            this.isProcessing = false;
            return;
        }

        if (!password) {
            this.showMessage('请输入密码', 'error');
            this.isProcessing = false;
            return;
        }

        if (password !== confirmPassword) {
            this.showMessage('两次输入的密码不一致', 'error');
            this.isProcessing = false;
            return;
        }

        if (password.length < 6) {
            this.showMessage('密码长度至少6位', 'error');
            this.isProcessing = false;
            return;
        }

        // 用户名格式验证
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(username)) {
            this.showMessage('用户名只能包含字母、数字和下划线', 'error');
            this.isProcessing = false;
            return;
        }

        // 邮箱格式验证
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showMessage('请输入有效的邮箱地址', 'error');
            this.isProcessing = false;
            return;
        }

        // 禁用按钮并显示加载状态
        if (registerBtn) {
            registerBtn.disabled = true;
            registerBtn.innerHTML = '<span class="loading-spinner"></span>注册中...';
        }

        try {
            console.log(`注册新用户: ${username}`);
            
            // 检查 dataManager 是否可用
            if (!window.dataManager || !window.dataManager.user) {
                throw new Error('数据系统未就绪，请刷新页面重试');
            }
            
            // 创建用户数据
            const userData = {
                id: 'user_' + Date.now(),
                username: username,
                email: email,
                password: password,
                avatar: 'assets/default-avatar.png' + username.charAt(0).toUpperCase(),
                signature: '这个人很懒，什么都没有写～',
                registerTime: new Date().toISOString(),
                followers: [],
                following: [],
                favorites: [],
                videos: [],
                dynamic: []
            };
            
            // 使用 dataManager 进行注册
            const user = window.dataManager.user.register(userData);
            
            console.log('注册成功:', user.username);
            this.showMessage('注册成功！正在跳转登录页面...', 'success');
            
            // 延迟跳转，让用户看到成功消息
            setTimeout(() => {
                console.log('跳转到登录页面');
                // 清除敏感数据
                if (usernameInput) usernameInput.value = '';
                if (emailInput) emailInput.value = '';
                if (passwordInput) passwordInput.value = '';
                if (confirmPasswordInput) confirmPasswordInput.value = '';
                window.location.href = 'login.html';
            }, 1500);
            
        } catch (error) {
            console.error('注册失败:', error);
            this.showMessage(error.message || '注册失败，请重试', 'error');
            
            // 清除密码字段
            if (passwordInput) passwordInput.value = '';
            if (confirmPasswordInput) confirmPasswordInput.value = '';
        } finally {
            this.isProcessing = false;
            
            // 重新启用按钮
            if (registerBtn) {
                registerBtn.disabled = false;
                registerBtn.textContent = '注册';
            }
        }
    }

    // 更新全局认证状态
    updateGlobalAuthState() {
        try {
            window.currentUser = this.currentUser;
            
            // 触发自定义事件，通知其他页面用户状态变化
            const authEvent = new CustomEvent('authStateChanged', {
                detail: { user: this.currentUser }
            });
            window.dispatchEvent(authEvent);
        } catch (error) {
            console.error('更新全局认证状态失败:', error);
        }
    }

    // 更新用户数据（供其它模块调用，如上传后更新作者信息）
    updateUserData(updatedUser) {
        try {
            if (!updatedUser || !updatedUser.id) return false;

            // 优先通过 DataManager 更新
            if (window.dataManager && window.dataManager.user && typeof window.dataManager.user.update === 'function') {
                const ok = window.dataManager.user.update(updatedUser);
                if (!ok) console.warn('dataManager.user.update 返回 false');
            } else if (window.dataManager && window.dataManager.folder && typeof window.dataManager.folder.save === 'function') {
                // 降级保存到 users 文件夹
                const users = window.dataManager.folder.getAllItems('users') || [];
                const idx = users.findIndex(u => u.id === updatedUser.id);
                if (idx !== -1) users[idx] = updatedUser;
                else users.push(updatedUser);
                window.dataManager.folder.save('users', users);
            } else {
                console.warn('无法找到可用的数据更新接口，尝试直接写 localStorage');
                try {
                        const saved = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('StreamFlix_data/users'), []) : JSON.parse(localStorage.getItem('StreamFlix_data/users') || '[]');
                    const i = saved.findIndex(u => u.id === updatedUser.id);
                    if (i !== -1) saved[i] = updatedUser; else saved.push(updatedUser);
                    localStorage.setItem('StreamFlix_data/users', JSON.stringify(saved));
                } catch (e) {
                    console.error('直接写 localStorage 失败:', e);
                }
            }

            // 更新本地认证状态
            // 防止将过大的 data URL 存入 localStorage 导致配额耗尽或内存问题
            if (updatedUser.avatar && typeof updatedUser.avatar === 'string' && updatedUser.avatar.startsWith('data:') && updatedUser.avatar.length > 20000) {
                console.warn('updatedUser.avatar 数据过大（避免写入 localStorage），使用默认头像代替');
                updatedUser.avatar = 'assets/default-avatar.png';
            }

            this.currentUser = updatedUser;
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            this.updateGlobalAuthState();
            this.updateUIBasedOnAuth();

            return true;
        } catch (error) {
            console.error('updateUserData 失败:', error);
            return false;
        }
    }

    // 退出登录
    logout() {
        console.log('用户退出登录');
        this.clearLoginState();
        this.showMessage('已退出登录', 'success');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    }

    // 清除登录状态
    clearLoginState() {
        try {
            localStorage.removeItem('currentUser');
            this.currentUser = null;
            this.updateGlobalAuthState();
            this.updateUIBasedOnAuth();
        } catch (error) {
            console.error('清除登录状态失败:', error);
        }
    }

    // 显示消息
    showMessage(message, type) {
        console.log(`显示消息: ${message} (${type})`);
        
        // 优先使用页面中的消息容器
        const pageMessage = document.getElementById('authMessage');
        if (pageMessage) {
            pageMessage.textContent = message;
            pageMessage.className = `auth-message ${type}`;
            pageMessage.style.display = 'block';
            
            // 自动隐藏成功消息
            if (type === 'success') {
                setTimeout(() => {
                    pageMessage.style.display = 'none';
                }, 3000);
            }
            return;
        }

        // 降级方案：创建浮动消息
        const existingMessages = document.querySelectorAll('.auth-floating-message');
        existingMessages.forEach(msg => {
            if (msg.parentNode) {
                msg.parentNode.removeChild(msg);
            }
        });

        const messageDiv = document.createElement('div');
        messageDiv.className = `auth-floating-message ${type}`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            z-index: 10000;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            ${type === 'success' ? 'background: #4CAF50;' : 'background: #f44336;'}
        `;

        document.body.appendChild(messageDiv);

        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 3000);
    }

    // 获取当前用户
    getCurrentUser() {
        return this.currentUser;
    }

    // 检查用户是否已登录
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // 要求登录
    requireLogin(redirectUrl = 'login.html') {
        if (!this.currentUser) {
            if (confirm('此功能需要登录，是否前往登录页面？')) {
                window.location.href = redirectUrl;
            }
            return false;
        }
        return true;
    }
}

// 初始化认证管理器 - 带有错误处理
let authManager;

try {
    console.log('开始加载 AuthManager...');
    authManager = new AuthManager();
    window.authManager = authManager;
} catch (error) {
    console.error('创建 AuthManager 实例失败:', error);
    // 创建降级的认证管理器
    window.authManager = {
        currentUser: null,
        isInitialized: false,
        getCurrentUser: () => null,
        isLoggedIn: () => false,
        requireLogin: () => {
            if (confirm('此功能需要登录，是否前往登录页面？')) {
                window.location.href = 'login.html';
            }
            return false;
        },
        logout: () => {
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        }
    };
}

// 当 DOM 加载完成后进行额外初始化
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM 加载完成，进行额外初始化');
    
    if (authManager) {
        // 确保认证管理器已初始化
        if (!authManager.isInitialized) {
            console.log('AuthManager 尚未初始化完成，等待中...');
            const checkInit = setInterval(() => {
                if (authManager.isInitialized) {
                    clearInterval(checkInit);
                    console.log('AuthManager 初始化完成');
                    
                    // 更新UI状态
                    authManager.updateUIBasedOnAuth();
                }
            }, 100);
        } else {
            // 直接更新UI状态
            authManager.updateUIBasedOnAuth();
        }
    }
});

// 添加全局样式用于加载动画
if (!document.querySelector('#auth-manager-styles')) {
    const style = document.createElement('style');
    style.id = 'auth-manager-styles';
    style.textContent = `
        .loading-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #ffffff;
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 1s ease-in-out infinite;
            margin-right: 8px;
            vertical-align: middle;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .auth-message {
            margin-bottom: 15px;
            padding: 10px;
            border-radius: 4px;
            text-align: center;
            display: none;
        }
        
        .auth-message.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
        }
        
        .auth-message.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
        }
    `;
    document.head.appendChild(style);
}