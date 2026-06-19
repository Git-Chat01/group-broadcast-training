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

    init() {
        // 1. 初始化数据
        DB.init(Defaults);

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

        // 5. 默认显示登录页
        this.showView("login");
    },

    /** 动态加载 JSZip 和 XLSX */
    loadLibs() {
        // JSZip（用于 docx 解析）
        if (typeof JSZip === "undefined") {
            const s1 = document.createElement("script");
            s1.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
            document.head.appendChild(s1);
        }
        // SheetJS（用于 xlsx 解析）
        if (typeof XLSX === "undefined") {
            const s2 = document.createElement("script");
            s2.src = "https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js";
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
            const isHidden = form.style.display === "none";
            form.style.display = isHidden ? "flex" : "none";
            document.getElementById("btnToggleTrainer").textContent = isHidden ? "培训师管理 ▲" : "培训师管理";
        });

        // 新人登录
        document.getElementById("btnTraineeLogin").addEventListener("click", () => {
            const name = document.getElementById("inputTraineeName").value;
            const result = Auth.loginAsTrainee(name);
            if (!result.ok) {
                alert(result.error);
                return;
            }
            document.getElementById("traineeNameDisplay").textContent = name;
            this.showView("trainee");
            this.bindTraineeTabs();
            this.switchTraineeTab("cognition");
        });

        // 回车快捷登录
        document.getElementById("inputTraineeName").addEventListener("keydown", (e) => {
            if (e.key === "Enter") document.getElementById("btnTraineeLogin").click();
        });

        // 培训师登录
        document.getElementById("btnTrainerLogin").addEventListener("click", () => {
            const pwd = document.getElementById("inputAdminPassword").value;
            const result = Auth.loginAsTrainer(pwd);
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

    logout() {
        Auth.logout();
        this.showView("login");
        document.getElementById("inputAdminPassword").value = "";
        document.getElementById("loginError").style.display = "none";
    },

    // ===== 新人端 Tab 切换 =====
    bindTraineeTabs() {
        const nav = document.querySelector("#view-trainee .tab-nav");
        if (!nav) return;
        nav.querySelectorAll(".tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                this.switchTraineeTab(btn.dataset.tab);
            });
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
        if (!nav) return;
        nav.querySelectorAll(".tab-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                this.switchTrainerTab(btn.dataset.tab);
            });
        });
    },

    switchTrainerTab(tabName) {
        document.querySelectorAll("#view-trainer .tab-btn").forEach(b => {
            b.classList.toggle("active", b.dataset.tab === tabName);
        });
        document.querySelectorAll("#view-trainer .tab-panel").forEach(p => {
            p.classList.toggle("active", p.id === "trainer-panel-" + tabName);
        });
        if (tabName === "content") Trainer.renderContentPanel();
        if (tabName === "monitor") Trainer.renderMonitorPanel();
    }
};

// ===== 启动 =====
document.addEventListener("DOMContentLoaded", () => App.init());
