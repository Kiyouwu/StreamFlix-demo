// user.js - 修复版
class UserProfileManager {
    constructor() {
        this.currentUser = this.getCurrentUser();
        this.targetUser = null;
        this.init();
    }

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
        this.loadTargetUser();
        this.setupEventListeners();
    }

    loadTargetUser() {
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('id');
        
        if (!userId) {
            this.showError('用户ID不存在');
            return;
        }

        try {
            this.targetUser = dataManager.user.getById(userId);
            if (!this.targetUser) {
                this.showError('用户不存在');
                return;
            }

            this.displayUserProfile();
            this.loadUserVideos();
        } catch (error) {
            console.error('加载用户数据失败:', error);
            this.showError('加载用户数据失败');
        }
    }

    displayUserProfile() {
        const isOwnProfile = this.currentUser && this.currentUser.id === this.targetUser.id;
        
        const profileHTML = `
            <div class="profile-header">
                <img src="${this.targetUser.avatar}" alt="头像" class="profile-avatar"
                     onerror="this.src='assets/default-avatar.png'">
                <div class="profile-info">
                    <div class="profile-username">${this.escapeHtml(this.targetUser.username)}</div>
                    <div class="profile-signature">${this.escapeHtml(this.targetUser.signature || '这个人很懒，什么都没有写～')}</div>
                    ${!isOwnProfile ? `
                        <div class="profile-actions">
                            <button class="follow-btn" id="followBtn">
                                ${this.isFollowing() ? '已关注' : '关注'}
                            </button>
                        </div>
                    ` : ''}
                </div>
                <div class="profile-stats">
                    <div class="stat-item">
                        <div class="stat-number" id="videoCount">0</div>
                        <div class="stat-label">投稿</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number" id="followerCount">${this.targetUser.followers ? this.targetUser.followers.length : 0}</div>
                        <div class="stat-label">粉丝</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-number" id="followingCount">${this.targetUser.following ? this.targetUser.following.length : 0}</div>
                        <div class="stat-label">关注</div>
                    </div>
                </div>
            </div>

            <div class="profile-tabs">
                <ul class="tab-nav">
                    <li class="tab-item active" data-tab="videos">视频</li>
                    <li class="tab-item" data-tab="dynamic">动态</li>
                    ${isOwnProfile ? `
                        <li class="tab-item" data-tab="favorites">收藏</li>
                    ` : ''}
                </ul>
            </div>

            <div class="tab-content">
                <div id="videos-tab" class="tab-panel active">
                    <h3>视频</h3>
                    <div class="video-grid" id="userVideosGrid">
                        <div class="loading-state">加载中...</div>
                    </div>
                    <div class="empty-state" id="noVideosMessage" style="display: none;">
                        <p>该用户还没有上传过视频</p>
                    </div>
                </div>

                <div id="dynamic-tab" class="tab-panel">
                    <h3>动态</h3>
                    <div id="userDynamicList">
                        <div class="loading-state">加载中...</div>
                    </div>
                    <div class="empty-state" id="noDynamicMessage" style="display: none;">
                        <p>该用户还没有发布任何动态</p>
                    </div>
                </div>

                ${isOwnProfile ? `
                    <div id="favorites-tab" class="tab-panel">
                        <h3>收藏</h3>
                        <div class="video-grid" id="userFavoritesGrid">
                            <div class="loading-state">加载中...</div>
                        </div>
                        <div class="empty-state" id="noFavoritesMessage" style="display: none;">
                            <p>你还没有收藏任何视频</p>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        const profileContent = document.getElementById('userProfileContent');
        if (profileContent) {
            // 使用安全的 DOM 构建替代直接 innerHTML 插入，避免 XSS
            profileContent.innerHTML = '';
            const temp = document.createElement('div');
            temp.innerHTML = profileHTML;
            // 抽取并安全处理可能包含用户数据的节点
            const isSafeUrl = (url) => {
                if (!url || typeof url !== 'string') return false;
                return /^(https?:|blob:|data:image\/|indexeddb:)/.test(url);
            };

            // 将 temp 的子节点逐个克隆到 profileContent 中，但对 img/video src 做白名单检查，对文本使用 textContent
            Array.from(temp.childNodes).forEach(node => {
                const clone = node.cloneNode(true);
                // 如果包含图片或视频，校验并设置 src
                clone.querySelectorAll && clone.querySelectorAll('img,video').forEach(el => {
                    const src = el.getAttribute('src');
                    if (!isSafeUrl(src)) {
                        el.removeAttribute('src');
                    }
                });
                profileContent.appendChild(clone);
            });
            this.updateStats();
            
            if (!isOwnProfile) {
                const followBtn = document.getElementById('followBtn');
                if (followBtn) {
                    followBtn.addEventListener('click', () => {
                        this.toggleFollow();
                    });
                }
            }
        }
    }

    updateStats() {
        const userVideos = dataManager.video.getByUser(this.targetUser.id);
        const videoCount = document.getElementById('videoCount');
        if (videoCount) {
            videoCount.textContent = userVideos.length;
        }
    }

    loadUserVideos() {
        try {
            const userVideos = dataManager.video.getByUser(this.targetUser.id);
            const videoGrid = document.getElementById('userVideosGrid');
            const noVideosMessage = document.getElementById('noVideosMessage');

            if (!videoGrid || !noVideosMessage) return;

            if (userVideos.length === 0) {
                videoGrid.style.display = 'none';
                noVideosMessage.style.display = 'block';
                return;
            }

            noVideosMessage.style.display = 'none';
            videoGrid.style.display = 'grid';
            
            videoGrid.innerHTML = userVideos.map(video => `
                <div class="video-card" data-video-id="${video.id}">
                    <img src="${video.cover}" alt="${video.title}" class="video-cover"
                         onerror="this.src='assets/demoCover.png'">
                    <div class="video-info">
                        <div class="video-title">${this.escapeHtml(video.title)}</div>
                        <div class="video-meta">
                            <span>${this.formatViews(video.views)} 播放</span>
                            <span>${this.formatTime(video.uploadTime)}</span>
                        </div>
                    </div>
                </div>
            `).join('');

            videoGrid.querySelectorAll('.video-card').forEach(card => {
                card.addEventListener('click', () => {
                    const videoId = card.dataset.videoId;
                    this.playVideo(videoId);
                });
            });
        } catch (error) {
            console.error('加载用户视频失败:', error);
            this.showTabError('videos-tab', '加载视频失败');
        }
    }

    loadUserDynamic() {
        try {
            // 使用 dataManager 的动态方法
            let userDynamic = [];
            if (dataManager.dynamic && dataManager.dynamic.getByUser) {
                userDynamic = dataManager.dynamic.getByUser(this.targetUser.id);
            } else {
                // 降级方案
                const allDynamics = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('dynamics'), []) : JSON.parse(localStorage.getItem('dynamics') || '[]');
                userDynamic = allDynamics.filter(dynamic => dynamic.authorId === this.targetUser.id);
            }
            
            const dynamicList = document.getElementById('userDynamicList');
            const noDynamicMessage = document.getElementById('noDynamicMessage');

            if (!dynamicList || !noDynamicMessage) return;

            if (userDynamic.length === 0) {
                dynamicList.style.display = 'none';
                noDynamicMessage.style.display = 'block';
                return;
            }

            noDynamicMessage.style.display = 'none';
            dynamicList.style.display = 'block';
            
            dynamicList.innerHTML = userDynamic.map(dynamic => `
                <div class="dynamic-item" style="background: white; padding: 15px; margin-bottom: 15px; border-radius: 8px;">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <img src="${dynamic.authorAvatar || this.targetUser.avatar}" alt="头像" 
                             style="width: 40px; height: 40px; border-radius: 50%; margin-right: 10px;"
                             onerror="this.src='assets/default-avatar.png'">
                        <div>
                            <div style="font-weight: bold;">${this.escapeHtml(dynamic.authorName || this.targetUser.username)}</div>
                            <div style="color: #666; font-size: 0.9em;">${this.formatTime(dynamic.publishTime)}</div>
                        </div>
                    </div>
                    <div style="margin-bottom: 10px;">${this.formatContent(dynamic.content)}</div>
                    ${dynamic.media && dynamic.media.length > 0 ? `
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 10px;">
                            ${dynamic.media.map(media => `
                                <img src="${media.url}" alt="动态媒体" style="width: 100%; border-radius: 4px;"
                                     onerror="this.style.display='none'">
                            `).join('')}
                        </div>
                    ` : ''}
                    <div style="display: flex; gap: 15px; color: #666;">
                        <span>👍 ${dynamic.likes || 0}</span>
                        <span>💬 ${dynamic.comments ? dynamic.comments.length : 0}</span>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('加载用户动态失败:', error);
            this.showTabError('dynamic-tab', '加载动态失败');
        }
    }

    loadUserFavorites() {
        try {
            let favorites = [];
            if (dataManager.favorite && dataManager.favorite.getByUser) {
                favorites = dataManager.favorite.getByUser(this.targetUser.id);
            } else {
                // 降级方案
                const userData = dataManager.user.getById(this.targetUser.id);
                const favoriteIds = userData?.favorites || [];
                const allVideos = dataManager.folder.getAllItems('videos');
                favorites = allVideos.filter(video => favoriteIds.includes(video.id));
            }
            
            const favoritesGrid = document.getElementById('userFavoritesGrid');
            const noFavoritesMessage = document.getElementById('noFavoritesMessage');

            if (!favoritesGrid || !noFavoritesMessage) return;

            if (favorites.length === 0) {
                favoritesGrid.style.display = 'none';
                noFavoritesMessage.style.display = 'block';
                return;
            }

            noFavoritesMessage.style.display = 'none';
            favoritesGrid.style.display = 'grid';
            
            favoritesGrid.innerHTML = favorites.map(video => `
                <div class="video-card" data-video-id="${video.id}">
                    <img src="${video.cover}" alt="${video.title}" class="video-cover"
                         onerror="this.src='assets/demoCover.png'">
                    <div class="video-info">
                        <div class="video-title">${this.escapeHtml(video.title)}</div>
                        <div class="video-meta">
                            <span>${video.authorName}</span>
                            <span>${this.formatViews(video.views)} 播放</span>
                        </div>
                    </div>
                </div>
            `).join('');

            favoritesGrid.querySelectorAll('.video-card').forEach(card => {
                card.addEventListener('click', () => {
                    const videoId = card.dataset.videoId;
                    this.playVideo(videoId);
                });
            });
        } catch (error) {
            console.error('加载用户收藏失败:', error);
            this.showTabError('favorites-tab', '加载收藏失败');
        }
    }

    formatContent(content) {
        if (!content) return '';
        return content
            .replace(/\n/g, '<br>')
            .replace(/#(\w+)/g, '<span style="color: var(--primary-color);">#$1</span>')
            .replace(/@(\w+)/g, '<span style="color: var(--secondary-color); cursor: pointer;">@$1</span>');
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-item')) {
                const tabName = e.target.dataset.tab;
                if (tabName) {
                    this.switchTab(tabName);
                }
            }
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.classList.remove('active');
        });
        const activeTab = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        const activePanel = document.getElementById(`${tabName}-tab`);
        if (activePanel) {
            activePanel.classList.add('active');
        }

        switch (tabName) {
            case 'videos':
                this.loadUserVideos();
                break;
            case 'dynamic':
                this.loadUserDynamic();
                break;
            case 'favorites':
                this.loadUserFavorites();
                break;
        }
    }

    isFollowing() {
        if (!this.currentUser) return false;
        const currentUserData = dataManager.user.getById(this.currentUser.id);
        return currentUserData?.following?.includes(this.targetUser.id) || false;
    }

    toggleFollow() {
        if (!this.currentUser && currentPage.includes('user.html')) {
            alert('请先登录！');
            window.location.href = 'login.html';
            return;
        }

        const followBtn = document.getElementById('followBtn');
        if (!followBtn) return;
        
        if (this.isFollowing()) {
            this.unfollowUser();
            followBtn.textContent = '关注';
            followBtn.classList.remove('following');
            this.showMessage('已取消关注');
        } else {
            this.followUser();
            followBtn.textContent = '已关注';
            followBtn.classList.add('following');
            this.showMessage('关注成功');
        }

        this.targetUser = dataManager.user.getById(this.targetUser.id);
        const followerCount = document.getElementById('followerCount');
        if (followerCount) {
            followerCount.textContent = this.targetUser.followers ? this.targetUser.followers.length : 0;
        }
    }

    followUser() {
        try {
            const currentUserData = dataManager.user.getById(this.currentUser.id);
            if (!currentUserData.following) currentUserData.following = [];
            if (!currentUserData.following.includes(this.targetUser.id)) {
                currentUserData.following.push(this.targetUser.id);
                dataManager.user.update(currentUserData);
            }

            if (!this.targetUser.followers) this.targetUser.followers = [];
            if (!this.targetUser.followers.includes(this.currentUser.id)) {
                this.targetUser.followers.push(this.currentUser.id);
                dataManager.user.update(this.targetUser);
            }
        } catch (error) {
            console.error('关注用户失败:', error);
        }
    }

    unfollowUser() {
        try {
            const currentUserData = dataManager.user.getById(this.currentUser.id);
            if (currentUserData.following) {
                currentUserData.following = currentUserData.following.filter(id => id !== this.targetUser.id);
                dataManager.user.update(currentUserData);
            }

            if (this.targetUser.followers) {
                this.targetUser.followers = this.targetUser.followers.filter(id => id !== this.currentUser.id);
                dataManager.user.update(this.targetUser);
            }
        } catch (error) {
            console.error('取消关注用户失败:', error);
        }
    }

    playVideo(videoId) {
        if (this.currentUser) {
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

    formatViews(views) {
        if (!views) return '0';
        if (views >= 10000) {
            return (views / 10000).toFixed(1) + '万';
        }
        return views.toString();
    }

    formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) {
            return '刚刚';
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)}分钟前`;
        } else if (diff < 86400000) {
            return `${Math.floor(diff / 3600000)}小时前`;
        } else {
            return date.toLocaleDateString();
        }
    }

    showMessage(message) {
        alert(message);
    }

    showTabError(tabId, message) {
        const tabContent = document.getElementById(tabId);
        if (tabContent) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'empty-state';
            errorDiv.innerHTML = `<p>${message}</p>`;
            tabContent.appendChild(errorDiv);
        }
    }

    showError(message) {
        const profileContent = document.getElementById('userProfileContent');
        if (profileContent) {
            profileContent.innerHTML = `
                <div class="empty-state">
                    <p>${message}</p>
                    <button class="btn btn-primary mt-20" onclick="window.location.href='index.html'">
                        返回首页
                    </button>
                </div>
            `;
        }
    }

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

let userProfileManager;
document.addEventListener('DOMContentLoaded', () => {
    userProfileManager = new UserProfileManager();
    window.userProfileManager = userProfileManager;
});