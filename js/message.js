// message.js - 完整修复优化版

// 消息管理系统
class MessageManager {
    constructor() {
        this.currentUser = null;
        this.messages = [];
        this.currentFilter = 'all';
        this.selectedMessage = null;
        this.isInitialized = false;
        this.initPromise = null;
        
        console.log('MessageManager 初始化开始');
        this.initialize();
    }

    // 异步初始化
    async initialize() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise(async (resolve, reject) => {
            try {
                console.log('MessageManager 开始初始化...');
                
                // 等待数据管理器初始化
                if (window.dataManager && typeof window.dataManager.waitForInitialization === 'function') {
                    await window.dataManager.waitForInitialization();
                    console.log('DataManager 已就绪');
                }
                
                // 获取当前用户
                await this.loadCurrentUser();
                
                // 加载消息数据
                await this.loadMessages();
                
                // 设置事件监听器
                this.setupEventListeners();
                
                // 更新UI
                this.updateUI();
                
                this.isInitialized = true;
                console.log('MessageManager 初始化完成');
                resolve(true);
                
            } catch (error) {
                console.error('MessageManager 初始化失败:', error);
                reject(error);
            }
        });

        return this.initPromise;
    }

    // 加载当前用户
    async loadCurrentUser() {
        try {
            // 尝试多种方式获取当前用户
            if (window.authManager && typeof window.authManager.getCurrentUser === 'function') {
                this.currentUser = window.authManager.getCurrentUser();
            } else if (window.currentUser) {
                this.currentUser = window.currentUser;
            } else {
                const savedUser = localStorage.getItem('currentUser');
                this.currentUser = savedUser ? JSON.parse(savedUser) : null;
            }
            
            console.log('当前用户:', this.currentUser ? this.currentUser.username : '未登录');
            
            // 检查登录状态
            if (!this.currentUser && window.location.pathname.includes('message.html')) {
                console.warn('未登录用户访问消息页面，跳转到登录页');
                setTimeout(() => {
                    alert('请先登录！');
                    window.location.href = 'login.html';
                }, 100);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('加载当前用户失败:', error);
            return false;
        }
    }

    // 加载消息数据
    async loadMessages() {
        try {
            console.log('开始加载消息数据...');
            
            // 优先使用 DataManager
            if (window.dataManager && window.dataManager.isInitialized) {
                const messagesData = window.dataManager.folder.getAll('messages');
                this.messages = Array.isArray(messagesData) ? messagesData : [];
                console.log('从 DataManager 加载消息:', this.messages.length);
            } else {
                // 降级到 localStorage
                const savedMessages = localStorage.getItem('messages');
                this.messages = savedMessages ? JSON.parse(savedMessages) : [];
                console.log('从 localStorage 加载消息:', this.messages.length);
            }
            
            // 如果没有消息数据，初始化示例数据
            if (this.messages.length === 0 && this.currentUser) {
                await this.initSampleMessages();
            }
            
            return true;
        } catch (error) {
            console.error('加载消息数据失败:', error);
            this.messages = [];
            return false;
        }
    }

    // 保存消息数据
    async saveMessages() {
        try {
            console.log('保存消息数据:', this.messages.length);
            
            // 优先使用 DataManager
            if (window.dataManager && window.dataManager.isInitialized) {
                const result = window.dataManager.folder.save('messages', this.messages);
                if (result) {
                    console.log('消息数据已保存到 DataManager');
                    return true;
                }
            }
            
            // 降级到 localStorage
            localStorage.setItem('messages', JSON.stringify(this.messages));
            console.log('消息数据已保存到 localStorage');
            return true;
            
        } catch (error) {
            console.error('保存消息数据失败:', error);
            return false;
        }
    }

    // 初始化示例消息
    async initSampleMessages() {
        try {
            console.log('初始化示例消息数据...');
            
            const sampleMessages = [
                {
                    id: 'msg_1',
                    type: 'system',
                    senderId: 'system',
                    senderName: '系统通知',
                    recipientId: this.currentUser.id,
                    content: '欢迎使用StreamFlix消息系统！您可以在这里查看点赞、评论、@提及等通知。',
                    timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
                    read: true,
                    relatedItem: null
                },
                {
                    id: 'msg_2',
                    type: 'like',
                    senderId: 'user_2',
                    senderName: 'video_creator',
                    recipientId: this.currentUser.id,
                    content: '点赞了您的视频',
                    timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
                    read: false,
                        relatedItem: {
                        type: 'video',
                        id: 'video_1',
                        title: '欢迎来到StreamFlix',
                        cover: 'assets/demoCover.png',
                        authorName: this.currentUser.username
                    }
                },
                {
                    id: 'msg_3',
                    type: 'comment',
                    senderId: 'user_2',
                    senderName: 'video_creator',
                    recipientId: this.currentUser.id,
                    content: '在您的视频中评论：很棒的视频！继续加油！',
                    timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
                    read: false,
                        relatedItem: {
                        type: 'video',
                        id: 'video_1',
                        title: '欢迎来到StreamFlix',
                        cover: 'assets/demoCover.png',
                        authorName: this.currentUser.username
                    }
                },
                {
                    id: 'msg_4',
                    type: 'mention',
                    senderId: 'user_2',
                    senderName: 'video_creator',
                    recipientId: this.currentUser.id,
                    content: '在动态中提到了您：快来看看这个有趣的视频！@' + this.currentUser.username,
                    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
                    read: false,
                    relatedItem: {
                        type: 'dynamic',
                        id: 'dynamic_1',
                        content: '分享了一个超棒的视频教程，快来学习吧！@' + this.currentUser.username
                    }
                }
            ];

            this.messages = sampleMessages;
            await this.saveMessages();
            console.log('示例消息数据初始化完成');
            
        } catch (error) {
            console.error('初始化示例消息失败:', error);
        }
    }

    // 等待初始化完成
    async waitForInitialization() {
        if (this.isInitialized) {
            return true;
        }
        return await this.initialize();
    }

    // 更新UI
    updateUI() {
        if (!this.currentUser) {
            console.warn('未登录用户，跳过UI更新');
            return;
        }

        this.displayMessages();
        this.updateUnreadCounts();
        this.updateFilterTabs();
    }

    // 显示消息列表
    displayMessages() {
        const messageList = document.getElementById('messageList');
        const emptyMessages = document.getElementById('emptyMessages');

        if (!messageList || !emptyMessages) {
            console.warn('消息列表DOM元素未找到');
            return;
        }

        // 过滤当前用户的消息
        const userMessages = this.getUserMessages();
        
        // 按类型过滤
        let filteredMessages = userMessages;
        if (this.currentFilter !== 'all') {
            filteredMessages = userMessages.filter(msg => msg.type === this.currentFilter);
        }

        if (filteredMessages.length === 0) {
            messageList.style.display = 'none';
            emptyMessages.style.display = 'block';
            return;
        }

        messageList.style.display = 'block';
        emptyMessages.style.display = 'none';

        // 按时间排序（最新的在前面）
        filteredMessages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        messageList.innerHTML = filteredMessages.map(message => `
            <div class="message-item ${message.read ? '' : 'unread'}" data-message-id="${message.id}">
                <div class="message-header">
                    <div class="message-meta">
                        <span class="message-type ${message.type}">${this.getMessageTypeText(message.type)}</span>
                        <span class="message-sender">${this.escapeHtml(message.senderName || '系统')}</span>
                    </div>
                    <div class="message-time">${this.formatTime(message.timestamp)}</div>
                </div>
                <div class="message-content-preview">${this.escapeHtml(message.content)}</div>
                ${message.relatedItem ? '<div class="message-has-attachment">📎</div>' : ''}
            </div>
        `).join('');

        // 添加点击事件
        this.attachMessageItemEvents();
    }

    // 获取当前用户的消息
    getUserMessages() {
        return this.messages.filter(msg => 
            msg.recipientId === this.currentUser.id || 
            (msg.type === 'system' && !msg.recipientId) ||
            msg.recipientId === 'all' // 系统广播消息
        );
    }

    // 附加消息项事件
    attachMessageItemEvents() {
        const messageList = document.getElementById('messageList');
        if (!messageList) return;

        messageList.querySelectorAll('.message-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const messageId = item.dataset.messageId;
                this.showMessageDetail(messageId);
            });
        });
    }

    // 显示消息详情
    async showMessageDetail(messageId) {
        await this.waitForInitialization();
        
        const message = this.messages.find(msg => msg.id === messageId);
        if (!message) {
            console.error('消息未找到:', messageId);
            return;
        }

        this.selectedMessage = message;

        // 标记为已读
        if (!message.read) {
            message.read = true;
            await this.saveMessages();
            this.updateUnreadCounts();
            
            // 触发消息更新事件
            this.triggerMessagesUpdated();
        }

        this.showMessageDetailView(message);
    }

    // 显示消息详情视图
    showMessageDetailView(message) {
        const messageListView = document.getElementById('messageListView');
        const messageDetailView = document.getElementById('messageDetailView');
        
        if (messageListView) messageListView.style.display = 'none';
        if (messageDetailView) {
            messageDetailView.style.display = 'block';
            messageDetailView.classList.add('active');
        }

        const detailContent = document.getElementById('messageDetailContent');
        if (detailContent) {
            detailContent.innerHTML = this.createMessageDetailHTML(message);
        }
    }

    // 创建消息详情HTML
    createMessageDetailHTML(message) {
        return `
            <div class="message-detail-content">
                <div class="message-header">
                    <div class="message-meta">
                        <span class="message-type ${message.type}">${this.getMessageTypeText(message.type)}</span>
                        <span class="message-sender">${this.escapeHtml(message.senderName || '系统')}</span>
                    </div>
                    <div class="message-time">${this.formatTime(message.timestamp)}</div>
                </div>
                
                <div class="message-content">${this.escapeHtml(message.content)}</div>
                
                ${message.relatedItem ? `
                    <div class="related-item">
                        <div class="related-item-label">相关内容：</div>
                        ${this.getRelatedItemPreview(message.relatedItem)}
                    </div>
                ` : ''}
                
                <div class="message-actions">
                    ${this.canReplyToMessage(message) ? `
                        <button class="btn btn-primary" onclick="messageManager.replyToMessage('${message.id}')">
                            <i class="icon-reply"></i> 回复
                        </button>
                    ` : ''}
                    <button class="btn btn-danger" onclick="messageManager.deleteMessage('${message.id}')">
                        <i class="icon-delete"></i> 删除
                    </button>
                    <button class="btn btn-secondary" onclick="messageManager.showMessageList()">
                        <i class="icon-back"></i> 返回列表
                    </button>
                </div>
            </div>
        `;
    }

    // 检查是否可以回复消息
    canReplyToMessage(message) {
        return message.senderId && 
               message.senderId !== this.currentUser.id && 
               message.senderId !== 'system' &&
               message.type !== 'system';
    }

    // 显示消息列表视图
    showMessageList() {
        const messageDetailView = document.getElementById('messageDetailView');
        const messageListView = document.getElementById('messageListView');
        
        if (messageDetailView) {
            messageDetailView.style.display = 'none';
            messageDetailView.classList.remove('active');
        }
        if (messageListView) messageListView.style.display = 'block';
        
        this.displayMessages();
    }

    // 获取消息类型文本
    getMessageTypeText(type) {
        const typeMap = {
            'like': '👍 点赞',
            'comment': '💬 评论',
            'mention': '@ 提及',
            'system': '🔔 系统',
            'reply': '↩️ 回复',
            'follow': '👤 关注'
        };
        return typeMap[type] || type;
    }

    // 获取相关项目预览
    getRelatedItemPreview(relatedItem) {
        if (!relatedItem) return '';

        switch (relatedItem.type) {
            case 'video':
                return `
                    <div class="related-video" onclick="messageManager.openRelatedVideo('${relatedItem.id}')">
                        <img src="${relatedItem.cover}" alt="视频封面" class="related-video-cover"
                             onerror="this.src='assets/default-cover.png'">
                        <div class="related-video-info">
                            <div class="related-video-title">${this.escapeHtml(relatedItem.title)}</div>
                            <div class="related-video-author">${this.escapeHtml(relatedItem.authorName)}</div>
                        </div>
                    </div>
                `;
                
            case 'dynamic':
                return `
                    <div class="related-dynamic">
                        <div class="related-dynamic-content">${this.escapeHtml(relatedItem.content)}</div>
                    </div>
                `;
                
            case 'comment':
                return `
                    <div class="related-comment">
                        <div class="related-comment-content">${this.escapeHtml(relatedItem.content)}</div>
                    </div>
                `;
                
            default:
                return '';
        }
    }

    // 打开相关视频
    openRelatedVideo(videoId) {
        console.log('打开视频:', videoId);
        // 这里可以跳转到视频页面或打开视频模态框
        if (window.videoManager) {
            window.videoManager.playVideo(videoId);
        } else {
            window.location.href = `video.html?id=${videoId}`;
        }
    }

    // 格式化时间
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
        } else if (diff < 604800000) {
            return `${Math.floor(diff / 86400000)}天前`;
        } else {
            return time.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        }
    }

    // 设置事件监听器
    setupEventListeners() {
        // 消息标签切换
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('message-tab')) {
                const type = e.target.dataset.type;
                this.switchFilter(type);
            }
        });

        // 监听认证状态变化
        window.addEventListener('authStateChanged', (e) => {
            console.log('检测到认证状态变化');
            this.currentUser = e.detail.user;
            if (this.currentUser) {
                this.loadMessages().then(() => this.updateUI());
            } else {
                this.messages = [];
                this.updateUI();
            }
        });

        // 监听全局消息更新事件
        window.addEventListener('globalMessagesUpdated', () => {
            console.log('收到全局消息更新事件');
            this.loadMessages().then(() => this.updateUI());
        });

        // 页面可见性变化时刷新消息
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.loadMessages().then(() => this.updateUI());
            }
        });

        // 定期刷新消息（每5分钟）
        setInterval(() => {
            if (this.currentUser && document.visibilityState === 'visible') {
                this.loadMessages().then(() => this.updateUI());
            }
        }, 5 * 60 * 1000);
    }

    // 更新过滤器标签
    updateFilterTabs() {
        document.querySelectorAll('.message-tab').forEach(tab => {
            const type = tab.dataset.type;
            tab.classList.toggle('active', type === this.currentFilter);
        });
    }

    // 切换过滤器
    switchFilter(type) {
        this.currentFilter = type;
        this.updateFilterTabs();
        this.displayMessages();
    }

    // 更新未读消息数量
    updateUnreadCounts() {
        if (!this.currentUser) return;

        const userMessages = this.getUserMessages();
        const counts = {
            'all': userMessages.filter(msg => !msg.read).length,
            'like': userMessages.filter(msg => msg.type === 'like' && !msg.read).length,
            'comment': userMessages.filter(msg => msg.type === 'comment' && !msg.read).length,
            'mention': userMessages.filter(msg => msg.type === 'mention' && !msg.read).length,
            'system': userMessages.filter(msg => msg.type === 'system' && !msg.read).length
        };

        // 更新未读徽章
        Object.keys(counts).forEach(type => {
            const badge = document.getElementById(`${type}UnreadCount`);
            if (badge) {
                if (counts[type] > 0) {
                    badge.textContent = counts[type] > 99 ? '99+' : counts[type];
                    badge.style.display = 'inline';
                } else {
                    badge.style.display = 'none';
                }
            }
        });

        // 更新标题未读计数
        this.updateTitleUnreadCount(counts.all);
    }

    // 更新标题未读计数
    updateTitleUnreadCount(unreadCount) {
        const originalTitle = document.title.replace(/^\(\d+\)\s*/, '');
        if (unreadCount > 0) {
            document.title = `(${unreadCount}) ${originalTitle}`;
        } else {
            document.title = originalTitle;
        }
    }

    // 回复消息
    async replyToMessage(messageId) {
        await this.waitForInitialization();
        
        const message = this.messages.find(msg => msg.id === messageId);
        if (!message || !message.senderId) return;

        const replyContent = prompt(`回复 ${message.senderName}：`);
        if (replyContent && replyContent.trim()) {
            const replyMessage = {
                id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                type: 'reply',
                senderId: this.currentUser.id,
                senderName: this.currentUser.username,
                recipientId: message.senderId,
                content: replyContent.trim(),
                timestamp: new Date().toISOString(),
                read: false,
                relatedItem: {
                    type: 'original',
                    content: message.content,
                    originalMessageId: message.id
                }
            };

            this.messages.push(replyMessage);
            await this.saveMessages();
            
            alert('回复发送成功！');
            this.showMessageList();
            
            // 触发消息更新事件
            this.triggerMessagesUpdated();
        }
    }

    // 删除消息
    async deleteMessage(messageId) {
        if (!confirm('确定要删除这条消息吗？')) return;

        this.messages = this.messages.filter(msg => msg.id !== messageId);
        await this.saveMessages();
        this.showMessageList();
        
        // 触发消息更新事件
        this.triggerMessagesUpdated();
    }

    // 创建新消息（供其他模块调用）
    async createMessage(messageData) {
        await this.waitForInitialization();
        
        const newMessage = {
            id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            read: false,
            ...messageData
        };

        this.messages.push(newMessage);
        await this.saveMessages();
        
        // 触发消息更新事件
        this.triggerMessagesUpdated();
        
        return newMessage;
    }

    // 触发消息更新事件
    triggerMessagesUpdated() {
        const event = new CustomEvent('messagesUpdated', {
            detail: { messages: this.messages }
        });
        window.dispatchEvent(event);
        
        // 同时触发全局消息更新事件
        const globalEvent = new CustomEvent('globalMessagesUpdated');
        window.dispatchEvent(globalEvent);
    }

    // 获取未读消息数量
    getUnreadCount() {
        if (!this.currentUser) return 0;
        return this.getUserMessages().filter(msg => !msg.read).length;
    }

    // 标记所有消息为已读
    async markAllAsRead() {
        this.getUserMessages().forEach(msg => {
            msg.read = true;
        });
        
        await this.saveMessages();
        this.updateUnreadCounts();
        this.displayMessages();
        
        // 触发消息更新事件
        this.triggerMessagesUpdated();
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

    // 销毁清理
    destroy() {
        this.isInitialized = false;
        this.initPromise = null;
        console.log('MessageManager 已销毁');
    }
}

// 全局消息管理器实例
let messageManager = null;

// 初始化消息管理器
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('初始化 MessageManager...');
        messageManager = new MessageManager();
        window.messageManager = messageManager;
        
        // 等待初始化完成
        await messageManager.waitForInitialization();
        console.log('MessageManager 初始化成功');
        
    } catch (error) {
        console.error('MessageManager 初始化失败:', error);
        // 创建降级版本
        messageManager = {
            isInitialized: false,
            waitForInitialization: () => Promise.resolve(false),
            getUnreadCount: () => 0,
            createMessage: () => Promise.resolve(null)
        };
        window.messageManager = messageManager;
    }
});

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MessageManager;
}