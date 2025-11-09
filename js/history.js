// 历史记录管理系统 - 修复版
class HistoryManager {
    constructor() {
        // 等待必要依赖加载
        if (typeof dataManager === 'undefined') {
            console.error('DataManager not found');
            return;
        }
        if (typeof authManager === 'undefined') {
            console.error('AuthManager not found');
            return;
        }
        
        this.currentUser = authManager.getCurrentUser();
        this.currentFilter = 'all';
        this.editMode = false;
        
        this.init();
    }

    init() {
        if (!this.currentUser && currentPage.includes('history.html')) {
            alert('请先登录！');
            window.location.href = 'login.html';
            return;
        }

        this.loadHistory();
        this.setupEventListeners();
    }

    // 加载历史记录
    loadHistory() {
        try {
            // 使用 dataManager 获取历史记录
            let userHistory = dataManager.history.getByUser(this.currentUser.id);

            // 按时间过滤
            userHistory = this.filterByTime(userHistory);

            this.displayHistory(userHistory);
            this.updateStats(userHistory.length);
        } catch (error) {
            console.error('加载历史记录失败:', error);
            this.showError('加载历史记录失败');
        }
    }

    // 按时间过滤
    filterByTime(history) {
        const now = new Date();
        
        switch (this.currentFilter) {
            case 'today':
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                return history.filter(item => new Date(item.watchTime) >= today);
            case 'week':
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return history.filter(item => new Date(item.watchTime) >= weekAgo);
            case 'month':
                const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                return history.filter(item => new Date(item.watchTime) >= monthAgo);
            default:
                return history;
        }
    }

    // 显示历史记录
    displayHistory(history) {
        const historyList = document.getElementById('historyList');
        const emptyHistory = document.getElementById('emptyHistory');

        if (!historyList || !emptyHistory) return;

        if (history.length === 0) {
            historyList.style.display = 'none';
            emptyHistory.style.display = 'block';
            return;
        }

        historyList.style.display = 'block';
        emptyHistory.style.display = 'none';

        // 按观看时间排序（最新的在前面）
        history.sort((a, b) => new Date(b.watchTime) - new Date(a.watchTime));

        historyList.innerHTML = history.map(item => {
            // 获取视频信息
            const video = dataManager.video.getById(item.videoId);
            if (!video) return ''; // 如果视频不存在，跳过
            
            return `
                <div class="history-item" data-video-id="${item.videoId}">
                    <img src="${video.cover}" alt="${video.title}" class="history-thumbnail" 
                         onerror="this.src='assets/demoCover.png'">
                    <div class="history-content">
                        <div class="history-title">${this.escapeHtml(video.title)}</div>
                        <div class="history-meta">
                            <span>${video.authorName}</span>
                            <span>•</span>
                            <span>${this.formatTime(item.watchTime)}</span>
                        </div>
                        <div class="history-progress">
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${item.progress || 0}%"></div>
                            </div>
                            <div class="progress-text">
                                ${this.formatProgress(item.progress || 0)}
                            </div>
                        </div>
                    </div>
                    ${this.editMode ? `
                        <div class="history-actions-item">
                            <button class="history-delete" onclick="historyManager.deleteHistoryItem('${item.videoId}')">🗑️</button>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        // 添加点击事件
        historyList.querySelectorAll('.history-item').forEach(item => {
            const videoId = item.dataset.videoId;
            const thumbnail = item.querySelector('.history-thumbnail');
            const title = item.querySelector('.history-title');
            
            if (thumbnail) {
                thumbnail.addEventListener('click', () => this.playVideo(videoId));
            }
            if (title) {
                title.addEventListener('click', () => this.playVideo(videoId));
            }
        });
    }

    // 更新统计信息
    updateStats(count) {
        const historyCount = document.getElementById('historyCount');
        if (historyCount) {
            historyCount.textContent = count;
        }
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
        } else if (diff < 604800000) { // 1周内
            return `${Math.floor(diff / 86400000)}天前`;
        } else {
            return time.toLocaleDateString();
        }
    }

    // 格式化进度
    formatProgress(progress) {
        if (progress >= 90) {
            return '已看完';
        } else if (progress === 0) {
            return '未观看';
        } else {
            return `${Math.round(progress)}%`;
        }
    }

    // 设置事件监听器
    setupEventListeners() {
        // 过滤器切换
        document.querySelectorAll('.history-filter').forEach(filter => {
            filter.addEventListener('click', (e) => {
                const filterType = e.target.dataset.filter;
                if (filterType) {
                    this.switchFilter(filterType);
                }
            });
        });

        // 编辑模式切换
        const editBtn = document.getElementById('editModeBtn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.toggleEditMode();
            });
        }

        // 清空历史按钮
        const clearBtn = document.getElementById('clearHistoryBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearAllHistory();
            });
        }
    }

    // 切换过滤器
    switchFilter(filterType) {
        this.currentFilter = filterType;
        
        // 更新活跃过滤器
        document.querySelectorAll('.history-filter').forEach(filter => {
            filter.classList.remove('active');
        });
        const activeFilter = document.querySelector(`[data-filter="${filterType}"]`);
        if (activeFilter) {
            activeFilter.classList.add('active');
        }

        this.loadHistory();
    }

    // 切换编辑模式
    toggleEditMode() {
        this.editMode = !this.editMode;
        const editBtn = document.getElementById('editModeBtn');
        if (editBtn) {
            editBtn.textContent = this.editMode ? '完成' : '编辑';
        }
        
        this.loadHistory();
    }

    // 播放视频
    playVideo(videoId) {
        // 更新观看进度
        this.updateWatchProgress(videoId, 0); // 开始观看，进度设为0
        
        // 跳转到视频播放页面
        window.location.href = `video-play.html?id=${videoId}`;
    }

    // 更新观看进度
    updateWatchProgress(videoId, progress) {
        if (!this.currentUser) return;
        
        dataManager.history.add({
            userId: this.currentUser.id,
            videoId: videoId,
            progress: progress
        });
    }

    // 删除历史记录项
    deleteHistoryItem(videoId) {
        dataManager.history.deleteByVideo(this.currentUser.id, videoId);
        this.loadHistory();
    }

    // 清空历史记录
    clearAllHistory() {
        if (confirm('确定要清空所有观看历史吗？此操作不可恢复。')) {
            dataManager.history.deleteByUser(this.currentUser.id);
            this.loadHistory();
        }
    }

    // 显示错误
    showError(message) {
        const historyList = document.getElementById('historyList');
        const emptyHistory = document.getElementById('emptyHistory');
        
        if (historyList && emptyHistory) {
            historyList.style.display = 'none';
            emptyHistory.style.display = 'block';
            emptyHistory.innerHTML = `<p>${message}</p>`;
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

// 初始化历史记录管理器
let historyManager;
document.addEventListener('DOMContentLoaded', () => {
    historyManager = new HistoryManager();
    window.historyManager = historyManager;
});