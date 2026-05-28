/* ============================================
   trainee.js — 新人端全部功能
   培训模块学习 · 试卷考试 · 个人进度
   ============================================ */

const Trainee = {

    // 考试状态
    currentExamId: null,
    userAnswers: {},

    // ==================== 培训模块 ====================

    /** 渲染模块列表 */
    renderStudyPanel() {
        const container = document.getElementById("trainee-panel-study");
        const modules = DB.getModules();
        const trainee = DB.getTrainee(Auth.traineeName);
        const progress = trainee.moduleProgress || {};

        // 能力清单概况
        const checklist = DB.getChecklist();
        const clProgress = DB.getChecklistProgress(Auth.traineeName);
        const clTotal = checklist.length;
        const clMastered = checklist.filter(c => clProgress[c.id] === "mastered").length;
        const clPct = clTotal > 0 ? Math.round(clMastered / clTotal * 100) : 0;

        const checklistCardHTML = checklist.length > 0 ? `
            <div class="card checklist-entry-card">
                <div class="checklist-entry-main">
                    <div class="checklist-entry-title">📋 软件硬件能力清单</div>
                    <div class="checklist-entry-sub">诚实面对自己，缺什么就练什么</div>
                    <div class="checklist-mini-bar">
                        <div class="checklist-mini-track">
                            <div class="checklist-mini-fill" style="width:${clPct}%;"></div>
                        </div>
                        <span class="checklist-mini-text">${clMastered}/${clTotal} 已掌握</span>
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="Trainee.openChecklist()">查看清单</button>
            </div>
        ` : '';

        container.innerHTML = checklistCardHTML + (modules.length === 0
            ? '<p class="empty-state">暂无培训模块，请联系培训师添加</p>'
            : modules.map(mod => {
            const done = progress[mod.id] === true;
            return `
                <div class="card card-row">
                    <div>
                        <div class="card-title">
                            ${mod.title}
                            ${done ? '<span class="badge badge-done">已完成</span>' : '<span class="badge badge-pending">未完成</span>'}
                            ${mod.hasExam ? '<span class="badge badge-info">含考核</span>' : ''}
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-primary btn-sm" onclick="Trainee.openStudy('${mod.id}')">开始学习</button>
                    </div>
                </div>
            `;
        }).join(""));
    },

    /** 打开培训内容弹窗 */
    openStudy(moduleId) {
        const mod = DB.getModules().find(m => m.id === moduleId);
        const trainee = DB.getTrainee(Auth.traineeName);
        const done = (trainee.moduleProgress || {})[moduleId] === true;
        if (!mod) return;

        Modal.show(`
            <div class="modal-header">
                <h2 class="modal-title">${mod.title}</h2>
                <button class="modal-close" onclick="Modal.hide()">&times;</button>
            </div>
            <div class="modal-body">${mod.content}</div>
            <div class="modal-footer">
                ${mod.hasExam ? `<button class="btn btn-primary" onclick="Modal.hide();Trainee.startExam('${mod.examId}');App.switchTraineeTab('exam')">参加考试</button>` : ''}
                <button class="btn btn-success" ${done ? 'disabled' : ''} id="btnMarkDone" data-module-id="${moduleId}">
                    ${done ? '✓ 已完成' : '标记为已完成'}
                </button>
                <button class="btn btn-outline" onclick="Modal.hide()">关闭</button>
            </div>
        `);

        // 绑定标记完成按钮
        const btn = document.getElementById("btnMarkDone");
        if (btn && !done) {
            btn.addEventListener("click", function() {
                const mid = this.dataset.moduleId;
                DB.setModuleProgress(Auth.traineeName, mid, true);
                this.textContent = "✓ 已完成";
                this.disabled = true;
                Trainee.renderStudyPanel();
                Trainee.renderProgressPanel();
            });
        }
    },

    // ==================== 能力清单 ====================

    /** 打开能力清单（全屏视图，替换培训面板内容） */
    openChecklist() {
        const container = document.getElementById("trainee-panel-study");
        const checklist = DB.getChecklist();
        const progress = DB.getChecklistProgress(Auth.traineeName);
        if (checklist.length === 0) { alert("暂无能力清单数据"); return; }

        // 按分类分组
        const groups = new Map();
        checklist.forEach(c => {
            if (!groups.has(c.category)) groups.set(c.category, []);
            groups.get(c.category).push(c);
        });

        const total = checklist.length;
        const mastered = checklist.filter(c => progress[c.id] === "mastered").length;
        const pct = Math.round(mastered / total * 100);

        let catsHTML = "";
        let first = true;
        const iconMap = { mastered: "✓", unskilled: "◐", unlearned: "○" };
        const clsMap = { mastered: "cl-mastered", unskilled: "cl-unskilled", unlearned: "cl-unlearned" };

        groups.forEach((items, catName) => {
            const catMastered = items.filter(c => progress[c.id] === "mastered").length;
            const catColor = catMastered === items.length ? "var(--success)" : (catMastered === 0 ? "var(--danger)" : "var(--text-secondary)");
            const catId = "cat-" + catName.replace(/[^a-zA-Z0-9一-龥]/g, "");

            catsHTML += `
                <div class="checklist-category">
                    <div class="checklist-cat-header" onclick="Trainee.toggleCategory('${catId}')">
                        <span class="checklist-cat-arrow" id="${catId}-arrow">${first ? "▼" : "▶"}</span>
                        <span class="checklist-cat-name">${catName}</span>
                        <span class="checklist-cat-count" style="color:${catColor};">${catMastered}/${items.length}</span>
                    </div>
                    <div class="checklist-cat-body" id="${catId}-body" style="${first ? "" : "display:none;"}">
                        ${items.map(c => {
                            const st = progress[c.id] || "unlearned";
                            return `
                                <div class="checklist-item ${clsMap[st]}" data-item="${c.id}" onclick="Trainee.cycleItem(this)">
                                    <span class="checklist-item-icon">${iconMap[st]}</span>
                                    <span class="checklist-item-text">${c.item}</span>
                                </div>`;
                        }).join("")}
                    </div>
                </div>`;
            first = false;
        });

        container.innerHTML = `
            <div class="checklist-fullscreen">
                <div class="checklist-fs-header">
                    <button class="checklist-back-btn" onclick="Trainee.renderStudyPanel()" aria-label="返回">←<span class="checklist-back-label"> 返回</span></button>
                    <h2 class="checklist-fs-title">📋 软件硬件能力清单</h2>
                    <span class="checklist-fs-spacer"></span>
                </div>
                <div class="checklist-overall-bar">
                    <div class="checklist-overall-info">
                        <span class="checklist-overall-label">整体掌握</span>
                        <span class="checklist-overall-num">${mastered}/${total}</span>
                    </div>
                    <div class="checklist-overall-track">
                        <div class="checklist-overall-fill" style="width:${pct}%;"></div>
                    </div>
                    <div class="checklist-legend">
                        <span class="checklist-legend-item"><span class="cl-dot cl-dot-mastered"></span>已掌握</span>
                        <span class="checklist-legend-item"><span class="cl-dot cl-dot-unskilled"></span>不熟练</span>
                        <span class="checklist-legend-item"><span class="cl-dot cl-dot-unlearned"></span>未掌握</span>
                    </div>
                </div>
                <div class="checklist-cats-wrapper">
                    ${catsHTML}
                </div>
            </div>
        `;
    },

    /** 三态切换：unlearned → unskilled → mastered → unlearned */
    cycleItem(el) {
        const itemId = el.dataset.item;
        const progress = DB.getChecklistProgress(Auth.traineeName);
        const current = progress[itemId] || "unlearned";

        const next = current === "unlearned" ? "unskilled"
            : current === "unskilled" ? "mastered"
            : "unlearned";

        DB.setChecklistItem(Auth.traineeName, itemId, next);

        // 更新当前元素样式
        const iconMap = { mastered: "✓", unskilled: "◐", unlearned: "○" };
        const clsMap = { mastered: "cl-mastered", unskilled: "cl-unskilled", unlearned: "cl-unlearned" };
        el.className = "checklist-item " + clsMap[next];
        el.querySelector(".checklist-item-icon").textContent = iconMap[next];

        // 更新分类头计数和颜色
        this._updateCategoryHeader(el.closest(".checklist-category"));
        // 更新顶部进度条
        this._updateOverallBar();
    },

    /** 更新分类头部进度 */
    _updateCategoryHeader(catEl) {
        const items = catEl.querySelectorAll(".checklist-item");
        let mastered = 0;
        items.forEach(it => { if (it.classList.contains("cl-mastered")) mastered++; });
        const countEl = catEl.querySelector(".checklist-cat-count");
        const total = items.length;
        countEl.textContent = mastered + "/" + total;
        countEl.style.color = mastered === total ? "var(--success)"
            : mastered === 0 ? "var(--danger)"
            : "var(--text-secondary)";
    },

    /** 更新顶部整体进度条 */
    _updateOverallBar() {
        const checklist = DB.getChecklist();
        const progress = DB.getChecklistProgress(Auth.traineeName);
        const total = checklist.length;
        const mastered = checklist.filter(c => progress[c.id] === "mastered").length;
        const pct = Math.round(mastered / total * 100);
        const numEl = document.querySelector(".checklist-overall-num");
        const fillEl = document.querySelector(".checklist-overall-fill");
        if (numEl) numEl.textContent = mastered + "/" + total;
        if (fillEl) fillEl.style.width = pct + "%";
    },

    /** 手风琴折叠 */
    toggleCategory(catId) {
        const body = document.getElementById(catId + "-body");
        const arrow = document.getElementById(catId + "-arrow");
        if (!body || !arrow) return;

        if (body.style.display === "none") {
            // 折叠所有其他分类
            document.querySelectorAll(".checklist-cat-body").forEach(b => b.style.display = "none");
            document.querySelectorAll(".checklist-cat-arrow").forEach(a => a.textContent = "▶");
            // 展开当前
            body.style.display = "";
            arrow.textContent = "▼";
        } else {
            body.style.display = "none";
            arrow.textContent = "▶";
        }
    },

    // ==================== 试卷考试 ====================

    /** 渲染试卷列表 */
    renderExamPanel() {
        const container = document.getElementById("trainee-panel-exam");
        const exams = DB.getExams();
        const examIds = Object.keys(exams);
        const trainee = DB.getTrainee(Auth.traineeName);
        const history = trainee.examHistory || [];

        if (examIds.length === 0) {
            container.innerHTML = `
                <div class="card" style="text-align:center;">
                    <p class="empty-state">暂无可用试卷</p>
                    <p style="color:var(--text-muted);">完成培训模块后，联系培训师添加试卷</p>
                </div>`;
            return;
        }

        container.innerHTML = examIds.map(eid => {
            const exam = exams[eid];
            const qCount = (exam.questions || []).length;
            const myRecords = history.filter(r => r.examId === eid);
            const bestScore = myRecords.length > 0
                ? Math.max(...myRecords.map(r => r.score))
                : null;

            // 题型统计
            const tc = { single: 0, multiple: 0, truefalse: 0, fill: 0 };
            (exam.questions || []).forEach(q => tc[q.type]++);
            const tl = [];
            if (tc.single > 0) tl.push(`${tc.single}单选`);
            if (tc.multiple > 0) tl.push(`${tc.multiple}多选`);
            if (tc.truefalse > 0) tl.push(`${tc.truefalse}判断`);
            if (tc.fill > 0) tl.push(`${tc.fill}填空`);

            return `
                <div class="card card-row">
                    <div>
                        <div class="card-title">${exam.title}</div>
                        <div class="card-sub">
                            共 ${qCount} 题 | ${tl.join(" / ")}
                            ${bestScore !== null ? ` | 最佳成绩：<strong>${bestScore}分</strong>（${myRecords.length}次）` : ' | 尚未考过'}
                        </div>
                    </div>
                    <button class="btn btn-primary" onclick="Trainee.startExam('${eid}')">开始考试</button>
                </div>
            `;
        }).join("");
    },

    /** 开始考试 */
    startExam(examId) {
        const exam = DB.getExam(examId);
        if (!exam || !exam.questions || exam.questions.length === 0) return;

        this.currentExamId = examId;
        this.userAnswers = {};
        exam.questions.forEach(q => {
            this.userAnswers[q.id] = (q.type === "fill") ? "" : [];
        });

        const container = document.getElementById("trainee-panel-exam");
        container.innerHTML = `
            <div class="quiz-bar">
                <button class="btn btn-ghost btn-sm" onclick="Trainee.renderExamPanel()">← 返回列表</button>
                <h2 class="quiz-bar-title">${exam.title}</h2>
                <span class="quiz-bar-status" id="quizStatus"></span>
            </div>
            <div id="quizBody"></div>
            <div style="text-align:center;padding:16px 0 32px;">
                <button class="btn btn-primary" id="btnSubmit">提交答卷</button>
            </div>
        `;

        this.renderQuestions();
        this.updateQuizStatus();

        document.getElementById("btnSubmit").addEventListener("click", () => this.submitExam());
    },

    /** 渲染全部题目 */
    renderQuestions() {
        const exam = DB.getExam(this.currentExamId);
        const container = document.getElementById("quizBody");
        if (!exam) return;

        const typeLabels = { single: "单选题", multiple: "多选题", truefalse: "判断题", fill: "填空题" };
        const tagClasses = { single: "tag-single", multiple: "tag-multiple", truefalse: "tag-truefalse", fill: "tag-fill" };

        container.innerHTML = exam.questions.map((q, idx) => {
            const tl = typeLabels[q.type] || q.type;
            const tc = tagClasses[q.type] || "";
            let isAnswered = (q.type === "fill")
                ? (this.userAnswers[q.id] && this.userAnswers[q.id].trim() !== "")
                : (this.userAnswers[q.id] && this.userAnswers[q.id].length > 0);

            // 图片
            let imgsHtml = "";
            if (q.images && q.images.length > 0) {
                imgsHtml = `<div class="question-images">${q.images.map(img => `<img src="${img}" class="question-img" onclick="this.classList.toggle('zoomed')">`).join("")}</div>`;
            }

            // 作答区
            let answerHtml = "";
            if (q.type === "fill") {
                const val = this.escapeHtml(this.userAnswers[q.id] || "");
                answerHtml = `
                    <div class="fill-input-wrapper">
                        <input type="text" class="fill-input" id="fi-${q.id}" data-qid="${q.id}" value="${val}" placeholder="请输入答案">
                    </div>`;
            } else {
                const options = q.options || [];
                answerHtml = `<ul class="option-list">${options.map((opt, oi) => {
                    const sel = (this.userAnswers[q.id] || []).includes(oi);
                    const cls = q.type === "multiple" ? "option-checkbox" : "option-radio";
                    return `
                        <li class="option-item ${sel ? 'selected' : ''}" data-qid="${q.id}" data-oidx="${oi}" data-qtype="${q.type}">
                            <span class="${cls}"></span><span>${opt}</span>
                        </li>`;
                }).join("")}</ul>`;
            }

            return `
                <div class="question-card ${isAnswered ? 'answered' : ''}" id="qc-${q.id}">
                    <div class="question-number">第 ${idx + 1} 题 <span class="question-type-tag ${tc}">${tl}</span>${q.type === 'multiple' ? '<span class="multi-hint">（多选）</span>' : ''}</div>
                    <div class="question-text">${q.question}</div>
                    ${imgsHtml}
                    ${answerHtml}
                </div>`;
        }).join("");

        // 绑定选择题事件
        container.querySelectorAll(".option-item").forEach(el => {
            el.addEventListener("click", function() {
                Trainee.selectOption(
                    parseInt(this.dataset.qid),
                    parseInt(this.dataset.oidx),
                    this.dataset.qtype
                );
            });
        });

        // 绑定填空题事件
        container.querySelectorAll(".fill-input").forEach(el => {
            el.addEventListener("input", function() {
                const qid = parseInt(this.dataset.qid);
                Trainee.userAnswers[qid] = this.value;
                Trainee.refreshCard(qid);
                Trainee.updateQuizStatus();
            });
        });
    },

    escapeHtml(str) {
        const d = document.createElement("div");
        d.textContent = str || "";
        return d.innerHTML;
    },

    selectOption(qid, oidx, qtype) {
        if (qtype === "multiple") {
            const cur = this.userAnswers[qid] || [];
            const p = cur.indexOf(oidx);
            if (p >= 0) cur.splice(p, 1); else cur.push(oidx);
            this.userAnswers[qid] = cur;
        } else {
            this.userAnswers[qid] = [oidx];
        }
        this.refreshCard(qid);
        this.updateQuizStatus();
    },

    refreshCard(qid) {
        const exam = DB.getExam(this.currentExamId);
        const q = (exam.questions || []).find(q => q.id === qid);
        if (!q) return;
        const card = document.getElementById("qc-" + qid);
        if (!card) return;
        const isAnswered = (q.type === "fill")
            ? (this.userAnswers[qid] && this.userAnswers[qid].trim() !== "")
            : (this.userAnswers[qid] && this.userAnswers[qid].length > 0);
        card.className = "question-card " + (isAnswered ? "answered" : "");
        card.querySelectorAll(".option-item").forEach(el => {
            const oi = parseInt(el.dataset.oidx);
            if ((this.userAnswers[qid] || []).includes(oi)) el.classList.add("selected");
            else el.classList.remove("selected");
        });
    },

    updateQuizStatus() {
        const exam = DB.getExam(this.currentExamId);
        const total = (exam.questions || []).length;
        let answered = 0;
        (exam.questions || []).forEach(q => {
            const a = this.userAnswers[q.id];
            if (q.type === "fill") { if (a && a.trim()) answered++; }
            else { if (a && a.length > 0) answered++; }
        });
        const el = document.getElementById("quizStatus");
        if (el) el.textContent = `已答 ${answered} / ${total}`;
    },

    /** 提交试卷 */
    submitExam() {
        const exam = DB.getExam(this.currentExamId);
        const qs = exam.questions || [];
        const total = qs.length;
        let answered = 0;
        qs.forEach(q => {
            const a = this.userAnswers[q.id];
            if (q.type === "fill") { if (a && a.trim()) answered++; }
            else { if (a && a.length > 0) answered++; }
        });

        if (answered < total) {
            if (!confirm(`还有 ${total - answered} 题未作答，确定提交吗？`)) return;
        }

        let correctCount = 0;
        const details = qs.map(q => {
            let isCorrect = false;
            const ua = this.userAnswers[q.id];
            if (q.type === "fill") {
                isCorrect = (ua || "").trim().toLowerCase() === (q.answer || "").trim().toLowerCase();
            } else {
                const ca = q.answer || [];
                const uaArr = ua || [];
                isCorrect = uaArr.length === ca.length && uaArr.every(a => ca.includes(a));
            }
            if (isCorrect) correctCount++;
            return { questionId: q.id, question: q.question, type: q.type, options: q.options, userAnswer: ua, correctAnswer: q.answer, isCorrect, explanation: q.explanation };
        });

        const score = Math.round(correctCount / total * 100);

        // 保存记录
        DB.addExamRecord(Auth.traineeName, {
            examId: this.currentExamId,
            examTitle: exam.title,
            score, total, correctCount, details
        });

        // 显示成绩
        this.showResult(score, correctCount, total, details);
    },

    showResult(score, correctCount, total, details) {
        const container = document.getElementById("trainee-panel-exam");
        const passClass = score >= 60 ? "pass" : "fail";
        const passText = score >= 60 ? "合格" : "不合格";
        const enc = score >= 80 ? "非常优秀！" : score >= 60 ? "通过了，继续加油！" : "别气馁，复习后再来！";

        container.innerHTML = `
            <div style="text-align:center;padding:24px 0;">
                <h2>考试完成</h2>
                <div class="result-score ${passClass}">${score}<span style="font-size:24px;">分</span></div>
                <p style="margin:8px 0;"><span class="badge ${score >= 60 ? 'badge-done' : 'badge-pending'}">${passText}</span></p>
                <p>答对 <strong>${correctCount}</strong> / ${total} 题 · ${enc}</p>
                <div style="text-align:left;margin-top:24px;">
                    <h3 style="margin-bottom:12px;">答题详情</h3>
                    ${details.map((d, i) => `
                        <div class="result-item ${d.isCorrect ? 'correct-item' : 'wrong-item'}">
                            <div class="result-question">${d.isCorrect ? '✓' : '✗'} 第${i+1}题：${d.question}</div>
                            <div class="result-answer">
                                你的答案：<strong>${this.fmtAns(d.userAnswer, d.options, d.type)}</strong>
                                ${d.isCorrect ? '' : `| 正确答案：<strong>${this.fmtAns(d.correctAnswer, d.options, d.type)}</strong>`}
                            </div>
                            ${!d.isCorrect && d.explanation ? `<div class="result-explanation">解析：${d.explanation}</div>` : ''}
                        </div>`).join("")}
                </div>
                <div style="margin-top:20px;display:flex;gap:12px;justify-content:center;">
                    <button class="btn btn-primary" onclick="Trainee.startExam('${this.currentExamId}')">重新考试</button>
                    <button class="btn btn-outline" onclick="Trainee.renderExamPanel()">返回列表</button>
                </div>
            </div>`;
    },

    fmtAns(ans, options, type) {
        if (type === "fill") return ans ? String(ans) : "未作答";
        if (!ans || !Array.isArray(ans) || ans.length === 0) return "未作答";
        return ans.map(i => (options || [])[i] || i).join("、");
    },

    // ==================== 我的进度 ====================

    renderProgressPanel() {
        const container = document.getElementById("trainee-panel-progress");
        const trainee = DB.getTrainee(Auth.traineeName);
        const history = trainee.examHistory || [];

        const passedExams = new Set(history.filter(r => r.score >= 60).map(r => r.examId)).size;
        const totalExams = Object.keys(DB.getExams()).length;

        const avgScore = history.length > 0
            ? Math.round(history.reduce((s, r) => s + r.score, 0) / history.length)
            : 0;

        // 能力清单统计
        const checklist = DB.getChecklist();
        const clProgress = trainee.checklistProgress || {};
        const clTotal = checklist.length;
        const clMastered = checklist.filter(c => clProgress[c.id] === "mastered").length;
        const clPct = clTotal > 0 ? Math.round(clMastered / clTotal * 100) : 0;

        container.innerHTML = `
            <div class="progress-section">
                <h3>学习概览</h3>
                <div class="progress-grid-3">
                    <div><div style="font-size:32px;font-weight:700;color:var(--success);">${passedExams}/${totalExams}</div><div style="font-size:13px;color:var(--text-secondary);">考试通过</div></div>
                    <div><div style="font-size:32px;font-weight:700;color:var(--warning);">${avgScore}</div><div style="font-size:13px;color:var(--text-secondary);">平均分</div></div>
                    <div><div style="font-size:32px;font-weight:700;color:var(--success);">${clMastered}/${clTotal}</div><div style="font-size:13px;color:var(--text-secondary);">能力掌握</div></div>
                </div>
                <div class="progress-bar-wrap"><div class="progress-bar-fill checklist-progress-fill" style="width:${clPct}%;"></div></div>
                <div class="progress-label">能力清单 ${clPct}%</div>
            </div>

            <div class="progress-section">
                <h3>能力清单详情</h3>
                ${this._renderProgressChecklist()}
            </div>

            <div class="progress-section">
                <h3>考试记录</h3>
                ${history.length === 0 ? '<p class="empty-state">暂无考试记录</p>' : `
                    <table class="data-table">
                        <thead><tr><th>试卷</th><th>成绩</th><th>答对</th><th>时间</th></tr></thead>
                        <tbody>${history.map(r => {
                            const sc = r.score >= 60 ? 'style="color:#34C759;"' : 'style="color:#FF3B30;"';
                            return `<tr><td>${r.examTitle}</td><td ${sc}><strong>${r.score}分</strong></td><td>${r.correctCount}/${r.total}</td><td>${r.date}</td></tr>`;
                        }).join("")}</tbody>
                    </table>`}
            </div>`;
    },

    /** 生成进度面板中的清单摘要 */
    _renderProgressChecklist() {
        const checklist = DB.getChecklist();
        const progress = DB.getChecklistProgress(Auth.traineeName);
        if (checklist.length === 0) return '<p class="empty-state">暂无能力清单</p>';

        const groups = new Map();
        checklist.forEach(c => {
            if (!groups.has(c.category)) groups.set(c.category, []);
            groups.get(c.category).push(c);
        });

        const iconMap = { mastered: '<span style="color:var(--success);">✓</span>', unskilled: '<span style="color:var(--warning);">◐</span>', unlearned: '<span style="color:var(--danger);">○</span>' };

        let html = "";
        groups.forEach((items, catName) => {
            const catMastered = items.filter(c => progress[c.id] === "mastered").length;
            html += `<div style="margin-bottom:12px;">
                <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${catName} <span style="color:var(--text-muted);font-weight:400;">${catMastered}/${items.length}</span></div>`;
            items.forEach(c => {
                const st = progress[c.id] || "unlearned";
                html += `<div style="font-size:13px;padding:2px 0;color:var(--text-secondary);">${iconMap[st]} ${c.item}</div>`;
            });
            html += `</div>`;
        });
        return html;
    },

    // ==================== 话术练习 ====================

    /** 当前正在查看的话术场景ID */
    currentScriptId: null,

    /** 渲染话术场景列表 */
    renderScriptPanel() {
        const container = document.getElementById("trainee-panel-script");
        const templates = DB.getScriptTemplates();
        const scripts = DB.getScripts(Auth.traineeName);

        if (templates.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无话术模板，请联系培训师添加</p>';
            return;
        }

        // 按分类分组
        const groups = new Map();
        templates.forEach(t => {
            if (!groups.has(t.category)) groups.set(t.category, []);
            groups.get(t.category).push(t);
        });

        // 统计
        let totalWritten = 0, totalReviewed = 0;
        templates.forEach(t => {
            const s = scripts[t.id];
            if (s && s.status !== "draft" && s.versions.length > 0) totalWritten++;
            if (s && s.status === "reviewed") totalReviewed++;
        });

        const iconMap = {
            unwritten: '<span class="script-item-icon unwritten">○</span>',
            draft: '<span class="script-item-icon draft">◐</span>',
            written: '<span class="script-item-icon written">✓</span>',
            reviewed: '<span class="script-item-icon reviewed">🔴</span>'
        };

        let catsHTML = "";
        let first = true;
        groups.forEach((items, catName) => {
            const catWritten = items.filter(t => {
                const s = scripts[t.id];
                return s && s.status !== "draft" && s.versions.length > 0;
            }).length;
            const catColor = catWritten === items.length ? "var(--success)"
                : (catWritten === 0 ? "var(--text-muted)" : "var(--warning)");
            const catId = "sc-" + catName.replace(/[^a-zA-Z0-9一-龥]/g, "");

            catsHTML += `
                <div class="script-category">
                    <div class="script-cat-header" onclick="Trainee.toggleCategory('${catId}')">
                        <span class="script-cat-arrow" id="${catId}-arrow">${first ? "▼" : "▶"}</span>
                        <span class="script-cat-name">${catName}</span>
                        <span class="script-cat-count" style="color:${catColor};">${catWritten}/${items.length}</span>
                    </div>
                    <div class="script-cat-body" id="${catId}-body" style="${first ? "" : "display:none;"}">
                        ${items.map(t => {
                            const s = scripts[t.id];
                            let status = "unwritten";
                            if (s) {
                                if (s.status === "reviewed") status = "reviewed";
                                else if (s.status === "submitted") status = "written";
                                else if (s.status === "draft" && s.versions.length > 0) status = "draft";
                            }
                            let badgeHTML = "";
                            const activeVer = s ? s.versions[s.activeVersion - 1] : null;
                            if (s && s.status === "reviewed" && activeVer && activeVer.feedback) {
                                badgeHTML = '<span class="script-item-badge feedback">有批注</span>';
                            }
                            return `
                                <div class="script-item" onclick="Trainee.openScriptScene('${t.id}')">
                                    ${iconMap[status]}
                                    <span class="script-item-text">${t.scene}</span>
                                    ${badgeHTML}
                                </div>`;
                        }).join("")}
                    </div>
                </div>`;
            first = false;
        });

        container.innerHTML = `
            <div class="script-summary">
                <span>已完成 <strong>${totalWritten}</strong> / ${templates.length}</span>
                <span>培训师已批 <strong>${totalReviewed}</strong> 个</span>
            </div>
            ${catsHTML}
        `;
    },

    /** 打开话术场景详情 */
    openScriptScene(templateId) {
        const templates = DB.getScriptTemplates();
        const template = templates.find(t => t.id === templateId);
        if (!template) return;

        this.currentScriptId = templateId;
        const scripts = DB.getScripts(Auth.traineeName);
        const sc = scripts[templateId];
        const activeV = sc ? sc.activeVersion : 0;
        const currentContent = sc && activeV > 0
            ? (sc.versions.find(v => v.version === activeV) || {}).content || ""
            : "";
        const currentFeedback = sc && activeV > 0
            ? (sc.versions.find(v => v.version === activeV) || {}).feedback
            : null;

        // 版本选项
        let versionOptions = '<option value="0">新建</option>';
        if (sc) {
            sc.versions.forEach(v => {
                const sel = v.version === activeV ? " selected" : "";
                versionOptions += '<option value="' + v.version + '"' + sel + '>版本 ' + v.version + '</option>';
            });
        }

        // 示范话术
        const examplesHTML = (template.examples || []).length > 0
            ? template.examples.map((ex) => `
                <div class="script-example-card">${this.escapeHtml(ex)}</div>
            `).join("")
            : '<div class="script-example-card" style="color:var(--text-muted);">暂无示范</div>';

        const dotsHTML = (template.examples || []).map((_, i) => `
            <span class="script-example-dot ${i === 0 ? 'active' : ''}" data-dot="${i}"></span>
        `).join("");

        // 关键技巧
        const tipsHTML = (template.tips || []).length > 0
            ? '<ul>' + template.tips.map(tip => '<li>' + this.escapeHtml(tip) + '</li>').join("") + '</ul>'
            : '<p style="color:var(--text-muted);">暂无技巧</p>';

        // 批注
        let feedbackHTML = "";
        if (currentFeedback) {
            feedbackHTML = `
                <div class="feedback-block">
                    <div class="feedback-block-label">📝 培训师批注（版本 ${activeV}）</div>
                    <div class="feedback-block-text">${this.escapeHtml(currentFeedback.text)}</div>
                    <div class="feedback-block-meta">${currentFeedback.trainer} · ${currentFeedback.createdAt}</div>
                </div>`;
        }

        const container = document.getElementById("trainee-panel-script");
        container.innerHTML = `
            <div class="script-detail">
                <div class="script-detail-header">
                    <button class="script-detail-back" onclick="Trainee.renderScriptPanel()" aria-label="返回">←</button>
                    <span class="script-detail-title">${template.scene}</span>
                    <select class="script-version-select" id="scriptVersionSelect" onchange="Trainee.switchScriptVersion('${templateId}', this.value)">
                        ${versionOptions}
                    </select>
                </div>

                <div class="script-section goal">
                    <div class="script-section-label">📍 目的</div>
                    <div class="script-section-text">${this.escapeHtml(template.goal)}</div>
                </div>

                <div class="script-section logic">
                    <div class="script-section-label">🧠 逻辑思维</div>
                    <div class="script-section-text">${this.escapeHtml(template.logic)}</div>
                </div>

                <div class="script-section">
                    <div class="script-section-label">💬 示范话术</div>
                    <div class="script-examples-wrapper">
                        <div class="script-examples-track" id="scriptExamplesTrack">
                            ${examplesHTML}
                        </div>
                    </div>
                    ${(template.examples || []).length > 1 ? `
                    <div class="script-example-nav">
                        <button id="btnExPrev" disabled onclick="Trainee.slideExample(-1)">‹</button>
                        <span class="script-example-dots">${dotsHTML}</span>
                        <button id="btnExNext" onclick="Trainee.slideExample(1)">›</button>
                    </div>` : ""}
                </div>

                <div class="script-section tips">
                    <div class="script-section-label">💡 关键技巧</div>
                    ${tipsHTML}
                </div>

                ${feedbackHTML}
            </div>

            <div class="script-input-bar">
                <textarea id="scriptContentInput" placeholder="在这里写你自己的话术版本...">${this.escapeHtml(currentContent)}</textarea>
                <div class="script-input-actions">
                    <button class="btn-script-draft" onclick="Trainee.saveScriptDraft()">保存草稿</button>
                    <button class="btn-script-read" onclick="Trainee.openReadMode()">试读</button>
                    <button class="btn-script-submit" onclick="Trainee.submitScript()">提交</button>
                </div>
            </div>
        `;

        // 初始化示范话术当前索引
        this._exampleIndex = 0;
    },

    /** 示范话术当前索引 */
    _exampleIndex: 0,

    /** 示范话术左右滑动 */
    slideExample(dir) {
        const templates = DB.getScriptTemplates();
        const template = templates.find(t => t.id === this.currentScriptId);
        if (!template) return;
        const total = (template.examples || []).length;
        if (total <= 1) return;

        this._exampleIndex += dir;
        if (this._exampleIndex < 0) this._exampleIndex = 0;
        if (this._exampleIndex >= total) this._exampleIndex = total - 1;

        const track = document.getElementById("scriptExamplesTrack");
        if (track) {
            track.style.transform = 'translateX(-' + (this._exampleIndex * 100) + '%)';
        }
        // 更新按钮状态
        const prevBtn = document.getElementById("btnExPrev");
        const nextBtn = document.getElementById("btnExNext");
        if (prevBtn) prevBtn.disabled = this._exampleIndex === 0;
        if (nextBtn) nextBtn.disabled = this._exampleIndex === total - 1;
        // 更新圆点
        document.querySelectorAll(".script-example-dot").forEach((d, i) => {
            d.classList.toggle("active", i === this._exampleIndex);
        });
    },

    /** 保存草稿 */
    saveScriptDraft() {
        const content = document.getElementById("scriptContentInput").value.trim();
        if (!content) { alert("请先写点内容再保存"); return; }
        DB.saveScriptDraft(Auth.traineeName, this.currentScriptId, content);
        // 保存按钮短暂变色反馈
        const draftBtn = document.querySelector(".btn-script-draft");
        if (draftBtn) {
            const origText = draftBtn.textContent;
            draftBtn.textContent = "✓ 已保存";
            draftBtn.style.background = "#E8F5E9";
            draftBtn.style.color = "#34C759";
            setTimeout(() => {
                draftBtn.textContent = origText;
                draftBtn.style.background = "";
                draftBtn.style.color = "";
            }, 1200);
        }
        // 同时更新版本下拉（如果是首次保存，版本号从0变成1）
        const sel = document.getElementById("scriptVersionSelect");
        if (sel && sel.value === "0") {
            const sc = DB.getScripts(Auth.traineeName)[this.currentScriptId];
            if (sc && sc.activeVersion > 0) {
                const opt = document.createElement("option");
                opt.value = String(sc.activeVersion);
                opt.textContent = "版本 " + sc.activeVersion;
                opt.selected = true;
                sel.appendChild(opt);
            }
        }
    },

    /** 提交给培训师 */
    submitScript() {
        const content = document.getElementById("scriptContentInput").value.trim();
        if (!content) { alert("请先写内容再提交"); return; }

        // 先确保保存最新内容
        DB.saveScriptDraft(Auth.traineeName, this.currentScriptId, content);
        DB.submitScript(Auth.traineeName, this.currentScriptId);
        // 提交按钮变色反馈
        const submitBtn = document.querySelector(".btn-script-submit");
        if (submitBtn) {
            submitBtn.textContent = "✓ 已提交";
            submitBtn.style.background = "#34C759";
            submitBtn.disabled = true;
        }
        // 更新版本下拉
        const sel = document.getElementById("scriptVersionSelect");
        if (sel && sel.value === "0") {
            this.openScriptScene(this.currentScriptId);
        }
    },

    /** 切换版本 */
    switchScriptVersion(templateId, versionNum) {
        const vn = parseInt(versionNum);
        if (vn === 0) {
            // 新建版本：清空输入框
            document.getElementById("scriptContentInput").value = "";
            document.getElementById("scriptVersionSelect").value = "0";
        } else {
            DB.setActiveScriptVersion(Auth.traineeName, templateId, vn);
            this.openScriptScene(templateId);
        }
    },

    /** 打开试读模式 */
    openReadMode() {
        const content = document.getElementById("scriptContentInput").value.trim();
        if (!content) { alert("还没有写内容，先写点东西再试读吧"); return; }

        const overlay = document.createElement("div");
        overlay.className = "read-mode-overlay";
        overlay.id = "readModeOverlay";
        overlay.innerHTML = `
            <div class="read-mode-content">
                <div class="read-mode-text">${this.escapeHtml(content).replace(/\n/g, "<br>")}</div>
            </div>
            <button class="read-mode-close" onclick="document.getElementById('readModeOverlay').remove()">关闭</button>
        `;
        overlay.addEventListener("click", function(e) {
            if (e.target === this) this.remove();
        });
        document.body.appendChild(overlay);
    },
};
