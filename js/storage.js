/* ============================================
   storage.js — localStorage 数据层封装
   所有数据读写统一走此模块，方便后续换后端
   ============================================ */

const DB = {

    /**
     * 初始化：版本号检测 + 智能合并
     * 首次使用直接写入；代码更新后仅新增模块/试卷，不覆盖已有数据
     */
    init(defaults) {
        const storedVersion = localStorage.getItem("dataVersion");
        const codeVersion = String(typeof DATA_VERSION !== "undefined" ? DATA_VERSION : 1);

        // 首次初始化：全部写入
        if (!storedVersion) {
            localStorage.setItem("adminPassword", defaults.adminPassword || "admin123");
            localStorage.setItem("modules", JSON.stringify(defaults.modules || []));
            localStorage.setItem("exams", JSON.stringify(defaults.exams || {}));
            localStorage.setItem("trainees", JSON.stringify(defaults.trainees || {}));
            localStorage.setItem("dataVersion", codeVersion);
            return;
        }

        // 版本一致：无需更新
        if (storedVersion === codeVersion) return;

        // 版本不一致：智能合并
        this._mergeModules(defaults.modules || []);
        this._mergeExams(defaults.exams || {});
        // adminPassword 和 trainees 始终保留用户数据，不覆盖
        localStorage.setItem("dataVersion", codeVersion);
    },

    /**
     * 智能合并模块：
     * - 新模块（ID 不存在）→ 自动添加
     * - 已有模块 → 用默认数据更新 content/title/hasExam/examId
     *   这是为了确保代码更新（如加截图）能同步到已有用户
     */
    _mergeModules(defaultModules) {
        const existing = this.getModules();
        const existingMap = new Map(existing.map(m => [m.id, m]));
        let changed = false;

        defaultModules.forEach(dm => {
            const old = existingMap.get(dm.id);
            if (!old) {
                // 新模块：直接添加
                existing.push(dm);
                existingMap.set(dm.id, dm);
                changed = true;
            } else {
                // 已有模块：用默认内容覆盖，确保截图等更新生效
                old.title = dm.title;
                old.content = dm.content;
                old.hasExam = dm.hasExam;
                old.examId = dm.examId;
                changed = true;
            }
        });

        if (changed) this.saveModules(existing);
    },

    /**
     * 智能合并试卷：
     * - 新试卷（ID 不存在）→ 自动添加
     * - 已有试卷 → 用默认数据覆盖题目（确保图片等更新生效）
     *   考试记录存储在 trainees 中，覆盖试卷定义不会丢失成绩
     */
    _mergeExams(defaultExams) {
        const existing = this.getExams();
        let changed = false;
        Object.keys(defaultExams).forEach(eid => {
            if (!existing[eid]) {
                existing[eid] = defaultExams[eid];
                changed = true;
            } else {
                // 已有试卷：覆盖题目数据使图片等更新生效
                existing[eid] = defaultExams[eid];
                changed = true;
            }
        });
        if (changed) this.saveExams(existing);
    },

    // ===== 管理密码 =====
    getAdminPassword() {
        return localStorage.getItem("adminPassword") || "admin123";
    },
    setAdminPassword(newPwd) {
        localStorage.setItem("adminPassword", newPwd);
    },

    // ===== 培训模块 =====
    getModules() {
        try { return JSON.parse(localStorage.getItem("modules")) || []; }
        catch (e) { return []; }
    },
    saveModules(modules) {
        localStorage.setItem("modules", JSON.stringify(modules));
    },
    addModule(mod) {
        const modules = this.getModules();
        modules.push(mod);
        this.saveModules(modules);
    },
    updateModule(moduleId, updates) {
        const modules = this.getModules();
        const idx = modules.findIndex(m => m.id === moduleId);
        if (idx >= 0) { modules[idx] = { ...modules[idx], ...updates }; this.saveModules(modules); }
    },
    deleteModule(moduleId) {
        const modules = this.getModules().filter(m => m.id !== moduleId);
        this.saveModules(modules);
    },

    // ===== 试卷题库 =====
    getExams() {
        try { return JSON.parse(localStorage.getItem("exams")) || {}; }
        catch (e) { return {}; }
    },
    saveExams(exams) {
        localStorage.setItem("exams", JSON.stringify(exams));
    },
    getExam(examId) {
        return this.getExams()[examId] || null;
    },
    addExam(examId, examData) {
        const exams = this.getExams();
        exams[examId] = examData;
        this.saveExams(exams);
    },
    deleteExam(examId) {
        const exams = this.getExams();
        delete exams[examId];
        this.saveExams(exams);
    },

    // ===== 新人数据 =====
    getTrainees() {
        try { return JSON.parse(localStorage.getItem("trainees")) || {}; }
        catch (e) { return {}; }
    },
    saveTrainees(trainees) {
        localStorage.setItem("trainees", JSON.stringify(trainees));
    },

    /** 获取所有新人数据（数组格式，含名字字段，供导出/遍历使用） */
    getTraineesAll() {
        const trainees = this.getTrainees();
        return Object.keys(trainees).map(name => ({
            name,
            ...trainees[name]
        }));
    },

    /** 获取或创建新人记录 */
    getTrainee(name) {
        const trainees = this.getTrainees();
        if (!trainees[name]) {
            trainees[name] = { moduleProgress: {}, examHistory: [] };
            this.saveTrainees(trainees);
        }
        return trainees[name];
    },

    /** 更新新人的模块完成状态 */
    setModuleProgress(name, moduleId, completed) {
        const trainees = this.getTrainees();
        if (!trainees[name]) trainees[name] = { moduleProgress: {}, examHistory: [] };
        trainees[name].moduleProgress[moduleId] = completed;
        this.saveTrainees(trainees);
    },

    /** 添加考试记录 */
    addExamRecord(name, record) {
        const trainees = this.getTrainees();
        if (!trainees[name]) trainees[name] = { moduleProgress: {}, examHistory: [] };
        trainees[name].examHistory.unshift({
            ...record,
            date: new Date().toLocaleString("zh-CN")
        });
        this.saveTrainees(trainees);
    },

    /** 删除新人 */
    deleteTrainee(name) {
        const trainees = this.getTrainees();
        delete trainees[name];
        this.saveTrainees(trainees);
    },

    /** 重置全部数据 */
    resetAll(defaults) {
        localStorage.clear();
        this.init(defaults);
    }
};
