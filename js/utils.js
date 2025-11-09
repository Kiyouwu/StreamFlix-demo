// utils.js - 小型工具集（全局）
(function(window){
    'use strict';

    /**
     * 安全的 JSON.parse 封装。
     * 如果解析失败或输入为空，返回 fallback（默认为 null）。
     * 用法： safeJsonParse(str, [])
     */
    function safeJsonParse(str, fallback = null) {
        if (str === null || typeof str === 'undefined') return fallback;
        if (typeof str !== 'string') return fallback;
        try {
            return JSON.parse(str);
        } catch (e) {
            console.warn('safeJsonParse: parse failed, returning fallback', e);
            return fallback;
        }
    }

    // 暴露到全局，便于现有脚本调用
    window.safeJsonParse = safeJsonParse;

})(window);

// object URL 注册与受管控的 createObjectURL
(function(window){
    if (!window.__objectUrls) window.__objectUrls = [];

    function createObjectURLTracked(file) {
        try {
            const url = URL.createObjectURL(file);
            window.__objectUrls.push(url);
            return url;
        } catch (e) {
            console.warn('createObjectURLTracked failed', e);
            return null;
        }
    }

    function revokeAllObjectUrls() {
        try {
            if (!window.__objectUrls) return;
            window.__objectUrls.forEach(u => { try { URL.revokeObjectURL(u); } catch(e){} });
            window.__objectUrls = [];
        } catch (e) { console.warn('revokeAllObjectUrls failed', e); }
    }

    window.createObjectURLTracked = createObjectURLTracked;
    window.revokeAllObjectUrls = revokeAllObjectUrls;

    // 页面卸载时统一释放
    window.addEventListener && window.addEventListener('unload', () => {
        try { revokeAllObjectUrls(); } catch(e){}
    });

})(window);
