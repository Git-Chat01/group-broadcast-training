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

        if (modules.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无培训模块，请联系培训师添加</p>';
            return;
        }

        container.innerHTML = modules.map(mod => {
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
        }).join("");
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
        const modules = DB.getModules();
        const progress = trainee.moduleProgress || {};
        const history = trainee.examHistory || [];

        const totalMods = modules.length;
        const doneMods = modules.filter(m => progress[m.id] === true).length;
        const modPct = totalMods > 0 ? Math.round(doneMods / totalMods * 100) : 0;

        const passedExams = new Set(history.filter(r => r.score >= 60).map(r => r.examId)).size;
        const totalExams = Object.keys(DB.getExams()).length;
        const examPct = totalExams > 0 ? Math.round(passedExams / totalExams * 100) : 0;

        const avgScore = history.length > 0
            ? Math.round(history.reduce((s, r) => s + r.score, 0) / history.length)
            : 0;

        container.innerHTML = `
            <div class="progress-section">
                <h3>学习概览</h3>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;text-align:center;margin-bottom:16px;">
                    <div><div style="font-size:32px;font-weight:700;color:var(--primary);">${doneMods}/${totalMods}</div><div style="font-size:13px;color:var(--text-secondary);">模块完成</div></div>
                    <div><div style="font-size:32px;font-weight:700;color:var(--success);">${passedExams}/${totalExams}</div><div style="font-size:13px;color:var(--text-secondary);">考试通过</div></div>
                    <div><div style="font-size:32px;font-weight:700;color:var(--warning);">${avgScore}</div><div style="font-size:13px;color:var(--text-secondary);">平均分</div></div>
                </div>
                <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${modPct}%;"></div></div>
                <div class="progress-label">模块学习进度 ${modPct}%</div>
            </div>

            <div class="progress-section">
                <h3>模块完成情况</h3>
                ${modules.length === 0 ? '<p class="empty-state">暂无模块</p>' : modules.map(m => {
                    const done = progress[m.id] === true;
                    return `<div class="card card-row">
                        <div><strong>${m.title}</strong> ${done ? '<span class="badge badge-done">已完成</span>' : '<span class="badge badge-pending">未完成</span>'}</div>
                        <button class="btn btn-outline btn-sm" onclick="Trainee.openStudy('${m.id}')">查看</button>
                    </div>`;
                }).join("")}
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
    }
};
