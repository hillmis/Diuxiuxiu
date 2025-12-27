/**
 * DxxSystem Core Module
 * Refactored for better structure while maintaining all original functionalities and UI.
 */
(function (window, document) {
    'use strict';

    // --- 配置常量 ---
    const CONFIG = {
        // 安全配置
        SECURITY: {
            OFFICIAL_SIGNATURE: '',// 请在发布前填写官方签名
            ERROR_PAGE: '404.html',
            CHECK_TIMEOUT: 3000
        },
        // 更新配置
        UPDATE: {
            CHECK_INTERVAL: 3000000, // 5分钟
            MIN_VISIBLE_CHECK: 2000  // 2秒
        },
        // 接口
        API: {
            HITOKOTO: 'https://www.wudada.online/Api/ScSj'
        },
        // 资源
        ASSETS: {
            ALIPAY: 'https://s3.bmp.ovh/imgs/2025/05/07/1565fff5085e314b.png',
            WECHAT: 'https://s3.bmp.ovh/imgs/2025/05/07/44ac595a875326bb.png'
        }
    };

    class SystemApp {
        constructor() {
            // 初始化状态
            this.state = {
                localCode: typeof webapp !== 'undefined' ? webapp.getcode() : '0',
                currentSign: typeof webapp !== 'undefined' ? webapp.getsign() : '',
                currentVersion: typeof webapp !== 'undefined' ? webapp.getpage() : '1.0',
                appName: typeof webapp !== 'undefined' ? webapp.getname() : '抖咻咻',
                latestUpdateData: null,
                lastCheckTimestamp: 0,
                hitokoto: '天若有情天亦老，人间正道是沧桑' // 默认一言
            };

            // 绑定上下文
            this.handleImageClick = this.handleImageClick.bind(this);
            this.checkUpdate = this.checkUpdate.bind(this);
            this.openAbout = this.openAbout.bind(this);
            this.handleCancelUpdate = this.handleCancelUpdate.bind(this);

            // 初始化
            this._injectStyles();
            this._initSecurity();
            this._initHooks();

            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this._onReady());
            } else {
                this._onReady();
            }
        }

        // --- 生命周期 ---
        _onReady() {
            this._fetchHitokoto();
            this._initVisibilityListener();
            this._verifyIntegrity();
        }

        _initHooks() {
            // 暴露给 webapp 的全局回调
            window.handleImageClick = this.handleImageClick;
            if (typeof webapp !== 'undefined') {
                webapp.lasting("handleImageClick");
            }
        }

        _initVisibilityListener() {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    // 后台处理强制更新退出
                    if (this.state.latestUpdateData?.forceUpdate) {
                        webapp.secede();
                    }
                } else {
                    // 前台检查更新
                    const timeSinceLastCheck = Date.now() - this.state.lastCheckTimestamp;
                    if (timeSinceLastCheck > CONFIG.UPDATE.MIN_VISIBLE_CHECK) {
                        this.checkUpdate();
                    }
                }
            });
        }

        // --- 安全模块 ---
        _initSecurity() {
            // 防篡改校验
            this._verifyIntegrity();
        }

        _verifyIntegrity() {
            // 简单防调试
            if (typeof window.devtools === 'object' || window.outerWidth - window.innerWidth > 100) {
                this._handleTampering('调试模式检测');
            }
            try {
                if (this.state.currentSign !== CONFIG.SECURITY.OFFICIAL_SIGNATURE) {
                    this._handleTampering('签名不匹配');
                    return false;
                }
                return true;
            } catch (e) {
                this._handleTampering('校验异常');
                return false;
            }
        }

        _handleTampering(reason) {
            console.error(`[安全警报] ${reason}`);
            // 实际生产中可取消注释以下行
            //window.stop();
            // 3秒后跳转错误页
            // setTimeout(() => { window.location.replace(CONFIG.SECURITY.ERROR_PAGE); }, 100);
        }

        // --- 数据获取模块 ---
        _fetchHitokoto() {
            const fetchPoem = () => {
                return fetch(CONFIG.API.HITOKOTO)
                    .then(res => res.ok ? res.json() : Promise.reject())
                    .then(data => {
                        const text = data.data || this.state.hitokoto;
                        // 递归获取短句
                        return text.length > 12 ? fetchPoem() : text;
                    })
                    .catch(() => this.state.hitokoto);
            };

            fetchPoem().then(text => {
                this.state.hitokoto = text;
                // 更新 Meta
                let meta = document.querySelector('meta[name="description"]');
                if (!meta) {
                    meta = document.createElement('meta');
                    meta.name = 'description';
                    document.head.appendChild(meta);
                }
                meta.content = text;

                // 如果关于页面打开中，实时更新
                const poemEl = document.querySelector('.poem-text');
                if (poemEl) poemEl.textContent = text;
            });
        }

        // --- 更新模块 ---
        _compareVersions(current, latest) {
            const currentNum = Number(current);
            const latestNum = Number(latest);
            if (isNaN(currentNum) || isNaN(latestNum)) return false;
            return latestNum > currentNum;
        }

        async checkUpdate() {
            try {
                const updateUrl = navigator.userAgent; // 假设 UA 即 API 地址
                const response = await fetch(updateUrl);
                if (!response.ok) throw `HTTP错误: ${response.status}`;
                const data = await response.json();

                if (!data.versionCode || !data.versionName) throw '无效的版本数据格式';

                if (this._compareVersions(this.state.localCode, data.versionCode)) {
                    this._createUpdateDialog();
                    this._showUpdateUI(data);
                } else {
                    if (typeof webapp !== 'undefined') webapp.toast('当前已是最新版本');
                }
            } catch (error) {
                console.log('更新检查失败:', error);
            } finally {
                this.state.lastCheckTimestamp = Date.now();
            }
        }


        _createUpdateDialog() {
            if (document.getElementById('updateOverlay')) return;
            const dialog = document.createElement('div');
            dialog.innerHTML = `
        <div id="updateOverlay" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100dvh; background: rgba(0,0,0,0.5); z-index: 9999; backdrop-filter: blur(4px); padding: 20px; box-sizing: border-box; display: flex; justify-content: center; align-items: center;">
            <!-- 弹窗主体：设置固定高度 height: 70vh -->
            <div style="background: #ffffff; width: min(95%, 480px); height: 70vh; max-height: 600px; min-height: 350px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); overflow: hidden; display: flex; flex-direction: column; animation: modalSlide 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);">
                
                <!-- 头部：固定不滚动 -->
                <div style="padding: 24px; background: #fff; border-bottom: 1px solid #f0f0f0; flex-shrink: 0;">
                    <div style="display: flex; align-items: center; gap: 16px; color: #1f2937;">
                        <div style="width: 48px; height: 48px; background: linear-gradient(135deg, #29c961, #22a350); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 4px 12px rgba(41, 201, 97, 0.3);">
                            <svg viewBox="0 0 24 24" width="28" height="28" style="fill: currentColor">
                                <path d="M14.8 3.8l2.6 5.1 5.8.9c.6.1.8.8.4 1.2l-4.2 4.3 1 5.7c.1.6-.5 1.1-1.1.8L12 18.3l-5 2.7c-.6.3-1.2-.2-1.1-.8l1-5.7-4.2-4.3c-.4-.4-.2-1.1.4-1.2l5.8-.9 2.6-5.1c.3-.6 1.1-.6 1.4 0z"/>
                            </svg>
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 700; color: #111;">发现新版本</h3>
                            <p style="margin: 4px 0 0 0; font-size: 0.85rem; color: #666;">为了更好的体验，建议您立即更新</p>
                        </div>
                    </div>
                </div>

                <!-- 内容区域：自适应高度并滚动 -->
                <div id="updateContent" style="flex: 1; padding: 24px; overflow-y: auto; scrollbar-width: thin; overscroll-behavior: contain; background: #fff;">
                    <!-- 内容将通过 JS 插入 -->
                </div>

                <!-- 底部按钮：固定不滚动 -->
                <div style="padding: 20px 24px; background: #fff; border-top: 1px solid #f0f0f0; display: flex; gap: 12px; justify-content: flex-end; flex-shrink: 0;">
                    <button id="updateCancel" style="padding: 12px 24px; background: #f5f7fa; border: none; border-radius: 10px; color: #5c6b7f; font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: all 0.2s;">稍后再说</button>
                    <button id="updateConfirm" style="padding: 12px 32px; background: #29c961; border: none; border-radius: 10px; color: white; font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 4px 12px rgba(41, 201, 97, 0.25);">立即更新</button>
                </div>
            </div>
        </div>
        <style>
            @keyframes modalSlide { 
                from { opacity: 0; transform: scale(0.95) translateY(10px); } 
                to { opacity: 1; transform: scale(1) translateY(0); } 
            }
            /* 滚动条美化 */
            #updateContent::-webkit-scrollbar { width: 6px; }
            #updateContent::-webkit-scrollbar-track { background: transparent; }
            #updateContent::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
            #updateContent::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
            
            /* 按钮点击效果 */
            #updateConfirm:active { transform: scale(0.96); box-shadow: none !important; }
            #updateCancel:active { transform: scale(0.96); background: #eef0f3 !important; }

            @media (max-width: 480px) { 
                #updateOverlay { padding: 16px; }
                /* 移动端高度调整 */
                #updateOverlay > div { width: 100% !important; height: 65vh !important; }
            }
        </style>
    `;
            document.body.appendChild(dialog);

            // 修复：使用正确的方法引用
            document.getElementById('updateCancel').addEventListener('click', () => this.handleCancelUpdate());
        }

        handleCancelUpdate() {
            document.getElementById('updateOverlay').style.display = 'none';
            if (typeof webapp !== 'undefined') webapp.toast('已延迟更新');
            this.state.lastCheckTimestamp = Date.now();
        }

        _showUpdateUI(data) {
            this.state.latestUpdateData = data;
            const overlay = document.getElementById('updateOverlay');
            const content = document.getElementById('updateContent');

            content.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 12px 15px; border-radius: 10px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="text-align: center;">
                        <div style="font-size: 11px; color: #888;">当前版本</div>
                        <div style="font-size: 14px; color: #333333ff; font-weight: bold;">v${this.state.currentVersion}</div>
                    </div>
                    <div style="color: #666;">➔</div>
                    <div style="text-align: center;">
                        <div style="font-size: 11px; color: #888;">最新版本</div>
                        <div style="font-size: 14px; color: #5cc9ff; font-weight: bold;">v${data.versionName}</div>
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.02); padding: 15px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="font-size: 13px; line-height: 1.6; color: #404040ff;">${data.description.replace(/\n/g, '<br>')}</div>
                </div>
                ${data.forceUpdate ? `
                <div style="margin-top: 15px; padding: 10px; background: rgba(255, 77, 79, 0.1); border-radius: 8px; border: 1px solid rgba(255, 77, 79, 0.2); display: flex; align-items: center; gap: 8px; color: #ff4d4f;">
                    <svg viewBox="0 0 24 24" width="16" height="16" style="fill: currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    <div style="font-size: 12px;">本次为强制更新</div>
                </div>` : ''}
            `;

            if (data.forceUpdate) {
                document.getElementById('updateCancel').style.display = 'none';
                if (typeof webapp !== 'undefined') webapp.revert(() => webapp.toast('请先完成更新', 3000));
            } else {
                document.getElementById('updateCancel').style.display = 'block';
            }

            const confirmBtn = document.getElementById('updateConfirm');
            confirmBtn.onclick = () => {
                this._checkPermissionAndDownload(data.downloadUrl);
                overlay.style.display = 'none';
            };
            overlay.style.display = 'flex';
        }

        async _checkPermissionAndDownload(url) {
            try {
                if (typeof webapp !== 'undefined' && !webapp.bestow()) {
                    await new Promise((resolve, reject) => {
                        webapp.rights();
                        webapp.behold(status => {
                            if (status === 0) resolve();
                            else reject('权限被拒绝');
                        });
                    });
                }
                if (typeof webapp !== 'undefined') webapp.browse(url);
            } catch (error) {
                console.error('下载失败:', error);
                if (typeof webapp !== 'undefined') webapp.toast('无法开始下载');
            }
        }

        // --- 关于页面模块 ---
        openAbout() {
            // 清理旧弹窗
            const oldPopup = document.getElementById('aboutPopup');
            if (oldPopup) oldPopup.remove();

            const popup = document.createElement('div');
            popup.id = 'aboutPopup';
            // 关键修复：先设置为隐藏状态（display: none），而不是只设置透明度
            popup.style.display = 'none';
            popup.style.opacity = '0';
            popup.className = 'popup-container';

            popup.addEventListener('click', (e) => {
                if (e.target === popup) this._closeAboutPopup(popup);
            });

            const content = document.createElement('div');
            content.className = 'content-container';

            // 1. Logo
            const logoSection = document.createElement('div');
            logoSection.className = 'about-logo-section';
            logoSection.innerHTML = `
        <div class="logo-box-animated"><i class="fa-solid fa-circle-nodes"></i></div>
        <h2 class="popup-title">${this.state.appName}</h2>
    `;

            // 2. 文本与列表
            const textContainer = document.createElement('div');
            textContainer.className = 'text-container';

            const poemEl = document.createElement('div');
            poemEl.className = 'poem-text';
            poemEl.textContent = this.state.hitokoto;

            const btnList = document.createElement('div');
            btnList.className = 'about-list-group';

            btnList.append(
                this._createListItem('fa-solid fa-code-branch', `当前版本 v${this.state.currentVersion}`, '点击检查更新', () => this.checkUpdate()),
                this._createListItem('fa-solid fa-user-astronaut', '应用作者 Hillmis', '访问主页', () => webapp.browse('https://link3.cc/liu13'))
            );

            // 3. 赞赏
            const donateSection = document.createElement('div');
            donateSection.className = 'donate-section';
            donateSection.innerHTML = `
        <div class="donate-title"><i class="fa-solid fa-mug-hot"></i> 请开发者喝杯柠檬水</div>
    `;

            const qrContainer = document.createElement('div');
            qrContainer.className = 'qr-container';
            qrContainer.append(
                this._createQrItem('支付宝', CONFIG.ASSETS.ALIPAY, '#1677ff'),
                this._createQrItem('微信', CONFIG.ASSETS.WECHAT, '#07c160')
            );

            const thanks = document.createElement('p');
            thanks.className = 'thanks-text';
            thanks.textContent = '点击图片保存赞赏码 · 感谢您的支持';

            donateSection.append(qrContainer, thanks);
            textContainer.append(poemEl, btnList, donateSection);
            content.append(logoSection, textContainer);
            popup.appendChild(content);

            document.body.appendChild(popup);

            // 关键修复：先显示元素，然后在下一帧开始动画
            requestAnimationFrame(() => {
                popup.style.display = 'flex';
                requestAnimationFrame(() => {
                    popup.style.opacity = '1';
                    popup.classList.remove('hidden');
                });
            });
        }

        // 修改 _closeAboutPopup 方法
        _closeAboutPopup(popup) {
            popup.style.opacity = '0';
            popup.classList.add('hidden');
            setTimeout(() => {
                if (popup.parentNode) {
                    // 等待过渡动画完成后再隐藏display
                    setTimeout(() => {
                        popup.style.display = 'none';
                        popup.parentNode.removeChild(popup);
                    }, 300);
                }
            }, 300);
        }
        _createListItem(iconClass, title, subtitle, onClick) {
            const item = document.createElement('div');
            item.className = 'about-list-item';
            item.onclick = onClick;
            item.innerHTML = `
                <div class="ali-icon"><i class="${iconClass}"></i></div>
                <div class="ali-content">
                    <div class="ali-title">${title}</div>
                    ${subtitle ? `<div class="ali-sub">${subtitle}</div>` : ''}
                </div>
                <div class="ali-arrow"><i class="fa-solid fa-angle-right"></i></div>
            `;
            return item;
        }

        _createQrItem(label, src, color) {
            const box = document.createElement('div');
            box.className = 'qr-box';

            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'qr-img-wrapper';
            imgWrapper.onclick = () => this.handleImageClick(1, src);

            const img = document.createElement('img');
            img.src = src;
            img.className = 'qr-img';
            imgWrapper.appendChild(img);

            const text = document.createElement('div');
            text.className = 'qr-label';
            text.style.color = color;
            text.innerHTML = `<i class="fa-brands fa-${label === '微信' ? 'weixin' : 'alipay'}"></i> ${label}`;

            box.append(imgWrapper, text);
            return box;
        }

        // --- 工具逻辑 ---
        async handleImageClick(elementType, imageUrl) {
            if (elementType !== 1 && elementType !== 2) return;

            try {
                const isWechatTip = imageUrl.includes('44ac595a875326bb') || imageUrl.includes('wechat');
                const isAlipayTip = imageUrl.includes('1565fff5085e314b') || imageUrl.includes('alipay');

                if (isWechatTip || isAlipayTip) {
                    if (typeof webapp !== 'undefined') webapp.toast('正在保存赞赏码...');

                    const response = await fetch(imageUrl);
                    if (!response.ok) throw new Error('下载失败');

                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);

                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = `donate_${Date.now()}.jpg`;
                    document.body.appendChild(link);
                    link.click();

                    await new Promise(resolve => setTimeout(resolve, 500));

                    setTimeout(() => {
                        document.body.removeChild(link);
                        URL.revokeObjectURL(blobUrl);

                        if (typeof webapp !== 'undefined') {
                            if (isWechatTip) {
                                webapp.toast('正在打开微信...');
                                webapp.start('com.tencent.mm');
                            } else if (isAlipayTip) {
                                webapp.toast('正在打开支付宝...');
                                webapp.start('com.eg.android.AlipayGphone');
                            }
                        }
                    }, 1000);
                }
            } catch (error) {
                if (typeof webapp !== 'undefined') webapp.toast('操作失败: ' + error.message);
            }
        }

        _injectStyles() {
            const style = document.createElement('style');
            style
                .textContent = `
        /* 弹窗容器 */
        .popup-container {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            z-index: 9999; background: rgba(0, 0, 0, 0.6);
            backdrop-filter: blur(5px);
            display: flex; justify-content: center; align-items: center;
            opacity: 0; /* 默认不透明 */
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none; /* 隐藏时禁止交互 */
        }
        
        /* 关键修复：移除 display: none 的过渡，仅控制透明度 */
        .popup-container.hidden { 
            opacity: 0; 
            pointer-events: none; 
        }
        
        /* 修复：不使用 display: none 而是控制透明度和交互 */
        .popup-container:not(.hidden) { 
            opacity: 1; 
            pointer-events: auto;
        }
        
        .popup-container.hidden .content-container { 
            transform: scale(0.9) translateY(20px); 
            opacity: 0; 
        }

        /* 内容卡片 */
        .content-container {
            background: rgba(30, 30, 30, 0.95); border: 1px solid rgba(255, 255, 255, 0.1);
            width: 85%; max-width: 400px; border-radius: 20px; padding: 30px 20px;
            display: flex; flex-direction: column; align-items: center;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
            transform: scale(1) translateY(0); opacity: 1;
            transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            max-height: 85vh; overflow-y: auto;
        }

                /* UI 细节 */
                .about-logo-section { display: flex; flex-direction: column; align-items: center; margin-bottom: 20px; }
                .logo-box-animated {
                    width: 70px; height: 70px; background: linear-gradient(135deg, #222, #333);
                    border-radius: 18px; display: flex; align-items: center; justify-content: center;
                    font-size: 36px; color: #fff; margin-bottom: 12px;
                    box-shadow: 0 8px 20px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
                    animation: floatLogo 3s ease-in-out infinite;
                }
                @keyframes floatLogo { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
                
                .popup-title { font-size: 20px; color: #fff; font-weight: 700; margin: 0; letter-spacing: 1px; }
                .text-container { width: 100%; display: flex; flex-direction: column; gap: 15px; }
                .poem-text { text-align: center; color: rgba(255,255,255,0.5); font-size: 13px; font-style: italic; margin-bottom: 10px; font-family: serif; }
                
                .about-list-group { display: flex; flex-direction: column; gap: 10px; width: 100%; }
                .about-list-item {
                    background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.05);
                    border-radius: 12px; padding: 12px 15px; display: flex; align-items: center;
                    transition: all 0.2s; cursor: pointer;
                }
                .about-list-item:active { background: rgba(255, 255, 255, 0.1); transform: scale(0.98); }
                .ali-icon {
                    width: 32px; height: 32px; background: rgba(255,255,255,0.1); border-radius: 8px;
                    display: flex; align-items: center; justify-content: center; color: #fff;
                    margin-right: 12px; font-size: 14px;
                }
                .ali-content { flex: 1; display: flex; flex-direction: column; justify-content: center; }
                .ali-title { color: #eee; font-size: 14px; font-weight: 500; }
                .ali-sub { color: rgba(255,255,255,0.5); font-size: 11px; margin-top: 2px; }
                .ali-arrow { color: rgba(255,255,255,0.3); font-size: 12px; }

                .donate-section { margin-top: 15px; padding-top: 20px; border-top: 1px dashed rgba(255,255,255,0.1); width: 100%; }
                .donate-title { text-align: center; color: #ccc; font-size: 13px; margin-bottom: 15px; font-weight: 500; }
                .donate-title i { color: #ffad81; margin-right: 5px; }
                .qr-container { display: flex; justify-content: center; gap: 20px; }
                .qr-box { display: flex; flex-direction: column; align-items: center; gap: 8px; }
                .qr-img-wrapper {
                    width: 90px; height: 90px; background: #fff; padding: 5px; border-radius: 10px;
                    cursor: pointer; transition: transform 0.2s;
                }
                .qr-img-wrapper:active { transform: scale(0.95); opacity: 0.8; }
                .qr-img { width: 100%; height: 100%; object-fit: contain; }
                .qr-label { font-size: 12px; font-weight: bold; }
                .thanks-text { text-align: center; color: rgba(255,255,255,0.3); font-size: 11px; margin-top: 15px; }
                
                @keyframes modalPop { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                #updateContent::-webkit-scrollbar { width: 4px; }
                #updateContent::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
            `;
            document.head.appendChild(style);
        }
    }

    // 实例化核心模块
    const appSystem = new SystemApp();

    // 暴露公共 API 供外部调用
    window.DxxSystem = {
        checkUpdate: () => appSystem.checkUpdate(),
        openAbout: () => appSystem.openAbout(),
        getVersion: () => appSystem.state.currentVersion,
        getHitokoto: () => appSystem.state.hitokoto,
        // 如果需要手动执行完整性检查
        verify: () => appSystem._verifyIntegrity()
    };

})(window, document);