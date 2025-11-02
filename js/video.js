// 视频播放和评论系统 - 修复版
class VideoPlayer {
    constructor() {
        // 等待必要依赖加载（容错）
        if (typeof dataManager === 'undefined') {
            console.error('DataManager not found');
        }
        if (typeof authManager === 'undefined') {
            console.error('AuthManager not found');
        }

        this.currentUser = (window.authManager && typeof authManager.getCurrentUser === 'function') ? authManager.getCurrentUser() : (window.currentUser || null);
        this.currentVideo = null;
        this.comments = [];
        this.videoBlobUrl = null; // 如果从 IndexedDB 创建了 objectURL，需要 revoke
        this.init();
    }

    async init() {
        await this.loadVideo();
        this.setupEventListeners();
    }

    // 加载视频
    async loadVideo() {
        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('id');
        
        if (!videoId) {
            alert('视频不存在！');
            window.location.href = 'index.html';
            return;
        }

        try {
            this.currentVideo = dataManager.video.getById(videoId);

            if (!this.currentVideo) {
                alert('视频不存在！');
                window.location.href = 'index.html';
                return;
            }

            await this.displayVideo();
            this.incrementViewCount();
            this.loadComments();
        } catch (error) {
            console.error('加载视频失败:', error);
            alert('加载视频失败！');
            window.location.href = 'index.html';
        }
    }

    // 显示视频
    async displayVideo() {
    document.title = `${this.currentVideo.title} - StreamFlix`;
        
        // 更新视频信息
        const videoTitle = document.getElementById('videoTitle');
        const videoAuthor = document.getElementById('videoAuthor');
        const videoViews = document.getElementById('videoViews');
        const videoUploadTime = document.getElementById('videoUploadTime');
        const videoDescription = document.getElementById('videoDescription');
        
        if (videoTitle) videoTitle.textContent = this.currentVideo.title;
        if (videoAuthor) videoAuthor.textContent = this.currentVideo.authorName;
        if (videoViews) videoViews.textContent = `${this.currentVideo.views} 播放`;
        if (videoUploadTime) videoUploadTime.textContent = this.formatTime(this.currentVideo.uploadTime);
        if (videoDescription) videoDescription.textContent = this.currentVideo.description;
        
        // 设置视频源
        const videoElement = document.getElementById('mainVideo');
        if (videoElement && this.currentVideo.videoUrl) {
            // 支持从 IndexedDB 读取的视频引用：indexeddb:<id>
            try {
                let videoUrl = this.currentVideo.videoUrl;

                // revoke 之前可能存在的 blob url
                if (this.videoBlobUrl) {
                    try { URL.revokeObjectURL(this.videoBlobUrl); } catch (e) {}
                    this.videoBlobUrl = null;
                }

                if (typeof videoUrl === 'string' && videoUrl.startsWith('indexeddb:')) {
                    // 从 storageManager 获取
                    const videoId = videoUrl.replace('indexeddb:', '');
                    if (window.storageManager && typeof storageManager.getVideo === 'function') {
                        try {
                            const videoData = await window.storageManager.getVideo(videoId);
                            if (videoData && videoData.file) {
                                this.videoBlobUrl = window.createObjectURLTracked ? window.createObjectURLTracked(videoData.file) : URL.createObjectURL(videoData.file);
                                if (this.videoBlobUrl) videoElement.src = this.videoBlobUrl;
                            } else {
                                console.warn('video.js: IndexedDB 未找到文件，使用原始 URL 作为回退');
                                videoElement.src = videoUrl;
                            }
                        } catch (err) {
                            console.error('video.js: 从 storageManager 获取视频失败:', err);
                            videoElement.src = videoUrl; // 回退
                        }
                    } else {
                        console.warn('video.js: storageManager 不可用，尝试使用原始 URL');
                        videoElement.src = videoUrl;
                    }
                } else {
                    videoElement.src = videoUrl;
                }
            } catch (e) {
                console.error('设置视频源时出错:', e);
                videoElement.src = this.currentVideo.videoUrl;
            }
        }
        
        // 显示标签
        const tagsContainer = document.getElementById('videoTags');
        if (tagsContainer && this.currentVideo.tags) {
            tagsContainer.innerHTML = this.currentVideo.tags.map(tag => `
                <span class="tag">#${this.escapeHtml(tag)}</span>
            `).join('');
        }
        
        // 更新操作按钮状态
        this.updateActionButtons();
    }

    // 增加播放量
    incrementViewCount() {
        dataManager.video.incrementViews(this.currentVideo.id);
        this.currentVideo.views++;
        
        const videoViews = document.getElementById('videoViews');
        if (videoViews) {
            videoViews.textContent = `${this.currentVideo.views} 播放`;
        }
    }

    // 设置事件监听器
    setupEventListeners() {
        // 点赞按钮
        const likeBtn = document.getElementById('likeBtn');
        if (likeBtn) {
            likeBtn.addEventListener('click', () => {
                this.toggleLike();
            });
        }

        // 收藏按钮
        const favoriteBtn = document.getElementById('favoriteBtn');
        if (favoriteBtn) {
            favoriteBtn.addEventListener('click', () => {
                this.toggleFavorite();
            });
        }

        // 评论表单
        const commentForm = document.getElementById('commentForm');
        if (commentForm) {
            commentForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitComment();
            });
        }

        // 作者点击事件
        const videoAuthor = document.getElementById('videoAuthor');
        if (videoAuthor) {
            videoAuthor.addEventListener('click', () => {
                this.viewAuthorProfile();
            });
        }
    }

    // 更新操作按钮状态
    updateActionButtons() {
        if (!this.currentUser) return;

        // 更新点赞按钮
        const likeBtn = document.getElementById('likeBtn');
        const likeCount = document.getElementById('likeCount');
        if (likeBtn && likeCount) {
            const isLiked = this.currentVideo.likedBy && this.currentVideo.likedBy.includes(this.currentUser.id);
            likeBtn.textContent = isLiked ? '❤️ 已点赞' : '🤍 点赞';
            likeBtn.style.color = isLiked ? 'var(--primary-color)' : '';
            likeCount.textContent = this.currentVideo.likes || 0;
        }

        // 更新收藏按钮
        const favoriteBtn = document.getElementById('favoriteBtn');
        if (favoriteBtn) {
            const isFavorited = dataManager.favorite.isFavorited(this.currentUser.id, this.currentVideo.id);
            favoriteBtn.textContent = isFavorited ? '⭐ 已收藏' : '☆ 收藏';
            favoriteBtn.style.color = isFavorited ? 'var(--primary-color)' : '';
        }
    }

    // 切换点赞
    toggleLike() {
        if (!this.currentUser && currentPage.includes('video.html')) {
            alert('请先登录！');
            window.location.href = 'login.html';
            return;
        }

        // 使用 safeJsonParse 以避免损坏的 localStorage 导致异常
    const videos = safeJsonParse(localStorage.getItem('VideoData'), []);
        const videoIndex = videos.findIndex(v => v.id === this.currentVideo.id);
        
        if (videoIndex === -1) return;

        if (!videos[videoIndex].likedBy) {
            videos[videoIndex].likedBy = [];
        }

        const isLiked = videos[videoIndex].likedBy.includes(this.currentUser.id);
        
        if (isLiked) {
            // 取消点赞
            videos[videoIndex].likedBy = videos[videoIndex].likedBy.filter(id => id !== this.currentUser.id);
            videos[videoIndex].likes--;
        } else {
            // 点赞
            videos[videoIndex].likedBy.push(this.currentUser.id);
            videos[videoIndex].likes++;
            // 发送点赞消息给视频作者（如果不是自己）
            try {
                const videoAuthorId = videos[videoIndex].authorId || this.currentVideo.authorId;
                if (videoAuthorId && videoAuthorId !== this.currentUser.id) {
                    if (window.messageManager && typeof window.messageManager.createMessage === 'function') {
                        window.messageManager.createMessage({
                            type: 'like',
                            senderId: this.currentUser.id,
                            senderName: this.currentUser.username,
                            recipientId: videoAuthorId,
                            content: '赞了你的视频',
                            relatedItem: { type: 'video', id: this.currentVideo.id }
                        });
                    } else {
                        const msgs = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('messages'), []) : JSON.parse(localStorage.getItem('messages') || '[]');
                        msgs.push({
                            id: 'msg_' + Date.now(),
                            type: 'like',
                            senderId: this.currentUser.id,
                            senderName: this.currentUser.username,
                            recipientId: videoAuthorId,
                            content: '赞了你的视频',
                            timestamp: new Date().toISOString(),
                            read: false,
                            relatedItem: { type: 'video', id: this.currentVideo.id }
                        });
                        localStorage.setItem('messages', JSON.stringify(msgs));
                        window.dispatchEvent(new CustomEvent('messagesUpdated'));
                    }
                }
            } catch (e) { console.warn('发送视频点赞消息失败', e); }
        }

        localStorage.setItem('VideoData', JSON.stringify(videos));
        this.currentVideo = videos[videoIndex];
        this.updateActionButtons();
    }

    // 在销毁时撤销可能创建的 objectURL
    destroy() {
        if (this.videoBlobUrl) {
            try { URL.revokeObjectURL(this.videoBlobUrl); } catch (e) {}
            this.videoBlobUrl = null;
        }
    }

    // 切换收藏
    toggleFavorite() {
        if (!this.currentUser && currentPage.includes('video.html')) {
            alert('请先登录！');
            window.location.href = 'login.html';
            return;
        }

        if (dataManager.favorite.isFavorited(this.currentUser.id, this.currentVideo.id)) {
            // 取消收藏
            dataManager.favorite.remove(this.currentUser.id, this.currentVideo.id);
            alert('已取消收藏');
        } else {
            // 收藏
            dataManager.favorite.add(this.currentUser.id, this.currentVideo.id);
            alert('收藏成功！');
        }

        this.updateActionButtons();
    }

    // 加载评论
    loadComments() {
        this.comments = this.currentVideo.comments || [];
        this.displayComments();
    }

    // 显示评论
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
        
        commentsContainer.innerHTML = this.comments.map(comment => `
            <div class="comment-item" data-comment-id="${comment.id}">
                <div style="display: flex;">
                    <img src="${comment.authorAvatar}" alt="${comment.authorName}" 
                         style="width: 40px; height: 40px; border-radius: 50%; margin-right: 10px;"
                         onerror="this.src='assets/default-avatar.png'">
                    <div style="flex: 1;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                            <div>
                                <span style="font-weight: bold;">${this.escapeHtml(comment.authorName)}</span>
                                <span style="color: #666; font-size: 0.9em; margin-left: 10px;">
                                    ${this.formatTime(comment.publishTime)}
                                </span>
                            </div>
                            ${comment.authorId === this.currentUser?.id ? `
                                <button class="btn" onclick="videoPlayer.deleteComment('${comment.id}')" style="padding: 2px 8px; font-size: 0.8em;">删除</button>
                            ` : ''}
                        </div>
                        <div style="margin-bottom: 10px;">${this.escapeHtml(comment.content)}</div>
                        <div style="display: flex; gap: 15px; color: #666;">
                            <span onclick="videoPlayer.toggleCommentLike('${comment.id}')" style="cursor: pointer;">
                                👍 ${comment.likes || 0}
                            </span>
                            <span onclick="videoPlayer.showReplyForm('${comment.id}')" style="cursor: pointer;">
                                💬 回复
                            </span>
                        </div>
                        
                        ${comment.replies && comment.replies.length > 0 ? `
                            <div style="margin-top: 10px; padding-left: 20px; border-left: 2px solid var(--border-color);">
                                ${comment.replies.map(reply => `
                                    <div style="margin-bottom: 10px; padding: 10px; background: var(--bg-color); border-radius: 4px;">
                                        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                            <div>
                                                <span style="font-weight: bold;">${this.escapeHtml(reply.authorName)}</span>
                                                <span style="color: #666; font-size: 0.9em; margin-left: 10px;">
                                                    ${this.formatTime(reply.publishTime)}
                                                </span>
                                            </div>
                                            ${reply.authorId === this.currentUser?.id ? `
                                                <button class="btn" onclick="videoPlayer.deleteReply('${comment.id}', '${reply.id}')" style="padding: 2px 8px; font-size: 0.8em;">删除</button>
                                            ` : ''}
                                        </div>
                                        <div>${this.escapeHtml(reply.content)}</div>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    }

    // 提交评论
    submitComment() {
        if (!this.currentUser && currentPage.includes('video.html')) {
            alert('请先登录！');
            window.location.href = 'login.html';
            return;
        }

        const commentInput = document.getElementById('commentInput');
        if (!commentInput) return;

        const content = commentInput.value.trim();
        if (!content) {
            alert('请输入评论内容！');
            return;
        }

        const newComment = {
            id: 'comment_' + Date.now(),
            authorId: this.currentUser.id,
            authorName: this.currentUser.username,
            authorAvatar: this.currentUser.avatar,
            content,
            publishTime: new Date().toISOString(),
            likes: 0,
            likedBy: [],
            replies: []
        };

    // 添加到评论列表
        this.comments.unshift(newComment);
        
        // 更新视频数据
        this.currentVideo.comments = this.comments;
        dataManager.video.update(this.currentVideo);

        // 清空输入框
        commentInput.value = '';
        
        // 重新显示评论
        this.displayComments();
        // 发送评论消息给视频作者（如果不是自己）
        try {
            if (this.currentVideo.authorId !== this.currentUser.id) {
                if (window.messageManager && typeof window.messageManager.createMessage === 'function') {
                    window.messageManager.createMessage({
                        type: 'comment',
                        senderId: this.currentUser.id,
                        senderName: this.currentUser.username,
                        recipientId: this.currentVideo.authorId,
                        content: `评论了你的视频：${content}`,
                        relatedItem: { type: 'video', id: this.currentVideo.id, title: this.currentVideo.title }
                    });
                } else {
                    // fallback to localStorage messages
                    const msgs = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('messages'), []) : JSON.parse(localStorage.getItem('messages') || '[]');
                    msgs.push({
                        id: 'msg_' + Date.now(),
                        type: 'comment',
                        senderId: this.currentUser.id,
                        senderName: this.currentUser.username,
                        recipientId: this.currentVideo.authorId,
                        content: `评论了你的视频：${content}`,
                        timestamp: new Date().toISOString(),
                        read: false,
                        relatedItem: { type: 'video', id: this.currentVideo.id, title: this.currentVideo.title }
                    });
                    localStorage.setItem('messages', JSON.stringify(msgs));
                    window.dispatchEvent(new CustomEvent('messagesUpdated'));
                }
            }
        } catch (e) { console.warn('发送评论消息失败', e); }
    }

    // 删除评论
    deleteComment(commentId) {
        if (confirm('确定要删除这条评论吗？')) {
            this.comments = this.comments.filter(c => c.id !== commentId);
            
            // 更新视频数据
            this.currentVideo.comments = this.comments;
            dataManager.video.update(this.currentVideo);
            
            this.displayComments();
        }
    }

    // 切换评论点赞
    toggleCommentLike(commentId) {
        if (!this.currentUser && currentPage.includes('video.html')) {
            alert('请先登录！');
            return;
        }

        const comment = this.comments.find(c => c.id === commentId);
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
                // 发送消息给评论作者（如果不是自己）
                try {
                    if (comment.authorId !== this.currentUser.id) {
                        if (window.messageManager && typeof window.messageManager.createMessage === 'function') {
                            window.messageManager.createMessage({
                                type: 'like',
                                senderId: this.currentUser.id,
                                senderName: this.currentUser.username,
                                recipientId: comment.authorId,
                                content: '赞了你的评论',
                                relatedItem: { type: 'video', id: this.currentVideo.id, commentId }
                            });
                        } else {
                            const msgs = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('messages'), []) : JSON.parse(localStorage.getItem('messages') || '[]');
                            msgs.push({
                                id: 'msg_' + Date.now(),
                                type: 'like',
                                senderId: this.currentUser.id,
                                senderName: this.currentUser.username,
                                recipientId: comment.authorId,
                                content: '赞了你的评论',
                                timestamp: new Date().toISOString(),
                                read: false,
                                relatedItem: { type: 'video', id: this.currentVideo.id, commentId }
                            });
                            localStorage.setItem('messages', JSON.stringify(msgs));
                            window.dispatchEvent(new CustomEvent('messagesUpdated'));
                        }
                    }
                } catch (e) { console.warn('发送评论点赞消息失败', e); }
            }

            // 更新视频数据
            this.currentVideo.comments = this.comments;
            dataManager.video.update(this.currentVideo);
            
            this.displayComments();
        }
    }

    // 显示回复表单
    showReplyForm(commentId) {
        if (!this.checkLogin?.()) {
            // checkLogin exists in videoPlayManager but not here; fallback
            if (!this.currentUser) {
                alert('请先登录！');
                window.location.href = 'login.html';
                return;
            }
        }

        const existingForm = document.querySelector('.reply-form');
        if (existingForm) existingForm.remove();

        const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (commentElement) {
            const replyForm = document.createElement('div');
            replyForm.className = 'reply-form';
            replyForm.innerHTML = `
                <div class="reply-form-inner">
                    <textarea class="reply-input" placeholder="写下你的回复..." rows="2"></textarea>
                    <div class="reply-actions">
                        <button class="btn btn-cancel" onclick="this.closest('.reply-form').remove()">取消</button>
                        <button class="btn btn-primary" onclick="videoPlayer.submitReply('${commentId}')">回复</button>
                    </div>
                </div>
            `;

            const commentMain = commentElement.querySelector('div[style*="flex: 1;"]');
            if (commentMain) commentMain.appendChild(replyForm);
        }
    }

    // 提交回复
    submitReply(commentId) {
        if (!this.currentUser) {
            alert('请先登录！');
            window.location.href = 'login.html';
            return;
        }

        const commentElement = document.querySelector(`[data-comment-id="${commentId}"]`);
        if (!commentElement) return;

        const replyInput = commentElement.querySelector('.reply-input');
        if (!replyInput) return;

        const content = replyInput.value.trim();
        if (!content) {
            alert('请输入回复内容！');
            return;
        }

        const comment = this.comments.find(c => c.id === commentId);
        if (!comment) return;

        if (!comment.replies) comment.replies = [];

        const newReply = {
            id: 'reply_' + Date.now(),
            authorId: this.currentUser.id,
            authorName: this.currentUser.username,
            content,
            publishTime: new Date().toISOString()
        };

        comment.replies.push(newReply);

        // 更新视频数据
        this.currentVideo.comments = this.comments;
        dataManager.video.update(this.currentVideo);

        // 移除表单并刷新显示
        const replyForm = commentElement.querySelector('.reply-form');
        if (replyForm) replyForm.remove();
        this.displayComments();

        // 发送回复消息给评论作者（如果不是自己）
        try {
            if (comment.authorId !== this.currentUser.id) {
                if (window.messageManager && typeof window.messageManager.createMessage === 'function') {
                    window.messageManager.createMessage({
                        type: 'reply',
                        senderId: this.currentUser.id,
                        senderName: this.currentUser.username,
                        recipientId: comment.authorId,
                        content: `回复了你的评论：${content}`,
                        relatedItem: { type: 'video', id: this.currentVideo.id, commentId }
                    });
                } else {
                    const msgs = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('messages'), []) : JSON.parse(localStorage.getItem('messages') || '[]');
                    msgs.push({
                        id: 'msg_' + Date.now(),
                        type: 'reply',
                        senderId: this.currentUser.id,
                        senderName: this.currentUser.username,
                        recipientId: comment.authorId,
                        content: `回复了你的评论：${content}`,
                        timestamp: new Date().toISOString(),
                        read: false,
                        relatedItem: { type: 'video', id: this.currentVideo.id, commentId }
                    });
                    localStorage.setItem('messages', JSON.stringify(msgs));
                    window.dispatchEvent(new CustomEvent('messagesUpdated'));
                }
            }
        } catch (e) { console.warn('发送回复消息失败', e); }
    }

    // 删除回复
    deleteReply(commentId, replyId) {
        if (!confirm('确定要删除这条回复吗？')) return;

        const comment = this.comments.find(c => c.id === commentId);
        if (!comment || !comment.replies) return;

        comment.replies = comment.replies.filter(r => r.id !== replyId);
        this.currentVideo.comments = this.comments;
        dataManager.video.update(this.currentVideo);
        this.displayComments();
    }

    // 查看作者资料
    viewAuthorProfile() {
        if (this.currentVideo && this.currentVideo.authorId) {
            window.location.href = `user.html?id=${this.currentVideo.authorId}`;
        }
    }

    // 格式化时间
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

// 初始化视频播放器
let videoPlayer;
document.addEventListener('DOMContentLoaded', () => {
    videoPlayer = new VideoPlayer();
    window.videoPlayer = videoPlayer;
});