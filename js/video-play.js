// video-play.js - 修复存储管理器问题
class VideoPlayManager {
    constructor() {
        this.currentUser = this.getCurrentUser();
        this.currentVideo = null;
        this.videoElement = null;
        this.comments = [];
        this.isInitialized = false;
        this.videoBlobUrl = null;
        this.storageManagerAvailable = false;
        this.storageManagerReady = false;
        this.init();
    }

    getCurrentUser() {
        if (window.authManager && typeof authManager.getCurrentUser === 'function') {
            return authManager.getCurrentUser();
        }
        if (window.currentUser) {
            return window.currentUser;
        }
        try {
            const savedUser = localStorage.getItem('currentUser');
            return safeJsonParse(savedUser, null);
        } catch (e) {
            console.error('获取当前用户失败:', e);
            return null;
        }
    }

    async init() {
        try {
            console.log('开始初始化视频播放器...');
            
            // 等待数据管理器初始化
            if (window.dataManager && typeof dataManager.waitForInitialization === 'function') {
                await dataManager.waitForInitialization();
            }
            
            // 检查并等待存储管理器
            await this.checkAndWaitForStorageManager();
            
            this.loadVideo();
            this.setupEventListeners();
            this.isInitialized = true;
            
            console.log('视频播放器初始化完成');
        } catch (error) {
            console.error('视频播放器初始化失败:', error);
            this.showError('系统初始化失败，请刷新页面');
        }
    }

    async checkAndWaitForStorageManager() {
        console.log('检查存储管理器状态...');
        
        // 方法1: 检查全局存储管理器实例
        if (window.storageManager) {
            console.log('找到全局存储管理器实例');
            return await this.initializeExistingStorageManager();
        }
        
        // 方法2: 检查 StorageManager 类是否存在
        if (window.StorageManager) {
            console.log('找到 StorageManager 类，尝试创建实例');
            return await this.createStorageManagerInstance();
        }
        
        // 方法3: 降级处理
        console.warn('存储管理器不可用，使用降级方案');
        this.setupFallbackStorageManager();
        return false;
    }

    async initializeExistingStorageManager() {
        try {
            const status = window.storageManager.getSupportStatus();
            this.storageManagerAvailable = status.supported;
            this.storageManagerReady = status.initialized;
            
            console.log('现有存储管理器状态:', status);
            
            if (this.storageManagerAvailable && !this.storageManagerReady) {
                console.log('初始化现有存储管理器...');
                await window.storageManager.initialize();
                this.storageManagerReady = true;
                console.log('现有存储管理器初始化完成');
            }
            
            return this.storageManagerReady;
        } catch (error) {
            console.error('初始化现有存储管理器失败:', error);
            this.setupFallbackStorageManager();
            return false;
        }
    }

    async createStorageManagerInstance() {
        try {
            console.log('创建新的存储管理器实例...');
            window.storageManager = new window.StorageManager();
            
            const status = window.storageManager.getSupportStatus();
            this.storageManagerAvailable = status.supported;
            this.storageManagerReady = status.initialized;
            
            console.log('新存储管理器状态:', status);
            
            if (this.storageManagerAvailable && !this.storageManagerReady) {
                console.log('初始化新存储管理器...');
                await window.storageManager.initialize();
                this.storageManagerReady = true;
                console.log('新存储管理器初始化完成');
            }
            
            return this.storageManagerReady;
        } catch (error) {
            console.error('创建存储管理器实例失败:', error);
            this.setupFallbackStorageManager();
            return false;
        }
    }

    setupFallbackStorageManager() {
        console.log('设置降级存储管理器');
        this.storageManagerAvailable = false;
        this.storageManagerReady = false;
        
        // 创建降级存储管理器
        window.storageManager = {
            isSupported: false,
            isInitialized: false,
            initialize: () => Promise.reject(new Error('存储管理器不可用')),
            getVideo: () => Promise.reject(new Error('存储管理器不可用')),
            storeVideo: () => Promise.reject(new Error('存储管理器不可用')),
            getSupportStatus: () => ({ supported: false, initialized: false })
        };
    }

    async loadVideo() {
        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('id');
        
        if (!videoId) {
            this.showError('视频不存在！');
            return;
        }

        try {
            this.currentVideo = dataManager.video.getById(videoId);
            
            if (!this.currentVideo) {
                this.showError('视频不存在！');
                return;
            }

            console.log('加载视频:', this.currentVideo.title);
            console.log('视频URL类型:', this.currentVideo.videoUrl);
            
            await this.displayVideo();
            this.incrementViewCount();
            this.loadComments();
            this.loadRecommendedVideos();
        } catch (error) {
            console.error('加载视频失败:', error);
            this.showError('加载视频失败，请重试');
        }
    }

    async displayVideo() {
    document.title = `${this.currentVideo.title} - StreamFlix`;
        this.updateVideoInfo();
        await this.setupVideoElement();
        this.displayTags();
        this.updateActionButtons();
    }

    updateVideoInfo() {
        const elements = {
            'videoTitle': this.currentVideo.title,
            'videoDescription': this.currentVideo.description,
            'videoAuthor': this.currentVideo.authorName,
            'videoViews': `${this.currentVideo.views || 0} 播放`,
            'videoUploadTime': this.formatTime(this.currentVideo.uploadTime)
        };

        Object.entries(elements).forEach(([id, content]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = content;
        });
    }

    async setupVideoElement() {
        this.videoElement = document.getElementById('mainVideo');
        if (this.videoElement && this.currentVideo.videoUrl) {
            try {
                let videoUrl = this.currentVideo.videoUrl;
                
                console.log('处理视频URL:', videoUrl);
                
                // 处理 IndexedDB 存储的视频
                if (videoUrl.startsWith('indexeddb:')) {
                    videoUrl = await this.handleIndexedDBVideo(videoUrl);
                }
                // 处理 Blob URL
                else if (videoUrl.startsWith('blob:')) {
                    this.videoBlobUrl = videoUrl;
                    console.log('使用Blob URL');
                }
                // 处理 data URL 或 http URL
                else if (videoUrl.startsWith('data:') || videoUrl.startsWith('http')) {
                    console.log('使用直接URL');
                }
                // 未知格式 - 尝试作为普通URL处理
                else {
                    console.warn('未知视频URL格式，尝试直接使用:', videoUrl);
                }
                
                console.log('设置视频源:', videoUrl.substring(0, 100) + (videoUrl.length > 100 ? '...' : ''));
                this.videoElement.src = videoUrl;
                this.setupVideoEventListeners();
                this.videoElement.load();

            } catch (error) {
                console.error('设置视频源失败:', error);
                this.handleVideoLoadError(error);
            }
        } else if (!this.currentVideo.videoUrl) {
            this.handleMissingVideoUrl();
        }
    }

    async handleIndexedDBVideo(videoUrl) {
        if (!this.storageManagerReady) {
            throw new Error('视频存储系统不可用，无法播放 IndexedDB 中的视频');
        }

        try {
            const videoId = videoUrl.replace('indexeddb:', '');
            console.log('从IndexedDB获取视频:', videoId);
            
            const videoData = await window.storageManager.getVideo(videoId);
            
                if (videoData && videoData.file) {
                this.videoBlobUrl = window.createObjectURLTracked ? window.createObjectURLTracked(videoData.file) : URL.createObjectURL(videoData.file);
                console.log('成功创建Blob URL');
                return this.videoBlobUrl;
            } else {
                throw new Error('视频文件不存在于存储系统中');
            }
        } catch (error) {
            console.error('从存储系统获取视频失败:', error);
            throw error;
        }
    }

    setupVideoEventListeners() {
        this.videoElement.addEventListener('loadeddata', () => {
            this.hideLoading();
            console.log('视频数据加载完成');
        });
        
        this.videoElement.addEventListener('waiting', () => {
            this.showLoading();
        });
        
        this.videoElement.addEventListener('canplay', () => {
            this.hideLoading();
        });

        this.videoElement.addEventListener('error', (e) => {
            console.error('视频加载错误:', e, this.videoElement.error);
            const errorMsg = this.getVideoErrorDescription(this.videoElement.error);
            this.handleVideoLoadError(new Error(errorMsg));
        });

        this.videoElement.addEventListener('loadstart', () => {
            console.log('开始加载视频');
            this.showLoading();
        });
    }

    getVideoErrorDescription(error) {
        if (!error) return '未知视频错误';
        
        switch (error.code) {
            case error.MEDIA_ERR_ABORTED:
                return '视频加载被中止';
            case error.MEDIA_ERR_NETWORK:
                return '网络错误导致视频加载失败';
            case error.MEDIA_ERR_DECODE:
                return '视频格式不支持或文件已损坏';
            case error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                return '视频格式不支持';
            default:
                return '视频加载失败';
        }
    }

    handleVideoLoadError(error) {
        console.error('视频加载失败:', error);
        
        let errorMessage = '视频加载失败';
        let suggestion = '请尝试刷新页面或联系视频上传者';
        
        if (error.message.includes('存储系统不可用')) {
            errorMessage = '视频存储系统不可用';
            suggestion = '请刷新页面重试，如果问题持续存在请联系管理员';
        } else if (error.message.includes('视频文件不存在')) {
            errorMessage = '视频文件不存在或已被删除';
            suggestion = '请联系视频上传者重新上传视频';
        } else if (error.message.includes('格式不支持')) {
            errorMessage = '视频格式不支持';
            suggestion = '请尝试使用其他浏览器或更新浏览器版本';
        } else if (error.message.includes('网络错误')) {
            errorMessage = '网络连接问题';
            suggestion = '请检查网络连接后刷新页面';
        }
        
        this.showError(`${errorMessage}，${suggestion}`);
        this.showVideoErrorState(errorMessage, suggestion);
    }

    handleMissingVideoUrl() {
        const errorMessage = '视频链接不存在';
        const suggestion = '请联系视频上传者检查视频文件';
        this.showError(`${errorMessage}，${suggestion}`);
        this.showVideoErrorState(errorMessage, suggestion);
    }

    showVideoErrorState(message, suggestion) {
        const videoContainer = document.querySelector('.video-container');
        if (videoContainer) {
            if (this.videoElement) {
                this.videoElement.style.display = 'none';
            }
            
            const existingError = videoContainer.querySelector('.video-error-state');
            if (existingError) {
                existingError.remove();
            }
            // 使用 DOM 构建，避免注入不受信任的 HTML
            const wrapper = document.createElement('div');
            wrapper.className = 'video-error-state';
            wrapper.style.cssText = 'text-align: center; padding: 40px; background: var(--bg-color); border-radius: 8px; margin: 20px 0;';

            const icon = document.createElement('div');
            icon.className = 'error-icon';
            icon.style.fontSize = '48px';
            icon.style.marginBottom = '16px';
            icon.textContent = '📹❌';
            wrapper.appendChild(icon);

            const h3 = document.createElement('h3');
            h3.style.color = 'var(--text-primary)';
            h3.style.marginBottom = '8px';
            h3.textContent = message;
            wrapper.appendChild(h3);

            const p = document.createElement('p');
            p.style.color = 'var(--text-secondary)';
            p.style.marginBottom = '20px';
            p.textContent = suggestion;
            wrapper.appendChild(p);

            const actions = document.createElement('div');
            actions.style.display = 'flex';
            actions.style.gap = '10px';
            actions.style.justifyContent = 'center';
            actions.style.flexWrap = 'wrap';

            const btnReload = document.createElement('button');
            btnReload.className = 'btn btn-primary';
            btnReload.textContent = '重新加载';
            btnReload.addEventListener('click', () => window.location.reload());
            actions.appendChild(btnReload);

            const btnHome = document.createElement('button');
            btnHome.className = 'btn';
            btnHome.textContent = '返回首页';
            btnHome.addEventListener('click', () => { window.location.href = 'index.html'; });
            actions.appendChild(btnHome);

            const btnBack = document.createElement('button');
            btnBack.className = 'btn';
            btnBack.textContent = '返回上页';
            btnBack.addEventListener('click', () => history.back());
            actions.appendChild(btnBack);

            wrapper.appendChild(actions);

            if (!this.storageManagerReady) {
                const info = document.createElement('div');
                info.style.marginTop = '20px';
                info.style.padding = '10px';
                info.style.background = '#fff3cd';
                info.style.border = '1px solid #ffeaa7';
                info.style.borderRadius = '4px';
                const small = document.createElement('small');
                small.textContent = '技术信息: 存储系统初始化失败 - 这通常是由于浏览器隐私设置或存储限制导致的';
                info.appendChild(small);
                wrapper.appendChild(info);
            }

            videoContainer.appendChild(wrapper);
        }
    }

    showLoading() {
        const loading = document.getElementById('videoLoading');
        if (loading) {
            loading.style.display = 'flex';
            loading.innerHTML = `
                <div style="text-align: center;">
                    <div class="loading-spinner" style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 10px;"></div>
                    <p>视频加载中...</p>
                </div>
            `;
        }
        
        if (!document.querySelector('#loadingStyles')) {
            const style = document.createElement('style');
            style.id = 'loadingStyles';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    hideLoading() {
        const loading = document.getElementById('videoLoading');
        if (loading) loading.style.display = 'none';
    }

    displayTags() {
        const tagsContainer = document.getElementById('videoTags');
        if (tagsContainer && this.currentVideo.tags) {
            tagsContainer.innerHTML = '';
            this.currentVideo.tags.forEach(tag => {
                const span = document.createElement('span');
                span.className = 'tag';
                span.textContent = '#' + String(tag);
                tagsContainer.appendChild(span);
            });
        }
    }

    incrementViewCount() {
        if (this.currentVideo && this.currentVideo.id) {
            try {
                dataManager.video.incrementViews(this.currentVideo.id);
                this.currentVideo.views = (this.currentVideo.views || 0) + 1;
                
                const videoViews = document.getElementById('videoViews');
                if (videoViews) {
                    videoViews.textContent = `${this.currentVideo.views} 播放`;
                }
            } catch (error) {
                console.error('更新播放量失败:', error);
            }
        }
    }

    setupEventListeners() {
        this.setupActionButtons();
        this.setupCommentForm();
        this.setupVideoProgressTracking();
        this.setupAuthorClick();
    }

    setupActionButtons() {
        const likeBtn = document.getElementById('likeBtn');
        if (likeBtn) {
            likeBtn.addEventListener('click', () => this.toggleLike());
        }

        const favoriteBtn = document.getElementById('favoriteBtn');
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', () => this.toggleFavorite());
        }

        const shareBtn = document.getElementById('shareBtn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => this.shareVideo());
        }
    }

    setupCommentForm() {
        const commentForm = document.getElementById('commentForm');
        if (commentForm) {
            commentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitComment();
            });
        }
    }

    setupVideoProgressTracking() {
        if (this.videoElement) {
            this.videoElement.addEventListener('timeupdate', () => {
                this.trackProgress();
            });
        }
    }

    setupAuthorClick() {
        const videoAuthor = document.getElementById('videoAuthor');
        if (videoAuthor) {
            videoAuthor.addEventListener('click', () => {
                this.viewAuthorProfile();
            });
        }
    }

    updateActionButtons() {
        if (!this.currentUser || !this.currentVideo) return;

        this.updateLikeButton();
        this.updateFavoriteButton();
    }

    updateLikeButton() {
        const likeBtn = document.getElementById('likeBtn');
        const likeCount = document.getElementById('likeCount');
        
        if (likeBtn && likeCount) {
            const isLiked = this.currentVideo.likedBy && 
                           this.currentVideo.likedBy.includes(this.currentUser.id);
            
            likeBtn.innerHTML = isLiked ? 
                '<span>❤️</span><span>已点赞</span>' : 
                '<span>🤍</span><span>点赞</span>';
            likeBtn.className = `action-btn ${isLiked ? 'active' : ''}`;
            likeCount.textContent = this.currentVideo.likes || 0;
        }
    }

    updateFavoriteButton() {
        const favoriteBtn = document.getElementById('favoriteBtn');
        const favoriteCount = document.getElementById('favoriteCount');
        
        if (favoriteBtn && favoriteCount) {
            const isFavorited = dataManager.favorite.isFavorited(this.currentUser.id, this.currentVideo.id);
            favoriteBtn.innerHTML = isFavorited ? 
                '<span>⭐</span><span>已收藏</span>' : 
                '<span>☆</span><span>收藏</span>';
            favoriteBtn.className = `action-btn ${isFavorited ? 'active' : ''}`;
            
            const favoriteCountValue = this.getFavoriteCount();
            favoriteCount.textContent = favoriteCountValue;
        }
    }

    getFavoriteCount() {
        try {
            const users = dataManager.user.getAll();
            return users.reduce((count, user) => {
                return count + (user.favorites && user.favorites.includes(this.currentVideo.id) ? 1 : 0);
            }, 0);
        } catch (error) {
            console.error('获取收藏数量失败:', error);
            return 0;
        }
    }

    toggleLike() {
        if (!this.checkLogin()) return;

        try {
            const videos = dataManager.folder.getAllItems('videos');
            const videoIndex = videos.findIndex(v => v.id === this.currentVideo.id);
            
            if (videoIndex === -1) return;

            if (!videos[videoIndex].likedBy) {
                videos[videoIndex].likedBy = [];
            }

            const isLiked = videos[videoIndex].likedBy.includes(this.currentUser.id);
            
            if (isLiked) {
                videos[videoIndex].likedBy = videos[videoIndex].likedBy.filter(id => id !== this.currentUser.id);
                videos[videoIndex].likes = Math.max(0, (videos[videoIndex].likes || 0) - 1);
            } else {
                videos[videoIndex].likedBy.push(this.currentUser.id);
                videos[videoIndex].likes = (videos[videoIndex].likes || 0) + 1;
                
                if (this.currentVideo.authorId !== this.currentUser.id) {
                    this.createLikeMessage();
                }
            }

            dataManager.folder.saveItem('videos', this.currentVideo.id, videos[videoIndex]);
            this.currentVideo = videos[videoIndex];
            this.updateActionButtons();
            
        } catch (error) {
            console.error('点赞操作失败:', error);
            this.showMessage('操作失败，请重试');
        }
    }

    createLikeMessage() {
        try {
            const messages = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('messages'), []) : JSON.parse(localStorage.getItem('messages') || '[]');
            const likeMessage = {
                id: 'msg_' + Date.now(),
                type: 'like',
                senderId: this.currentUser.id,
                senderName: this.currentUser.username,
                recipientId: this.currentVideo.authorId,
                content: '点赞了你的视频',
                timestamp: new Date().toISOString(),
                read: false,
                relatedItem: {
                    type: 'video',
                    id: this.currentVideo.id,
                    title: this.currentVideo.title
                }
            };
            messages.push(likeMessage);
            localStorage.setItem('messages', JSON.stringify(messages));
            
            window.dispatchEvent(new CustomEvent('messagesUpdated'));
        } catch (error) {
            console.error('创建点赞消息失败:', error);
        }
    }

    toggleFavorite() {
        if (!this.checkLogin()) return;

        try {
            if (dataManager.favorite.isFavorited(this.currentUser.id, this.currentVideo.id)) {
                dataManager.favorite.remove(this.currentUser.id, this.currentVideo.id);
                this.showMessage('已取消收藏');
            } else {
                dataManager.favorite.add(this.currentUser.id, this.currentVideo.id);
                this.showMessage('收藏成功！');
            }

            this.updateActionButtons();
        } catch (error) {
            console.error('收藏操作失败:', error);
            this.showMessage('操作失败，请重试');
        }
    }

    checkLogin() {
        if (!this.currentUser) {
            this.showMessage('请先登录！');
            setTimeout(() => {
                window.location.href = 'login.html?redirect=' + encodeURIComponent(window.location.href);
            }, 1000);
            return false;
        }
        return true;
    }

    loadComments() {
        try {
            this.comments = this.currentVideo.comments || [];
            this.displayComments();
        } catch (error) {
            console.error('加载评论失败:', error);
            this.comments = [];
        }
    }

    displayComments() {
        const commentsContainer = document.getElementById('commentsList');
        const noComments = document.getElementById('noComments');
        
        if (!commentsContainer || !noComments) return;

        if (this.comments.length === 0) {
            commentsContainer.style.display = 'none';
            noComments.style.display = 'block';
            return;
        }

        noComments.style.display = 'none';
        commentsContainer.style.display = 'block';
        
        // 使用安全 DOM 创建每条评论，避免直接注入 HTML
        commentsContainer.innerHTML = '';
        const isSafeUrl = (url) => {
            if (!url || typeof url !== 'string') return false;
            return /^(https?:|blob:|data:image\/|indexeddb:)/.test(url);
        };

        this.comments.forEach(comment => {
            const el = this.createCommentElement(comment, isSafeUrl.bind(this));
            commentsContainer.appendChild(el);
        });
    }

    // 新方法：安全创建评论 DOM 元素
    createCommentElement(comment, isSafeUrl) {
        const isCommentOwner = comment.authorId === this.currentUser?.id;

        const container = document.createElement('div');
        container.className = 'comment-item';
        container.dataset.commentId = comment.id;

        const header = document.createElement('div');
        header.className = 'comment-header';

        const avatar = document.createElement('img');
        avatar.className = 'comment-avatar';
        if (isSafeUrl(comment.authorAvatar)) avatar.src = comment.authorAvatar;
        avatar.alt = comment.authorName || '';
        avatar.addEventListener('error', () => { avatar.src = 'assets/default-avatar.png'; });
        header.appendChild(avatar);

        const main = document.createElement('div');
        main.className = 'comment-main';

        const info = document.createElement('div');
        info.className = 'comment-info';
        const author = document.createElement('span');
        author.className = 'comment-author';
        author.textContent = comment.authorName || '匿名';
        const time = document.createElement('span');
        time.className = 'comment-time';
        time.textContent = this.formatTime(comment.publishTime);
        info.appendChild(author);
        info.appendChild(time);

        const content = document.createElement('div');
        content.className = 'comment-content';
        content.textContent = comment.content || '';

        const actions = document.createElement('div');
        actions.className = 'comment-actions';

        const likeAction = document.createElement('span');
        likeAction.className = 'comment-action';
        likeAction.textContent = `👍 ${comment.likes || 0}`;
        likeAction.addEventListener('click', () => this.toggleCommentLike(comment.id));
        actions.appendChild(likeAction);

        const replyAction = document.createElement('span');
        replyAction.className = 'comment-action';
        replyAction.textContent = '💬 回复';
        replyAction.addEventListener('click', () => this.showReplyForm(comment.id));
        actions.appendChild(replyAction);

        if (isCommentOwner) {
            const del = document.createElement('span');
            del.className = 'comment-action';
            del.textContent = '🗑️ 删除';
            del.addEventListener('click', () => this.deleteComment(comment.id));
            actions.appendChild(del);
        }

        main.appendChild(info);
        main.appendChild(content);
        main.appendChild(actions);

        // 回复
        if (comment.replies && comment.replies.length > 0) {
            const repliesEl = this.createRepliesElement(comment.replies, comment.id);
            main.appendChild(repliesEl);
        }

        header.appendChild(main);
        container.appendChild(header);

        return container;
    }

    createRepliesElement(replies, commentId) {
        const wrap = document.createElement('div');
        wrap.className = 'comment-replies';

        replies.forEach(reply => {
            const r = document.createElement('div');
            r.className = 'comment-reply';
            r.dataset.replyId = reply.id;

            const header = document.createElement('div');
            header.className = 'reply-header';

            const author = document.createElement('span');
            author.className = 'reply-author';
            author.textContent = reply.authorName || '匿名';

            const time = document.createElement('span');
            time.className = 'reply-time';
            time.textContent = this.formatTime(reply.publishTime);

            header.appendChild(author);
            header.appendChild(time);

            if (reply.authorId === this.currentUser?.id) {
                const del = document.createElement('span');
                del.className = 'reply-action';
                del.textContent = '删除';
                del.addEventListener('click', () => this.deleteReply(commentId, reply.id));
                header.appendChild(del);
            }

            const content = document.createElement('div');
            content.className = 'reply-content';
            content.textContent = reply.content || '';

            r.appendChild(header);
            r.appendChild(content);
            wrap.appendChild(r);
        });

        return wrap;
    }

    attachCommentEvents() {
        // 评论点赞事件已经在HTML中绑定
    }

    submitComment() {
        if (!this.checkLogin()) return;

        const commentInput = document.getElementById('commentInput');
        if (!commentInput) return;

        const content = commentInput.value.trim();
        if (!content) {
            this.showMessage('请输入评论内容！');
            return;
        }

        try {
            const newComment = {
                id: 'comment_' + Date.now(),
                authorId: this.currentUser.id,
                authorName: this.currentUser.username,
                authorAvatar: this.currentUser.avatar || 'assets/default-avatar.png',
                content,
                publishTime: new Date().toISOString(),
                likes: 0,
                likedBy: [],
                replies: []
            };

            if (!this.currentVideo.comments) {
                this.currentVideo.comments = [];
            }

            this.currentVideo.comments.unshift(newComment);
            dataManager.video.update(this.currentVideo);

            commentInput.value = '';
            this.loadComments();
            
            if (this.currentVideo.authorId !== this.currentUser.id) {
                this.createCommentMessage(content);
            }
            
            this.showMessage('评论发布成功！');
        } catch (error) {
            console.error('发布评论失败:', error);
            this.showMessage('评论发布失败，请重试');
        }
    }

    createCommentMessage(commentContent) {
        try {
            const messages = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('messages'), []) : JSON.parse(localStorage.getItem('messages') || '[]');
            const commentMessage = {
                id: 'msg_' + Date.now(),
                type: 'comment',
                senderId: this.currentUser.id,
                senderName: this.currentUser.username,
                recipientId: this.currentVideo.authorId,
                content: `评论了你的视频：${commentContent.substring(0, 50)}${commentContent.length > 50 ? '...' : ''}`,
                timestamp: new Date().toISOString(),
                read: false,
                relatedItem: {
                    type: 'video',
                    id: this.currentVideo.id,
                    title: this.currentVideo.title
                }
            };
            messages.push(commentMessage);
            localStorage.setItem('messages', JSON.stringify(messages));
            
            window.dispatchEvent(new CustomEvent('messagesUpdated'));
        } catch (error) {
            console.error('创建评论消息失败:', error);
        }
    }

    deleteComment(commentId) {
        if (!this.checkLogin()) return;

        if (confirm('确定要删除这条评论吗？')) {
            try {
                this.currentVideo.comments = this.currentVideo.comments.filter(c => c.id !== commentId);
                dataManager.video.update(this.currentVideo);
                this.loadComments();
                this.showMessage('评论已删除');
            } catch (error) {
                console.error('删除评论失败:', error);
                this.showMessage('删除失败，请重试');
            }
        }
    }

    toggleCommentLike(commentId) {
        if (!this.checkLogin()) return;

        try {
            const comment = this.currentVideo.comments.find(c => c.id === commentId);
            if (comment) {
                if (!comment.likedBy) {
                    comment.likedBy = [];
                }

                const isLiked = comment.likedBy.includes(this.currentUser.id);
                
                if (isLiked) {
                    comment.likedBy = comment.likedBy.filter(id => id !== this.currentUser.id);
                    comment.likes--;
                } else {
                    comment.likedBy.push(this.currentUser.id);
                    comment.likes++;
                    // 新增点赞时发送通知给评论作者（如果不是自己）
                    try {
                        if (comment.authorId && this.currentUser && comment.authorId !== this.currentUser.id) {
                            this.createNotification(
                                comment.authorId,
                                '有人点赞了你的评论',
                                `${this.currentUser.username} 赞了你的评论：${(comment.content || '').slice(0, 80)}`,
                                { videoId: this.currentVideo.id, commentId }
                            );
                        }
                    } catch (e) {
                        console.error('发送评论点赞通知失败:', e);
                    }
                }

                dataManager.video.update(this.currentVideo);
                this.loadComments();
            }
        } catch (error) {
            console.error('评论点赞失败:', error);
        }
    }

    showReplyForm(commentId) {
        if (!this.checkLogin()) return;

        const existingForm = document.querySelector('.reply-form');
        if (existingForm) {
            existingForm.remove();
        }

        const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (commentElement) {
            const replyForm = document.createElement('div');
            replyForm.className = 'reply-form';

            const inner = document.createElement('div');
            inner.className = 'reply-form-inner';

            const textarea = document.createElement('textarea');
            textarea.className = 'reply-input';
            textarea.placeholder = '写下你的回复...';
            textarea.rows = 2;

            const actions = document.createElement('div');
            actions.className = 'reply-actions';

            const btnCancel = document.createElement('button');
            btnCancel.className = 'btn btn-cancel';
            btnCancel.textContent = '取消';
            btnCancel.addEventListener('click', () => replyForm.remove());

            const btnReply = document.createElement('button');
            btnReply.className = 'btn btn-primary';
            btnReply.textContent = '回复';
            btnReply.addEventListener('click', () => this.submitReply(commentId));

            actions.appendChild(btnCancel);
            actions.appendChild(btnReply);

            inner.appendChild(textarea);
            inner.appendChild(actions);
            replyForm.appendChild(inner);

            const commentMain = commentElement.querySelector('.comment-main');
            if (commentMain) {
                commentMain.appendChild(replyForm);
                textarea.focus();
            }
        }
    }

    submitReply(commentId) {
        const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (!commentElement) return;

        const replyInput = commentElement.querySelector('.reply-input');
        if (!replyInput) return;

        const content = replyInput.value.trim();
        if (!content) {
            this.showMessage('请输入回复内容！');
            return;
        }

        try {
            const comment = this.currentVideo.comments.find(c => c.id === commentId);
            if (comment) {
                if (!comment.replies) {
                    comment.replies = [];
                }

                const newReply = {
                    id: 'reply_' + Date.now(),
                    authorId: this.currentUser.id,
                    authorName: this.currentUser.username,
                    content,
                    publishTime: new Date().toISOString()
                };

                comment.replies.push(newReply);
                dataManager.video.update(this.currentVideo);
                
                const replyForm = commentElement.querySelector('.reply-form');
                if (replyForm) {
                    replyForm.remove();
                }
                
                // 发送通知给被回复的评论作者（如果不是回复自己）
                try {
                    if (comment.authorId && this.currentUser && comment.authorId !== this.currentUser.id) {
                        this.createNotification(
                            comment.authorId,
                            '有人回复了你的评论',
                            `${this.currentUser.username} 回复了你的评论：${content}`,
                            { videoId: this.currentVideo.id, commentId, replyId: newReply.id, url: `video-play.html?id=${this.currentVideo.id}` }
                        );
                    }
                } catch (e) {
                    console.error('发送回复通知失败:', e);
                }

                this.loadComments();
                this.showMessage('回复发布成功！');
            }
        } catch (error) {
            console.error('发布回复失败:', error);
            this.showMessage('回复发布失败，请重试');
        }
    }

    deleteReply(commentId, replyId) {
        if (!this.checkLogin()) return;

        if (confirm('确定要删除这条回复吗？')) {
            try {
                const comment = this.currentVideo.comments.find(c => c.id === commentId);
                if (comment && comment.replies) {
                    comment.replies = comment.replies.filter(r => r.id !== replyId);
                    dataManager.video.update(this.currentVideo);
                    this.loadComments();
                    this.showMessage('回复已删除');
                }
            } catch (error) {
                console.error('删除回复失败:', error);
                this.showMessage('删除失败，请重试');
            }
        }
    }

    // 发送用户通知的通用方法：优先使用 messageManager，否则回退到 localStorage
    createNotification(targetUserId, title, content, meta = {}) {
        try {
            const msg = {
                id: 'msg_' + Date.now(),
                type: 'notification',
                to: targetUserId,
                from: this.currentUser ? this.currentUser.id : null,
                fromName: this.currentUser ? this.currentUser.username : '系统',
                title,
                content,
                meta,
                time: new Date().toISOString(),
                read: false
            };

            if (window.messageManager && typeof window.messageManager.createMessage === 'function') {
                try {
                    window.messageManager.createMessage(msg);
                    return;
                } catch (e) {
                    console.warn('调用 messageManager.createMessage 失败，回退到 localStorage', e);
                }
            }

            // localStorage 回退
            try {
                const raw = localStorage.getItem('messages');
                const arr = raw ? JSON.parse(raw) : [];
                arr.push(msg);
                localStorage.setItem('messages', JSON.stringify(arr));
                window.dispatchEvent(new CustomEvent('messagesUpdated', { detail: { message: msg } }));
            } catch (e) {
                console.error('回退存储消息失败:', e);
            }
        } catch (error) {
            console.error('创建通知失败:', error);
        }
    }

    trackProgress() {
        if (!this.currentUser || !this.videoElement || !this.currentVideo) return;

        const progress = (this.videoElement.currentTime / this.videoElement.duration) * 100;
        
        if (progress % 10 < 1 || this.videoElement.currentTime % 30 < 1) {
            this.saveWatchHistory(progress);
        }
    }

    saveWatchHistory(progress) {
        try {
            const historyItem = {
                userId: this.currentUser.id,
                videoId: this.currentVideo.id,
                watchTime: new Date().toISOString(),
                progress: Math.round(progress),
                videoTitle: this.currentVideo.title,
                videoCover: this.currentVideo.cover,
                authorName: this.currentVideo.authorName
            };
            
            dataManager.history.add(historyItem);
        } catch (error) {
            console.error('保存观看历史失败:', error);
        }
    }

    loadRecommendedVideos() {
        if (!this.currentVideo) return;
        
        try {
            const recommendedVideos = dataManager.video.getRecommended(this.currentVideo.id, 6);
            const container = document.getElementById('recommendedVideos');
            
            if (!container || recommendedVideos.length === 0) return;
            container.innerHTML = '';
            const isSafeUrl = (url) => {
                if (!url || typeof url !== 'string') return false;
                return /^(https?:|blob:|data:image\/|indexeddb:)/.test(url);
            };

            recommendedVideos.forEach(video => {
                const card = document.createElement('div');
                card.className = 'video-card';
                card.dataset.videoId = video.id;

                const img = document.createElement('img');
                img.className = 'video-cover';
                img.alt = video.title || '';
                if (isSafeUrl(video.cover)) img.src = video.cover;
                img.addEventListener('error', () => { img.src = 'assets/demoCover.png'; });
                card.appendChild(img);

                const info = document.createElement('div');
                info.className = 'video-info';

                const title = document.createElement('div');
                title.className = 'video-title';
                title.textContent = video.title || '';

                const meta = document.createElement('div');
                meta.className = 'video-meta';
                const authorSpan = document.createElement('span');
                authorSpan.textContent = video.authorName || '';
                const viewsSpan = document.createElement('span');
                viewsSpan.textContent = `${this.formatViews(video.views)}播放`;
                meta.appendChild(authorSpan);
                meta.appendChild(viewsSpan);

                info.appendChild(title);
                info.appendChild(meta);
                card.appendChild(info);

                card.addEventListener('click', () => this.playVideo(video.id));
                container.appendChild(card);
            });
        } catch (error) {
            console.error('加载推荐视频失败:', error);
        }
    }

    shareVideo() {
        if (!this.currentVideo) return;
        
        const shareUrl = `${window.location.origin}${window.location.pathname}?id=${this.currentVideo.id}`;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                this.showMessage('视频链接已复制到剪贴板！');
            }).catch(() => {
                this.fallbackShare(shareUrl);
            });
        } else {
            this.fallbackShare(shareUrl);
        }
    }

    fallbackShare(shareUrl) {
        const tempInput = document.createElement('input');
        tempInput.value = shareUrl;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand('copy');
        document.body.removeChild(tempInput);
        this.showMessage('视频链接已复制到剪贴板！');
    }

    playVideo(videoId) {
        if (this.videoElement) {
            const progress = (this.videoElement.currentTime / this.videoElement.duration) * 100;
            this.saveWatchHistory(progress);
        }
        
        window.location.href = `video-play.html?id=${videoId}`;
    }

    viewAuthorProfile() {
        if (this.currentVideo && this.currentVideo.authorId) {
            window.location.href = `user.html?id=${this.currentVideo.authorId}`;
        }
    }

    formatViews(views) {
        if (!views) return '0';
        if (views >= 10000) {
            return (views / 10000).toFixed(1) + '万';
        }
        if (views >= 100000000) {
            return (views / 100000000).toFixed(1) + '亿';
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
        } else if (diff < 604800000) {
            return `${Math.floor(diff / 86400000)}天前`;
        } else {
            return date.toLocaleDateString();
        }
    }

    showMessage(message) {
        const existingMessage = document.querySelector('.user-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageEl = document.createElement('div');
        messageEl.className = 'user-message';
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: var(--primary-color);
            color: white;
            padding: 12px 20px;
            border-radius: 4px;
            z-index: 10000;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;

        document.body.appendChild(messageEl);

        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    }

    showError(message) {
        const contentArea = document.querySelector('.content-area');
        if (contentArea) {
            contentArea.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 40px;">
                    <h3>😢 出错了</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary mt-20" onclick="window.location.href='index.html'">
                        返回首页
                    </button>
                </div>
            `;
        } else {
            alert(message);
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

    destroy() {
        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.src = '';
            this.videoElement.load();
        }
        
        if (this.videoBlobUrl) {
            URL.revokeObjectURL(this.videoBlobUrl);
            this.videoBlobUrl = null;
        }
        
        this.isInitialized = false;
    }
}

let videoPlayManager;

document.addEventListener('DOMContentLoaded', () => {
    try {
        videoPlayManager = new VideoPlayManager();
        window.videoPlayManager = videoPlayManager;
        
        window.addEventListener('beforeunload', () => {
            if (videoPlayManager) {
                if (videoPlayManager.videoElement) {
                    const progress = (videoPlayManager.videoElement.currentTime / videoPlayManager.videoElement.duration) * 100;
                    videoPlayManager.saveWatchHistory(progress);
                }
                videoPlayManager.destroy();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (videoPlayManager && videoPlayManager.videoElement) {
                if (document.hidden) {
                    videoPlayManager.videoElement.pause();
                }
            }
        });

    } catch (error) {
        console.error('视频播放器创建失败:', error);
        const contentArea = document.querySelector('.content-area');
        if (contentArea) {
            contentArea.innerHTML = `
                <div class="empty-state">
                    <p>视频播放器初始化失败，请刷新页面</p>
                    <button class="btn btn-primary" onclick="window.location.reload()">刷新页面</button>
                </div>
            `;
        }
    }
});