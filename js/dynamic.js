// dynamic.js - 修复版

// 动态管理系统
class DynamicManager {
    constructor() {
        this.currentUser = window.authManager ? window.authManager.getCurrentUser() : null;
        this.dynamics = this.loadDynamicsFromStorage();
        this.mediaFiles = [];
        
        this.init();
    }

    init() {
        
        if (!this.currentUser && currentPage.includes('dynamic.html')) {
            alert('请先登录！');
            window.location.href = 'login.html';
            return;
        }

        // 尝试从 DataManager 读取最新的数据源（非阻塞）
        try { this.loadDynamics(); } catch(e){ console.warn('loadDynamics 调用失败', e); }
        this.setupEventListeners();
        this.updateComposerInfo();
    }

    // 从存储加载动态数据
    loadDynamicsFromStorage() {
        try {
            // 使用全局 safeJsonParse（utils.js 应提前加载），并在不可解析时回退为 []
            return safeJsonParse(localStorage.getItem('dynamics'), []);
        } catch (error) {
            console.error('加载动态数据失败:', error);
            return [];
        }
    }

    // 保存动态数据到存储
    saveDynamicsToStorage() {
        try {
            // 优先使用 DataManager 的 folder.save（同步接口）保存 dynamics
            if (window.dataManager && window.dataManager.folder && typeof window.dataManager.folder.save === 'function') {
                return window.dataManager.folder.save('dynamics', this.dynamics);
            }

            // 回退到 legacy localStorage（仅在 DataManager 不可用时）
            localStorage.setItem('dynamics', JSON.stringify(this.dynamics));
            return true;
        } catch (error) {
            console.error('保存动态数据失败:', error);
            try { localStorage.setItem('dynamics', JSON.stringify(this.dynamics)); } catch(e){}
            return false;
        }
    }

    // 通知其它模块动态有更新（通用事件）
    notifyDynamicsUpdated(detail = {}) {
        try {
            window.dispatchEvent(new CustomEvent('dynamicsUpdated', { detail }));
        } catch (e) {
            console.warn('派发 dynamicsUpdated 事件失败', e);
        }
    }

    // 更新发布器信息
    updateComposerInfo() {
        const composerAvatar = document.getElementById('composerAvatar');
        const composerUsername = document.getElementById('composerUsername');
        
        if (composerAvatar) composerAvatar.src = this.currentUser.avatar;
        if (composerUsername) composerUsername.textContent = this.currentUser.username;
    }

    // 加载动态（优先从 dataManager 获取）
    async loadDynamics() {
        try {
            let userDynamics = [];
            if (window.dataManager && window.dataManager.dynamic && typeof window.dataManager.dynamic.getByFollowing === 'function') {
                try {
                    userDynamics = await window.dataManager.dynamic.getByFollowing(this.currentUser.id);
                } catch (e) {
                    console.warn('从 dataManager 获取关注动态失败，回退到本地缓存', e);
                    const all = this.loadDynamicsFromStorage();
                    const following = this.currentUser.following || [];
                    userDynamics = all.filter(d => d.authorId === this.currentUser.id || following.includes(d.authorId));
                }
            } else {
                const all = this.loadDynamicsFromStorage();
                const following = this.currentUser.following || [];
                userDynamics = all.filter(d => d.authorId === this.currentUser.id || following.includes(d.authorId));
            }

            // 更新本地缓存
            this.dynamics = Array.isArray(userDynamics) ? userDynamics.slice() : [];

            try { await this.displayDynamics(userDynamics); } catch (e) { console.warn('displayDynamics 调用失败', e); }
        } catch (e) {
            console.error('loadDynamics 失败:', e);
        }
    }

    // 显示动态
    async displayDynamics(dynamics) {
        const dynamicFeed = document.getElementById('dynamicFeed');
        const emptyDynamic = document.getElementById('emptyDynamic');

        if (!dynamicFeed || !emptyDynamic) return;

        if (dynamics.length === 0) {
            dynamicFeed.style.display = 'none';
            emptyDynamic.style.display = 'block';
            return;
        }

        dynamicFeed.style.display = 'block';
        emptyDynamic.style.display = 'none';

        // 按发布时间排序（最新的在前面）
        dynamics.sort((a, b) => new Date(b.publishTime) - new Date(a.publishTime));

        // 统一通过 dataManager 解析 media 引用以获得 displayUrl（如果 DataManager 提供）
        try {
            if (window.dataManager && window.dataManager.dynamic && typeof window.dataManager.dynamic.resolveMediaList === 'function') {
                dynamics = await window.dataManager.dynamic.resolveMediaList(dynamics);
            }
        } catch (e) {
            console.warn('通过 dataManager 解析 media 引用失败，继续使用原始数据', e);
        }

    dynamicFeed.innerHTML = dynamics.map(dynamic => `
            <div class="dynamic-item" data-dynamic-id="${dynamic.id}">
                <div class="dynamic-header">
                    <img src="${dynamic.authorAvatar}" alt="头像" class="dynamic-avatar" 
                         onclick="dynamicManager.viewUserProfile('${dynamic.authorId}')"
                         onerror="this.src='assets/default-avatar.png'">
                    <div class="dynamic-user">
                        <div class="dynamic-username" onclick="dynamicManager.viewUserProfile('${dynamic.authorId}')">${dynamic.authorName}</div>
                        <div class="dynamic-time">${this.formatTime(dynamic.publishTime)}</div>
                    </div>
                </div>
                
                <div class="dynamic-content">${this.formatContent(dynamic.content)}</div>
                
                ${dynamic.media && dynamic.media.length > 0 ? `
                    <div class="dynamic-media">
                        ${dynamic.media.map(media => `
                            <div class="dynamic-media-item" data-media-url="${this.escapeHtml(media.displayUrl || media.url)}" onclick="dynamicManager.viewMedia('${this.escapeHtml(media.displayUrl || media.url)}')">
                                ${media.type === 'video' ? `
                                    <video src="${this.escapeHtml(media.displayUrl || media.url)}" controls style="max-width: 100%;"></video>
                                ` : `
                                    <img src="${this.escapeHtml(media.displayUrl || media.url)}" alt="动态图片" style="max-width: 100%;">
                                `}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div class="dynamic-actions">
                    <div class="dynamic-action" onclick="dynamicManager.toggleLike('${dynamic.id}')">
                        <span>👍</span>
                        <span>${dynamic.likes || 0}</span>
                    </div>
                    <div class="dynamic-action" onclick="dynamicManager.toggleComment('${dynamic.id}')">
                        <span>💬</span>
                        <span>${dynamic.comments ? dynamic.comments.length : 0}</span>
                    </div>
                    ${dynamic.authorId === this.currentUser.id ? `
                        <div class="dynamic-action" onclick="dynamicManager.deleteDynamic('${dynamic.id}')" style="margin-left: auto;">
                            <span>🗑️</span>
                        </div>
                    ` : ''}
                </div>
                
                ${dynamic.showComments ? `
                    <div class="dynamic-comments">
                        <div class="comment-form">
                            <input type="text" placeholder="写下你的评论..." style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 4px;" 
                                   id="commentInput-${dynamic.id}">
                            <button class="btn btn-primary" style="margin-top: 5px; padding: 5px 10px;" 
                                    onclick="dynamicManager.addComment('${dynamic.id}')">评论</button>
                        </div>
                        ${dynamic.comments && dynamic.comments.length > 0 ? `
                            ${dynamic.comments.map(comment => `
                                <div class="comment-item">
                                    <div class="comment-header">
                                        <span class="comment-author">${this.escapeHtml(comment.authorName)}</span>
                                        <span class="comment-time">${this.formatTime(comment.publishTime)}</span>
                                    </div>
                                    <div class="comment-content">${this.escapeHtml(comment.content)}</div>
                                    <div class="comment-actions">
                                        <span onclick="dynamicManager.toggleCommentLike('${dynamic.id}', '${comment.id}')">👍 ${comment.likes || 0}</span>
                                        ${comment.authorId === this.currentUser.id ? `
                                            <span onclick="dynamicManager.deleteComment('${dynamic.id}', '${comment.id}')">删除</span>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `).join('');

        // 处理 indexeddb 媒体引用：将带 data-deferred-src 的元素通过 storageManager 获取并替换 src
        try {
            const mediaContainers = dynamicFeed.querySelectorAll('[data-media-url]');
            mediaContainers.forEach(async (container) => {
                const deferredSrc = container.getAttribute('data-media-url');
                if (!deferredSrc) return;

                // 如果是 indexeddb 引用，需要从 storageManager 获取文件并用 objectURL 赋值
                if (deferredSrc.startsWith('indexeddb:') && window.storageManager && window.storageManager.isSupported) {
                    const id = deferredSrc.replace('indexeddb:', '');
                    try {
                        // 根据元素内是否有 video 或 img 做不同处理
                        const videoEl = container.querySelector('video[data-deferred-src]');
                        const imgEl = container.querySelector('img[data-deferred-src]');

                        if (videoEl) {
                            const rec = await window.storageManager.getVideo(id);
                            if (rec && rec.file) {
                                const url = window.createObjectURLTracked ? window.createObjectURLTracked(rec.file) : URL.createObjectURL(rec.file);
                                if (url) videoEl.src = url;
                            }
                        } else if (imgEl) {
                            const rec = await window.storageManager.getImage(id);
                            if (rec && rec.file) {
                                const url = window.createObjectURLTracked ? window.createObjectURLTracked(rec.file) : URL.createObjectURL(rec.file);
                                if (url) imgEl.src = url;
                            }
                        }
                    } catch (err) {
                        console.warn('加载 indexeddb 媒体失败:', err);
                    }
                } else {
                    // 非 indexeddb（可能是 blob URL 或 data URL），直接赋值
                    const videoEl = container.querySelector('video[data-deferred-src]');
                    const imgEl = container.querySelector('img[data-deferred-src]');
                    if (videoEl) videoEl.src = deferredSrc;
                    if (imgEl) imgEl.src = deferredSrc;
                }
            });
        } catch (e) {
            console.error('解析媒体引用失败:', e);
        }
    }

    // 格式化内容（处理换行和链接）
    formatContent(content) {
        if (!content) return '';
        return content
            .replace(/\n/g, '<br>')
            .replace(/#(\w+)/g, '<span style="color: var(--primary-color);">#$1</span>')
            .replace(/@(\w+)/g, '<span style="color: var(--secondary-color); cursor: pointer;">@$1</span>');
    }

    // 格式化时间
    formatTime(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = now - time;

        if (diff < 60000) { // 1分钟内
            return '刚刚';
        } else if (diff < 3600000) { // 1小时内
            return `${Math.floor(diff / 60000)}分钟前`;
        } else if (diff < 86400000) { // 1天内
            return `${Math.floor(diff / 3600000)}小时前`;
        } else {
            return time.toLocaleDateString();
        }
    }

    // 设置事件监听器
    setupEventListeners() {
        // 媒体上传
        const mediaUpload = document.getElementById('mediaUpload');
        if (mediaUpload) {
            mediaUpload.addEventListener('change', (e) => {
                this.handleMediaUpload(e.target.files);
            });
        }

        // 动态输入框
        const dynamicInput = document.getElementById('dynamicInput');
        if (dynamicInput) {
            dynamicInput.addEventListener('input', () => {
                this.updatePublishButton();
            });
        }

        // 发布按钮
        const publishBtn = document.getElementById('publishDynamicBtn');
        if (publishBtn) {
            publishBtn.addEventListener('click', () => {
                this.publishDynamic();
            });
        }
    }

    // 处理媒体上传
    async handleMediaUpload(files) {
        if (!files || files.length === 0) return;

        for (let file of files) {
            try {
                const type = file.type.startsWith('video/') ? 'video' : 'image';
                // 立即创建 preview blob url
                const previewUrl = window.createObjectURLTracked ? window.createObjectURLTracked(file) : URL.createObjectURL(file);
                const placeholder = { url: previewUrl, preview: previewUrl, type, file, stored: false };
                this.mediaFiles.push(placeholder);
                this.updateMediaPreview();

                // 异步尝试存入 IndexedDB
                if (window.storageManager && window.storageManager.isSupported) {
                    const mediaId = 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
                    try {
                        if (type === 'video') {
                            await window.storageManager.storeVideo(mediaId, file);
                        } else {
                            await window.storageManager.storeImage(mediaId, file);
                        }
                        // 成功则替换为 indexeddb 引用
                        placeholder.url = `indexeddb:${mediaId}`;
                        placeholder.id = mediaId;
                        placeholder.stored = true;
                        // 更新预览（虽然 preview 保留用于撤销）
                        this.updateMediaPreview();
                    } catch (storeErr) {
                        console.warn('storageManager 存储失败，使用 Blob URL 回退', storeErr);
                    }
                }
            } catch (err) {
                console.error('处理媒体文件失败:', err);
            }
        }
    }

    // 更新媒体预览
    updateMediaPreview() {
        const mediaPreview = document.getElementById('mediaPreview');
        if (!mediaPreview) return;

        mediaPreview.innerHTML = this.mediaFiles.map((media, index) => `
            <div class="media-item">
                ${media.type === 'video' ? `
                    <video src="${media.preview || media.url}" controls style="max-width: 100px; max-height: 100px;"></video>
                ` : `
                    <img src="${media.preview || media.url}" alt="预览图片" style="max-width: 100px; max-height: 100px;">
                `}
                <button class="media-remove" onclick="dynamicManager.removeMedia(${index})">×</button>
            </div>
        `).join('');
    }

    // 移除媒体
    removeMedia(index) {
        const removed = this.mediaFiles.splice(index, 1);
        // 释放 preview blob urls
        if (removed && removed.length > 0) {
            const item = removed[0];
            try { if (item.preview) URL.revokeObjectURL(item.preview); } catch(e) {}
        }
        this.updateMediaPreview();
    }

    // 更新发布按钮状态
    updatePublishButton() {
        const content = document.getElementById('dynamicInput')?.value.trim() || '';
        const publishBtn = document.getElementById('publishDynamicBtn');
        if (publishBtn) {
            publishBtn.disabled = !content && this.mediaFiles.length === 0;
        }
    }

    // 发布动态
    async publishDynamic() {
        const dynamicInput = document.getElementById('dynamicInput');
        if (!dynamicInput) return;

        const content = dynamicInput.value.trim();
        
        if (!content && this.mediaFiles.length === 0) {
            alert('请输入动态内容或添加媒体文件！');
            return;
        }

        const newDynamic = {
            id: 'dynamic_' + Date.now(),
            authorId: this.currentUser.id,
            authorName: this.currentUser.username,
            authorAvatar: this.currentUser.avatar,
            content: content,
            media: this.mediaFiles.map(media => ({
                url: media.url,
                type: media.type
            })),
            publishTime: new Date().toISOString(),
            likes: 0,
            likedBy: [],
            comments: [],
            showComments: false
        };

        this.dynamics.push(newDynamic);
        // 如果存在 DataManager 的 dynamic API，优先写入中央数据管理（create 返回 {ok, dynamic, storedMediaIds, error}）
        if (window.dataManager && window.dataManager.dynamic && typeof window.dataManager.dynamic.create === 'function') {
            try {
                const res = await window.dataManager.dynamic.create(newDynamic);
                if (!res || !res.ok) {
                    console.warn('dataManager.dynamic.create 返回失败，回退到本地存储', res && res.error);
                    this.saveDynamicsToStorage();
                }
            } catch (e) {
                console.warn('通过 dataManager.dynamic.create 保存动态失败，回退到本地存储', e);
                this.saveDynamicsToStorage();
            }
        } else {
            this.saveDynamicsToStorage();
        }

        // 重置发布器
        dynamicInput.value = '';
    // 释放所有 preview URLs
    this.mediaFiles.forEach(m => { try { if (m.preview) URL.revokeObjectURL(m.preview); } catch(e){} });
    this.mediaFiles = [];
        this.updateMediaPreview();
        this.updatePublishButton();

        // 重新加载动态
        this.loadDynamics();

        // 通知其它页面/模块动态已更新（例如 profile）
        this.notifyDynamicsUpdated({ dynamic: newDynamic, action: 'create' });

        alert('动态发布成功！');
    }

    // 切换点赞
    async toggleLike(dynamicId) {
        if (!this.currentUser) return;

        const dynamic = this.dynamics.find(d => d.id === dynamicId);
        if (!dynamic) return;

        if (!dynamic.likedBy) {
            dynamic.likedBy = [];
        }

        const isLiked = dynamic.likedBy.includes(this.currentUser.id);
        
        if (isLiked) {
            // 取消点赞
            dynamic.likedBy = dynamic.likedBy.filter(id => id !== this.currentUser.id);
            dynamic.likes = Math.max(0, (dynamic.likes || 0) - 1);
        } else {
            // 点赞
            dynamic.likedBy.push(this.currentUser.id);
            dynamic.likes = (dynamic.likes || 0) + 1;
            
            // 发送点赞消息
            if (dynamic.authorId !== this.currentUser.id) {
                this.createLikeMessage(dynamic);
            }
        }

        // 尝试通过 dataManager 持久化变化，优先使用 centralized data store
        try {
            if (window.dataManager && window.dataManager.dynamic && typeof window.dataManager.dynamic.update === 'function') {
                await window.dataManager.dynamic.update(dynamic);
            } else {
                this.saveDynamicsToStorage();
            }
        } catch (e) {
            console.warn('通过 dataManager 更新动态失败，回退到本地存储', e);
            this.saveDynamicsToStorage();
        }

        // 重新加载以保证 UI 与中央数据源一致
        try { await this.loadDynamics(); } catch(e){}
        this.notifyDynamicsUpdated({ dynamicId, action: 'like' });
    }

    // 创建点赞消息
    createLikeMessage(dynamic) {
        try {
            const messages = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('messages'), []) : JSON.parse(localStorage.getItem('messages') || '[]');
            const likeMessage = {
                id: 'msg_' + Date.now(),
                type: 'like',
                senderId: this.currentUser.id,
                senderName: this.currentUser.username,
                recipientId: dynamic.authorId,
                content: '点赞了你的动态',
                timestamp: new Date().toISOString(),
                read: false,
                relatedItem: {
                    type: 'dynamic',
                    content: dynamic.content,
                    dynamicId: dynamic.id
                }
            };
            messages.push(likeMessage);
            localStorage.setItem('messages', JSON.stringify(messages));
            
            // 触发消息更新事件
            window.dispatchEvent(new CustomEvent('messagesUpdated'));
        } catch (error) {
            console.error('创建点赞消息失败:', error);
        }
    }

    // 切换评论显示
    toggleComment(dynamicId) {
        const dynamic = this.dynamics.find(d => d.id === dynamicId);
        if (dynamic) {
            dynamic.showComments = !dynamic.showComments;
            this.saveDynamicsToStorage();
            // 同步到 dataManager
            try {
                if (window.dataManager && window.dataManager.dynamic && typeof window.dataManager.dynamic.update === 'function') {
                    window.dataManager.dynamic.update(dynamic).catch(e => console.warn('更新 dynamic showComments 失败', e));
                }
            } catch (e) {}

            this.loadDynamics();
            this.notifyDynamicsUpdated({ dynamicId, action: 'toggleComments' });
        }
    }

    // 添加评论
    async addComment(dynamicId) {
        if (!this.currentUser) return;

        const commentInput = document.getElementById(`commentInput-${dynamicId}`);
        if (!commentInput) return;

        const content = commentInput.value.trim();
        
        if (!content) {
            alert('请输入评论内容！');
            return;
        }

        const dynamic = this.dynamics.find(d => d.id === dynamicId);
        if (!dynamic) return;

        const newComment = {
            id: 'comment_' + Date.now(),
            authorId: this.currentUser.id,
            authorName: this.currentUser.username,
            content: content,
            publishTime: new Date().toISOString(),
            likes: 0,
            likedBy: []
        };

        if (!dynamic.comments) {
            dynamic.comments = [];
        }

        dynamic.comments.push(newComment);
        // 优先同步到 dataManager
        try {
            if (window.dataManager && window.dataManager.dynamic && typeof window.dataManager.dynamic.update === 'function') {
                await window.dataManager.dynamic.update(dynamic);
            } else {
                this.saveDynamicsToStorage();
            }
        } catch (e) {
            console.warn('同步评论到 dataManager 失败，回退到本地存储', e);
            this.saveDynamicsToStorage();
        }

        // 发送评论消息
        if (dynamic.authorId !== this.currentUser.id) {
            this.createCommentMessage(dynamic, content);
        }

        commentInput.value = '';
        await this.loadDynamics();
        this.notifyDynamicsUpdated({ dynamicId, commentId: newComment.id, action: 'comment' });
    }

    // 创建评论消息
    createCommentMessage(dynamic, commentContent) {
        try {
            const messages = (typeof safeJsonParse === 'function') ? safeJsonParse(localStorage.getItem('messages'), []) : JSON.parse(localStorage.getItem('messages') || '[]');
            const commentMessage = {
                id: 'msg_' + Date.now(),
                type: 'comment',
                senderId: this.currentUser.id,
                senderName: this.currentUser.username,
                recipientId: dynamic.authorId,
                content: `评论了你的动态：${commentContent}`,
                timestamp: new Date().toISOString(),
                read: false,
                relatedItem: {
                    type: 'dynamic',
                    content: dynamic.content,
                    dynamicId: dynamic.id
                }
            };
            messages.push(commentMessage);
            localStorage.setItem('messages', JSON.stringify(messages));
            
            // 触发消息更新事件
            window.dispatchEvent(new CustomEvent('messagesUpdated'));
        } catch (error) {
            console.error('创建评论消息失败:', error);
        }
    }

    // 切换评论点赞
    async toggleCommentLike(dynamicId, commentId) {
        if (!this.currentUser) return;

        const dynamic = this.dynamics.find(d => d.id === dynamicId);
        if (!dynamic || !dynamic.comments) return;

        const comment = dynamic.comments.find(c => c.id === commentId);
        if (!comment) return;

        if (!comment.likedBy) {
            comment.likedBy = [];
        }

        const isLiked = comment.likedBy.includes(this.currentUser.id);
        
        if (isLiked) {
            comment.likedBy = comment.likedBy.filter(id => id !== this.currentUser.id);
            comment.likes = Math.max(0, (comment.likes || 0) - 1);
        } else {
            comment.likedBy.push(this.currentUser.id);
            comment.likes = (comment.likes || 0) + 1;
        }

        try {
            if (window.dataManager && window.dataManager.dynamic && typeof window.dataManager.dynamic.update === 'function') {
                await window.dataManager.dynamic.update(dynamic);
            } else {
                this.saveDynamicsToStorage();
            }
        } catch (e) {
            console.warn('同步评论点赞到 dataManager 失败，回退到本地存储', e);
            this.saveDynamicsToStorage();
        }

        await this.loadDynamics();
        this.notifyDynamicsUpdated({ dynamicId, commentId, action: 'commentLike' });
    }

    // 删除评论
    async deleteComment(dynamicId, commentId) {
        if (confirm('确定要删除这条评论吗？')) {
            const dynamic = this.dynamics.find(d => d.id === dynamicId);
            if (dynamic && dynamic.comments) {
                dynamic.comments = dynamic.comments.filter(c => c.id !== commentId);
                try {
                    if (window.dataManager && window.dataManager.dynamic && typeof window.dataManager.dynamic.update === 'function') {
                        await window.dataManager.dynamic.update(dynamic);
                    } else {
                        this.saveDynamicsToStorage();
                    }
                } catch (e) {
                    console.warn('同步删除评论失败，回退到本地存储', e);
                    this.saveDynamicsToStorage();
                }

                await this.loadDynamics();
                this.notifyDynamicsUpdated({ dynamicId, commentId, action: 'commentDelete' });
            }
        }
    }

    // 删除动态
    async deleteDynamic(dynamicId) {
        if (confirm('确定要删除这条动态吗？')) {
            try {
                if (window.dataManager && window.dataManager.dynamic && typeof window.dataManager.dynamic.delete === 'function') {
                    await window.dataManager.dynamic.delete(dynamicId);
                } else {
                    this.dynamics = this.dynamics.filter(d => d.id !== dynamicId);
                    this.saveDynamicsToStorage();
                }
            } catch (e) {
                console.warn('通过 dataManager 删除 dynamic 失败，回退到本地删除', e);
                this.dynamics = this.dynamics.filter(d => d.id !== dynamicId);
                this.saveDynamicsToStorage();
            }

            await this.loadDynamics();
            try { window.dispatchEvent(new CustomEvent('dynamicsUpdated')); } catch (e) {}
        }
    }

    // 查看用户资料
    viewUserProfile(userId) {
        window.location.href = `user.html?id=${userId}`;
    }

    // 查看媒体
    viewMedia(mediaUrl) {
        // 在实际应用中，这里会打开一个媒体查看器
        window.open(mediaUrl, '_blank');
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

// 初始化动态管理器
let dynamicManager;
document.addEventListener('DOMContentLoaded', () => {
    dynamicManager = new DynamicManager();
    window.dynamicManager = dynamicManager;
});