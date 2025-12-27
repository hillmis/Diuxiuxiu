/**
 * js/api.js
 * 抖咻咻 API 接口管理模块
 * 包含：基础请求封装、加密验证、各模块接口集合、下载代理逻辑
 */

const Api = {
    config: {
        // 核心后端地址 (原 API_BASE)
        BASE_URL: '',

        // 外部第三方解析 SDK 配置
        SDK: {
            BASE: '',
            KEY: ''
        },
        // 积分/口令验证密钥
        SECRET: 'DouXiuXiu_Secret_2025_#@!'
    },

    /**
     * 核心请求方法 (替代原 apiFetch)
     */
    async fetch(endpoint, action, data = {}) {
        const formData = new FormData();
        formData.append('action', action);

        // 自动注入当前用户ID (依赖全局 app 对象)
        if (window.app && window.app.accountManager && window.app.accountManager.user) {
            const uid = window.app.accountManager.user.id;
            formData.append('user_id', uid);
            formData.append('uid', uid);
        }

        // 追加数据
        for (const key in data) {
            if (data[key] instanceof FileList || Array.isArray(data[key])) {
                // 处理文件数组 (如发帖时的 media[])
                if (Array.isArray(data[key])) {
                    data[key].forEach(file => formData.append(`${key}[]`, file));
                }
            } else if (data[key] !== undefined && data[key] !== null) {
                formData.append(key, data[key]);
            }
        }

        const url = endpoint.startsWith('http') ? endpoint : `${this.config.BASE_URL}/${endpoint}`;

        try {
            const response = await window.fetch(url, {
                method: 'POST',
                body: formData
            });
            return await response.json();
        } catch (e) {
            console.error(`[API Error] ${endpoint}/${action}:`, e);
            return { code: 500, msg: "网络请求失败，请检查连接" };
        }
    },

    /**
     * 简单的 GET 请求封装
     */
    async get(url, options = {}) {
        const res = await window.fetch(url, options);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
    },

    async getJson(url, options = {}) {
        const res = await this.get(url, options);
        return await res.json();
    },

    // ================= 模块化接口 =================

    /** 账号与权限 */
    Auth: {
        async loginOrRegister(username, password, deviceId, isWebIde) {
            return Api.fetch('chat_api.php', 'login_or_register', {
                username, password, device_id: deviceId, is_webide: isWebIde
            });
        },
        // 更新资料 (昵称/头像)
        async updateProfile(userId, username, avatar) {
            return Api.fetch('chat_api.php', 'update_profile', {
                action: 'update_profile',
                user_id: userId,
                username, avatar
            });
        },
        // 获取用户信息
        async getUserInfo(userId) {
            return Api.fetch('chat_api.php', 'get_user_info', { user_id: userId });
        },
        // 获取他人主页信息
        async getUserProfile(targetId, currentId) {
            return Api.fetch('chat_api.php', 'get_user_profile', { target_id: targetId, current_id: currentId });
        },
        async adminOp(adminId, targetId, opType, val) {
            return Api.fetch('chat_api.php', 'user_op', {
                admin_id: adminId,
                target_id: targetId,
                op_type: opType,
                val: val
            });
        }
    },

    /** 聊天室 */
    Chat: {
        async getMessages(lastId) {
            return Api.fetch('chat_api.php', 'get_msgs', { last_id: lastId });
        },
        async sendMessage(uid, content, type, quoteData = {}) {
            const payload = { uid, content, type, ...quoteData };
            return Api.fetch('chat_api.php', 'send_msg', payload);
        },
        async deleteMessage(msgId, userId, isAdmin) {
            return Api.fetch('chat_api.php', 'delete_msg', {
                msg_id: msgId,
                user_id: userId,
                is_admin: isAdmin
            });
        }
    },

    /** 圈子/社区 */
    Circle: {
        async getCircles() {
            return Api.fetch('circle_api.php', 'get_circles');
        },
        async getCircleInfo(circleId, userId) {
            return Api.fetch('circle_api.php', 'get_circle_info', { circle_id: circleId, user_id: userId });
        },
        async joinToggle(circleId, userId, type) {
            return Api.fetch('circle_api.php', 'join_toggle', { circle_id: circleId, user_id: userId, type });
        },
        async getPostList(params) {
            // params: { page, circle_id, user_id, keyword }
            return Api.fetch('circle_api.php', 'get_post_list', params);
        },
        async toggleLike(postId, userId) {
            return Api.fetch('circle_api.php', 'toggle_like', { post_id: postId, user_id: userId });
        },
        async createPost(formData) {
            // 特殊处理：发帖通常包含文件，formData 由外部构建更方便，这里直接透传
            const url = `${Api.config.BASE_URL}/circle_api.php`;
            try {
                const res = await window.fetch(url, { method: 'POST', body: formData });
                return await res.json();
            } catch (e) {
                return { code: 500, msg: "发布请求失败" };
            }
        },
        async manageCircle(data) {
            return Api.fetch('circle_api.php', 'manage_circle', data);
        },
        async createCircle(userId, name, desc) {
            return Api.fetch('circle_api.php', 'create_circle', { user_id: userId, name, desc });
        },
        async rewardPost(userId, postId, amount) {
            return Api.fetch('circle_api.php', 'reward_post', { user_id: userId, post_id: postId, amount });
        },
        async getUserPosts(userId) { return Api.fetch('circle_api.php', 'get_user_posts', { user_id: userId }); },
        async getUserCircles(userId) { return Api.fetch('circle_api.php', 'get_user_circles', { user_id: userId }); },
        async getUserLikes(userId) { return Api.fetch('circle_api.php', 'get_user_likes', { user_id: userId }); },
        async getCoinHistory(userId) { return Api.fetch('circle_api.php', 'get_coin_history', { user_id: userId }); }
    },

    /** 外部第三方 SDK 接口 */
    External: {
        // 抖音主页解析 (支持 AbortSignal)
        async fetchDouyinProfile(url, signal) {
            const apiUrl = `${Api.config.SDK.BASE}/douyin_zhuye/?key=${Api.config.SDK.KEY}&url=${encodeURIComponent(url)}`;
            const options = signal ? { signal } : {};
            return Api.getJson(apiUrl, options);
        },
        // 抖音搜索
        async searchDouyin(keyword) {
            const apiUrl = `${Api.config.SDK.BASE}/douyin_search/?key=${Api.config.SDK.KEY}&msg=${encodeURIComponent(keyword)}&type=0`;
            return Api.getJson(apiUrl);
        },
        // 单视频/链接解析
        async parseVideo(url) {
            const apiUrl = `${Api.config.SDK.BASE}/douyin_video/?key=${Api.config.SDK.KEY}&url=${encodeURIComponent(url)}`;
            return Api.getJson(apiUrl);
        }
    },

    /** 
     * 下载与文件处理 
     * 专门用于 DownloadManager
     */
    Download: {
        /**
         * 获取文件的 Blob 数据
         * @param {string} url - 目标 URL
         * @param {boolean} useProxy - 是否使用代理 (视频通常需要，图片可能不需要)
         */
        async getBlob(url, useProxy = false) {
            // 获取代理前缀
            const proxyPrefix = Api.getProxyPrefix();
            const targetUrl = useProxy ? (proxyPrefix + encodeURIComponent(url)) : url;

            try {
                const res = await window.fetch(targetUrl);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.blob();
            } catch (e) {
                console.warn(`[Download] Blob fetch failed (Proxy: ${useProxy}): ${url}`, e);
                return null;
            }
        }
    },

    /** 
     * 获取下载代理地址前缀 
     * 对应 DownloadManager 中的 this.proxy
     */
    getProxyPrefix() {
        // 动态适配末尾斜杠
        const base = this.config.BASE_URL.endsWith('/') ? this.config.BASE_URL.slice(0, -1) : this.config.BASE_URL;
        // 假设代理脚本位于 API 根目录的同级或特定路径
        // 原有逻辑是 BASE_URL + '/dyzl.php?url='
        return `${base}/dyzl.php?url=`;
    },

    /** 积分与加密工具 */
    Quota: {
        buf2hex(buffer) {
            return [...new Uint8Array(buffer)].map(x => x.toString(16).padStart(2, '0')).join('');
        },
        base64ToBuf(base64) {
            const binary_string = window.atob(base64);
            const len = binary_string.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binary_string.charCodeAt(i);
            return bytes;
        },
        async generateSign(token, timestamp) {
            const str = token + timestamp + Api.config.SECRET;
            const encoder = new TextEncoder();
            const data = encoder.encode(str);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            return this.buf2hex(hashBuffer);
        },
        async decryptData(encryptedBase64, ivBase64) {
            try {
                const encoder = new TextEncoder();
                const keyData = encoder.encode(Api.config.SECRET);
                const keyHashBuffer = await crypto.subtle.digest('SHA-256', keyData);
                const keyHashHex = this.buf2hex(keyHashBuffer);
                const rawKeyStr = keyHashHex.substring(0, 16);
                const rawKeyBytes = encoder.encode(rawKeyStr);
                const key = await crypto.subtle.importKey("raw", rawKeyBytes, { name: "AES-CBC" }, false, ["decrypt"]);
                const encryptedBuffer = this.base64ToBuf(encryptedBase64);
                const ivBuffer = this.base64ToBuf(ivBase64);
                const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-CBC", iv: ivBuffer }, key, encryptedBuffer);
                const decoder = new TextDecoder();
                return JSON.parse(decoder.decode(decryptedBuffer));
            } catch (e) {
                console.error("解密失败:", e);
                return null;
            }
        },
        async verifyToken(token) {
            const timestamp = Math.floor(Date.now() / 1000);
            const sign = await this.generateSign(token, timestamp);
            const response = await window.fetch(`${Api.config.BASE_URL}/verify_token.php`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, timestamp, sign })
            });
            return { raw: await response.json(), token, timestamp };
        }
    }
};

// 挂载到全局
window.Api = Api;
window.API_BASE = Api.config.BASE_URL; // 兼容旧代码引用