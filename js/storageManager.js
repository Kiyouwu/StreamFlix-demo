// storageManager.js - 修复版（确保全局可用）
class StorageManager {
    constructor() {
        this.dbName = 'VideoStorageDB';
        // bump DB version to add 'chunks' object store for large file chunks
        this.dbVersion = 2;
        this.db = null;
        this.isInitialized = false;
        this.initPromise = null;
        this.isSupported = this.checkIndexedDBSupport();
        
        console.log('StorageManager 构造函数调用，支持状态:', this.isSupported);
    }

    checkIndexedDBSupport() {
        try {
            return !!(window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB);
        } catch (e) {
            console.warn('IndexedDB 不支持:', e);
            return false;
        }
    }

    async initialize() {
        if (!this.isSupported) {
            throw new Error('浏览器不支持 IndexedDB');
        }

        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise((resolve, reject) => {
            console.log('开始初始化 IndexedDB...');
            
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('IndexedDB 打开失败:', request.error);
                reject(new Error(`无法打开数据库: ${request.error?.message || '未知错误'}`));
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isInitialized = true;
                console.log('IndexedDB 初始化成功');
                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 创建视频存储对象库
                if (!db.objectStoreNames.contains('videos')) {
                    const videoStore = db.createObjectStore('videos', { keyPath: 'id' });
                    videoStore.createIndex('authorId', 'authorId', { unique: false });
                    videoStore.createIndex('uploadTime', 'uploadTime', { unique: false });
                    console.log('创建视频对象库');
                }
                
                // 创建图片存储对象库
                if (!db.objectStoreNames.contains('images')) {
                    const imageStore = db.createObjectStore('images', { keyPath: 'id' });
                    console.log('创建图片对象库');
                }
                
                // 创建分片存储对象库（用于大文件分片存储）
                if (!db.objectStoreNames.contains('chunks')) {
                    // keyPath 为 id（例如 largeid_chunkIndex）
                    const chunkStore = db.createObjectStore('chunks', { keyPath: 'id' });
                    // 可以按关联的 largeId 创建索引
                    chunkStore.createIndex('largeId', 'largeId', { unique: false });
                    console.log('创建 chunks 对象库（用于分片）');
                }
                
                console.log('IndexedDB 数据库升级完成');
            };
        });

        return this.initPromise;
    }

    // 存储视频文件
    async storeVideo(videoId, videoFile) {
        if (!this.isSupported) {
            throw new Error('浏览器不支持 IndexedDB');
        }

        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['videos'], 'readwrite');
            const store = transaction.objectStore('videos');
            
            const videoData = {
                id: videoId,
                file: videoFile,
                uploadTime: new Date().toISOString()
            };
            
            // 使用 put 以支持更新同 id 的记录（避免 add 在键存在时失败）
            const request = store.put(videoData);
            
            request.onsuccess = () => {
                console.log('视频文件存储成功:', videoId);
                resolve(true);
            };
            
            request.onerror = () => {
                console.error('视频文件存储失败:', request.error);
                reject(new Error(`存储失败: ${request.error?.message || '未知错误'}`));
            };
        });
    }

    // 获取视频文件
    async getVideo(videoId) {
        if (!this.isSupported) {
            throw new Error('浏览器不支持 IndexedDB');
        }

        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['videos'], 'readonly');
            const store = transaction.objectStore('videos');
            
            const request = store.get(videoId);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error(`获取失败: ${request.error?.message || '未知错误'}`));
            };
        });
    }

    // 存储图片文件
    async storeImage(imageId, imageFile) {
        if (!this.isSupported) {
            throw new Error('浏览器不支持 IndexedDB');
        }

        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');
            
            const imageData = {
                id: imageId,
                file: imageFile,
                uploadTime: new Date().toISOString()
            };
            
            // 使用 put 以支持更新同 id 的记录（避免 add 在键存在时失败）
            const request = store.put(imageData);
            
            request.onsuccess = () => {
                console.log('图片文件存储成功:', imageId);
                resolve(true);
            };
            
            request.onerror = () => {
                console.error('图片文件存储失败:', request.error);
                reject(new Error(`存储失败: ${request.error?.message || '未知错误'}`));
            };
        });
    }

    // 获取图片文件
    async getImage(imageId) {
        if (!this.isSupported) {
            throw new Error('浏览器不支持 IndexedDB');
        }

        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['images'], 'readonly');
            const store = transaction.objectStore('images');
            
            const request = store.get(imageId);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error(`获取失败: ${request.error?.message || '未知错误'}`));
            };
        });
    }

    // 删除图片文件
    async deleteImage(imageId) {
        if (!this.isSupported) {
            throw new Error('浏览器不支持 IndexedDB');
        }

        await this.initialize();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['images'], 'readwrite');
            const store = transaction.objectStore('images');

            const request = store.delete(imageId);

            request.onsuccess = () => {
                console.log('图片文件删除成功:', imageId);
                resolve(true);
            };

            request.onerror = () => {
                console.error('图片文件删除失败:', request.error);
                reject(new Error(`删除失败: ${request.error?.message || '未知错误'}`));
            };
        });
    }

    // 删除视频文件
    async deleteVideo(videoId) {
        if (!this.isSupported) {
            throw new Error('浏览器不支持 IndexedDB');
        }

        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['videos'], 'readwrite');
            const store = transaction.objectStore('videos');
            
            const request = store.delete(videoId);
            
            request.onsuccess = () => {
                console.log('视频文件删除成功:', videoId);
                resolve(true);
            };
            
            request.onerror = () => {
                console.error('视频文件删除失败:', request.error);
                reject(new Error(`删除失败: ${request.error?.message || '未知错误'}`));
            };
        });
    }

    // 存储大文件（分片）。返回 true/throw
    async storeLargeFile(largeId, file, chunkSize = 5 * 1024 * 1024) {
        if (!this.isSupported) throw new Error('浏览器不支持 IndexedDB');
        if (!file || typeof file.size !== 'number') throw new Error('file 必须为 Blob/File');

        await this.initialize();

        const total = file.size;
        const chunks = Math.ceil(total / chunkSize);

        // 读取或创建 manifest（用于记录已写入的 chunkIds）
        let manifest = await new Promise((resolve, reject) => {
            const tx = this.db.transaction(['videos'], 'readonly');
            const store = tx.objectStore('videos');
            const req = store.get(largeId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error || new Error('获取 manifest 失败'));
        });

        if (!manifest) {
            manifest = { id: largeId, isLarge: true, chunkIds: [], size: total, type: file.type, uploadTime: new Date().toISOString() };
            // 写入初始 manifest
            await new Promise((resolve, reject) => {
                const tx = this.db.transaction(['videos'], 'readwrite');
                const store = tx.objectStore('videos');
                const req = store.put(manifest);
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error || new Error('manifest 写入失败'));
            });
        }

        // 遍历每个 chunk，检查是否已存在，支持从中断处继续
        for (let i = 0; i < chunks; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, total);
            const blob = file.slice(start, end);
            const id = `${largeId}_chunk_${i}`;

            // 如果 manifest 已记录该 chunk，则跳过
            if (manifest.chunkIds && manifest.chunkIds.includes(id)) {
                // 已存在，跳过
                continue;
            }

            // 检查 chunk 是否已在 DB 中（防止 manifest 不一致）
            const exists = await new Promise((resolve) => {
                const tx = this.db.transaction(['chunks'], 'readonly');
                const store = tx.objectStore('chunks');
                const req = store.get(id);
                req.onsuccess = () => resolve(!!req.result);
                req.onerror = () => resolve(false);
            });

            if (exists) {
                // 将 id 加入 manifest（修复不一致）
                manifest.chunkIds.push(id);
                await new Promise((resolve, reject) => {
                    const tx = this.db.transaction(['videos'], 'readwrite');
                    const store = tx.objectStore('videos');
                    const req = store.put(manifest);
                    req.onsuccess = () => resolve(true);
                    req.onerror = () => reject(req.error || new Error('manifest 更新失败'));
                });
                continue;
            }

            // 写入 chunk
            await new Promise((resolve, reject) => {
                const tx = this.db.transaction(['chunks'], 'readwrite');
                const store = tx.objectStore('chunks');
                const data = { id, largeId, index: i, file: blob, size: blob.size };
                const req = store.put(data);
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error || new Error('chunk 写入失败'));
            });

            // 立即更新 manifest（便于断点续传）
            manifest.chunkIds.push(id);
            await new Promise((resolve, reject) => {
                const tx = this.db.transaction(['videos'], 'readwrite');
                const store = tx.objectStore('videos');
                const req = store.put(manifest);
                req.onsuccess = () => resolve(true);
                req.onerror = () => reject(req.error || new Error('manifest 更新失败'));
            });
        }

        return true;
    }

    // 从分片构建大文件并返回 { id, file: Blob, type }
    async getLargeFile(largeId) {
        if (!this.isSupported) throw new Error('浏览器不支持 IndexedDB');
        await this.initialize();

        // 读取 manifest
        const manifest = await new Promise((resolve, reject) => {
            const tx = this.db.transaction(['videos'], 'readonly');
            const store = tx.objectStore('videos');
            const req = store.get(largeId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error || new Error('获取 manifest 失败'));
        });

        if (!manifest || !manifest.isLarge || !Array.isArray(manifest.chunkIds)) {
            throw new Error('未找到对应的大文件 manifest');
        }

        // 逐个读取 chunk
        const blobs = [];
        for (let i = 0; i < manifest.chunkIds.length; i++) {
            const cid = manifest.chunkIds[i];
            const rec = await new Promise((resolve, reject) => {
                const tx = this.db.transaction(['chunks'], 'readonly');
                const store = tx.objectStore('chunks');
                const req = store.get(cid);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => reject(req.error || new Error('获取 chunk 失败'));
            });

            if (!rec || !rec.file) throw new Error('缺失分片 ' + cid);
            blobs.push(rec.file);
        }

        const blob = new Blob(blobs, { type: manifest.type || 'application/octet-stream' });
        return { id: largeId, file: blob, type: manifest.type, size: manifest.size };
    }

    // 查询分片上传进度（返回已写入 chunk 数量与总 chunk 数）
    async getLargeUploadProgress(largeId, chunkSize = 5 * 1024 * 1024) {
        if (!this.isSupported) throw new Error('浏览器不支持 IndexedDB');
        await this.initialize();

        const manifest = await new Promise((resolve, reject) => {
            const tx = this.db.transaction(['videos'], 'readonly');
            const store = tx.objectStore('videos');
            const req = store.get(largeId);
            req.onsuccess = () => resolve(req.result || null);
            req.onerror = () => reject(req.error || new Error('获取 manifest 失败'));
        });

        if (!manifest) return { exists: false, uploadedChunks: 0, totalChunks: 0 };
        const totalChunks = Math.ceil((manifest.size || 0) / chunkSize);
        const uploadedChunks = Array.isArray(manifest.chunkIds) ? manifest.chunkIds.length : 0;
        return { exists: true, uploadedChunks, totalChunks, size: manifest.size, type: manifest.type };
    }

    // 删除大文件（manifest + 所有 chunk）
    async deleteLargeFile(largeId) {
        if (!this.isSupported) throw new Error('浏览器不支持 IndexedDB');
        await this.initialize();

        const manifest = await this.getVideo(largeId).catch(() => null);
        if (manifest && manifest.chunkIds && manifest.chunkIds.length) {
            for (const cid of manifest.chunkIds) {
                await new Promise((resolve) => {
                    const tx = this.db.transaction(['chunks'], 'readwrite');
                    const store = tx.objectStore('chunks');
                    const req = store.delete(cid);
                    req.onsuccess = () => resolve(true);
                    req.onerror = () => resolve(false);
                });
            }
        }

        // 删除 manifest
        return this.deleteVideo(largeId);
    }

    // 获取用户的所有视频
    async getVideosByUser(userId) {
        if (!this.isSupported) {
            throw new Error('浏览器不支持 IndexedDB');
        }

        await this.initialize();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['videos'], 'readonly');
            const store = transaction.objectStore('videos');
            const index = store.index('authorId');
            
            const request = index.getAll(userId);
            
            request.onsuccess = () => {
                resolve(request.result);
            };
            
            request.onerror = () => {
                reject(new Error(`查询失败: ${request.error?.message || '未知错误'}`));
            };
        });
    }

    // 获取所有存储的视频记录（管理用途）
    async getAllVideos() {
        if (!this.isSupported) {
            throw new Error('浏览器不支持 IndexedDB');
        }

        await this.initialize();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['videos'], 'readonly');
            const store = transaction.objectStore('videos');
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(new Error(`获取所有视频失败: ${request.error?.message || '未知错误'}`));
            };
        });
    }

    // 估算剩余存储空间
    async estimateStorage() {
        if (!navigator.storage || !navigator.storage.estimate) {
            return { available: null, used: null };
        }
        
        try {
            const estimate = await navigator.storage.estimate();
            return {
                available: estimate.quota,
                used: estimate.usage,
                percentage: estimate.usage / estimate.quota
            };
        } catch (error) {
            console.error('存储空间估算失败:', error);
            return { available: null, used: null };
        }
    }

    // 检查数据库是否支持
    getSupportStatus() {
        return {
            supported: this.isSupported,
            initialized: this.isInitialized
        };
    }
}

// 确保全局可用 - 修复版本
(function() {
    console.log('开始加载 StorageManager...');
    
        try {
        // 创建全局实例
        const storageManager = new StorageManager();
        
        // 确保全局可用
        window.StorageManager = StorageManager;
        window.storageManager = storageManager;
        
        console.log('StorageManager 创建成功，支持状态:', storageManager.getSupportStatus());

        // 尝试自动初始化以便尽早发现问题
        storageManager.initialize().then(() => {
            console.log('StorageManager 自动初始化成功');
        }).catch(err => {
            console.warn('StorageManager 自动初始化失败（可降级）:', err);
        });
        
    } catch (error) {
        console.error('StorageManager 创建失败:', error);
        
        // 创建降级版本
        const fallbackStorageManager = {
            isSupported: false,
            isInitialized: false,
            initialize: () => Promise.reject(new Error('存储管理器不可用')),
            getVideo: () => Promise.reject(new Error('存储管理器不可用')),
            storeVideo: () => Promise.reject(new Error('存储管理器不可用')),
            getSupportStatus: () => ({ supported: false, initialized: false })
        };
        
        window.StorageManager = class {
            constructor() {
                return fallbackStorageManager;
            }
        };
        window.storageManager = fallbackStorageManager;
        
        console.log('使用降级 StorageManager');
    }
})();