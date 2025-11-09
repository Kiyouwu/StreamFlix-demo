// search.js - 修复版

// 搜索管理系统 - 修复版
class SearchManager {
    constructor() {
        // 等待必要依赖加载
        if (typeof dataManager === 'undefined') {
            console.error('DataManager not found');
            return;
        }
        
        this.currentUser = this.getCurrentUser();
        this.currentFilter = 'all';
        this.currentQuery = '';
        
        this.init();
    }

    // 获取当前用户
    getCurrentUser() {
        if (window.authManager && window.authManager.getCurrentUser) {
            return window.authManager.getCurrentUser();
        }
        if (window.currentUser) {
            return window.currentUser;
        }
        try {
            const savedUser = localStorage.getItem('currentUser');
            if (typeof safeJsonParse === 'function') return safeJsonParse(savedUser, null);
            return savedUser ? JSON.parse(savedUser) : null;
        } catch (e) {
            console.error('获取当前用户失败:', e);
            return null;
        }
    }

    init() {
        this.setupEventListeners();
        this.loadSearchHistory();
        
        // 检查URL参数
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');
        if (query) {
            this.performSearch(query);
        }
    }

    // 设置事件监听器
    setupEventListeners() {
        // 搜索按钮
        const searchBtn = document.querySelector('.search-btn-large');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.performMainSearch();
            });
        }

        // 搜索输入框回车事件
        const mainSearch = document.getElementById('mainSearch');
        if (mainSearch) {
            mainSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.performMainSearch();
                }
            });
        }

        // 头部搜索框
        const headerSearch = document.getElementById('headerSearch');
        if (headerSearch) {
            headerSearch.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const query = e.target.value.trim();
                    if (query) {
                        this.performSearch(query);
                    }
                }
            });
        }

        // 过滤器标签
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const filter = e.target.dataset.filter;
                if (filter) {
                    this.switchFilter(filter);
                }
            });
        });

        // 清空搜索历史
        const clearHistory = document.querySelector('.history-clear');
        if (clearHistory) {
            clearHistory.addEventListener('click', () => {
                this.clearSearchHistory();
            });
        }
    }

    // 执行主搜索
    performMainSearch() {
        const mainSearch = document.getElementById('mainSearch');
        if (mainSearch) {
            const query = mainSearch.value.trim();
            if (query) {
                this.performSearch(query);
            }
        }
    }

    // 执行搜索
    performSearch(query) {
        if (!query || !query.trim()) return;
        
        this.currentQuery = query.trim();
        
        // 更新搜索框
        const mainSearch = document.getElementById('mainSearch');
        const headerSearch = document.getElementById('headerSearch');
        if (mainSearch) mainSearch.value = this.currentQuery;
        if (headerSearch) headerSearch.value = this.currentQuery;
        
        // 添加到搜索历史
        this.addToSearchHistory(this.currentQuery);
        
        // 执行搜索
        this.executeSearch(this.currentQuery);
    }

    // 执行搜索逻辑
    executeSearch(query) {
        try {
            // 使用 dataManager 进行搜索
            const videoResults = dataManager.video.search(query);
            const userResults = dataManager.user.search(query);
            
            // 搜索标签
            const allVideos = dataManager.folder.getAllItems('videos');
            const allTags = [...new Set(allVideos.flatMap(v => v.tags || []))];
            const tagResults = allTags.filter(tag =>
                tag && tag.toLowerCase().includes(query.toLowerCase())
            );

            this.displayResults(videoResults, userResults, tagResults);
        } catch (error) {
            console.error('搜索执行失败:', error);
            this.showError('搜索失败，请重试');
        }
    }

    // 显示搜索结果
    displayResults(videoResults, userResults, tagResults) {
        const noResults = document.getElementById('noResults');
        const videoResultsSection = document.getElementById('videoResults');
        const userResultsSection = document.getElementById('userResults');
        const tagResultsSection = document.getElementById('tagResults');

        // 隐藏无结果提示
        if (noResults) noResults.style.display = 'none';

        // 显示视频结果
        if (videoResultsSection) {
            if (videoResults.length > 0 && (this.currentFilter === 'all' || this.currentFilter === 'videos')) {
                videoResultsSection.style.display = 'block';
                const videoGrid = document.getElementById('videoResultsGrid');
                if (videoGrid) {
                    videoGrid.innerHTML = videoResults.map(video => `
                        <div class="video-card" data-video-id="${video.id}">
                            <img src="${video.cover}" alt="${video.title}" class="video-cover" 
                                 onerror="this.src='assets/demoCover.png'">
                            <div class="video-info">
                                <div class="video-title">${this.escapeHtml(video.title)}</div>
                                <div class="video-meta">
                                    <span>${video.authorName}</span>
                                    <span>${video.views || 0} 播放</span>
                                </div>
                            </div>
                        </div>
                    `).join('');

                    // 添加视频点击事件
                    videoGrid.querySelectorAll('.video-card').forEach(card => {
                        card.addEventListener('click', () => {
                            const videoId = card.dataset.videoId;
                            this.playVideo(videoId);
                        });
                    });
                }
            } else {
                videoResultsSection.style.display = 'none';
            }
        }

        // 显示用户结果
        if (userResultsSection) {
            if (userResults.length > 0 && (this.currentFilter === 'all' || this.currentFilter === 'users')) {
                userResultsSection.style.display = 'block';
                const userGrid = document.getElementById('userResultsGrid');
                if (userGrid) {
                    userGrid.innerHTML = userResults.map(user => `
                        <div class="user-card" data-user-id="${user.id}">
                            <img src="${user.avatar}" alt="${user.username}" class="user-avatar"
                                 onerror="this.src='assets/default-avatar.png'">
                            <div style="font-weight: bold;">${this.escapeHtml(user.username)}</div>
                            <div style="color: #666; font-size: 0.9em; margin-top: 5px;">${this.escapeHtml(user.signature || '')}</div>
                        </div>
                    `).join('');

                    // 添加用户点击事件
                    userGrid.querySelectorAll('.user-card').forEach(card => {
                        card.addEventListener('click', () => {
                            const userId = card.dataset.userId;
                            this.viewUserProfile(userId);
                        });
                    });
                }
            } else {
                userResultsSection.style.display = 'none';
            }
        }

        // 显示标签结果
        if (tagResultsSection) {
            if (tagResults.length > 0 && (this.currentFilter === 'all' || this.currentFilter === 'tags')) {
                tagResultsSection.style.display = 'block';
                const tagList = document.getElementById('tagResultsList');
                if (tagList) {
                    tagList.innerHTML = tagResults.map(tag => `
                        <div class="tag" data-tag="${tag}" style="display: inline-block; margin: 5px; padding: 8px 15px; background: var(--bg-color); border-radius: 15px; cursor: pointer;">
                            #${this.escapeHtml(tag)}
                        </div>
                    `).join('');

                    // 添加标签点击事件
                    tagList.querySelectorAll('.tag').forEach(tag => {
                        tag.addEventListener('click', () => {
                            const tagName = tag.dataset.tag;
                            this.searchByTag(tagName);
                        });
                    });
                }
            } else {
                tagResultsSection.style.display = 'none';
            }
        }

        // 如果没有结果
        if (noResults && videoResults.length === 0 && userResults.length === 0 && tagResults.length === 0) {
            noResults.style.display = 'block';
            noResults.innerHTML = `<p>没有找到与 "${this.escapeHtml(this.currentQuery)}" 相关的结果</p>`;
        }
    }

    // 切换过滤器
    switchFilter(filter) {
        this.currentFilter = filter;
        
        // 更新活跃标签
        document.querySelectorAll('.filter-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeTab = document.querySelector(`[data-filter="${filter}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // 重新显示结果
        if (this.currentQuery) {
            this.executeSearch(this.currentQuery);
        }
    }

    // 加载搜索历史
    loadSearchHistory() {
        const historyList = document.getElementById('searchHistoryList');
        if (!historyList) return;
        
        let searchHistory = [];
        if (this.currentUser) {
            searchHistory = this.getUserSearchHistory();
        } else {
            // 如果没有登录，使用本地临时历史
            searchHistory = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('tempSearchHistory'), []) : JSON.parse(localStorage.getItem('tempSearchHistory') || '[]');
        }

        if (searchHistory.length === 0) {
            historyList.innerHTML = '<div class="history-item">暂无搜索历史</div>';
            return;
        }

        historyList.innerHTML = searchHistory.slice(0, 10).map(item => {
            const query = typeof item === 'string' ? item : item.query;
            return `
                <div class="history-item">
                    <span onclick="searchManager.performSearch('${this.escapeHtml(query)}')">${this.escapeHtml(query)}</span>
                    <span onclick="searchManager.removeFromSearchHistory('${this.escapeHtml(query)}')" style="color: #999; cursor: pointer;">×</span>
                </div>
            `;
        }).join('');
    }

    // 获取用户搜索历史
    getUserSearchHistory() {
        try {
            const userData = dataManager.user.getById(this.currentUser.id);
            return userData?.searchHistory || [];
        } catch (error) {
            console.error('获取用户搜索历史失败:', error);
            return [];
        }
    }

    // 保存用户搜索历史
    saveUserSearchHistory(history) {
        try {
            const userData = dataManager.user.getById(this.currentUser.id);
            userData.searchHistory = history;
            dataManager.user.update(userData);
            return true;
        } catch (error) {
            console.error('保存用户搜索历史失败:', error);
            return false;
        }
    }

    // 添加到搜索历史
    addToSearchHistory(query) {
        if (!query || !query.trim()) return;
        
        if (this.currentUser) {
            let searchHistory = this.getUserSearchHistory();
            
            // 移除重复项
            searchHistory = searchHistory.filter(item => {
                const existingQuery = typeof item === 'string' ? item : item.query;
                return existingQuery !== query;
            });
            
            // 添加到开头
            searchHistory.unshift({
                query: query,
                timestamp: new Date().toISOString()
            });
            
            // 限制数量
            searchHistory = searchHistory.slice(0, 10);
            
            this.saveUserSearchHistory(searchHistory);
        } else {
            // 临时存储
            let tempHistory = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('tempSearchHistory'), []) : JSON.parse(localStorage.getItem('tempSearchHistory') || '[]');
            tempHistory = tempHistory.filter(item => item !== query);
            tempHistory.unshift(query);
            tempHistory = tempHistory.slice(0, 10);
            localStorage.setItem('tempSearchHistory', JSON.stringify(tempHistory));
        }
        
        this.loadSearchHistory();
    }

    // 从搜索历史移除
    removeFromSearchHistory(query) {
        if (this.currentUser) {
            let searchHistory = this.getUserSearchHistory();
            searchHistory = searchHistory.filter(item => {
                const existingQuery = typeof item === 'string' ? item : item.query;
                return existingQuery !== query;
            });
            this.saveUserSearchHistory(searchHistory);
        } else {
            // 临时历史
            let tempHistory = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('tempSearchHistory'), []) : JSON.parse(localStorage.getItem('tempSearchHistory') || '[]');
            tempHistory = tempHistory.filter(item => item !== query);
            localStorage.setItem('tempSearchHistory', JSON.stringify(tempHistory));
        }
        
        this.loadSearchHistory();
    }

    // 清空搜索历史
    clearSearchHistory() {
        if (confirm('确定要清空所有搜索历史吗？')) {
            if (this.currentUser) {
                this.saveUserSearchHistory([]);
            } else {
                localStorage.removeItem('tempSearchHistory');
            }
            this.loadSearchHistory();
        }
    }

    // 通过标签搜索
    searchByTag(tag) {
        this.performSearch(tag);
    }

    // 播放视频
    playVideo(videoId) {
        if (this.currentUser) {
            // 记录观看历史
            const history = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('history'), []) : JSON.parse(localStorage.getItem('history') || '[]');
            const existingIndex = history.findIndex(item => 
                item.userId === this.currentUser.id && item.videoId === videoId
            );
            
            if (existingIndex !== -1) {
                history[existingIndex].watchTime = new Date().toISOString();
            } else {
                history.push({
                    userId: this.currentUser.id,
                    videoId: videoId,
                    watchTime: new Date().toISOString(),
                    progress: 0
                });
            }
            localStorage.setItem('history', JSON.stringify(history));
        }
        window.location.href = `video-play.html?id=${videoId}`;
    }

    // 查看用户资料
    viewUserProfile(userId) {
        window.location.href = `user.html?id=${userId}`;
    }

    // 显示错误
    showError(message) {
        const noResults = document.getElementById('noResults');
        if (noResults) {
            noResults.style.display = 'block';
            noResults.innerHTML = `<p>${message}</p>`;
        }
    }

    // HTML转义
    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// 全局搜索函数
function performSearch(query) {
    if (typeof searchManager !== 'undefined') {
        searchManager.performSearch(query);
    } else {
        window.location.href = `search.html?q=${encodeURIComponent(query)}`;
    }
}

function clearSearchHistory() {
    if (typeof searchManager !== 'undefined') {
        searchManager.clearSearchHistory();
    }
}

// 初始化搜索管理器
let searchManager;
document.addEventListener('DOMContentLoaded', () => {
    searchManager = new SearchManager();
    window.searchManager = searchManager;
});