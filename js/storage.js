/* ============================================
   storage.js — localStorage 数据层封装
   所有数据读写统一走此模块，方便后续换后端
   ============================================ */

/**
 * HTML 转义工具 — 项目唯一的转义函数
 * 使用 DOM API 完整转义所有 HTML 特殊字符（& < > " '），
 * 同时适用于 HTML 正文和属性值场景。
 * Trainee.escapeHtml / Trainer.escHtml / Trainer.escAttr 均委托至此。
 */
function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

/**
 * 手风琴折叠工具 — 清单和话术分类共用
 * 由 Trainee.toggleCategory 委托，Trainer 直接调用，消除跨模块耦合
 */
function toggleAccordion(catId) {
    const body = document.getElementById(catId + "-body");
    const arrow = document.getElementById(catId + "-arrow");
    if (!body || !arrow) return;
    const isScript = body.classList.contains("script-cat-body");
    const bodySel = isScript ? ".script-cat-body" : ".checklist-cat-body";
    const arrowSel = isScript ? ".script-cat-arrow" : ".checklist-cat-arrow";
    if (body.style.display === "none") {
        document.querySelectorAll(bodySel).forEach(b => b.style.display = "none");
        document.querySelectorAll(arrowSel).forEach(a => a.textContent = "▶");
        body.style.display = "";
        arrow.textContent = "▼";
    } else {
        body.style.display = "none";
        arrow.textContent = "▶";
    }
}

const DB = {

    // ===== Firebase 同步层 =====

    /** 防止 Firebase onValue 监听器触发时重复写入 localStorage 的标记 */
    _syncing: false,

    /** 将单个 key 的值推送到 Firebase */
    async _syncKeyToFirebase(key) {
        if (!firebaseDB) return;
        try {
            this._syncing = true;
            const raw = localStorage.getItem(key);
            if (raw === null) return;
            let data;
            try { data = JSON.parse(raw); } catch (e) { data = raw; }
            if (key === "trainees" && data && typeof data === "object") {
                // 按新人粒度分别推送，避免多人同时写入互相覆盖
                const names = Object.keys(data);
                for (const name of names) {
                    await firebaseDB.ref("/cide/trainees/" + encodeURIComponent(name)).set(data[name]);
                }
            } else {
                await firebaseDB.ref("/cide/" + key).set(data);
            }
        } catch (err) {
            console.warn("[Firebase] 推送 " + key + " 失败：", err);
        } finally {
            this._syncing = false;
        }
    },

    /** 从 Firebase 拉取指定 key */
    async _pullKeyFromFirebase(key) {
        if (!firebaseDB) return null;
        try {
            const snap = await firebaseDB.ref("/cide/" + key).once("value");
            return snap.val();
        } catch (err) {
            console.warn("[Firebase] 拉取 " + key + " 失败：", err);
            return null;
        }
    },

    /** 从 Firebase 拉取全部数据到 localStorage */
    async _pullAllFromFirebase() {
        if (!firebaseDB) return;
        try {
            const snap = await firebaseDB.ref("/cide").once("value");
            const remote = snap.val();
            if (!remote) return; // 远端无数据，保留本地

            // 写入全局键
            const globalKeys = ["adminPassword", "dataVersion", "modules", "exams", "checklist", "scriptTemplates", "cognition"];
            for (const key of globalKeys) {
                if (remote[key] !== undefined) {
                    localStorage.setItem(key, typeof remote[key] === "string" ? remote[key] : JSON.stringify(remote[key]));
                }
            }

            // 合并 trainees：远端 trainees 按新人粒度合并到本地
            if (remote.trainees) {
                const localTrainees = this.getTrainees();
                const remoteNames = Object.keys(remote.trainees).map(decodeURIComponent);
                for (const name of remoteNames) {
                    const remoteData = remote.trainees[encodeURIComponent(name)] || remote.trainees[name];
                    // 远端数据覆盖本地同名新人（远端为最新）
                    localTrainees[name] = remoteData;
                }
                localStorage.setItem("trainees", JSON.stringify(localTrainees));
            }
        } catch (err) {
            console.warn("[Firebase] 全量拉取失败：", err);
        }
    },

    /** 启动 Firebase 实时监听（远端变化 → 自动同步到 localStorage） */
    _startFirebaseWatch() {
        if (!firebaseDB) return;
        firebaseDB.ref("/cide").on("value", (snap) => {
            if (this._syncing) return; // 自己的写入触发的，跳过
            const remote = snap.val();
            if (!remote) return;

            // 同步全局键
            const globalKeys = ["adminPassword", "dataVersion", "modules", "exams", "checklist", "scriptTemplates", "cognition"];
            for (const key of globalKeys) {
                if (remote[key] !== undefined) {
                    const localRaw = localStorage.getItem(key);
                    const remoteRaw = typeof remote[key] === "string" ? remote[key] : JSON.stringify(remote[key]);
                    if (localRaw !== remoteRaw) {
                        localStorage.setItem(key, remoteRaw);
                    }
                }
            }

            // 合并 trainees
            if (remote.trainees) {
                const localTrainees = this.getTrainees();
                let changed = false;
                const remoteNames = Object.keys(remote.trainees);
                for (const rawName of remoteNames) {
                    const name = decodeURIComponent(rawName);
                    const remoteData = remote.trainees[rawName];
                    const localData = localTrainees[name];
                    // 远端数据写入（覆盖同名）
                    if (!localData || JSON.stringify(localData) !== JSON.stringify(remoteData)) {
                        localTrainees[name] = remoteData;
                        changed = true;
                    }
                }
                if (changed) {
                    localStorage.setItem("trainees", JSON.stringify(localTrainees));
                }
            }
        });
    },

    // ===== 初始化 =====

    /**
     * 初始化：Firebase 拉取 → 版本号检测 + 智能合并 → Firebase 推送
     * 首次使用直接写入；代码更新后仅新增模块/试卷，不覆盖已有数据
     */
    async init(defaults) {
        // 1. 等待 Firebase 就绪，尝试从远端拉取最新数据
        await firebaseReady;
        if (firebaseDB) {
            await this._pullAllFromFirebase();
        }
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
        } else if (storedVersion !== codeVersion) {
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
        }
        // 版本一致：无需合并，跳过

        // 2. Firebase 可用时：推送本地最新数据到远端 + 启动实时监听
        if (firebaseDB) {
            // 推送全部 key 到 Firebase（确保远端与本地一致）
            const allKeys = ["adminPassword", "dataVersion", "modules", "exams", "checklist", "scriptTemplates", "cognition", "trainees"];
            for (const key of allKeys) {
                await this._syncKeyToFirebase(key);
            }
            // 启动实时监听
            this._startFirebaseWatch();
        }
    },

    /**
     * 通用数组智能合并 — 按 ID 匹配合并，消除 4 个 _merge* 的重复代码
     * @param {Array} existing - 已有数据数组
     * @param {Array} defaults - 默认数据数组
     * @param {Function} updateFn - 已有项更新回调 (old, new) => void
     * @param {boolean} deleteRemoved - 是否删除默认列表中不存在的项
     * @returns {boolean} 是否发生变更
     */
    _mergeArrayById(existing, defaults, updateFn, deleteRemoved) {
        let changed = false;
        if (deleteRemoved) {
            const defaultIds = new Set(defaults.map(m => m.id));
            const filtered = existing.filter(m => defaultIds.has(m.id));
            if (filtered.length !== existing.length) {
                existing.length = 0;
                existing.push(...filtered);
                changed = true;
            }
        }
        const existingMap = new Map(existing.map(m => [m.id, m]));
        defaults.forEach(d => {
            const old = existingMap.get(d.id);
            if (!old) {
                existing.push(d);
                changed = true;
            } else {
                updateFn(old, d);
                changed = true;
            }
        });
        return changed;
    },

    /**
     * 智能合并模块：
     * - 新模块 → 添加 / 已有 → 覆盖 / 废弃 → 删除
     */
    _mergeModules(defaultModules) {
        const existing = this.getModules();
        if (this._mergeArrayById(existing, defaultModules, (old, dm) => {
            old.title = dm.title;
            old.content = dm.content;
            old.hasExam = dm.hasExam;
            old.examId = dm.examId;
        }, true)) {
            this.saveModules(existing);
        }
    },

    /**
     * 智能合并试卷：直接覆盖（保留成绩数据在 trainees 中）
     */
    _mergeExams(defaultExams) {
        const existing = this.getExams();
        let changed = false;
        Object.keys(defaultExams).forEach(eid => {
            if (!existing[eid] || JSON.stringify(existing[eid]) !== JSON.stringify(defaultExams[eid])) {
                existing[eid] = defaultExams[eid];
                changed = true;
            }
        });
        if (changed) this.saveExams(existing);
    },

    /**
     * 智能合并清单：新项添加 / 已有更新文本 / 不删旧项
     */
    _mergeChecklist(defaultChecklist) {
        const existing = this.getChecklist();
        if (this._mergeArrayById(existing, defaultChecklist, (old, dm) => {
            old.category = dm.category;
            old.item = dm.item;
        })) {
            this.saveChecklist(existing);
        }
    },

    /**
     * 智能合并话术模板：新添 / 更新 / 绝不删除（有新人版本数据关联）
     */
    _mergeScriptTemplates(defaultTemplates) {
        const existing = this.getScriptTemplates();
        if (this._mergeArrayById(existing, defaultTemplates, (old, dt) => {
            old.category = dt.category;
            old.scene = dt.scene;
            old.goal = dt.goal;
            old.logic = dt.logic;
            old.examples = dt.examples;
            old.tips = dt.tips;
        })) {
            this.saveScriptTemplates(existing);
        }
    },

    /**
     * 智能合并团播认知：新卡片添加 / 已有更新 / 不删旧卡片
     */
    _mergeCognition(defaultCards) {
        const existing = this.getCognition();
        if (this._mergeArrayById(existing, defaultCards, (old, dc) => {
            old.title = dc.title;
            old.content = dc.content;
            old.scenario = dc.scenario;
        })) {
            this.saveCognition(existing);
        }
    },

    // ===== 管理密码 =====
    getAdminPassword() {
        return localStorage.getItem("adminPassword") || "admin123";
    },
    setAdminPassword(newPwd) {
        localStorage.setItem("adminPassword", newPwd);
        this._syncKeyToFirebase("adminPassword");
    },

    // ===== 培训模块 =====
    getModules() {
        try { return JSON.parse(localStorage.getItem("modules")) || []; }
        catch (e) { return []; }
    },
    saveModules(modules) {
        localStorage.setItem("modules", JSON.stringify(modules));
        this._syncKeyToFirebase("modules");
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
        this._syncKeyToFirebase("exams");
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
        this._syncKeyToFirebase("checklist");
    },

    // ===== 团播认知 =====
    getCognition() {
        try { return JSON.parse(localStorage.getItem("cognition")) || []; }
        catch (e) { return []; }
    },
    saveCognition(cards) {
        localStorage.setItem("cognition", JSON.stringify(cards));
        this._syncKeyToFirebase("cognition");
    },

    // ===== 新人数据 =====
    getTrainees() {
        try { return JSON.parse(localStorage.getItem("trainees")) || {}; }
        catch (e) { return {}; }
    },
    saveTrainees(trainees) {
        localStorage.setItem("trainees", JSON.stringify(trainees));
        this._syncKeyToFirebase("trainees");
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
            const examPassed = history.filter(r => r.score >= PASS_THRESHOLD).length;
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
        this._syncKeyToFirebase("scriptTemplates");
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
            sc.feedbackRead = false;  // 未读标记：新人打开详情时清除
            this.saveTrainees(trainees);
        }
    },

    /** 标记批注为已读（新人打开场景详情时调用） */
    markScriptFeedbackRead(name, templateId) {
        const trainees = this.getTrainees();
        if (!trainees[name] || !trainees[name].scripts) return;
        const sc = trainees[name].scripts[templateId];
        if (sc && sc.feedbackRead === false) {
            sc.feedbackRead = true;
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
    async resetAll(defaults) {
        localStorage.clear();
        await this.init(defaults);
    }
};
