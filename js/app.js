/* ============================================
   app.js — 主控制器
   初始化 · 视图路由 · Tab 切换 · 弹窗工具
   ============================================ */

// ===== 弹窗工具 =====
const Modal = {
    show(innerHTML) {
        document.getElementById("modalContent").innerHTML = innerHTML;
        document.getElementById("modalOverlay").style.display = "flex";
    },
    hide() {
        document.getElementById("modalOverlay").style.display = "none";
    }
};

// ===== 主应用 =====
const App = {

    /** 登录流程状态：null | "login" | "setup" */
    _loginState: null,

    async init() {
        // 1. 初始化数据（等待 Firebase 同步完成）
        await DB.init(Defaults);

        // 2. 加载 JSZip 和 XLSX（CDN 动态加载）
        this.loadLibs();

        // 3. 绑定登录事件
        this.bindLogin();

        // 4. 绑定弹窗关闭（点击遮罩）
        document.getElementById("modalOverlay").addEventListener("click", function(e) {
            if (e.target === this) Modal.hide();
        });
        document.addEventListener("keydown", function(e) {
            if (e.key === "Escape") Modal.hide();
        });

        // 5. 监听远端数据同步（自动刷新培训师面板）
        this._bindSyncListener();

        // 6. 注册 Service Worker（离线缓存 + 版本更新提示）
        this._registerSW();

        // 7. 默认显示登录页
        this.showView("login");
    },

    /** 注册 Service Worker 实现离线缓存和版本更新通知 */
    _registerSW() {
        if (!("serviceWorker" in navigator)) return;

        navigator.serviceWorker.register("/sw.js?v=73").then((reg) => {
            console.log("[SW] 已注册:", reg.scope);

            // 监听新版本就绪
            reg.addEventListener("updatefound", () => {
                const newWorker = reg.installing;
                if (!newWorker) return;
                newWorker.addEventListener("statechange", () => {
                    // 新 SW 安装完成，等待激活
                    if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                        console.log("[SW] 新版本已就绪，刷新页面以激活");
                        // 显示更新提示横幅
                        App._showUpdateBanner();
                    }
                });
            });
        }).catch((err) => {
            console.warn("[SW] 注册失败:", err);
        });

        // 页面已由 SW 控制 → 检查是否有待激活的更新
        if (navigator.serviceWorker.controller) {
            navigator.serviceWorker.addEventListener("controllerchange", () => {
                console.log("[SW] 控制器已切换为新版本");
            });
        }
    },

    /** 页面顶部显示「新版本可用」横幅 */
    _showUpdateBanner() {
        // 防止重复显示
        if (document.getElementById("sw-update-banner")) return;

        const banner = document.createElement("div");
        banner.id = "sw-update-banner";
        banner.style.cssText = `
            position:fixed;top:0;left:0;right:0;z-index:10000;
            background:var(--primary);color:#fff;text-align:center;
            padding:10px 16px;font-size:14px;display:flex;
            align-items:center;justify-content:center;gap:12px;
            box-shadow:0 2px 8px rgba(0,0,0,0.2);
        `;
        banner.innerHTML = `
            <span>🔄 内容已更新，刷新页面获取最新版本</span>
            <button id="sw-update-btn" style="
                background:#fff;color:var(--primary);border:none;
                padding:4px 14px;border-radius:4px;font-size:13px;
                font-weight:600;cursor:pointer;
            ">立即刷新</button>
            <button id="sw-update-close" style="
                background:transparent;color:#fff;border:none;
                font-size:20px;line-height:1;cursor:pointer;
                padding:0 4px;opacity:0.8;
            " title="稍后提醒">&times;</button>
        `;
        document.body.prepend(banner);

        // 关闭按钮：隐藏横幅（本次会话不再显示）
        document.getElementById("sw-update-close").addEventListener("click", () => {
            banner.style.display = "none";
        });

        document.getElementById("sw-update-btn").addEventListener("click", () => {
            // 通知 SW 跳过等待 → 激活 → 刷新页面
            const worker = navigator.serviceWorker.controller;
            if (worker) worker.postMessage("skipWaiting");
            // 同时刷新所有客户端
            navigator.serviceWorker.getRegistrations().then((regs) => {
                regs.forEach((reg) => {
                    if (reg.waiting) reg.waiting.postMessage("skipWaiting");
                });
            });
            window.location.reload();
        });
    },

    /** 动态加载 JSZip 和 XLSX（含 SRI 完整性校验） */
    loadLibs() {
        // JSZip（用于 docx 解析）
        if (typeof JSZip === "undefined") {
            const s1 = document.createElement("script");
            s1.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
            s1.integrity = "sha384-+mbV2IY1Zk/X1p/nWllGySJSUN8uMs+gUAN10Or95UBH0fpj6GfKgPmgC5EXieXG";
            s1.crossOrigin = "anonymous";
            document.head.appendChild(s1);
        }
        // SheetJS（用于 xlsx 解析）
        if (typeof XLSX === "undefined") {
            const s2 = document.createElement("script");
            s2.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
            s2.integrity = "sha384-QCIdq2UMVEoSRhR3ZWZwdz2/pivLowr+eokFMdYyukq7qI26VYRxFa4Nl6FKetmL";
            s2.crossOrigin = "anonymous";
            document.head.appendChild(s2);
        }
    },

    // ===== 视图切换 =====
    showView(viewName) {
        document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
        const el = document.getElementById("view-" + viewName);
        if (el) el.classList.add("active");
    },

    // ===== 登录事件 =====
    bindLogin() {
        // 培训师入口展开/收起
        document.getElementById("btnToggleTrainer").addEventListener("click", () => {
            const form = document.getElementById("trainerEntryForm");
            const isHidden = form.style.display !== "flex";
            form.style.display = isHidden ? "flex" : "none";
            document.getElementById("btnToggleTrainer").textContent = isHidden ? "培训师管理 ▲" : "培训师管理";
        });

        // —— 新人登录（异步密码验证） ——

        // 输入艺名 → 展开密码区
        document.getElementById("inputTraineeName").addEventListener("input", () => {
            const name = document.getElementById("inputTraineeName").value.trim();
            const pwGroup = document.getElementById("loginPasswordGroup");
            const btn = document.getElementById("btnTraineeLogin");
            if (name.length > 0) {
                pwGroup.style.display = "block";
                btn.disabled = false;
            } else {
                pwGroup.style.display = "none";
                btn.disabled = true;
            }
            // 换名字 → 重置为登录模式
            this._resetToLoginMode();
        });

        // 输入密码 → 强度实时更新（仅在注册/设置密码模式下显示）
        document.getElementById("inputTraineePassword").addEventListener("input", (e) => {
            const pwd = e.target.value;
            const wrap = document.getElementById("passwordStrengthWrap");
            // 只在注册/设密模式下才显示强度条，正常登录不需要
            if (pwd.length > 0 && this._loginState === "setup") {
                wrap.style.display = "block";
                const s = Auth.evaluatePasswordStrength(pwd);
                const fill = document.getElementById("passwordStrengthFill");
                fill.style.width = s.pct + "%";
                fill.className = "password-strength-fill strength-" + s.level;
                const lbl = document.getElementById("passwordStrengthLabel");
                lbl.textContent = "密码强度：" + s.label;
                lbl.className = "password-strength-label strength-" + s.level;
            } else {
                wrap.style.display = "none";
            }
        });

        // 登录按钮 — 三场景分发
        document.getElementById("btnTraineeLogin").addEventListener("click", async () => {
            const name = document.getElementById("inputTraineeName").value.trim();
            const pwd = document.getElementById("inputTraineePassword").value;
            const confirmEl = document.getElementById("inputTraineePasswordConfirm");
            const msgEl = document.getElementById("loginPasswordMsg");
            const btn = document.getElementById("btnTraineeLogin");

            const showMsg = (text, cls) => {
                msgEl.textContent = text;
                msgEl.className = "password-msg " + cls;
            };

            // 校验艺名
            if (!name) { alert("请输入艺名"); return; }
            // 校验密码非空
            if (!pwd) { showMsg("请输入密码", "error"); return; }

            // 判断账号状态
            const exists = DB.traineeExists(name);
            const hasHash = exists && DB.getTraineePasswordHash(name);

            if (exists && hasHash) {
                // === 场景 B：已有密码的老用户 ===
                const ok = await Auth.verifyPassword(name, pwd);
                if (!ok) { showMsg("密码错误", "error"); return; }
                this._completeTraineeLogin(name);

            } else if (this._loginState !== "setup") {
                // === 首次点击：进入注册/设置模式 ===
                this._loginState = "setup";
                confirmEl.style.display = "block";
                // 展示强度条
                const wrap = document.getElementById("passwordStrengthWrap");
                if (pwd.length > 0) wrap.style.display = "block";
                btn.textContent = "设置密码并进入";
                const msg = exists ? "首次登录，请设置密码" : "新账号，请设置密码";
                showMsg(msg, "info");

            } else {
                // === 第二次点击：确认注册/设置 ===
                const confirmPwd = confirmEl.value;
                if (pwd.length < 6) { showMsg("密码至少6位", "error"); return; }
                if (pwd !== confirmPwd) { showMsg("两次输入的密码不一致", "error"); return; }

                const result = await Auth.setNewPassword(name, pwd);
                if (!result.ok) { showMsg(result.error, "error"); return; }
                this._completeTraineeLogin(name);
            }
        });

        // 回车快捷登录（三个输入框都触发按钮点击）
        ["inputTraineeName", "inputTraineePassword", "inputTraineePasswordConfirm"].forEach(id => {
            document.getElementById(id).addEventListener("keydown", (e) => {
                if (e.key === "Enter") document.getElementById("btnTraineeLogin").click();
            });
        });

        // 培训师登录（异步：SHA-256 哈希比对）
        document.getElementById("btnTrainerLogin").addEventListener("click", async () => {
            const pwd = document.getElementById("inputAdminPassword").value;
            const result = await Auth.loginAsTrainer(pwd);
            if (!result.ok) {
                const errEl = document.getElementById("loginError");
                errEl.textContent = result.error;
                errEl.style.display = "block";
                return;
            }
            document.getElementById("loginError").style.display = "none";
            this.showView("trainer");
            this.bindTrainerTabs();
            this.switchTrainerTab("content");
        });

        document.getElementById("inputAdminPassword").addEventListener("keydown", (e) => {
            if (e.key === "Enter") document.getElementById("btnTrainerLogin").click();
        });

        // 退出登录
        document.getElementById("btnTraineeLogout").addEventListener("click", () => this.logout());
        document.getElementById("btnTrainerLogout").addEventListener("click", () => this.logout());
    },

    /** 完成新人登录：切视图 + 渲染第一个 Tab */
    _completeTraineeLogin(name) {
        const result = Auth.loginAsTrainee(name);
        if (!result.ok) return;
        document.getElementById("traineeNameDisplay").textContent = Auth.traineeName;
        this._resetLoginUI();
        this.showView("trainee");
        this.bindTraineeTabs();
        this.switchTraineeTab("cognition");
    },

    /** 重置登录 UI 到初始状态（退出或登录成功后调用） */
    _resetLoginUI() {
        this._loginState = null;
        document.getElementById("loginPasswordGroup").style.display = "none";
        document.getElementById("inputTraineeName").value = "";
        document.getElementById("inputTraineePassword").value = "";
        const confirmEl = document.getElementById("inputTraineePasswordConfirm");
        confirmEl.style.display = "none";
        confirmEl.value = "";
        document.getElementById("passwordStrengthWrap").style.display = "none";
        const msgEl = document.getElementById("loginPasswordMsg");
        msgEl.textContent = "";
        msgEl.className = "password-msg";
        const btn = document.getElementById("btnTraineeLogin");
        btn.textContent = "进入学习";
        btn.disabled = true;
    },

    /** 从设置模式回到登录模式（换名字时调用） */
    _resetToLoginMode() {
        if (this._loginState !== "setup") return;
        this._loginState = null;
        document.getElementById("inputTraineePasswordConfirm").style.display = "none";
        document.getElementById("inputTraineePasswordConfirm").value = "";
        const msgEl = document.getElementById("loginPasswordMsg");
        msgEl.textContent = "";
        msgEl.className = "password-msg";
        document.getElementById("btnTraineeLogin").textContent = "进入学习";
    },

    logout() {
        // 停止 GitHub 轮询定时器，防止登出后继续请求
        DB.stopPolling();
        Auth.logout();
        // 清除认知题内存作答状态（防止下一位登录者看到残留数据）
        if (typeof Cognition !== "undefined") Cognition.answered = {};
        this._resetLoginUI();
        this.showView("login");
        document.getElementById("inputAdminPassword").value = "";
        document.getElementById("loginError").style.display = "none";
    },

    // ===== 新人端 Tab 切换 =====
    bindTraineeTabs() {
        const nav = document.querySelector("#view-trainee .tab-nav");
        if (!nav || nav._delegated) return; // 防止重复绑定
        nav._delegated = true;
        nav.addEventListener("click", (e) => {
            const btn = e.target.closest(".tab-btn");
            if (btn) this.switchTraineeTab(btn.dataset.tab);
        });
    },

    switchTraineeTab(tabName) {
        // 更新按钮状态
        document.querySelectorAll("#view-trainee .tab-btn").forEach(b => {
            b.classList.toggle("active", b.dataset.tab === tabName);
        });
        // 更新面板
        document.querySelectorAll("#view-trainee .tab-panel").forEach(p => {
            p.classList.toggle("active", p.id === "trainee-panel-" + tabName);
        });
        // 渲染对应内容
        if (tabName === "cognition") Cognition.renderPanel();
        if (tabName === "study") Trainee.renderStudyPanel();
        if (tabName === "exam") Trainee.renderExamPanel();
        if (tabName === "script") Trainee.renderScriptPanel();
        if (tabName === "progress") Trainee.renderProgressPanel();
    },

    // ===== 培训师端 Tab 切换 =====
    bindTrainerTabs() {
        const nav = document.querySelector("#view-trainer .tab-nav");
        if (!nav || nav._delegated) return; // 防止重复绑定
        nav._delegated = true;
        nav.addEventListener("click", (e) => {
            const btn = e.target.closest(".tab-btn");
            if (btn) this.switchTrainerTab(btn.dataset.tab);
        });
    },

    switchTrainerTab(tabName) {
        document.querySelectorAll("#view-trainer .tab-btn").forEach(b => {
            b.classList.toggle("active", b.dataset.tab === tabName);
        });
        document.querySelectorAll("#view-trainer .tab-panel").forEach(p => {
            p.classList.toggle("active", p.id === "trainer-panel-" + tabName);
        });
        // 记录当前 Tab，供数据同步时自动刷新
        this._currentTrainerTab = tabName;
        if (tabName === "content") Trainer.renderContentPanel();
        if (tabName === "monitor") Trainer.renderMonitorPanel();
    },

    /** 监听远端数据同步事件，自动刷新培训师当前面板 */
    _bindSyncListener() {
        window.addEventListener("db-synced", () => {
            if (Auth.role !== "trainer") return;
            const tab = this._currentTrainerTab;
            if (tab === "monitor") Trainer.renderMonitorPanel();
            else if (tab === "content") Trainer.renderContentPanel();
        });
    },
};

// ===== 启动 =====
document.addEventListener("DOMContentLoaded", () => App.init());
