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
 * HTML 安全净化 — 移除 script 标签和危险属性（on* / javascript:）
 * 用于渲染培训师提交的 HTML 内容（模块正文、认知卡片等）前做防御性过滤。
 * 策略：DOM 解析 → 移除危险节点/属性 → 输出安全 HTML
 */
function stripScripts(html) {
  if (!html) return "";
  const doc = document.createElement("div");
  doc.innerHTML = html;
  // 移除所有 <script> 标签
  doc.querySelectorAll("script").forEach(el => el.remove());
  // 移除所有元素上的内联事件属性和 javascript: 链接
  doc.querySelectorAll("*").forEach(el => {
    const attrs = [...el.attributes];
    attrs.forEach(attr => {
      const name = attr.name.toLowerCase();
      // 移除所有 on* 事件属性
      if (/^on\w+/.test(name)) {
        el.removeAttribute(name);
      }
      // 移除 javascript: 协议的 href/src
      if ((name === "href" || name === "src") && /^\s*javascript:/i.test(attr.value)) {
        el.removeAttribute(name);
      }
    });
  });
  return doc.innerHTML;
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
    document.querySelectorAll(bodySel).forEach((b) => (b.style.display = "none"));
    document.querySelectorAll(arrowSel).forEach((a) => (a.textContent = "▶"));
    body.style.display = "";
    arrow.textContent = "▼";
  } else {
    body.style.display = "none";
    arrow.textContent = "▶";
  }
}

const DB = {
  // ===== GitHub API 同步层 =====

  /** 防止并发推送的标记 */
  _syncing: false,
  /** 远端文件 SHA（用于冲突检测） */
  _lastRemoteSHA: null,
  /** 是否有待推送的数据 */
  _syncPending: false,
  /** 轮询定时器 */
  _pollTimer: null,
  /** 排名缓存 + 时间戳（5 秒内不重复计算，避免 O(n×m) 开销） */
  _rankingsCache: null,
  _rankingsCacheTime: 0,

  /** 同步是否可用（Worker 代理模式 — Token 在服务端，前端无需持有） */
  _githubReady() {
    // Worker 模式：始终可用，鉴权由 Worker 的 GITHUB_TOKEN 环境变量处理
    if (typeof GITHUB_CONFIG !== "undefined" && GITHUB_CONFIG && GITHUB_CONFIG.syncWorker) return true;
    // 向后兼容：如果还配了旧版 token，也认为可用
    const token = GITHUB_CONFIG && GITHUB_CONFIG.token;
    return !!(token && token.startsWith("ghp_"));
  },

  /** 从 Worker 拉取 db.json 并写入 localStorage（Worker 代理 GitHub API） */
  async _pullFromGitHub() {
    if (!this._githubReady()) return false;
    try {
      const resp = await fetch(GITHUB_CONFIG.syncWorker + "/api/sync", {
        headers: { "X-Sync-Key": GITHUB_CONFIG.syncKey },
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        // 404 或 db.json 不存在 → 首次使用，正常跳过
        if (resp.status === 404 || err.exists === false) return false;
        throw new Error("HTTP " + resp.status + (err.message ? ": " + err.message : ""));
      }
      const result = await resp.json();
      if (!result.content) return false;
      this._lastRemoteSHA = result.sha;
      const remote = result.content; // Worker 已解码 base64，直接就是 JSON 对象

      // 将远端数据写入 localStorage（trainees 合并，其余覆盖）
      const staticKeys = [
        "adminPassword",
        "dataVersion",
        "modules",
        "exams",
        "checklist",
        "scriptTemplates",
        "cognition",
      ];
      let changed = false;
      // 静态数据：远端直接覆盖本地（培训师更新内容后所有人同步）
      for (const key of staticKeys) {
        if (remote[key] !== undefined) {
          const newVal =
            typeof remote[key] === "string" ? remote[key] : JSON.stringify(remote[key]);
          if (localStorage.getItem(key) !== newVal) {
            localStorage.setItem(key, newVal);
            changed = true;
          }
        }
      }
      // 新人数据：远端为权威数据源，两端都做乱码修复后再合并
      if (remote.trainees !== undefined) {
        let localTrainees = {};
        try {
          localTrainees = JSON.parse(localStorage.getItem("trainees")) || {};
        } catch (e) { /* ignore */ }

        // —— 浏览器端安全的乱码检测 + 修复（TextDecoder API） ——
        const fixName = function (name) {
          if (!name || /[一-鿿]/.test(name)) return name; // 已含中文，不乱码
          try {
            const bytes = new Uint8Array(name.length);
            for (let i = 0; i < name.length; i++) bytes[i] = name.charCodeAt(i) & 0xff;
            const fixed = new TextDecoder("utf-8").decode(bytes);
            if (/[一-鿿]/.test(fixed) && fixed !== name) return fixed;
          } catch (e) { /* ignore */ }
          return name;
        };
        const looksBad = function (name) {
          if (/[一-鿿]/.test(name)) return false; // 有中文，不乱码
          let latin1 = 0;
          for (let i = 0; i < name.length; i++) {
            const c = name.charCodeAt(i);
            if (c >= 0x80 && c <= 0xff) latin1++;
          }
          return !/[一-鿿]/.test(name) && (latin1 >= 2 || name.length > 20);
        };

        // —— 清洗远端 trainees ——
        const cleanRemote = {};
        let remoteFixed = 0;
        for (const [name, data] of Object.entries(remote.trainees)) {
          if (looksBad(name)) {
            const fixed = fixName(name);
            if (!looksBad(fixed)) { cleanRemote[fixed] = data; remoteFixed++; }
            // 修不好的乱码 → 丢弃
          } else {
            cleanRemote[name] = data;
          }
        }
        if (remoteFixed > 0) console.log("[Sync] 修复远端乱码新人:", remoteFixed, "个");

        // —— 清洗本地 trainees ——
        const cleanLocal = {};
        let localFixed = 0, localDropped = 0;
        for (const [name, data] of Object.entries(localTrainees)) {
          if (looksBad(name)) {
            const fixed = fixName(name);
            if (!looksBad(fixed)) { cleanLocal[fixed] = data; localFixed++; }
            else { localDropped++; }
          } else {
            cleanLocal[name] = data;
          }
        }
        if (localFixed > 0 || localDropped > 0) {
          console.log("[Sync] 修复本地乱码新人:", localFixed, "个, 丢弃:", localDropped, "个");
        }

        // —— 合并：远端优先，本地补充远端没有的 ——
        const merged = { ...cleanLocal, ...cleanRemote };
        for (const name of Object.keys(cleanLocal)) {
          if (!cleanRemote[name]) {
            merged[name] = cleanLocal[name];
          }
        }
        const mergedVal = JSON.stringify(merged);
        if (localStorage.getItem("trainees") !== mergedVal) {
          localStorage.setItem("trainees", mergedVal);
          changed = true;
        }
      }
      // 数据有变化时通知 UI 自动刷新
      if (changed) {
        window.dispatchEvent(new CustomEvent("db-synced"));
      }
      return true;
    } catch (err) {
      console.warn("[Sync] 拉取失败：", err);
      return false;
    }
  },

  /** 推送 localStorage 全部数据到 Worker → Worker 写入 GitHub db.json */
  async _pushToGitHub() {
    if (!this._githubReady() || this._syncing) return;
    this._syncing = true;
    this._syncPending = false;
    try {
      // 收集所有 key 的值
      const data = {};
      const keys = [
        "adminPassword",
        "dataVersion",
        "modules",
        "exams",
        "checklist",
        "scriptTemplates",
        "cognition",
        "trainees",
      ];
      for (const key of keys) {
        const raw = localStorage.getItem(key);
        if (raw !== null) {
          try {
            data[key] = JSON.parse(raw);
          } catch (e) {
            data[key] = raw;
          }
        }
      }

      const body = { content: data };
      // 如果有远端 SHA，带上以更新文件（而非创建）
      if (this._lastRemoteSHA) {
        body.sha = this._lastRemoteSHA;
      }

      const resp = await fetch(GITHUB_CONFIG.syncWorker + "/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sync-Key": GITHUB_CONFIG.syncKey,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        if (resp.status === 409 || err.conflict) {
          // SHA 冲突：远端有新数据，拉取合并后重试
          console.log("[Sync] SHA 冲突，合并远端数据后重试");
          await this._pullFromGitHub();
          this._syncing = false;
          await this._pushToGitHub();
          return;
        }
        throw new Error("HTTP " + resp.status + (err.message ? ": " + err.message : ""));
      }

      const result = await resp.json();
      this._lastRemoteSHA = result.sha || null;
    } catch (err) {
      console.warn("[Sync] 推送失败：", err);
    } finally {
      this._syncing = false;
    }
  },

  /** 延迟同步（防抖 2 秒，避免连续操作触发多次 API 调用） */
  _scheduleSync() {
    if (!this._githubReady()) return;
    if (this._syncPending) return; // 已有待执行的同步
    this._syncPending = true;
    setTimeout(() => this._pushToGitHub(), 2000);
  },

  /** 启动定期拉取（每 30 秒检查远端是否有新数据） */
  _startGitHubPolling() {
    if (!this._githubReady() || this._pollTimer) return;
    this._pollTimer = setInterval(async () => {
      // 正在推送或 2s 内有待推送 → 跳过，避免把 GitHub 旧数据拉下来覆盖本地新修改
      if (this._syncing || this._syncPending) return;
      await this._pullFromGitHub();
    }, 30000);
  },

  /** 停止定期拉取（登出时调用，防止定时器在用户切换后继续运行） */
  _stopGitHubPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  },

  // ===== 初始化 =====

  /**
   * 初始化：GitHub 拉取 → 版本号检测 + 智能合并 → GitHub 推送
   * 首次使用直接写入；代码更新后仅新增模块/试卷，不覆盖已有数据
   */
  async init(defaults) {
    // 1. 尝试从 GitHub 拉取最新数据（覆盖本地 localStorage）
    if (this._githubReady()) {
      await this._pullFromGitHub();
    }

    const storedVersion = localStorage.getItem("dataVersion");
    const codeVersion = String(typeof DATA_VERSION !== "undefined" ? DATA_VERSION : 1);

    // 首次初始化：全部写入
    if (!storedVersion) {
      localStorage.setItem("adminPassword", defaults.adminPassword || "");
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

    // 2. GitHub 可用时：推送本地最新数据到远端 + 启动定期拉取
    if (this._githubReady()) {
      await this._pushToGitHub();
      this._startGitHubPolling();
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
      const defaultIds = new Set(defaults.map((m) => m.id));
      const filtered = existing.filter((m) => defaultIds.has(m.id));
      if (filtered.length !== existing.length) {
        existing.length = 0;
        existing.push(...filtered);
        changed = true;
      }
    }
    const existingMap = new Map(existing.map((m) => [m.id, m]));
    defaults.forEach((d) => {
      const old = existingMap.get(d.id);
      if (!old) {
        existing.push(d);
        changed = true;
      } else {
        // 仅在 updateFn 真的修改了数据时才标记变更（避免无变化的版本升级触发全量保存）
        const before = JSON.stringify(old);
        updateFn(old, d);
        if (JSON.stringify(old) !== before) changed = true;
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
    if (
      this._mergeArrayById(
        existing,
        defaultModules,
        (old, dm) => {
          old.title = dm.title;
          old.content = dm.content;
          old.hasExam = dm.hasExam;
          old.examId = dm.examId;
        },
        true,
      )
    ) {
      this.saveModules(existing);
    }
  },

  /**
   * 智能合并试卷：逐题按 id 合并，而非整卷替换。
   * - 新增试卷 → 直接添加
   * - 已有试卷 → 更新标题 + 逐题合并（新增/更新，保留培训师自定义题目）
   * - 学员成绩记录存储在 trainees 中，不受试卷合并影响
   */
  _mergeExams(defaultExams) {
    const existing = this.getExams();
    let changed = false;
    Object.keys(defaultExams).forEach((eid) => {
      if (!existing[eid]) {
        // 全新试卷：直接添加
        existing[eid] = defaultExams[eid];
        changed = true;
      } else {
        // 已有试卷：更新标题 + 逐题按 id 合并
        if (existing[eid].title !== defaultExams[eid].title) {
          existing[eid].title = defaultExams[eid].title;
          changed = true;
        }
        const existingQs = existing[eid].questions || [];
        const defaultQs = defaultExams[eid].questions || [];
        // 逐题合并：新增题目 → 添加；已有题目 → 更新题目内容、选项、答案、解析
        // deleteRemoved = false：不删除培训师可能添加的自定义题目
        if (this._mergeArrayById(
          existingQs,
          defaultQs,
          (oldQ, newQ) => {
            oldQ.type = newQ.type;
            oldQ.question = newQ.question;
            oldQ.images = newQ.images;
            oldQ.options = newQ.options;
            oldQ.answer = newQ.answer;
            oldQ.explanation = newQ.explanation;
          },
          false
        )) {
          changed = true;
        }
      }
    });
    if (changed) this.saveExams(existing);
  },

  /**
   * 智能合并清单：新项添加 / 已有更新文本 / 删除废弃项
   * 删除旧项不会影响 trainee 的 checklistProgress（进度按 id 存储，无对应项即不展示）
   */
  _mergeChecklist(defaultChecklist) {
    const existing = this.getChecklist();
    if (
      this._mergeArrayById(existing, defaultChecklist, (old, dm) => {
        old.category = dm.category;
        old.item = dm.item;
      }, true)
    ) {
      this.saveChecklist(existing);
    }
  },

  /**
   * 智能合并话术模板：新添 / 更新 / 绝不删除（有新人版本数据关联）
   */
  _mergeScriptTemplates(defaultTemplates) {
    const existing = this.getScriptTemplates();
    if (
      this._mergeArrayById(existing, defaultTemplates, (old, dt) => {
        old.category = dt.category;
        old.scene = dt.scene;
        old.goal = dt.goal;
        old.logic = dt.logic;
        old.examples = dt.examples;
        old.tips = dt.tips;
      })
    ) {
      this.saveScriptTemplates(existing);
    }
  },

  /**
   * 智能合并团播认知：新卡片添加 / 已有更新 / 不删旧卡片
   */
  _mergeCognition(defaultCards) {
    const existing = this.getCognition();
    if (
      this._mergeArrayById(existing, defaultCards, (old, dc) => {
        old.title = dc.title;
        old.content = dc.content;
        old.scenario = dc.scenario;
      })
    ) {
      this.saveCognition(existing);
    }
  },

  // ===== 管理密码 =====
  getAdminPassword() {
    // 安全加固（2026-08-15）：删除明文默认密码兜底。
    // 空值表示"未设置密码"，登录必然失败（fail-closed），
    // 正常流程下 init() 会用 data.js 中的哈希默认值初始化。
    return localStorage.getItem("adminPassword") || "";
  },
  setAdminPassword(newPwd) {
    localStorage.setItem("adminPassword", newPwd);
    this._scheduleSync();
  },

  // ===== 培训模块 =====
  getModules() {
    try {
      return JSON.parse(localStorage.getItem("modules")) || [];
    } catch (e) {
      return [];
    }
  },
  saveModules(modules) {
    localStorage.setItem("modules", JSON.stringify(modules));
    this._scheduleSync();
  },
  addModule(mod) {
    const modules = this.getModules();
    modules.push(mod);
    this.saveModules(modules);
  },
  updateModule(moduleId, updates) {
    const modules = this.getModules();
    const idx = modules.findIndex((m) => m.id === moduleId);
    if (idx >= 0) {
      modules[idx] = { ...modules[idx], ...updates };
      this.saveModules(modules);
    }
  },
  deleteModule(moduleId) {
    const modules = this.getModules().filter((m) => m.id !== moduleId);
    this.saveModules(modules);
  },

  // ===== 试卷题库 =====
  getExams() {
    try {
      return JSON.parse(localStorage.getItem("exams")) || {};
    } catch (e) {
      return {};
    }
  },
  saveExams(exams) {
    localStorage.setItem("exams", JSON.stringify(exams));
    this._scheduleSync();
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
    try {
      return JSON.parse(localStorage.getItem("checklist")) || [];
    } catch (e) {
      return [];
    }
  },
  saveChecklist(checklist) {
    localStorage.setItem("checklist", JSON.stringify(checklist));
    this._scheduleSync();
  },

  // ===== 团播认知 =====
  getCognition() {
    try {
      return JSON.parse(localStorage.getItem("cognition")) || [];
    } catch (e) {
      return [];
    }
  },
  saveCognition(cards) {
    localStorage.setItem("cognition", JSON.stringify(cards));
    this._scheduleSync();
  },

  // ===== 新人数据 =====
  getTrainees() {
    try {
      return JSON.parse(localStorage.getItem("trainees")) || {};
    } catch (e) {
      return {};
    }
  },
  saveTrainees(trainees) {
    localStorage.setItem("trainees", JSON.stringify(trainees));
    this._scheduleSync();
  },

  /** 获取所有新人数据（数组格式，含名字字段，供导出/遍历使用） */
  getTraineesAll() {
    const trainees = this.getTrainees();
    return Object.keys(trainees).map((name) => ({
      name,
      ...trainees[name],
    }));
  },

  /** 计算所有新人的综合排名（5 秒内缓存有效，避免渲染和快照保存时重复 O(n×m) 遍历）
   *  话术质量权重：基础1.0 + 批注×0.2 + 版本≥2×0.05 × (版本数-1, 上限0.15) */
  getRankings() {
    // 5 秒内返回缓存结果
    if (this._rankingsCache && Date.now() - this._rankingsCacheTime < 5000) {
      return this._rankingsCache;
    }
    const all = this.getTraineesAll();
    const templates = this.getScriptTemplates();
    const checklist = this.getChecklist();
    const exams = this.getExams();
    const totalExamIds = Object.keys(exams).length;
    const prevSnapshot = this._getLatestRankingSnapshot();

    const result = all
      .map((t) => {
        // 话术分 — 质量加权
        const scripts = t.scripts || {};
        let scriptDone = 0;
        let scriptQualitySum = 0;
        templates.forEach((tmpl) => {
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
        const scriptRaw =
          templates.length > 0 ? Math.round((scriptDone / templates.length) * 100) : 0;
        const scriptQuality =
          templates.length > 0 ? Math.round((scriptQualitySum / templates.length) * 100) : 0;
        // 话术分 = 数量分×0.4 + 质量分×0.6
        const scriptScore = Math.round(scriptRaw * 0.4 + scriptQuality * 0.6);

        // 考试分
        const history = t.examHistory || [];
        const examScore =
          history.length > 0
            ? Math.round(history.reduce((s, r) => s + r.score, 0) / history.length)
            : 0;

        // 能力分
        const cp = t.checklistProgress || {};
        const clMastered = checklist.filter((c) => cp[c.id] === "mastered").length;
        const clScore =
          checklist.length > 0 ? Math.round((clMastered / checklist.length) * 100) : 0;

        // 综合分
        const total = Math.round(scriptScore * 0.5 + examScore * 0.3 + clScore * 0.2);

        // 上榜门槛
        const examPassed = history.filter((r) => r.score >= PASS_THRESHOLD).length;
        const qualified = scriptDone >= 3 || examPassed >= 1;

        // 排名变化（对比上次快照）
        const prev = prevSnapshot ? prevSnapshot.rankings.find((r) => r.name === t.name) : null;
        const prevRank = prev ? prev.rank : null;
        const prevTotal = prev ? prev.total : null;

        // 徽章
        const badges = [];
        if (scriptDone >= templates.length && templates.length > 0)
          badges.push({ id: "script-master", name: "话术全通", icon: "📝" });
        if (examPassed >= totalExamIds && totalExamIds > 0)
          badges.push({ id: "exam-ace", name: "学霸", icon: "🎓" });
        if (clMastered >= checklist.length && checklist.length > 0)
          badges.push({ id: "hardware-pro", name: "硬件达人", icon: "🔧" });
        if (scriptDone >= 8) badges.push({ id: "script-lv2", name: "话术达人 Lv.2", icon: "💬" });
        else if (scriptDone >= 3)
          badges.push({ id: "script-lv1", name: "话术达人 Lv.1", icon: "💬" });
        if (clMastered >= 25)
          badges.push({ id: "hardware-lv2", name: "设备能手 Lv.2", icon: "⚡" });
        else if (clMastered >= 12)
          badges.push({ id: "hardware-lv1", name: "设备能手 Lv.1", icon: "⚡" });

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
          badges,
        };
      })
      .sort((a, b) => {
        if (a.qualified !== b.qualified) return a.qualified ? -1 : 1;
        return b.total - a.total;
      });
    this._rankingsCache = result;
    this._rankingsCacheTime = Date.now();
    return result;
  },

  /** 保存排名快照（用于计算排名变化） */
  saveRankingSnapshot() {
    const rankings = this.getRankings();
    const qualified = rankings.filter((r) => r.qualified);
    // 只保存上榜的人 + 排名
    const snapshot = {
      date: new Date().toISOString().slice(0, 10),
      rankings: qualified.map((r, i) => ({ name: r.name, rank: i + 1, total: r.total })),
    };
    const history = this._getRankingHistory();
    // 同一天只保留最新一份
    const existing = history.findIndex((h) => h.date === snapshot.date);
    if (existing >= 0) history[existing] = snapshot;
    else history.push(snapshot);
    // 只保留最近 30 条
    if (history.length > 30) history.shift();
    localStorage.setItem("rankingHistory", JSON.stringify(history));
  },

  _getRankingHistory() {
    try {
      return JSON.parse(localStorage.getItem("rankingHistory")) || [];
    } catch (e) {
      return [];
    }
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
    if (!trainees[name])
      trainees[name] = { moduleProgress: {}, examHistory: [], checklistProgress: {} };
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
    try {
      return JSON.parse(localStorage.getItem("scriptTemplates")) || [];
    } catch (e) {
      return [];
    }
  },
  saveScriptTemplates(templates) {
    localStorage.setItem("scriptTemplates", JSON.stringify(templates));
    this._scheduleSync();
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
    if (!trainees[name])
      trainees[name] = { moduleProgress: {}, examHistory: [], checklistProgress: {} };
    if (!trainees[name].scripts) trainees[name].scripts = {};

    const sc = trainees[name].scripts[templateId] || { versions: [], activeVersion: 0 };
    const newVersion = sc.versions.length + 1;

    sc.versions.push({
      version: newVersion,
      content: content,
      createdAt: new Date().toLocaleString("zh-CN"),
      feedback: null,
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
    if (!trainees[name])
      trainees[name] = { moduleProgress: {}, examHistory: [], checklistProgress: {} };
    if (!trainees[name].scripts) trainees[name].scripts = {};

    const sc = trainees[name].scripts[templateId];
    // 首次保存：直接创建版本1
    if (!sc) {
      trainees[name].scripts[templateId] = {
        versions: [
          {
            version: 1,
            content: content,
            createdAt: new Date().toLocaleString("zh-CN"),
            feedback: null,
          },
        ],
        activeVersion: 1,
        status: "draft",
      };
      this.saveTrainees(trainees);
      return;
    }

    const active = sc.versions.find((v) => v.version === sc.activeVersion);
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
        feedback: null,
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
    if (sc && sc.versions.find((v) => v.version === versionNum)) {
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
    Object.keys(trainees).forEach((name) => {
      if (trainees[name].scripts) {
        delete trainees[name].scripts;
      }
    });
    this.saveTrainees(trainees);
  },

  /** 删除指定版本的场景话术 */
  deleteScriptVersion(name, templateId, versionNum) {
    const trainees = this.getTrainees();
    if (!trainees[name] || !trainees[name].scripts) return false;
    const sc = trainees[name].scripts[templateId];
    if (!sc) return false;

    // 移除指定版本
    sc.versions = sc.versions.filter((v) => v.version !== versionNum);

    // 如果删除的是当前激活版本，切换到最新版本
    if (sc.activeVersion === versionNum) {
      sc.activeVersion = sc.versions.length > 0 ? sc.versions[sc.versions.length - 1].version : 0;
    }

    // 如果所有版本都删完了，清理该场景的状态
    if (sc.versions.length === 0) {
      sc.status = "draft";
      sc.completed = false;
    }

    this.saveTrainees(trainees);
    return true;
  },

  /** 培训师添加批注 */
  addScriptFeedback(name, templateId, versionNum, feedbackText) {
    const trainees = this.getTrainees();
    if (!trainees[name] || !trainees[name].scripts) return;
    const sc = trainees[name].scripts[templateId];
    if (!sc || !versionNum || versionNum <= 0) return; // 无版本或版本异常 → 无目标可批注
    const ver = sc.versions.find((v) => v.version === versionNum);
    if (ver) {
      ver.feedback = {
        trainer: "培训师",
        text: feedbackText,
        createdAt: new Date().toLocaleString("zh-CN"),
      };
      sc.status = "reviewed";
      sc.feedbackRead = false; // 未读标记：新人打开详情时清除
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
      date: new Date().toLocaleString("zh-CN"),
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

  // ===== 设备注册限制 =====

  /**
   * 获取本设备已注册的账号列表（localStorage key 不同步到 GitHub，每台设备独立计数）
   * @returns {string[]} 本设备注册的艺名数组
   */
  _getDeviceRegistrations() {
    try {
      return JSON.parse(localStorage.getItem("device_registrations")) || [];
    } catch (e) {
      return [];
    }
  },

  /** 获取本设备已注册账号数量 */
  getDeviceRegistrationCount() {
    return this._getDeviceRegistrations().length;
  },

  /** 记录一次新注册（仅在确认注册成功后调用） */
  addDeviceRegistration(name) {
    const list = this._getDeviceRegistrations();
    if (!list.includes(name)) {
      list.push(name);
      localStorage.setItem("device_registrations", JSON.stringify(list));
    }
  },

  /** 公开接口：停止轮询（由 App.logout 调用） */
  stopPolling() {
    this._stopGitHubPolling();
  },

  /** 重置全部数据 */
  async resetAll(defaults) {
    localStorage.clear();
    await this.init(defaults);
  },
};
