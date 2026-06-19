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
            localStorage.setItem("checklist", JSON.stringify(defaults.checklist || []));
            localStorage.setItem("scriptTemplates", JSON.stringify(defaults.scriptTemplates || []));
            localStorage.setItem("cognition", JSON.stringify(defaults.cognition || []));
            localStorage.setItem("trainees", JSON.stringify(defaults.trainees || {}));
            localStorage.setItem("dataVersion", codeVersion);
            return;
        }

        // 版本一致：无需更新
        if (storedVersion === codeVersion) return;

        // 版本不一致：智能合并（仅合并模板/题库/清单数据）
        this._mergeModules(defaults.modules || []);
        this._mergeExams(defaults.exams || {});
        this._mergeChecklist(defaults.checklist || []);
        this._mergeScriptTemplates(defaults.scriptTemplates || []);
        this._mergeCognition(defaults.cognition || []);
        // ⚠️ 以下两项为运行态用户数据，任何情况下都不覆盖、不删除：
        //    adminPassword — 培训师自设密码
        //    trainees — 所有新人的考试记录、能力清单进度、话术版本
        //    丢失这些数据 = 培训数据全毁，属于严重事故
        localStorage.setItem("dataVersion", codeVersion);
    },

    /**
     * 智能合并模块：
     * - 新模块（ID 不存在）→ 自动添加
     * - 已有模块 → 用默认数据更新 content/title/hasExam/examId
     * - 已废弃模块（不在默认列表中）→ 自动删除
     */
    _mergeModules(defaultModules) {
        const existing = this.getModules();
        const defaultIds = new Set(defaultModules.map(m => m.id));

        // 删除已废弃的模块（不在新默认列表中的）
        let filtered = existing.filter(m => defaultIds.has(m.id));
        if (filtered.length !== existing.length) {
            existing.length = 0;
            existing.push(...filtered);
        }

        const existingMap = new Map(existing.map(m => [m.id, m]));

        defaultModules.forEach(dm => {
            const old = existingMap.get(dm.id);
            if (!old) {
                // 新模块：直接添加
                existing.push(dm);
            } else {
                // 已有模块：用默认内容覆盖
                old.title = dm.title;
                old.content = dm.content;
                old.hasExam = dm.hasExam;
                old.examId = dm.examId;
            }
        });

        this.saveModules(existing);
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

    /**
     * 智能合并清单：
     * - 新项（ID 不存在）→ 自动添加
     * - 已有项 → 用默认数据更新 category/item 文本
     * - 已删除的项保留（培训师可能已习惯某项）
     */
    _mergeChecklist(defaultChecklist) {
        const existing = this.getChecklist();
        const existingMap = new Map(existing.map(m => [m.id, m]));
        let changed = false;

        defaultChecklist.forEach(dm => {
            const old = existingMap.get(dm.id);
            if (!old) {
                existing.push(dm);
                changed = true;
            } else {
                old.category = dm.category;
                old.item = dm.item;
                changed = true;
            }
        });

        if (changed) this.saveChecklist(existing);
    },

    /**
     * 智能合并话术模板：
     * - 新模板（ID 不存在）→ 自动添加
     * - 已有模板 → 用默认数据更新所有字段
     * ⚠️ 绝不删除已有模板 —— 即使某个模板从 Defaults 中移除，
     *    也要保留在 localStorage 中，因为可能有新人的话术版本数据关联此 ID。
     *    删除模板 ID 会导致新人的话术数据变成"孤儿数据"无法访问。
     */
    _mergeScriptTemplates(defaultTemplates) {
        const existing = this.getScriptTemplates();
        const existingMap = new Map(existing.map(m => [m.id, m]));
        let changed = false;

        defaultTemplates.forEach(dt => {
            const old = existingMap.get(dt.id);
            if (!old) {
                existing.push(dt);
                changed = true;
            } else {
                old.category = dt.category;
                old.scene = dt.scene;
                old.goal = dt.goal;
                old.logic = dt.logic;
                old.examples = dt.examples;
                old.tips = dt.tips;
                changed = true;
            }
        });

        if (changed) this.saveScriptTemplates(existing);
    },

    /**
     * 智能合并团播认知：
     * - 新卡片（ID 不存在）→ 自动添加
     * - 已有卡片 → 用默认数据更新 title/content/scenario
     * - 已删除的卡片保留（不主动删数据）
     */
    _mergeCognition(defaultCards) {
        const existing = this.getCognition();
        const existingMap = new Map(existing.map(m => [m.id, m]));
        let changed = false;

        defaultCards.forEach(dc => {
            const old = existingMap.get(dc.id);
            if (!old) {
                existing.push(dc);
                changed = true;
            } else {
                old.title = dc.title;
                old.content = dc.content;
                old.scenario = dc.scenario;
                changed = true;
            }
        });

        if (changed) this.saveCognition(existing);
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

    // ===== 能力清单 =====
    getChecklist() {
        try { return JSON.parse(localStorage.getItem("checklist")) || []; }
        catch (e) { return []; }
    },
    saveChecklist(checklist) {
        localStorage.setItem("checklist", JSON.stringify(checklist));
    },

    // ===== 团播认知 =====
    getCognition() {
        try { return JSON.parse(localStorage.getItem("cognition")) || []; }
        catch (e) { return []; }
    },
    saveCognition(cards) {
        localStorage.setItem("cognition", JSON.stringify(cards));
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

    /** 计算所有新人的综合排名
     *  话术质量权重：基础1.0 + 批注×0.2 + 版本≥2×0.05 × (版本数-1, 上限0.15) */
    getRankings() {
        const all = this.getTraineesAll();
        const templates = this.getScriptTemplates();
        const checklist = this.getChecklist();
        const exams = this.getExams();
        const totalExamIds = Object.keys(exams).length;
        const prevSnapshot = this._getLatestRankingSnapshot();

        return all.map(t => {
            // 话术分 — 质量加权
            const scripts = t.scripts || {};
            let scriptDone = 0;
            let scriptQualitySum = 0;
            templates.forEach(tmpl => {
                const s = scripts[tmpl.id];
                if (s && (s.completed || s.status === "submitted" || s.status === "reviewed")) {
                    scriptDone++;
                    let weight = 1.0;
                    // 培训师批注加权
                    const activeV = s.versions ? s.versions[s.activeVersion - 1] : null;
                    if (activeV && activeV.feedback) weight += 0.2;
                    // 版本积累加权（版本≥2时每多一个版本+0.05，上限0.15）
                    const vCount = s.versions ? s.versions.length : 1;
                    if (vCount >= 2) {
                        weight += Math.min((vCount - 1) * 0.05, 0.15);
                    }
                    scriptQualitySum += weight;
                }
            });
            const scriptRaw = templates.length > 0 ? Math.round(scriptDone / templates.length * 100) : 0;
            const scriptQuality = templates.length > 0 ? Math.round(scriptQualitySum / templates.length * 100) : 0;
            // 话术分 = 数量分×0.4 + 质量分×0.6
            const scriptScore = Math.round(scriptRaw * 0.4 + scriptQuality * 0.6);

            // 考试分
            const history = t.examHistory || [];
            const examScore = history.length > 0
                ? Math.round(history.reduce((s, r) => s + r.score, 0) / history.length)
                : 0;

            // 能力分
            const cp = t.checklistProgress || {};
            const clMastered = checklist.filter(c => cp[c.id] === "mastered").length;
            const clScore = checklist.length > 0 ? Math.round(clMastered / checklist.length * 100) : 0;

            // 综合分
            const total = Math.round(scriptScore * 0.5 + examScore * 0.3 + clScore * 0.2);

            // 上榜门槛
            const examPassed = history.filter(r => r.score >= 60).length;
            const qualified = scriptDone >= 3 || examPassed >= 1;

            // 排名变化（对比上次快照）
            const prev = prevSnapshot ? prevSnapshot.rankings.find(r => r.name === t.name) : null;
            const prevRank = prev ? prev.rank : null;
            const prevTotal = prev ? prev.total : null;

            // 徽章
            const badges = [];
            if (scriptDone >= templates.length && templates.length > 0) badges.push({ id: "script-master", name: "话术全通", icon: "📝" });
            if (examPassed >= totalExamIds && totalExamIds > 0) badges.push({ id: "exam-ace", name: "学霸", icon: "🎓" });
            if (clMastered >= checklist.length && checklist.length > 0) badges.push({ id: "hardware-pro", name: "硬件达人", icon: "🔧" });
            if (scriptDone >= 8) badges.push({ id: "script-lv2", name: "话术达人 Lv.2", icon: "💬" });
            else if (scriptDone >= 3) badges.push({ id: "script-lv1", name: "话术达人 Lv.1", icon: "💬" });
            if (clMastered >= 25) badges.push({ id: "hardware-lv2", name: "设备能手 Lv.2", icon: "⚡" });
            else if (clMastered >= 12) badges.push({ id: "hardware-lv1", name: "设备能手 Lv.1", icon: "⚡" });

            return {
                name: t.name,
                total,
                qualified,
                scriptScore,
                scriptDone,
                scriptTotal: templates.length,
                scriptRaw,
                scriptQuality,
                examScore,
                examPassed,
                examTotal: totalExamIds,
                clScore,
                clMastered,
                clTotal: checklist.length,
                prevRank,
                prevTotal,
                badges
            };
        }).sort((a, b) => {
            if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
            return b.total - a.total;
        });
    },

    /** 保存排名快照（用于计算排名变化） */
    saveRankingSnapshot() {
        const rankings = this.getRankings();
        const qualified = rankings.filter(r => r.qualified);
        // 只保存上榜的人 + 排名
        const snapshot = {
            date: new Date().toISOString().slice(0, 10),
            rankings: qualified.map((r, i) => ({ name: r.name, rank: i + 1, total: r.total }))
        };
        const history = this._getRankingHistory();
        // 同一天只保留最新一份
        const existing = history.findIndex(h => h.date === snapshot.date);
        if (existing >= 0) history[existing] = snapshot;
        else history.push(snapshot);
        // 只保留最近 30 条
        if (history.length > 30) history.shift();
        localStorage.setItem("rankingHistory", JSON.stringify(history));
    },

    _getRankingHistory() {
        try { return JSON.parse(localStorage.getItem("rankingHistory")) || []; }
        catch (e) { return []; }
    },

    _getLatestRankingSnapshot() {
        const history = this._getRankingHistory();
        return history.length > 0 ? history[history.length - 1] : null;
    },

    /** 获取或创建新人记录 */
    getTrainee(name) {
        const trainees = this.getTrainees();
        if (!trainees[name]) {
            trainees[name] = { moduleProgress: {}, examHistory: [], checklistProgress: {} };
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

    /** 更新新人清单项状态（mastered / unskilled / unlearned） */
    setChecklistItem(name, itemId, status) {
        const trainees = this.getTrainees();
        if (!trainees[name]) trainees[name] = { moduleProgress: {}, examHistory: [], checklistProgress: {} };
        if (!trainees[name].checklistProgress) trainees[name].checklistProgress = {};
        trainees[name].checklistProgress[itemId] = status;
        this.saveTrainees(trainees);
    },

    /** 获取新人清单进度（返回 map: itemId → status） */
    getChecklistProgress(name) {
        const t = this.getTrainee(name);
        return t.checklistProgress || {};
    },

    // ===== 话术模板 =====
    getScriptTemplates() {
        try { return JSON.parse(localStorage.getItem("scriptTemplates")) || []; }
        catch (e) { return []; }
    },
    saveScriptTemplates(templates) {
        localStorage.setItem("scriptTemplates", JSON.stringify(templates));
    },

    // ===== 新人话术版本 =====

    /** 获取新人所有话术数据 */
    getScripts(name) {
        const t = this.getTrainee(name);
        return t.scripts || {};
    },

    /** 保存新版本（每次保存递增版本号，新建副本） */
    saveScriptVersion(name, templateId, content, status) {
        const trainees = this.getTrainees();
        if (!trainees[name]) trainees[name] = { moduleProgress: {}, examHistory: [], checklistProgress: {} };
        if (!trainees[name].scripts) trainees[name].scripts = {};

        const sc = trainees[name].scripts[templateId] || { versions: [], activeVersion: 0 };
        const newVersion = sc.versions.length + 1;

        sc.versions.push({
            version: newVersion,
            content: content,
            createdAt: new Date().toLocaleString("zh-CN"),
            feedback: null
        });
        sc.activeVersion = newVersion;
        sc.status = status || "draft";

        trainees[name].scripts[templateId] = sc;
        this.saveTrainees(trainees);
        return newVersion;
    },

    /** 更新草稿（不创建新版本，直接修改当前激活版本的内容；首次保存自动创建） */
    saveScriptDraft(name, templateId, content) {
        const trainees = this.getTrainees();
        if (!trainees[name]) trainees[name] = { moduleProgress: {}, examHistory: [], checklistProgress: {} };
        if (!trainees[name].scripts) trainees[name].scripts = {};

        const sc = trainees[name].scripts[templateId];
        // 首次保存：直接创建版本1
        if (!sc) {
            trainees[name].scripts[templateId] = {
                versions: [{ version: 1, content: content, createdAt: new Date().toLocaleString("zh-CN"), feedback: null }],
                activeVersion: 1,
                status: "draft"
            };
            this.saveTrainees(trainees);
            return;
        }

        const active = sc.versions.find(v => v.version === sc.activeVersion);
        if (active && active.feedback === null) {
            active.content = content;
            active.createdAt = new Date().toLocaleString("zh-CN");
            sc.status = "draft";
        } else {
            const newVersion = sc.versions.length + 1;
            sc.versions.push({
                version: newVersion,
                content: content,
                createdAt: new Date().toLocaleString("zh-CN"),
                feedback: null
            });
            sc.activeVersion = newVersion;
            sc.status = "draft";
        }
        this.saveTrainees(trainees);
    },

    /** 提交给培训师 */
    submitScript(name, templateId) {
        const trainees = this.getTrainees();
        if (!trainees[name] || !trainees[name].scripts) return;
        const sc = trainees[name].scripts[templateId];
        if (sc) {
            sc.status = "submitted";
            this.saveTrainees(trainees);
        }
    },

    /** 切换激活版本 */
    setActiveScriptVersion(name, templateId, versionNum) {
        const trainees = this.getTrainees();
        if (!trainees[name] || !trainees[name].scripts) return;
        const sc = trainees[name].scripts[templateId];
        if (sc && sc.versions.find(v => v.version === versionNum)) {
            sc.activeVersion = versionNum;
            this.saveTrainees(trainees);
        }
    },

    /** 标记场景为已完成（试读或提交后调用） */
    markScriptCompleted(name, templateId) {
        const trainees = this.getTrainees();
        if (!trainees[name] || !trainees[name].scripts) return;
        const sc = trainees[name].scripts[templateId];
        if (sc && sc.versions.length > 0) {
            sc.completed = true;
            this.saveTrainees(trainees);
        }
    },

    /** 删除某新人的话术数据（保留考试记录和能力清单） */
    deleteTraineeScripts(name) {
        const trainees = this.getTrainees();
        if (trainees[name] && trainees[name].scripts) {
            delete trainees[name].scripts;
            this.saveTrainees(trainees);
        }
    },

    /** 清空所有新人的话术数据 */
    clearAllScripts() {
        const trainees = this.getTrainees();
        Object.keys(trainees).forEach(name => {
            if (trainees[name].scripts) {
                delete trainees[name].scripts;
            }
        });
        this.saveTrainees(trainees);
    },

    /** 培训师添加批注 */
    addScriptFeedback(name, templateId, versionNum, feedbackText) {
        const trainees = this.getTrainees();
        if (!trainees[name] || !trainees[name].scripts) return;
        const sc = trainees[name].scripts[templateId];
        if (!sc) return;
        const ver = sc.versions.find(v => v.version === versionNum);
        if (ver) {
            ver.feedback = {
                trainer: "培训师",
                text: feedbackText,
                createdAt: new Date().toLocaleString("zh-CN")
            };
            sc.status = "reviewed";
            this.saveTrainees(trainees);
        }
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

    // ===== 新人密码 =====

    /** 检测新人是否存在（不自动创建，区别于 getTrainee） */
    traineeExists(name) {
        const trainees = this.getTrainees();
        return !!trainees[name];
    },

    /** 获取新人密码哈希，不存在或旧数据返回 null */
    getTraineePasswordHash(name) {
        const trainees = this.getTrainees();
        const t = trainees[name];
        if (!t || !t.passwordHash) return null;
        return t.passwordHash;
    },

    /** 存储新人密码哈希（首次注册或修改密码时调用） */
    setTraineePassword(name, hash) {
        const trainees = this.getTrainees();
        if (!trainees[name]) {
            // 首次注册：创建新记录
            trainees[name] = { moduleProgress: {}, examHistory: [], checklistProgress: {} };
        }
        trainees[name].passwordHash = hash;
        this.saveTrainees(trainees);
    },

    /** 清除新人密码（培训师重置密码时调用，保留学习数据） */
    clearTraineePassword(name) {
        const trainees = this.getTrainees();
        if (trainees[name]) {
            delete trainees[name].passwordHash;
            this.saveTrainees(trainees);
        }
    },

    /** 重置全部数据 */
    resetAll(defaults) {
        localStorage.clear();
        this.init(defaults);
    }
};
