// hotfix.js - 紧急修复补丁（增强版）
function applyHotfix() {
    console.log('应用热修复补丁...');
    
    // 修复登录状态检查
    function checkAuthStatus() {
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (savedUser) {
                try {
                    const user = (typeof safeJsonParse === 'function') ? safeJsonParse(savedUser, null) : (savedUser ? JSON.parse(savedUser) : null);
                    window.currentUser = user;
                    
                    // 更新UI
                    updateAuthUI(user);
                } catch (e) {
                    console.error('解析用户数据失败:', e);
                    localStorage.removeItem('currentUser');
                    window.currentUser = null;
                }
            } else {
                window.currentUser = null;
                updateAuthUI(null);
            }
        } catch (error) {
            console.error('检查认证状态失败:', error);
        }
    }
    
    // 更新认证UI
    function updateAuthUI(user) {
        const headerActions = document.getElementById('headerActions');
        if (!headerActions) return;
        
        if (user) {
            headerActions.innerHTML = `
                <div style="display:flex; align-items:center; width:100%; justify-content:flex-end;">
                    <img src="${user.avatar || 'assets/default-avatar.png'}" alt="avatar" class="header-avatar" onclick="window.location.href='profile.html'" />
                </div>
            `;
        } else {
            headerActions.innerHTML = `
                <button class="btn btn-primary" onclick="window.location.href='login.html'">登录</button>
                <button class="btn btn-secondary" onclick="window.location.href='register.html'">注册</button>
            `;
        }
    }
    
    // 全局退出函数
    window.logout = function() {
        try {
            localStorage.removeItem('currentUser');
            window.currentUser = null;
            updateAuthUI(null);
            
            // 触发认证状态变化事件
            window.dispatchEvent(new CustomEvent('authStateChanged', {
                detail: { user: null }
            }));
            
            // 延迟跳转让UI更新完成
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 100);
        } catch (error) {
            console.error('退出登录失败:', error);
            window.location.href = 'index.html';
        }
    };
    
    // 立即检查登录状态
    checkAuthStatus();
    
    // 监听存储变化
    window.addEventListener('storage', function(e) {
        if (e.key === 'currentUser') {
            console.log('检测到存储变化，重新检查登录状态');
            checkAuthStatus();
        }
    });
    
    // 监听认证状态变化
    window.addEventListener('authStateChanged', function(e) {
        console.log('收到认证状态变化事件');
        window.currentUser = e.detail.user;
        updateAuthUI(e.detail.user);
    });
    
    console.log('热修复补丁应用完成');
}

// 提供全局辅助函数
window.getCurrentUser = function() {
        try {
            if (window.currentUser) return window.currentUser;
            const saved = localStorage.getItem('currentUser');
            if (typeof safeJsonParse === 'function') {
                return safeJsonParse(saved, null);
            }
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            console.error('解析本地用户失败:', e);
            return null;
        }
};

window.isLoggedIn = function() {
    return !!window.getCurrentUser();
};

// 自动应用热修复
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyHotfix);
} else {
    setTimeout(applyHotfix, 0);
}

// 存储空间管理
const StorageHelper = {
    // 检查存储使用情况
    checkStorageUsage() {
        let totalSize = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalSize += localStorage[key].length;
            }
        }
        return {
            used: totalSize,
            usedKB: (totalSize / 1024).toFixed(2),
            usedMB: (totalSize / 1024 / 1024).toFixed(2),
            warning: totalSize > 4 * 1024 * 1024 // 4MB警告
        };
    },
    
    // 清理大文件数据
    cleanupLargeData() {
        const largeItems = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const value = localStorage.getItem(key);
            if (value.length > 100000) { // 大于100KB
                largeItems.push({ key, size: value.length });
            }
        }
        
        largeItems.sort((a, b) => b.size - a.size);
        
        // 清理最大的几个项目
        largeItems.slice(0, 3).forEach(item => {
            console.log(`清理大文件: ${item.key} (${(item.size / 1024).toFixed(2)}KB)`);
            localStorage.removeItem(item.key);
        });
        
        return largeItems.length;
    },
    
    // 优化用户数据
    optimizeUserData() {
        try {
            const usersData = localStorage.getItem('StreamFlix_data/users');
            if (usersData) {
                const users = JSON.parse(usersData);
                let optimized = false;
                
                const optimizedUsers = users.map(user => {
                    if (user.avatar && user.avatar.startsWith('data:') && user.avatar.length > 5000) {
                        user.avatar = 'assets/default-avatar.png';
                        optimized = true;
                    }
                    return user;
                });
                
                if (optimized) {
                    localStorage.setItem('StreamFlix_data/users', JSON.stringify(optimizedUsers));
                    console.log('用户数据优化完成');
                }
            }
        } catch (error) {
            console.error('优化用户数据失败:', error);
        }
    }
};

// 暴露到全局
window.StorageHelper = StorageHelper;