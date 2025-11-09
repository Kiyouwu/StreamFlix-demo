// profile.js - 修复版
class ProfileManager {
    constructor() {
        this.currentUser = this.getCurrentUser();
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
            return safeJsonParse(savedUser, null);
        } catch (e) {
            console.error('获取当前用户失败:', e);
            return null;
        }
    }

    init() {
        if (!this.currentUser && currentPage.includes('profile.html')) {
            alert('请先登录！');
            window.location.href = 'login.html';
            return;
        }

        this.loadUserProfile();
        this.setupEventListeners();
        this.loadUserVideos();
        this.loadUserFavorites();
        this.loadUserDynamic();
        // 注入发布器（如果页面没有显式的发布表单，则自动插入）
        this.injectDynamicComposer();
    }

    // 持久化 dynamics 数组：优先使用 DataManager 的 folder.save，回退到 legacy localStorage
    async persistDynamicsArray(dynamics) {
        try {
            if (window.dataManager && window.dataManager.folder && typeof window.dataManager.folder.save === 'function') {
                return window.dataManager.folder.save('dynamics', dynamics);
            }
            localStorage.setItem('dynamics', JSON.stringify(dynamics));
            return true;
        } catch (e) {
            console.warn('persistDynamicsArray 失败，尝试回退到 localStorage', e);
            try { localStorage.setItem('dynamics', JSON.stringify(dynamics)); } catch(e){}
            return false;
        }
    }

    // 在个人主页动态标签页顶部注入发布表单（如果页面中尚未存在）
    injectDynamicComposer() {
        try {
            const dynamicTab = document.getElementById('dynamic-tab');
            if (!dynamicTab) return;

            // 若页面已存在提交表单则不重复注入
            if (document.getElementById('profileDynamicComposer')) return;

            const composer = document.createElement('div');
            composer.id = 'profileDynamicComposer';
            composer.className = 'card';
            composer.style.padding = '12px';
            composer.style.marginBottom = '12px';

            composer.innerHTML = `
                <textarea id="profileDynamicInput" placeholder="说点什么吧..." rows="3" style="width:100%; padding:8px; border:1px solid var(--border-color); border-radius:6px;"></textarea>
                <div style="display:flex; gap:8px; align-items:center; margin-top:8px;">
                    <input type="file" id="profileMediaUpload" accept="image/*,video/*" multiple style="display:none;" />
                    <button class="btn" id="profileAddMediaBtn">添加媒体</button>
                    <div id="profileMediaPreview" style="display:flex; gap:8px;"></div>
                    <div style="margin-left:auto;"><button class="btn btn-primary" id="profilePublishBtn">发布</button></div>
                </div>
            `;

            const dynamicList = document.getElementById('dynamicList');
            dynamicTab.insertBefore(composer, dynamicList);

            // 绑定事件
            const addMediaBtn = document.getElementById('profileAddMediaBtn');
            const mediaInput = document.getElementById('profileMediaUpload');
            const publishBtn = document.getElementById('profilePublishBtn');

            addMediaBtn.addEventListener('click', () => mediaInput.click());

            const mediaFiles = [];

            mediaInput.addEventListener('change', async (e) => {
                const files = e.target.files;
                if (!files || files.length === 0) return;
                for (let file of files) {
                    // 立即生成预览 URL（Blob URL），并尝试异步将文件存入 IndexedDB
                    const previewUrl = window.createObjectURLTracked ? window.createObjectURLTracked(file) : URL.createObjectURL(file);
                    const type = file.type.startsWith('video/') ? 'video' : 'image';

                    // 先将占位项推入数组，后续更新其 url 字段为 indexeddb:<id> 或保留 blob 回退
                    const placeholder = { url: previewUrl, type, preview: previewUrl, stored: false };
                    mediaFiles.push(placeholder);
                    this.renderProfileMediaPreview(mediaFiles);

                    // 异步尝试使用 storageManager 存储
                    try {
                        if (window.storageManager && window.storageManager.isSupported) {
                            const mediaId = 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
                            if (type === 'video') {
                                await window.storageManager.storeVideo(mediaId, file);
                            } else {
                                await window.storageManager.storeImage(mediaId, file);
                            }
                            // 成功则将 url 标记为 indexeddb: 引用，并记录 id
                            placeholder.url = `indexeddb:${mediaId}`;
                            placeholder.stored = true;
                            placeholder.id = mediaId;
                            // 触发一次预览更新（虽然 preview 仍可用于显示）
                            this.renderProfileMediaPreview(mediaFiles);
                        }
                    } catch (storeErr) {
                        console.warn('将媒体保存到 storageManager 失败，使用 Blob URL 回退', storeErr);
                        // 已有 previewUrl 可用于回退，无需额外处理
                    }
                }
            });

            publishBtn.addEventListener('click', async () => {
                const textarea = document.getElementById('profileDynamicInput');
                const content = textarea.value.trim();
                if (!content && mediaFiles.length === 0) {
                    alert('请输入内容或添加媒体');
                    return;
                }

                // 构建 media 列表，优先使用 indexeddb 引用，否则使用当前 preview/blob URL
                const mediaList = mediaFiles.map(m => ({ url: m.url, type: m.type }));

                const newDynamic = {
                    id: 'dynamic_' + Date.now(),
                    authorId: this.currentUser.id,
                    authorName: this.currentUser.username,
                    authorAvatar: this.currentUser.avatar,
                    content,
                    media: mediaList,
                    publishTime: new Date().toISOString(),
                    likes: 0,
                    comments: [],
                    likedBy: []
                };

                    // 使用 dataManager 优先保存（返回结构 { ok, dynamic, storedMediaIds, error } ）
                    if (dataManager.dynamic && typeof dataManager.dynamic.create === 'function') {
                        try {
                            const res = await dataManager.dynamic.create(newDynamic);
                            if (!res || !res.ok) {
                                console.warn('dataManager.dynamic.create 返回失败，回退到 localStorage', res && res.error);
                                const dynamics = safeJsonParse(localStorage.getItem('dynamics'), []);
                                dynamics.push(newDynamic);
                                localStorage.setItem('dynamics', JSON.stringify(dynamics));
                            }
                        } catch (e) {
                            console.warn('dataManager.dynamic.create 失败，回退到 localStorage', e);
                            // 优先使用 DataManager 保存新动态，回退到 legacy localStorage 仅在必要时使用
                            try {
                                if (window.dataManager && window.dataManager.dynamic && typeof window.dataManager.dynamic.create === 'function') {
                                    const res = await window.dataManager.dynamic.create(newDynamic);
                                    if (!res || !res.ok) {
                                        // 回退：写入 legacy localStorage（仅在 dataManager 不可用或返回失败时）
                                        const dynamics = safeJsonParse(localStorage.getItem('dynamics'), []);
                                        dynamics.push(newDynamic);
                                        await this.persistDynamicsArray(dynamics);
                                    }
                                } else {
                                    const dynamics = safeJsonParse(localStorage.getItem('dynamics'), []);
                                    dynamics.push(newDynamic);
                                    await this.persistDynamicsArray(dynamics);
                                }
                            } catch (e) {
                                console.warn('通过 dataManager 保存动态失败，使用本地回退', e);
                                const dynamics = safeJsonParse(localStorage.getItem('dynamics'), []);
                                dynamics.push(newDynamic);
                                await this.persistDynamicsArray(dynamics);
                            }
                        }
                    } else {
                        // 优先使用 DataManager 创建动态
                        try {
                            if (window.dataManager && window.dataManager.dynamic && typeof window.dataManager.dynamic.create === 'function') {
                                const res = await window.dataManager.dynamic.create(newDynamic);
                                if (!res || !res.ok) {
                                    const dynamics = safeJsonParse(localStorage.getItem('dynamics'), []);
                                    dynamics.push(newDynamic);
                                    localStorage.setItem('dynamics', JSON.stringify(dynamics));
                                }
                            } else {
                                const dynamics = safeJsonParse(localStorage.getItem('dynamics'), []);
                                dynamics.push(newDynamic);
                                localStorage.setItem('dynamics', JSON.stringify(dynamics));
                            }
                        } catch (e) {
                            console.warn('通过 dataManager 创建动态失败，回退到 localStorage', e);
                            const dynamics = safeJsonParse(localStorage.getItem('dynamics'), []);
                            dynamics.push(newDynamic);
                            await this.persistDynamicsArray(dynamics);
                        }
                    }

                // 清理输入
                textarea.value = '';
                // 释放 blob URLs
                mediaFiles.forEach(m => { if (m.preview) try { URL.revokeObjectURL(m.preview); } catch(e){} });
                mediaFiles.length = 0;
                this.renderProfileMediaPreview(mediaFiles);

                // 通知更新
                try { window.dispatchEvent(new CustomEvent('dynamicsUpdated', { detail: { dynamic: newDynamic, action: 'create' } })); } catch(e){}

                this.loadUserDynamic();
                alert('动态发布成功！');
            });

        } catch (error) {
            console.error('injectDynamicComposer 失败:', error);
        }
    }

    renderProfileMediaPreview(mediaFiles) {
        const preview = document.getElementById('profileMediaPreview');
        if (!preview) return;
        // 使用 DOM 方法安全构建预览，避免直接插入未校验的 HTML
        preview.innerHTML = '';
        const isSafeUrl = (url) => {
            if (!url || typeof url !== 'string') return false;
            return /^(https?:|blob:|data:image\/|indexeddb:)/.test(url);
        };

        mediaFiles.forEach((m, i) => {
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';

            if (m.type === 'video') {
                const video = document.createElement('video');
                video.controls = true;
                video.style.width = '80px';
                video.style.height = '60px';
                video.style.objectFit = 'cover';
                if (isSafeUrl(m.url)) video.src = m.url;
                wrapper.appendChild(video);
            } else {
                const img = document.createElement('img');
                img.style.width = '80px';
                img.style.height = '60px';
                img.style.objectFit = 'cover';
                if (isSafeUrl(m.url)) img.src = m.url;
                wrapper.appendChild(img);
            }

            const btn = document.createElement('button');
            btn.className = 'media-remove';
            btn.dataset.index = String(i);
            btn.style.position = 'absolute';
            btn.style.right = '0';
            btn.style.top = '0';
            btn.textContent = '×';
            btn.addEventListener('click', () => {
                mediaFiles.splice(i, 1);
                this.renderProfileMediaPreview(mediaFiles);
            });

            wrapper.appendChild(btn);
            preview.appendChild(wrapper);
        });
    }

    // loadUserProfile 方法在文件后面有更完善的实现，故此处保留占位注释以避免重复定义。

    updateStats() {
        const videos = dataManager.video.getByUser(this.currentUser.id);
        const followersCount = this.currentUser.followers ? this.currentUser.followers.length : 0;
        const followingCount = this.currentUser.following ? this.currentUser.following.length : 0;
        
        document.getElementById('videoCount').textContent = videos.length;
        document.getElementById('followerCount').textContent = followersCount;
        document.getElementById('followingCount').textContent = followingCount;
    }

    setupEventListeners() {
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });

        const editForm = document.getElementById('editProfileForm');
        if (editForm) {
            editForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveProfile();
            });
        }

        const avatar = document.getElementById('profileAvatar');
        if (avatar) {
            avatar.addEventListener('click', () => {
                document.getElementById('editAvatar').click();
            });
        }

        const avatarInput = document.getElementById('editAvatar');
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    const file = e.target.files[0];
                    // 使用受管控的 createObjectURL 生成预览，避免将大文件转为 data URL 存入内存/localStorage
                    const previewUrl = window.createObjectURLTracked ? window.createObjectURLTracked(file) : URL.createObjectURL(file);
                    const avatarEl = document.getElementById('profileAvatar');
                    if (avatarEl && previewUrl) {
                        avatarEl.src = previewUrl;
                    }
                    // 保留文件在 input 中，实际保存时再由 saveProfile 使用 storeAvatar 处理（存入 IndexedDB 或压缩）
                }
            });
        }

        // 添加动态创建按钮事件
        const createDynamicBtn = document.getElementById('createDynamicBtn');
        if (createDynamicBtn) {
            createDynamicBtn.addEventListener('click', () => {
                this.createDynamic();
            });
        }

        // 监听动态更新事件，实时同步动态列表
        window.addEventListener('dynamicsUpdated', (e) => {
            try {
                // 重新加载用户动态以保持同步
                this.loadUserDynamic();
            } catch (err) {
                console.error('处理 dynamicsUpdated 事件失败:', err);
            }
        });
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-item').forEach(tab => {
            tab.classList.remove('active');
        });
        const tabElement = document.querySelector(`[data-tab="${tabName}"]`);
        if (tabElement) {
            tabElement.classList.add('active');
        }

        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        const tabToggle = document.getElementById(`${tabName}-tab`);
        if (tabToggle) {
            tabToggle.classList.add('active');
        }

        switch (tabName) {
            case 'videos':
                this.loadUserVideos();
                break;
            case 'favorites':
                this.loadUserFavorites();
                break;
            case 'dynamic':
                this.loadUserDynamic();
                break;
        }
    }

    loadUserVideos() {
        const userVideos = dataManager.video.getByUser(this.currentUser.id);
        const videoGrid = document.getElementById('myVideosGrid');
        const noVideosMessage = document.getElementById('noVideosMessage');

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
                        <span>${this.formatViews(video.views || 0)} 播放</span>
                        <span>${new Date(video.uploadTime).toLocaleDateString()}</span>
                    </div>
                    <div style="margin-top: 10px; display: flex; gap: 5px;">
                        <button class="btn" onclick="profileManager.editVideo('${video.id}')" style="flex: 1;">编辑</button>
                        <button class="btn btn-secondary" onclick="profileManager.deleteVideo('${video.id}')" style="flex: 1;">删除</button>
                    </div>
                </div>
            </div>
        `).join('');

        videoGrid.querySelectorAll('.video-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('button')) {
                    const videoId = card.dataset.videoId;
                    this.playVideo(videoId);
                }
            });
        });
    }

    loadUserFavorites() {
        let favoriteVideos = [];
        if (dataManager.favorite && dataManager.favorite.getByUser) {
            favoriteVideos = dataManager.favorite.getByUser(this.currentUser.id);
        } else {
            // 降级方案
            const userData = dataManager.user.getById(this.currentUser.id);
            const favoriteIds = userData?.favorites || [];
            const allVideos = dataManager.folder.getAllItems('videos');
            favoriteVideos = allVideos.filter(video => favoriteIds.includes(video.id));
        }
        
        const favoritesGrid = document.getElementById('favoritesGrid');
        const noFavoritesMessage = document.getElementById('noFavoritesMessage');

        if (favoriteVideos.length === 0) {
            favoritesGrid.style.display = 'none';
            noFavoritesMessage.style.display = 'block';
            return;
        }

        noFavoritesMessage.style.display = 'none';
        favoritesGrid.style.display = 'grid';
        
        favoritesGrid.innerHTML = favoriteVideos.map(video => `
            <div class="video-card" data-video-id="${video.id}">
                <img src="${video.cover}" alt="${video.title}" class="video-cover"
                     onerror="this.src='assets/demoCover.png'">
                <div class="video-info">
                    <div class="video-title">${this.escapeHtml(video.title)}</div>
                    <div class="video-meta">
                        <span class="video-author" data-author-id="${video.authorId}">${this.escapeHtml(video.authorName)}</span>
                        <span>${this.formatViews(video.views || 0)} 播放</span>
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

        favoritesGrid.querySelectorAll('.video-author').forEach(author => {
            author.addEventListener('click', (e) => {
                e.stopPropagation();
                const authorId = author.dataset.authorId;
                this.viewUserProfile(authorId);
            });
        });
    }

    loadUserDynamic() {
        let userDynamics = [];
        if (dataManager.dynamic && dataManager.dynamic.getByUser) {
            userDynamics = dataManager.dynamic.getByUser(this.currentUser.id);
        } else {
            // 降级方案
            const allDynamics = safeJsonParse(localStorage.getItem('dynamics'), []);
            userDynamics = allDynamics.filter(dynamic => dynamic.authorId === this.currentUser.id);
        }
        
        const dynamicList = document.getElementById('dynamicList');
        const noDynamicMessage = document.getElementById('noDynamicMessage');

        if (userDynamics.length === 0) {
            dynamicList.style.display = 'none';
            noDynamicMessage.style.display = 'block';
            return;
        }

        noDynamicMessage.style.display = 'none';
        dynamicList.style.display = 'block';
        
        dynamicList.innerHTML = userDynamics.map(dynamic => `
            <div class="dynamic-item" style="background: white; padding: 15px; margin-bottom: 15px; border-radius: 8px; box-shadow: var(--shadow);">
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <img src="${this.currentUser.avatar || 'assets/default-avatar.png'}" alt="头像" style="width: 40px; height: 40px; border-radius: 50%; margin-right: 10px;">
                    <div>
                        <div style="font-weight: bold;">${this.currentUser.username}</div>
                        <div style="color: #666; font-size: 0.9em;">${this.formatTime(dynamic.publishTime)}</div>
                    </div>
                </div>
                <div style="margin-bottom: 10px; line-height: 1.5;">${this.formatContent(dynamic.content)}</div>
                ${dynamic.media && dynamic.media.length > 0 ? `
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 10px;">
                        ${dynamic.media.map(media => `
                            <img src="${media.url}" alt="动态媒体" style="width: 100%; border-radius: 4px; object-fit: cover;">
                        `).join('')}
                    </div>
                ` : ''}
                <div style="display: flex; gap: 15px; color: #666; align-items: center;">
                    <span>👍 ${dynamic.likes || 0}</span>
                    <span>💬 ${dynamic.comments ? dynamic.comments.length : 0}</span>
                    <button class="btn" onclick="profileManager.deleteDynamic('${dynamic.id}')" style="margin-left: auto; padding: 4px 8px; font-size: 0.8em;">删除</button>
                </div>
            </div>
        `).join('');
    }

    openEditProfile() {
        document.getElementById('editProfileModal').style.display = 'block';
        document.getElementById('editUsername').value = this.currentUser.username;
        document.getElementById('editSignature').value = this.currentUser.signature || '';
    }

    closeEditProfile() {
        document.getElementById('editProfileModal').style.display = 'none';
    }

    // 注意：saveProfile 的现代实现在文件的后面（async saveProfile）会使用 storeAvatar 并优先存入 IndexedDB。

    updateUserProfile(username, signature, avatar) {
        const updatedUser = {
            ...this.currentUser,
            username,
            signature,
            avatar
        };

        if (authManager.updateUserData(updatedUser)) {
            this.currentUser = updatedUser;
            this.loadUserProfile();
            this.closeEditProfile();
            
            alert('资料更新成功！');
        } else {
            alert('资料更新失败，请重试');
        }
    }

    createDynamic() {
        (async () => {
            const content = prompt('请输入动态内容：');
            if (!content) return;

            const newDynamic = {
                id: 'dynamic_' + Date.now(),
                authorId: this.currentUser.id,
                authorName: this.currentUser.username,
                authorAvatar: this.currentUser.avatar,
                content,
                publishTime: new Date().toISOString(),
                likes: 0,
                comments: []
            };

                    // 优先使用 dataManager 创建动态并在失败时回退到 legacy localStorage
                    try {
                        if (window.dataManager && window.dataManager.dynamic && typeof window.dataManager.dynamic.create === 'function') {
                            const res = await window.dataManager.dynamic.create(newDynamic);
                            if (!res || !res.ok) {
                                const dynamics = safeJsonParse(localStorage.getItem('dynamics'), []);
                                dynamics.push(newDynamic);
                                await this.persistDynamicsArray(dynamics);
                            }
                        } else {
                            const dynamics = safeJsonParse(localStorage.getItem('dynamics'), []);
                            dynamics.push(newDynamic);
                            await this.persistDynamicsArray(dynamics);
                        }
                    } catch (e) {
                        console.warn('通过 dataManager 创建动态失败，回退到 localStorage', e);
                        const dynamics = safeJsonParse(localStorage.getItem('dynamics'), []);
                        dynamics.push(newDynamic);
                        await this.persistDynamicsArray(dynamics);
                    }

            // 通知动态管理器/其它页面更新
            try {
                window.dispatchEvent(new CustomEvent('dynamicsUpdated', { detail: { dynamic: newDynamic } }));
            } catch (e) {
                console.warn('派发 dynamicsUpdated 事件失败', e);
            }

            this.loadUserDynamic();
            alert('动态发布成功！');
        })();
    }

    playVideo(videoId) {
        window.location.href = `video-play.html?id=${videoId}`;
    }

    viewUserProfile(userId) {
        window.location.href = `user.html?id=${userId}`;
    }

    editVideo(videoId) {
        window.location.href = `upload.html?edit=${videoId}`;
    }

    deleteVideo(videoId) {
        if (confirm('确定要删除这个视频吗？此操作不可恢复。')) {
            if (dataManager.video.delete(videoId)) {
                const updatedUser = {
                    ...this.currentUser,
                    videos: this.currentUser.videos.filter(id => id !== videoId)
                };
                authManager.updateUserData(updatedUser);
                
                this.loadUserVideos();
                this.updateStats();
                alert('视频删除成功！');
            } else {
                alert('视频删除失败，请重试');
            }
        }
    }

    async deleteDynamic(dynamicId) {
        if (confirm('确定要删除这条动态吗？')) {
            let success = false;
            try {
                if (dataManager.dynamic && dataManager.dynamic.delete) {
                    const res = await dataManager.dynamic.delete(dynamicId);
                    success = !!res;
                } else {
                    // 降级方案：更新 legacy storage
                    const dynamics = safeJsonParse(localStorage.getItem('dynamics'), []);
                    const newDynamics = dynamics.filter(d => d.id !== dynamicId);
                    await this.persistDynamicsArray(newDynamics);
                    success = true;
                }
            } catch (e) {
                console.warn('删除 dynamic 时出错，回退到本地删除', e);
                const dynamics = safeJsonParse(localStorage.getItem('dynamics'), []);
                const newDynamics = dynamics.filter(d => d.id !== dynamicId);
                await this.persistDynamicsArray(newDynamics);
                success = true;
            }

            if (success) {
                // 通知其它模块动态列表更新
                try { window.dispatchEvent(new CustomEvent('dynamicsUpdated')); } catch(e){}
                this.loadUserDynamic();
                alert('动态删除成功！');
            } else {
                alert('动态删除失败，请重试');
            }
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatViews(views) {
        if (!views) return '0';
        if (views >= 10000) {
            return (views / 10000).toFixed(1) + '万';
        }
        return views.toString();
    }

    formatTime(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = now - time;

        if (diff < 60000) {
            return '刚刚';
        } else if (diff < 3600000) {
            return `${Math.floor(diff / 60000)}分钟前`;
        } else if (diff < 86400000) {
            return `${Math.floor(diff / 3600000)}小时前`;
        } else {
            return time.toLocaleDateString();
        }
    }

    formatContent(content) {
        return content
            .replace(/\n/g, '<br>')
            .replace(/#(\w+)/g, '<span style="color: var(--primary-color);">#$1</span>')
            .replace(/@(\w+)/g, '<span style="color: var(--secondary-color); cursor: pointer;">@$1</span>');
    }

// 存储头像到 IndexedDB
async storeAvatar(avatarFile) {
    try {
        if (!window.storageManager || !window.storageManager.isSupported) {
            // 降级方案：转换为小尺寸Base64
            return await this.compressImage(avatarFile);
        }
        const avatarId = `avatar_${this.currentUser.id}_${Date.now()}`;
        await window.storageManager.storeImage(avatarId, avatarFile);

        const newRef = `indexeddb:${avatarId}`;

        // 异步删除旧头像（如果存在并且存储在 indexeddb 中）以释放空间
        try {
            const oldRef = this.currentUser && this.currentUser.avatar ? this.currentUser.avatar : null;
            if (oldRef && typeof oldRef === 'string' && oldRef.startsWith('indexeddb:')) {
                const oldId = oldRef.replace('indexeddb:', '');
                if (oldId && oldId !== avatarId && window.storageManager && typeof window.storageManager.deleteImage === 'function') {
                    // 不阻塞主流程，后台删除
                    window.storageManager.deleteImage(oldId).then(() => {
                        console.log('旧头像已删除:', oldId);
                    }).catch(err => {
                        console.warn('删除旧头像失败:', err);
                    });
                }
            }
        } catch (e) {
            console.warn('尝试删除旧头像时出错:', e);
        }

        return newRef;
    } catch (error) {
        console.warn('头像存储失败，使用压缩方案:', error);
        return await this.compressImage(avatarFile);
    }
}

// 压缩图片
compressImage(file, maxWidth = 200, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 计算新尺寸
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                ctx.drawImage(img, 0, 0, width, height);
                
                // 转换为压缩的Base64
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataUrl);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// 获取头像URL
getAvatarUrl(avatarRef) {
    if (!avatarRef) return 'assets/default-avatar.png';
    
    if (avatarRef.startsWith('indexeddb:')) {
        // 从IndexedDB加载
        const avatarId = avatarRef.replace('indexeddb:', '');
        if (window.storageManager && window.storageManager.isSupported) {
            // 异步加载，先返回默认头像
            this.loadAvatarFromStorage(avatarId);
            return 'assets/default-avatar.png';
        }
    }
    
    return avatarRef;
}

// 从存储加载头像
async loadAvatarFromStorage(avatarId) {
    try {
        const avatarData = await window.storageManager.getImage(avatarId);
        if (avatarData && avatarData.file) {
            const avatarUrl = window.createObjectURLTracked ? window.createObjectURLTracked(avatarData.file) : URL.createObjectURL(avatarData.file);
            // 更新页面上的头像
            const avatarElements = document.querySelectorAll('#profileAvatar, .header-avatar');
            avatarElements.forEach(el => {
                if (el.src.includes('default-avatar.png')) {
                    el.src = avatarUrl;
                }
            });
        }
    } catch (error) {
        console.warn('从存储加载头像失败:', error);
    }
}

// 修改保存资料方法
async saveProfile() {
    const username = document.getElementById('editUsername').value.trim();
    const signature = document.getElementById('editSignature').value.trim();
    const avatarFile = document.getElementById('editAvatar').files[0];

    if (!username) {
        alert('请输入用户名');
        return;
    }

    const users = dataManager.user.getAll();
    const existingUser = users.find(u => u.username === username && u.id !== this.currentUser.id);
    if (existingUser) {
        alert('用户名已存在，请选择其他用户名');
        return;
    }

    let avatarUrl = this.currentUser.avatar;
    
    if (avatarFile) {
        // 显示加载状态
        const saveBtn = document.querySelector('#editProfileForm button[type="submit"]');
        const originalText = saveBtn.textContent;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="loading-spinner"></span>处理中...';
        
        try {
            avatarUrl = await this.storeAvatar(avatarFile);
        } catch (error) {
            console.error('头像处理失败:', error);
            alert('头像处理失败，使用原头像');
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = originalText;
        }
    }

    this.updateUserProfile(username, signature, avatarUrl);
}

// 修改加载用户资料方法
loadUserProfile() {
    document.getElementById('profileUsername').textContent = this.currentUser.username;
    document.getElementById('profileSignature').textContent = this.currentUser.signature || '这个人很懒，什么都没有写～';
    
    // 使用新的头像加载方法
    const avatarUrl = this.getAvatarUrl(this.currentUser.avatar);
    document.getElementById('profileAvatar').src = avatarUrl;
    
    this.updateStats();
}

}

let profileManager;
document.addEventListener('DOMContentLoaded', () => {
    profileManager = new ProfileManager();
    // 向全局暴露 createDynamic 方便页面上使用旧的 onclick 调用
    try { window.createDynamic = () => profileManager && profileManager.createDynamic ? profileManager.createDynamic() : null; } catch(e){}
});