// upload.js - 完整修复版（包含分类数据同步）
class UploadManager {
    constructor() {
        this.currentUser = null;
        this.videoFile = null;
        this.coverFile = null;
        this.tags = [];
        this.editMode = false;
        this.editingVideoId = null;
        this.editingVideo = null;
        this.isInitialized = false;
        this.initPromise = null;
        
        console.log('UploadManager 初始化开始');
        this.initialize();
    }

    // 异步初始化
    async initialize() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise(async (resolve, reject) => {
            try {
                console.log('UploadManager 开始初始化...');
                
                // 等待依赖管理器初始化
                await this.waitForDependencies();
                
                // 获取当前用户
                await this.loadCurrentUser();
                
                // 检查编辑模式
                this.checkEditMode();
                
                // 设置事件监听器
                this.setupEventListeners();
                
                // 初始化UI状态
                this.updateUIState();
                
                this.isInitialized = true;
                console.log('UploadManager 初始化完成');
                resolve(true);
                
            } catch (error) {
                console.error('UploadManager 初始化失败:', error);
                reject(error);
            }
        });

        return this.initPromise;
    }

    // 等待依赖管理器
    async waitForDependencies() {
        // 等待 DataManager
        if (window.dataManager && typeof window.dataManager.waitForInitialization === 'function') {
            await window.dataManager.waitForInitialization();
            console.log('DataManager 已就绪');
        } else {
            throw new Error('DataManager 不可用');
        }
        
        // 等待 AuthManager
        if (window.authManager && typeof window.authManager.getCurrentUser === 'function') {
            // authManager 已就绪
            console.log('AuthManager 已就绪');
        } else {
            console.warn('AuthManager 不可用，使用降级方案');
        }
    }

    // 加载当前用户
    async loadCurrentUser() {
        try {
            if (window.authManager && typeof window.authManager.getCurrentUser === 'function') {
                this.currentUser = window.authManager.getCurrentUser();
            } else if (window.currentUser) {
                this.currentUser = window.currentUser;
            } else {
                const savedUser = localStorage.getItem('currentUser');
                this.currentUser = (typeof safeJsonParse === 'function') ? safeJsonParse(savedUser, null) : (savedUser ? JSON.parse(savedUser) : null);
            }
            
            console.log('当前用户:', this.currentUser ? this.currentUser.username : '未登录');
            
            // 检查登录状态
            if (!this.currentUser && window.location.pathname.includes('upload.html')) {
                console.warn('未登录用户访问上传页面，跳转到登录页');
                setTimeout(() => {
                    alert('请先登录！');
                    window.location.href = 'login.html';
                }, 100);
                throw new Error('用户未登录');
            }
            
            return true;
        } catch (error) {
            console.error('加载当前用户失败:', error);
            throw error;
        }
    }

    checkEditMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('edit');
        
        if (editId) {
            this.editMode = true;
            this.editingVideoId = editId;
            this.loadVideoForEdit();
        }
    }

    async loadVideoForEdit() {
        try {
            await this.waitForInitialization();
            
            this.editingVideo = window.dataManager.video.getById(this.editingVideoId);
            
            if (this.editingVideo && this.editingVideo.authorId === this.currentUser.id) {
                this.populateEditForm();
            } else {
                alert('视频不存在或没有编辑权限！');
                window.location.href = 'profile.html';
            }
        } catch (error) {
            console.error('加载编辑视频失败:', error);
            alert('加载视频信息失败！');
        }
    }

    populateEditForm() {
        const videoTitle = document.getElementById('videoTitle');
        const videoDescription = document.getElementById('videoDescription');
        const videoCategory = document.getElementById('videoCategory');
        
        if (videoTitle) videoTitle.value = this.editingVideo.title || '';
        if (videoDescription) videoDescription.value = this.editingVideo.description || '';
        if (videoCategory) videoCategory.value = this.editingVideo.category || '';
        
        const privacyInput = document.querySelector(`input[name="privacy"][value="${this.editingVideo.privacy || 'public'}"]`);
        if (privacyInput) privacyInput.checked = true;
        
        this.tags = this.editingVideo.tags || [];
        this.renderTags();
        
        const coverPreview = document.getElementById('coverPreview');
        if (coverPreview && this.editingVideo.cover) {
            coverPreview.src = this.editingVideo.cover;
            coverPreview.style.display = 'block';
        }
        
        // 更新页面标题和按钮文本
        const pageTitle = document.querySelector('h1');
        const submitBtn = document.getElementById('submitBtn');
        if (pageTitle) pageTitle.textContent = '编辑视频';
        if (submitBtn) {
            submitBtn.textContent = '更新视频';
            submitBtn.disabled = false; // 编辑模式下不需要视频文件
        }

        // 显示原始视频信息
        const videoInfo = document.getElementById('originalVideoInfo');
        if (videoInfo && this.editingVideo.videoUrl) {
            videoInfo.style.display = 'block';
        }
    }

    setupEventListeners() {
        this.setupFileUploadEvents();
        this.setupFormEvents();
        this.setupInputEvents();
    }

    setupFileUploadEvents() {
        const uploadArea = document.getElementById('uploadArea');
        const videoFileInput = document.getElementById('videoFile');
        
        if (uploadArea && videoFileInput) {
            uploadArea.addEventListener('click', () => {
                videoFileInput.click();
            });

            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                
                const files = e.dataTransfer.files;
                if (files.length > 0 && files[0].type.startsWith('video/')) {
                    this.handleVideoFile(files[0]);
                } else {
                    this.showError('请选择视频文件！');
                }
            });
        }

        if (videoFileInput) {
            videoFileInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleVideoFile(e.target.files[0]);
                }
            });
        }

        const coverInput = document.getElementById('videoCover');
        if (coverInput) {
            coverInput.addEventListener('change', (e) => {
                if (e.target.files.length > 0) {
                    this.handleCoverFile(e.target.files[0]);
                }
            });
        }
    }

    setupFormEvents() {
        const tagInput = document.getElementById('tagInput');
        if (tagInput) {
            tagInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const tag = tagInput.value.trim();
                    if (tag) {
                        this.addTag(tag);
                        tagInput.value = '';
                    }
                }
            });
        }

        const uploadForm = document.getElementById('uploadForm');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.submitVideo();
            });
        }

        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (confirm('确定要取消吗？所有未保存的更改将会丢失。')) {
                    window.history.back();
                }
            });
        }
    }

    setupInputEvents() {
        // 标题字符计数
        const titleInput = document.getElementById('videoTitle');
        if (titleInput) {
            titleInput.addEventListener('input', () => {
                this.updateCharCounter('titleCounter', titleInput.value.length, 100);
                this.validateForm();
            });
        }

        // 描述字符计数
        const descInput = document.getElementById('videoDescription');
        if (descInput) {
            descInput.addEventListener('input', () => {
                this.updateCharCounter('descriptionCounter', descInput.value.length, 500);
            });
        }

        // 分类选择验证
        const categorySelect = document.getElementById('videoCategory');
        if (categorySelect) {
            categorySelect.addEventListener('change', () => {
                this.validateForm();
            });
        }
    }

    updateCharCounter(counterId, currentLength, maxLength) {
        const counter = document.getElementById(counterId);
        if (counter) {
            counter.textContent = `${currentLength}/${maxLength}`;
            
            if (currentLength > maxLength * 0.8) {
                counter.style.color = '#e74c3c';
            } else {
                counter.style.color = 'var(--text-secondary)';
            }
        }
    }

    handleVideoFile(file) {
        if (!file.type.startsWith('video/')) {
            this.showError('请选择视频文件！');
            return;
        }

        // 文件大小验证（100MB）
        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showError(`文件大小不能超过 ${this.formatFileSize(maxSize)}！`);
            return;
        }

        this.videoFile = file;
        
        // 显示文件信息
        this.updateFileInfo('videoFileInfo', file);
        
        // 显示视频预览
        const videoPreview = document.getElementById('videoPreview');
        if (videoPreview) {
            const videoURL = window.createObjectURLTracked ? window.createObjectURLTracked(file) : URL.createObjectURL(file);
            if (videoURL) {
                videoPreview.src = videoURL;
                videoPreview.style.display = 'block';
            }
            // 生成缩略图
            this.generateThumbnail(videoURL);
        }

        this.validateForm();
    }

    handleCoverFile(file) {
        if (!file.type.startsWith('image/')) {
            this.showError('请选择图片文件！');
            return;
        }

        // 文件大小验证（5MB）
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showError(`文件大小不能超过 ${this.formatFileSize(maxSize)}！`);
            return;
        }

        this.coverFile = file;
        
        // 显示文件信息
        this.updateFileInfo('coverFileInfo', file);
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const coverPreview = document.getElementById('coverPreview');
            if (coverPreview) {
                coverPreview.src = e.target.result;
                coverPreview.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }

    updateFileInfo(elementId, file) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <strong>${file.name}</strong> 
                (${this.formatFileSize(file.size)}) 
                - ${new Date(file.lastModified).toLocaleDateString()}
            `;
        }
    }

    generateThumbnail(videoURL) {
        const video = document.createElement('video');
        video.src = videoURL;
        video.currentTime = 1;
        
        video.addEventListener('loadeddata', () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 设置 canvas 尺寸
            canvas.width = 280;
            canvas.height = 160;
            
            // 绘制视频帧
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // 如果没有自定义封面，使用视频帧作为封面
            if (!this.coverFile && !this.editMode) {
                const coverPreview = document.getElementById('coverPreview');
                if (coverPreview) {
                    coverPreview.src = canvas.toDataURL();
                    coverPreview.style.display = 'block';
                }
            }
        });
        
        video.addEventListener('error', () => {
            console.warn('无法生成视频缩略图');
        });
    }

    addTag(tagText) {
        const cleanedTag = tagText.trim().replace(/[^\w\u4e00-\u9fa5]/g, '');
        
        if (!cleanedTag) {
            this.showError('标签不能为空！');
            return;
        }

        if (this.tags.includes(cleanedTag)) {
            this.showError('标签已存在！');
            return;
        }

        if (this.tags.length >= 10) {
            this.showError('最多只能添加10个标签！');
            return;
        }

        this.tags.push(cleanedTag);
        this.renderTags();
    }

    removeTag(tagText) {
        this.tags = this.tags.filter(tag => tag !== tagText);
        this.renderTags();
    }

    renderTags() {
        const tagContainer = document.getElementById('tagContainer');
        if (tagContainer) {
            tagContainer.innerHTML = `
                ${this.tags.map(tag => `
                    <div class="tag">
                        ${this.escapeHtml(tag)}
                        <span class="tag-remove" onclick="uploadManager.removeTag('${this.escapeHtml(tag)}')">×</span>
                    </div>
                `).join('')}
                <input type="text" class="tag-input" id="tagInput" placeholder="输入标签后按回车添加" maxlength="20">
            `;

            // 重新绑定事件
            const tagInput = document.getElementById('tagInput');
            if (tagInput) {
                tagInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const tag = tagInput.value.trim();
                        if (tag) {
                            this.addTag(tag);
                            tagInput.value = '';
                        }
                    }
                });
            }
        }
    }

    validateForm() {
        const title = document.getElementById('videoTitle')?.value.trim();
        const category = document.getElementById('videoCategory')?.value;
        const submitBtn = document.getElementById('submitBtn');
        
        let isValid = true;
        let errorMessage = '';

        if (!title) {
            isValid = false;
            errorMessage = '请输入视频标题';
        } else if (!category) {
            isValid = false;
            errorMessage = '请选择视频分类';
        } else if (!this.editMode && !this.videoFile) {
            isValid = false;
            errorMessage = '请选择视频文件';
        }

        if (submitBtn) {
            submitBtn.disabled = !isValid;
        }

        return { isValid, errorMessage };
    }

    async submitVideo() {
        await this.waitForInitialization();
        
        const validation = this.validateForm();
        if (!validation.isValid) {
            this.showError(validation.errorMessage);
            return;
        }

        const videoTitle = document.getElementById('videoTitle');
        const videoDescription = document.getElementById('videoDescription');
        const videoCategory = document.getElementById('videoCategory');
        const privacyInput = document.querySelector('input[name="privacy"]:checked');

        if (!videoTitle || !videoDescription || !videoCategory || !privacyInput) {
            this.showError('表单数据不完整！');
            return;
        }

        const title = videoTitle.value.trim();
        const description = videoDescription.value.trim();
        const category = videoCategory.value;
        const privacy = privacyInput.value;

        // 显示加载状态
        this.setLoadingState(true);

        try {
            // 模拟上传过程
            await this.simulateUpload();
            
            let coverUrl = '';
            
            if (this.coverFile) {
                coverUrl = await this.processImageFile(this.coverFile);
            } else {
                const coverPreview = document.getElementById('coverPreview');
                if (coverPreview && coverPreview.src && !coverPreview.src.startsWith('data:')) {
                    coverUrl = coverPreview.src;
                } else if (this.editMode && this.editingVideo.cover) {
                    coverUrl = this.editingVideo.cover;
                }
            }

            if (this.editMode) {
                await this.updateVideo(title, description, category, privacy, coverUrl);
            } else {
                await this.uploadNewVideo(title, description, category, privacy, coverUrl);
            }
        } catch (error) {
            console.error('上传失败:', error);
            this.showError('上传失败，请重试！');
            this.setLoadingState(false);
        }
    }

    async updateVideo(title, description, category, privacy, coverUrl) {
        const updatedVideo = {
            ...this.editingVideo,
            title,
            description,
            category,
            privacy,
            cover: coverUrl || this.editingVideo.cover,
            tags: this.tags
        };

        if (window.dataManager.video.update(updatedVideo)) {
            this.showSuccess('视频更新成功！');
            setTimeout(() => {
                window.location.href = 'profile.html';
            }, 1500);
        } else {
            throw new Error('视频更新失败');
        }
    }

    async simulateUpload() {
        return new Promise((resolve) => {
            const progressBar = document.getElementById('videoProgressBar');
            const progressFill = document.getElementById('videoProgressFill');
            const uploadStatus = document.getElementById('videoUploadStatus');
            
            if (progressBar) progressBar.style.display = 'block';
            if (uploadStatus) {
                uploadStatus.style.display = 'block';
                uploadStatus.textContent = '上传中...';
                uploadStatus.className = 'upload-status';
            }
            
            let progress = 0;
            const interval = setInterval(() => {
                progress += Math.random() * 15;
                if (progress >= 100) {
                    progress = 100;
                    clearInterval(interval);
                    
                    if (progressFill) progressFill.style.width = '100%';
                    if (uploadStatus) {
                        uploadStatus.textContent = '上传完成！';
                        uploadStatus.className = 'upload-status success';
                    }
                    
                    setTimeout(resolve, 500);
                } else {
                    if (progressFill) progressFill.style.width = progress + '%';
                }
            }, 200);
        });
    }

    setLoadingState(loading) {
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = loading;
            submitBtn.textContent = loading ? 
                (this.editMode ? '更新中...' : '上传中...') : 
                (this.editMode ? '更新视频' : '发布视频');
        }
    }

    showError(message) {
        alert(message); // 实际项目中应该使用更友好的提示方式
        console.error('Upload Error:', message);
    }

    showSuccess(message) {
        alert(message); // 实际项目中应该使用更友好的提示方式
        console.log('Upload Success:', message);
    }

    updateUIState() {
        this.validateForm();
        
        // 初始化字符计数器
        const titleInput = document.getElementById('videoTitle');
        const descInput = document.getElementById('videoDescription');
        
        if (titleInput) {
            this.updateCharCounter('titleCounter', titleInput.value.length, 100);
        }
        if (descInput) {
            this.updateCharCounter('descriptionCounter', descInput.value.length, 500);
        }
    }

    async waitForInitialization() {
        if (this.isInitialized) {
            return true;
        }
        return await this.initialize();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
        
        return categories[categoryId] || categoryId;
    }

    async uploadNewVideo(title, description, category, privacy, coverUrl) {
        let videoUrl = '';

        if (this.videoFile) {
            // 优化：在写入前检查存储配额（如果 storageManager 支持）
            if (window.storageManager) {
                try {
                    if (typeof window.storageManager.estimateStorage === 'function') {
                        try {
                            const estimate = await window.storageManager.estimateStorage();
                            if (estimate && estimate.percentage !== undefined && estimate.percentage !== null) {
                                console.log('storage estimate:', estimate);
                                // 如果已使用量超过85%，提示用户
                                if (estimate.percentage > 0.85) {
                                    if (!confirm(`检测到可用存储空间较低 (${Math.round(estimate.percentage * 100)}%)，继续写入大文件可能会失败。是否继续？`)) {
                                        throw new Error('用户取消：存储空间不足');
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('获取存储估算失败，继续写入', e);
                        }
                    }

                    const videoId = 'video_file_' + Date.now();
                    // 重试机制：如果第一次写入失败，允许一次回退/重试决策
                    try {
                        await window.storageManager.initialize().catch(()=>{});
                        await window.storageManager.storeVideo(videoId, this.videoFile);
                        // 验证写入
                        if (window.DEBUG_STORAGE) {
                            try { const rec = await window.storageManager.getVideo(videoId); console.debug('post-store getVideo', rec && { id: rec.id, fileSize: rec?.file?.size }); } catch(e){console.warn(e)}
                        }
                        videoUrl = `indexeddb:${videoId}`;
                        console.log('视频写入 IndexedDB 成功:', videoId);
                    } catch (storeErr) {
                        console.error('首次写入 IndexedDB 失败:', storeErr);
                        // 如果是配额问题或类似，提供回退选择
                        const isQuota = (storeErr && (storeErr.name === 'QuotaExceededError' || (storeErr.message && /quota|storage|disk|exceed/i.test(storeErr.message))));

                        if (isQuota) {
                            const useBlob = confirm('写入 IndexedDB 失败，可能是存储空间不足。点击确定将回退为临时 Blob URL（页面刷新后失效），取消将停止上传。确定回退？');
                            if (useBlob) {
                                videoUrl = window.createObjectURLTracked ? window.createObjectURLTracked(this.videoFile) : URL.createObjectURL(this.videoFile);
                            } else {
                                throw new Error('写入失败（配额），用户取消');
                            }
                        } else {
                            // 非配额错误：询问是否重试一次或回退
                            const retry = confirm('写入 IndexedDB 时发生错误，是否重试？点击确定重试，取消使用临时 Blob URL 回退。');
                            if (retry) {
                                try {
                                    await window.storageManager.storeVideo(videoId + '_r', this.videoFile);
                                    videoUrl = `indexeddb:${videoId}_r`;
                                } catch (rerr) {
                                    console.error('重试写入仍然失败:', rerr);
                                    videoUrl = window.createObjectURLTracked ? window.createObjectURLTracked(this.videoFile) : URL.createObjectURL(this.videoFile);
                                }
                            } else {
                                videoUrl = window.createObjectURLTracked ? window.createObjectURLTracked(this.videoFile) : URL.createObjectURL(this.videoFile);
                            }
                        }
                    }
                } catch (error) {
                    console.error('准备写入 IndexedDB 失败或被取消:', error);
                    // 如果用户取消或预检失败，抛出或回退为 Blob URL
                    if (!videoUrl) {
                        // 如果没有 videoUrl，就回退到 Blob URL，确保上传不会中断
                        videoUrl = window.createObjectURLTracked ? window.createObjectURLTracked(this.videoFile) : URL.createObjectURL(this.videoFile);
                    }
                }
            } else {
                // storageManager 不可用 -> 降级使用 Blob URL（临时）
                videoUrl = window.createObjectURLTracked ? window.createObjectURLTracked(this.videoFile) : URL.createObjectURL(this.videoFile);
            }
        }

        // 获取分类名称
        const categoryName = this.getCategoryName(category);
        
        const videoData = {
            id: 'video_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            title,
            description,
            authorId: this.currentUser.id,
            authorName: this.currentUser.username,
            cover: coverUrl,
            videoUrl: videoUrl,
            views: 0,
            likes: 0,
            likedBy: [],
            comments: [],
            tags: this.tags,
            category: category, // 存储英文分类ID
            categoryName: categoryName, // 存储中文分类名称
            uploadTime: new Date().toISOString(),
            privacy
        };

        console.log('上传视频数据:', {
            title: videoData.title,
            category: videoData.category,
            categoryName: videoData.categoryName
        });

        // 优化：先检查存储空间
        const storageInfo = window.dataManager.checkStorage();
        if (storageInfo.warning) {
            if (!confirm(`存储空间紧张 (${storageInfo.usedMB} MB)，继续上传可能会失败。是否继续？`)) {
                this.setLoadingState(false);
                return;
            }
        }

        const createdVideo = window.dataManager.video.create(videoData);
        if (!createdVideo) {
            throw new Error('创建视频失败');
        }

        // 存储优化
        window.dataManager.optimizeStorage();

        // 更新用户视频列表
        const updatedUser = {
            ...this.currentUser,
            videos: [...(this.currentUser.videos || []), videoData.id]
        };
        
        if (window.authManager && typeof window.authManager.updateUserData === 'function') {
            window.authManager.updateUserData(updatedUser);
        } else {
            window.dataManager.user.update(updatedUser);
        }

        this.showSuccess('视频上传成功！');
        setTimeout(() => {
            window.location.href = 'profile.html';
        }, 1500);
    }

    // 处理图片文件 - 压缩和优化
    async processImageFile(file) {
        return new Promise((resolve) => {
            // 压缩图片以减少存储空间
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    // 设置最大尺寸
                    const maxWidth = 800;
                    const maxHeight = 450;
                    let { width, height } = img;
                    
                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width *= maxHeight / height;
                            height = maxHeight;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // 使用较低的图片质量
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(compressedDataUrl);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }
}

// 全局上传管理器实例
let uploadManager = null;

// 初始化上传管理器
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('初始化 UploadManager...');
        uploadManager = new UploadManager();
        window.uploadManager = uploadManager;
        
        // 等待初始化完成
        await uploadManager.waitForInitialization();
        console.log('UploadManager 初始化成功');
        
    } catch (error) {
        console.error('UploadManager 初始化失败:', error);
        // 创建降级版本
        uploadManager = {
            isInitialized: false,
            waitForInitialization: () => Promise.resolve(false),
            showError: (msg) => alert(msg)
        };
        window.uploadManager = uploadManager;
        
        // 显示错误信息
        alert('上传功能初始化失败，请刷新页面重试');
    }
});