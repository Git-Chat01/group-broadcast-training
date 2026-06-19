/* ============================================
   trainer.js — 培训师端全部功能
   内容管理 · 导入题库 · 新人监管
   ============================================ */

const Trainer = {

    // ==================== 内容管理 ====================

    renderContentPanel() {
        const container = document.getElementById("trainer-panel-content");
        const modules = DB.getModules();

        container.innerHTML = `
            <!-- 模块管理 -->
            <div class="progress-section">
                <div class="card-row" style="margin-bottom:16px;">
                    <h3>培训模块管理</h3>
                    <button class="btn btn-primary btn-sm" onclick="Trainer.showModuleForm()">+ 新增模块</button>
                </div>
                ${modules.length === 0 ? '<p class="empty-state">暂无模块，点击上方按钮添加</p>' : modules.map(m => `
                    <div class="card card-row">
                        <div>
                            <strong>${m.title}</strong>
                            ${m.hasExam ? '<span class="badge badge-info">关联试卷: ' + m.examId + '</span>' : '<span class="badge badge-pending">无考核</span>'}
                        </div>
                        <div style="display:flex;gap:6px;">
                            <button class="btn btn-outline btn-sm" onclick="Trainer.showModuleForm('${m.id}')">编辑</button>
                            <button class="btn btn-danger btn-sm" onclick="Trainer.deleteModule('${m.id}')">删除</button>
                        </div>
                    </div>`).join("")}
            </div>

            <!-- 题库管理 -->
            <div class="progress-section">
                <div class="card-row" style="margin-bottom:16px;">
                    <h3>试卷题库管理</h3>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-outline btn-sm" onclick="Trainer.showImportDialog()">导入题库</button>
                        <button class="btn btn-primary btn-sm" onclick="Trainer.showExamForm()">+ 新建试卷</button>
                    </div>
                </div>
                ${this.renderExamListForTrainer()}
            </div>

            <!-- 密码管理 -->
            <div class="progress-section">
                <h3>管理密码</h3>
                <div style="display:flex;flex-direction:column;gap:10px;max-width:320px;">
                    <input type="password" class="form-input" id="inputOldPassword" placeholder="输入旧密码" style="width:100%;">
                    <input type="password" class="form-input" id="inputNewPassword" placeholder="输入新密码" style="width:100%;">
                    <input type="password" class="form-input" id="inputConfirmPassword" placeholder="确认新密码" style="width:100%;">
                    <button class="btn btn-primary btn-sm" id="btnChangePassword" style="align-self:flex-start;">修改密码</button>
                </div>
                <p class="form-hint" id="passwordMsg" style="display:none;margin-top:8px;"></p>
            </div>
        `;

        document.getElementById("btnChangePassword").addEventListener("click", () => {
            const msgEl = document.getElementById("passwordMsg");
            const showMsg = (text, ok) => {
                msgEl.textContent = text;
                msgEl.style.color = ok ? "var(--success)" : "var(--danger)";
                msgEl.style.display = "block";
            };

            const oldPwd = document.getElementById("inputOldPassword").value.trim();
            const newPwd = document.getElementById("inputNewPassword").value.trim();
            const confirmPwd = document.getElementById("inputConfirmPassword").value.trim();

            if (!oldPwd) { showMsg("请输入旧密码", false); return; }
            if (oldPwd !== DB.getAdminPassword()) { showMsg("旧密码错误", false); return; }
            if (!newPwd) { showMsg("请输入新密码", false); return; }
            if (newPwd !== confirmPwd) { showMsg("两次输入的新密码不一致", false); return; }

            DB.setAdminPassword(newPwd);
            showMsg("密码已更新！", true);
            document.getElementById("inputOldPassword").value = "";
            document.getElementById("inputNewPassword").value = "";
            document.getElementById("inputConfirmPassword").value = "";
        });
    },

    renderExamListForTrainer() {
        const exams = DB.getExams();
        const ids = Object.keys(exams);
        if (ids.length === 0) return '<p class="empty-state">暂无试卷，请导入或手动创建</p>';
        return ids.map(eid => {
            const ex = exams[eid];
            const cnt = (ex.questions || []).length;
            return `
                <div class="card card-row">
                    <div>
                        <strong>${ex.title}</strong>
                        <span style="color:var(--text-muted);margin-left:8px;">${cnt} 题 | ID: ${eid}</span>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-outline btn-sm" onclick="Trainer.showExamForm('${eid}')">编辑</button>
                        <button class="btn btn-danger btn-sm" onclick="Trainer.deleteExam('${eid}')">删除</button>
                    </div>
                </div>`;
        }).join("");
    },

    // ===== 模块表单弹窗 =====
    showModuleForm(moduleId) {
        const mod = moduleId ? DB.getModules().find(m => m.id === moduleId) : null;
        const isEdit = !!mod;
        const title = isEdit ? mod.title : "";
        const content = isEdit ? mod.content : "";
        const hasExam = isEdit ? mod.hasExam : false;
        const examId = isEdit ? mod.examId : "";
        const exams = DB.getExams();
        const examOptions = Object.keys(exams).map(eid => `<option value="${eid}" ${examId === eid ? 'selected' : ''}>${exams[eid].title}</option>`).join("");

        Modal.show(`
            <div class="modal-header">
                <h2 class="modal-title">${isEdit ? '编辑' : '新增'}培训模块</h2>
                <button class="modal-close" onclick="Modal.hide()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">模块标题</label>
                    <input type="text" class="form-input" id="fModTitle" value="${this.escAttr(title)}">
                </div>
                <div class="form-group">
                    <label class="form-label">培训内容（支持HTML）</label>
                    <textarea class="form-textarea" id="fModContent">${this.escHtml(content)}</textarea>
                    <p class="form-hint">可粘贴图文混排内容，包括图片和视频嵌入代码</p>
                </div>
                <div class="form-group inline-flex">
                    <label><input type="checkbox" id="fModHasExam" ${hasExam ? 'checked' : ''}> 关联试卷考核</label>
                    <select class="form-select" id="fModExamId" style="width:auto;">${examOptions}</select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" id="btnSaveModule">保存</button>
                <button class="btn btn-outline" onclick="Modal.hide()">取消</button>
            </div>
        `);

        document.getElementById("btnSaveModule").addEventListener("click", () => {
            const mTitle = document.getElementById("fModTitle").value.trim();
            const mContent = document.getElementById("fModContent").value;
            const mHasExam = document.getElementById("fModHasExam").checked;
            const mExamId = document.getElementById("fModExamId").value;

            if (!mTitle) { alert("请输入模块标题"); return; }

            if (isEdit) {
                DB.updateModule(moduleId, {
                    title: mTitle,
                    content: mContent,
                    hasExam: mHasExam,
                    examId: mHasExam ? mExamId : null
                });
            } else {
                DB.addModule({
                    id: "m" + Date.now(),
                    title: mTitle,
                    content: mContent,
                    hasExam: mHasExam,
                    examId: mHasExam ? mExamId : null
                });
            }
            Modal.hide();
            this.renderContentPanel();
        });
    },

    deleteModule(moduleId) {
        if (!confirm("确定要删除这个模块吗？此操作不可恢复。")) return;
        DB.deleteModule(moduleId);
        this.renderContentPanel();
    },

    // ===== 试卷表单弹窗 =====
    showExamForm(examId) {
        const exam = examId ? DB.getExam(examId) : null;
        const isEdit = !!exam;
        const title = isEdit ? exam.title : "";
        const questionsJson = isEdit ? JSON.stringify(exam.questions || [], null, 2) : "[]";

        Modal.show(`
            <div class="modal-header">
                <h2 class="modal-title">${isEdit ? '编辑' : '新建'}试卷</h2>
                <button class="modal-close" onclick="Modal.hide()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">试卷 ID（英文标识，如 exam-1）</label>
                    <input type="text" class="form-input" id="fExamId" value="${isEdit ? examId : 'exam-' + Date.now()}" ${isEdit ? 'disabled' : ''}>
                </div>
                <div class="form-group">
                    <label class="form-label">试卷标题</label>
                    <input type="text" class="form-input" id="fExamTitle" value="${this.escAttr(title)}">
                </div>
                <div class="form-group">
                    <label class="form-label">题目数据（JSON格式）</label>
                    <textarea class="form-textarea" id="fExamQuestions" style="font-family:monospace;font-size:13px;">${this.escHtml(questionsJson)}</textarea>
                    <p class="form-hint">
                        每道题格式：{ "id": 1, "type": "single|multiple|truefalse|fill", "question": "题干", "images": [], "options": ["A.xx"], "answer": [0], "explanation": "解析" }
                        <br>填空题为：{ "type": "fill", "answer": "答案字符串", 不需要 options }
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" id="btnSaveExam">保存</button>
                <button class="btn btn-outline" onclick="Modal.hide()">取消</button>
            </div>
        `);

        document.getElementById("btnSaveExam").addEventListener("click", () => {
            const eId = document.getElementById("fExamId").value.trim();
            const eTitle = document.getElementById("fExamTitle").value.trim();
            const eQuestionsRaw = document.getElementById("fExamQuestions").value;

            if (!eId || !eTitle) { alert("请填写试卷ID和标题"); return; }

            let questions;
            try {
                questions = JSON.parse(eQuestionsRaw);
                if (!Array.isArray(questions)) throw new Error("题目必须是数组");
            } catch (e) {
                alert("题目 JSON 格式错误：" + e.message);
                return;
            }

            DB.addExam(eId, { title: eTitle, questions });
            Modal.hide();
            this.renderContentPanel();
        });
    },

    deleteExam(examId) {
        if (!confirm("确定要删除试卷「" + examId + "」吗？此操作不可恢复。")) return;
        DB.deleteExam(examId);
        this.renderContentPanel();
    },

    // ===== 导入弹窗 =====
    showImportDialog() {
        Modal.show(`
            <div class="modal-header">
                <h2 class="modal-title">导入题库</h2>
                <button class="modal-close" onclick="Modal.hide()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom:16px;">支持从问卷星导出的 Word 文档（.docx）或 Excel 表格（.xlsx），自动识别题目格式。</p>
                <div class="form-group">
                    <label class="form-label">试卷标题</label>
                    <input type="text" class="form-input" id="fImportTitle" placeholder="如：团播画风调优基础 — 考核">
                </div>
                <div class="form-group">
                    <label class="form-label">试卷 ID（英文标识）</label>
                    <input type="text" class="form-input" id="fImportExamId" placeholder="如：exam-1">
                </div>
                <div class="form-group">
                    <label class="form-label">选择文件</label>
                    <input type="file" class="form-input" id="fImportFile" accept=".docx,.xlsx,.xls">
                </div>
                <div id="importPreview" style="margin-top:12px;"></div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-primary" id="btnDoImport" disabled>确认导入</button>
                <button class="btn btn-outline" onclick="Modal.hide()">取消</button>
            </div>
        `);

        let parsedResult = null;

        document.getElementById("fImportFile").addEventListener("change", async function() {
            const file = this.files[0];
            if (!file) return;

            document.getElementById("importPreview").innerHTML = '<p style="padding:16px;color:var(--text-secondary);">正在解析文件...</p>';

            const result = await Importer.parseFile(file);
            if (!result.ok) {
                document.getElementById("importPreview").innerHTML = `<p style="color:#FF3B30;">${result.error}</p>`;
                return;
            }

            parsedResult = result;
            document.getElementById("btnDoImport").disabled = false;

            document.getElementById("importPreview").innerHTML = `
                <p style="color:#34C759;">解析成功！共识别 <strong>${result.questions.length}</strong> 道题${result.imageCount ? '，含 ' + result.imageCount + ' 张图片' : ''}</p>
                <div class="import-preview">
                    <table class="import-preview-table">
                        <thead><tr><th>#</th><th>题型</th><th>题干</th><th>选项数</th></tr></thead>
                        <tbody>
                            ${result.questions.map((q, i) => `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td>${{single:'单选', multiple:'多选', truefalse:'判断', fill:'填空'}[q.type] || q.type}</td>
                                    <td>${q.question.substring(0, 60)}${q.question.length > 60 ? '...' : ''}</td>
                                    <td>${q.options ? q.options.length : '-'}</td>
                                </tr>`).join("")}
                        </tbody>
                    </table>
                </div>`;
        });

        document.getElementById("btnDoImport").addEventListener("click", () => {
            const title = document.getElementById("fImportTitle").value.trim();
            const examId = document.getElementById("fImportExamId").value.trim();
            if (!title || !examId) { alert("请填写试卷标题和ID"); return; }
            if (!parsedResult) { alert("请先选择并解析文件"); return; }

            DB.addExam(examId, { title, questions: parsedResult.questions });
            Modal.hide();
            this.renderContentPanel();
            alert(`导入成功！试卷「${title}」共 ${parsedResult.questions.length} 题已保存。`);
        });
    },

    // ==================== 新人监管 ====================

    renderMonitorPanel() {
        const container = document.getElementById("trainer-panel-monitor");
        const trainees = DB.getTrainees();
        const names = Object.keys(trainees);

        if (names.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无新人数据，等待新人登录学习</p>';
            return;
        }

        const exams = DB.getExams();
        const checklist = DB.getChecklist();

        // 排名数据 + 保存快照（每天一次）
        DB.saveRankingSnapshot();
        const rankings = DB.getRankings();

        container.innerHTML = `
            <div class="progress-section">
                <div class="card-row" style="margin-bottom:12px;">
                    <h3>新人总览（${names.length}人）</h3>
                    <div style="display:flex;gap:8px;">
                        <button class="btn btn-outline btn-sm" onclick="Trainer.showDataMgmt()">数据管理</button>
                        <button class="btn btn-outline btn-sm" onclick="Trainer.exportCSV()">导出 CSV</button>
                    </div>
                </div>
                ${rankings.length >= 2 ? `
                <div class="rank-trainer-table-wrap">
                    <table class="data-table rank-table">
                        <thead><tr><th>#</th><th>新人</th><th>综合分</th><th>话术</th><th>考试</th><th>能力</th></tr></thead>
                        <tbody>
                            ${rankings.filter(r => r.qualified).map((r, i) => `
                                <tr>
                                    <td style="font-weight:700;">${i < 3 ? ['🥇','🥈','🥉'][i] : i + 1}</td>
                                    <td><strong>${r.name}</strong></td>
                                    <td style="font-weight:700;color:var(--primary);">${r.total}</td>
                                    <td>${r.scriptDone}/${r.scriptTotal}</td>
                                    <td>${r.examScore}分</td>
                                    <td>${r.clMastered}/${r.clTotal}</td>
                                </tr>`).join("")}
                            ${rankings.filter(r => !r.qualified).map(r => `
                                <tr style="opacity:0.5;">
                                    <td>-</td>
                                    <td>${r.name} <span style="font-size:11px;color:var(--text-muted);">观察期</span></td>
                                    <td>-</td>
                                    <td>${r.scriptDone}/${r.scriptTotal}</td>
                                    <td>${r.examScore}分</td>
                                    <td>${r.clMastered}/${r.clTotal}</td>
                                </tr>`).join("")}
                        </tbody>
                    </table>
                </div>` : ''}
                ${names.map(name => {
                    const t = trainees[name];
                    const history = t.examHistory || [];
                    const clProgress = t.checklistProgress || {};
                    const avgScore = history.length > 0
                        ? Math.round(history.reduce((s, r) => s + r.score, 0) / history.length)
                        : 0;
                    const passed = history.filter(r => r.score >= 60).length;
                    const clMastered = checklist.filter(c => clProgress[c.id] === "mastered").length;
                    const templates = DB.getScriptTemplates();
                    const scripts = DB.getScripts(name);
                    let scriptWritten = 0, scriptPending = 0;
                    templates.forEach(t => {
                        const s = scripts[t.id];
                        if (s && s.status === "submitted") scriptPending++;
                        if (s && s.status !== "draft" && s.versions.length > 0) scriptWritten++;
                    });

                    const hasPwd = !!t.passwordHash;

                    return `
                        <div class="card">
                            <div class="card-row" style="margin-bottom:8px;">
                                <div>
                                    <strong style="font-size:16px;">${name}</strong>
                                    <span style="font-size:12px;color:${hasPwd ? 'var(--success)' : 'var(--warning)'};margin-left:8px;">${hasPwd ? '🔒 已设密码' : '⚠️ 未设密码'}</span>
                                </div>
                                <div style="display:flex;gap:6px;">
                                    <button class="btn btn-outline btn-sm" onclick="Trainer.setTraineePassword('${name}')">修改密码</button>
                                    <button class="btn btn-danger btn-sm" onclick="Trainer.deleteTrainee('${name}')">删除</button>
                                </div>
                            </div>
                            <div class="trainee-stats-grid">
                                <div><span style="font-size:20px;font-weight:700;color:var(--success);">${passed}/${history.length}</span><br><span style="font-size:12px;color:var(--text-muted);">考试通过</span></div>
                                <div><span style="font-size:20px;font-weight:700;color:var(--warning);">${avgScore}</span><br><span style="font-size:12px;color:var(--text-muted);">平均分</span></div>
                                <div><span style="font-size:20px;font-weight:700;color:var(--success);">${clMastered}/${checklist.length}</span><br><span style="font-size:12px;color:var(--text-muted);">能力掌握</span></div>
                            </div>
                            <div style="display:flex;align-items:center;justify-content:space-between;">
                                <div class="trainer-script-stats" onclick="Trainer.viewTraineeScripts('${name}')" style="margin-top:0;">
                                    话术进度：${scriptWritten}/${templates.length} 已写${scriptPending > 0 ? ' · ' + scriptPending + ' 个待批注' : ''}
                                </div>
                                ${Object.keys(scripts).length > 0 ? `<button class="btn btn-sm" style="background:#FFF0F0;color:#FF3B30;border:none;font-size:12px;padding:4px 10px;" onclick="event.stopPropagation();Trainer.deleteTraineeScripts('${name}')">清除话术</button>` : ''}
                            </div>
                            ${history.length > 0 ? `
                                <table class="data-table" style="margin-top:12px;">
                                    <thead><tr><th>试卷</th><th>成绩</th><th>答对</th><th>时间</th></tr></thead>
                                    <tbody>${history.slice(0, 10).map(r => {
                                        const sc = r.score >= 60 ? 'style="color:#34C759;"' : 'style="color:#FF3B30;"';
                                        return `<tr><td>${r.examTitle}</td><td ${sc}><strong>${r.score}分</strong></td><td>${r.correctCount}/${r.total}</td><td>${r.date}</td></tr>`;
                                    }).join("")}</tbody>
                                </table>
                            ` : '<p style="color:var(--text-muted);margin-top:8px;">暂无考试记录</p>'}
                        </div>`;
                }).join("")}
            </div>`;
    },

    deleteTrainee(name) {
        if (!confirm(`确定要删除新人「${name}」的所有数据吗？此操作不可恢复。`)) return;
        DB.deleteTrainee(name);
        this.renderMonitorPanel();
    },

    /** 培训师直接设置/重置新人密码 */
    async setTraineePassword(name) {
        const hasPwd = !!DB.getTraineePasswordHash(name);
        const label = hasPwd ? `修改「${name}」的密码` : `为「${name}」设置密码`;
        const newPwd = prompt(`${label}\n\n请输入新密码（至少6位）：\n（留空则清除密码，新人下次需自设）`);
        if (newPwd === null) return; // 取消

        if (newPwd.trim() === "") {
            // 留空 → 清除密码
            if (!confirm(`确定要清除「${name}」的密码吗？\n\n清除后该新人下次登录时需要重新设置密码。`)) return;
            DB.clearTraineePassword(name);
            alert(`已清除「${name}」的密码，下次登录时需自设。`);
        } else {
            // 设置了新密码 → 直接生效
            if (newPwd.trim().length < 6) { alert("密码至少6位，请重新操作。"); return; }
            const hash = await Auth.hashPassword(newPwd.trim());
            DB.setTraineePassword(name, hash);
            alert(`「${name}」的密码已更新为：${newPwd.trim()}\n\n请告知该新人。`);
        }
        this.renderMonitorPanel();
    },

    // ==================== 话术监管与批注 ====================

    /** 查看某新人的话术列表 */
    viewTraineeScripts(name) {
        const container = document.getElementById("trainer-panel-monitor");
        const templates = DB.getScriptTemplates();
        const scripts = DB.getScripts(name);

        const groups = new Map();
        templates.forEach(t => {
            if (!groups.has(t.category)) groups.set(t.category, []);
            groups.get(t.category).push(t);
        });

        let catsHTML = "";
        let first = true;
        groups.forEach((items, catName) => {
            const catId = "tsc-" + catName.replace(/[^a-zA-Z0-9一-龥]/g, "");
            catsHTML += `
                <div class="script-category">
                    <div class="script-cat-header" onclick="Trainee.toggleCategory('${catId}')">
                        <span class="script-cat-arrow" id="${catId}-arrow">${first ? "▼" : "▶"}</span>
                        <span class="script-cat-name">${catName}</span>
                    </div>
                    <div class="script-cat-body" id="${catId}-body" style="${first ? "" : "display:none;"}">
                        ${items.map(t => {
                            const s = scripts[t.id];
                            let st = "unwritten";
                            if (s) {
                                if (s.status === "submitted") st = "submitted";
                                else if (s.status === "reviewed") st = "reviewed";
                                else if (s.versions.length > 0) st = "draft";
                            }
                            const icons = { unwritten: "○", draft: "◐", submitted: "⚠", reviewed: "✓" };
                            const iconColors = { unwritten: "var(--danger)", draft: "var(--warning)", submitted: "#FF9500", reviewed: "var(--success)" };
                            return `
                                <div class="script-item" onclick="Trainer.openScriptFeedback('${name}', '${t.id}')">
                                    <span class="script-item-icon" style="color:${iconColors[st]};">${icons[st]}</span>
                                    <span class="script-item-text">${t.scene}</span>
                                    ${st === "submitted" ? '<span class="script-item-badge feedback">待批注</span>' : ''}
                                </div>`;
                        }).join("")}
                    </div>
                </div>`;
            first = false;
        });

        container.innerHTML = `
            <div style="padding:16px;">
                <button class="btn btn-ghost btn-sm" onclick="Trainer.renderMonitorPanel()">← 返回监管列表</button>
                <h3 style="margin:12px 0;">${name} 的话术练习</h3>
                ${catsHTML}
            </div>
        `;
    },

    /** 打开批注页面 */
    openScriptFeedback(name, templateId) {
        const container = document.getElementById("trainer-panel-monitor");
        const templates = DB.getScriptTemplates();
        const template = templates.find(t => t.id === templateId);
        if (!template) return;

        const scripts = DB.getScripts(name);
        const sc = scripts[templateId];
        const activeV = sc ? sc.activeVersion : 0;
        const currentVer = sc && activeV > 0 ? sc.versions.find(v => v.version === activeV) : null;
        const currentContent = currentVer ? currentVer.content : "（该场景尚未提交）";
        const currentFeedback = currentVer ? currentVer.feedback : null;

        let feedbackHTML = "";
        if (currentFeedback) {
            feedbackHTML = `
                <div class="feedback-block">
                    <div class="feedback-block-label">我之前的批注（版本 ${activeV}）</div>
                    <div class="feedback-block-text">${Trainer.escHtml(currentFeedback.text)}</div>
                    <div class="feedback-block-meta">${currentFeedback.createdAt}</div>
                </div>`;
        }

        container.innerHTML = `
            <div class="script-detail">
                <div class="script-detail-header">
                    <button class="script-detail-back" onclick="Trainer.viewTraineeScripts('${name}')">←</button>
                    <span class="script-detail-title">${template.scene} — ${name}</span>
                </div>

                <div class="script-section goal">
                    <div class="script-section-label">📍 模板目的</div>
                    <div class="script-section-text">${Trainer.escHtml(template.goal)}</div>
                </div>

                <div class="script-section">
                    <div class="script-section-label">✏️ ${name} 的版本（版本 ${activeV}）</div>
                    <div class="script-section-text" style="white-space:pre-wrap;background:var(--bg-secondary);padding:14px;border-radius:10px;font-size:14px;line-height:1.6;">
                        ${Trainer.escHtml(currentContent)}
                    </div>
                </div>

                ${feedbackHTML}

                <div class="script-section">
                    <div class="script-section-label">📝 ${currentFeedback ? '修改批注' : '添加批注'}</div>
                    <textarea class="script-trainer-feedback-input" id="trainerFeedbackInput" placeholder="给出具体的修改建议...">${currentFeedback ? Trainer.escHtml(currentFeedback.text) : ''}</textarea>
                    <button class="btn btn-primary" style="margin-top:10px;width:100%;" onclick="Trainer.submitFeedback('${name}', '${templateId}', ${activeV})">
                        ${currentFeedback ? '更新批注' : '提交批注'}
                    </button>
                </div>
            </div>
        `;
    },

    /** 提交批注 */
    submitFeedback(name, templateId, versionNum) {
        const text = document.getElementById("trainerFeedbackInput").value.trim();
        if (!text) { alert("请填写批注内容"); return; }
        DB.addScriptFeedback(name, templateId, versionNum, text);
        alert("批注已提交！新人下次打开话术就能看到～");
        this.openScriptFeedback(name, templateId);
    },

    // ===== CSV 导出 =====

    /** 导出所有新人考试记录为 CSV 文件 */
    exportCSV() {
        const allTrainees = DB.getTraineesAll();
        if (allTrainees.length === 0) {
            alert("暂无新人数据可导出");
            return;
        }

        // 构建 CSV 行：艺名, 试卷, 成绩, 答对, 总题数, 是否合格, 时间
        const headers = ["艺名", "试卷", "成绩", "答对", "总题数", "是否合格", "时间"];
        const rows = [headers];

        allTrainees.forEach(t => {
            const history = t.examHistory || [];
            if (history.length === 0) {
                // 无考试记录的新人也保留一行
                rows.push([t.name, "无记录", "", "", "", "", ""]);
                return;
            }
            history.forEach(r => {
                rows.push([
                    t.name,
                    r.examTitle || "",
                    String(r.score),
                    String(r.correctCount),
                    String(r.total),
                    r.score >= 60 ? "合格" : "不合格",
                    r.date || ""
                ]);
            });
        });

        // CSV 转义：字段含逗号、引号、换行时用引号包裹
        const csvContent = rows.map(row =>
            row.map(cell => {
                const str = String(cell);
                if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
                    return "\"" + str.replace(/"/g, "\"\"") + "\"";
                }
                return str;
            }).join(",")
        ).join("\n");

        // 加 BOM 确保 Excel 正确识别中文
        const bom = "﻿";
        const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "培训数据_" + new Date().toISOString().slice(0, 10) + ".csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    // ===== 数据管理 =====

    /** 删除某新人的话术数据（保留考试记录和能力清单） */
    deleteTraineeScripts(name) {
        if (!confirm(`确定要清除「${name}」的所有话术数据吗？\n\n此操作不可恢复，但考试记录和能力清单不受影响。`)) return;
        DB.deleteTraineeScripts(name);
        alert(`已清除「${name}」的话术数据`);
        this.renderMonitorPanel();
    },

    /** 清空所有新人的话术数据 */
    clearAllScripts() {
        if (!confirm("⚠️ 确定要清空所有新人的话术数据吗？\n\n这会删除所有主持已编写的话术版本和批注记录。\n考试记录和能力清单不受影响。\n\n此操作不可恢复！")) return;
        if (!confirm("再次确认：输入\"确认清空\"执行操作")) return;
        // 二次确认通过后再执行
        const finalCheck = prompt("请输入\"确认清空\"以执行操作：");
        if (finalCheck !== "确认清空") { alert("输入不一致，操作已取消"); return; }
        DB.clearAllScripts();
        alert("所有新人的话术数据已清空");
        this.renderMonitorPanel();
    },

    /** 数据管理弹窗 */
    showDataMgmt() {
        const trainees = DB.getTrainees();
        const names = Object.keys(trainees);
        const templates = DB.getScriptTemplates();

        // 统计
        let totalScripts = 0;
        names.forEach(n => {
            const s = DB.getScripts(n);
            totalScripts += Object.keys(s).length;
        });

        Modal.show(`
            <div class="modal-header">
                <h2 class="modal-title">数据管理</h2>
                <button class="modal-close" onclick="Modal.hide()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="margin-bottom:16px;">共 <strong>${names.length}</strong> 位新人，<strong>${totalScripts}</strong> 条话术记录</p>

                <div class="card" style="margin-bottom:12px;border-left:3px solid #FF3B30;">
                    <h4 style="margin-bottom:8px;">⚠️ 清空所有话术</h4>
                    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
                        删除所有新人已编写的话术版本和批注记录。<br>
                        考试记录、能力清单、管理密码不受影响。
                    </p>
                    <button class="btn btn-danger btn-sm" onclick="Modal.hide();Trainer.clearAllScripts()">清空所有话术</button>
                </div>

                <div class="card" style="border-left:3px solid var(--warning);">
                    <h4 style="margin-bottom:8px;">按新人管理</h4>
                    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">选择新人进行数据操作</p>
                    ${names.map(n => {
                        const s = DB.getScripts(n);
                        const count = Object.keys(s).length;
                        return `
                            <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
                                <span><strong>${n}</strong> — ${count} 条话术</span>
                                <div style="display:flex;gap:6px;">
                                    <button class="btn btn-sm" style="background:var(--primary-light);color:var(--primary);border:none;font-size:12px;" onclick="Modal.hide();Trainer.setTraineePassword('${n}')">修改密码</button>
                                    ${count > 0 ? `<button class="btn btn-sm" style="background:#FFF0F0;color:#FF3B30;border:none;font-size:12px;" onclick="Modal.hide();Trainer.deleteTraineeScripts('${n}')">清除话术</button>` : '<span style="font-size:12px;color:var(--text-muted);">无话术</span>'}
                                    <button class="btn btn-sm" style="background:#FFF0F0;color:#FF3B30;border:none;font-size:12px;" onclick="Modal.hide();Trainer.deleteTrainee('${n}')">删除账号</button>
                                </div>
                            </div>`;
                    }).join("")}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="Modal.hide()">关闭</button>
            </div>
        `);
    },

    // ===== 工具方法 =====
    escAttr(str) {
        return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    },
    escHtml(str) {
        return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
};
