/* ============================================
   cognition.js — 团播认知模块
   阅读卡片 + 场景判断题（不记分，纯学习）
   ============================================ */

const Cognition = {

    // 记录用户已作答的题目（持久化到 localStorage，退出登录不丢失）
    answered: {},

    /** 从 localStorage 加载当前新人的答题记录（只保留答对的，答错的可重试） */
    _loadAnswers() {
        const key = "cog_answers_" + Auth.traineeName;
        try {
            const raw = JSON.parse(localStorage.getItem(key)) || {};
            const cards = DB.getCognition();
            // 只保留答对的，答错的允许下次重新尝试
            const filtered = {};
            for (const [cardId, selectedIndex] of Object.entries(raw)) {
                const card = cards.find(c => c.id === cardId);
                if (card && card.scenario && card.scenario.answer === selectedIndex) {
                    filtered[cardId] = selectedIndex;
                }
            }
            this.answered = filtered;
        } catch (e) {
            this.answered = {};
        }
    },

    /** 保存当前答题记录到 localStorage */
    _saveAnswers() {
        const key = "cog_answers_" + Auth.traineeName;
        localStorage.setItem(key, JSON.stringify(this.answered));
    },

    /** 渲染团播认知面板 — 卡片流 + 每张底部嵌场景判断题 */
    renderPanel() {
        const container = document.getElementById("trainee-panel-cognition");
        const cards = DB.getCognition();  // storage.js 读取 cognition 数据
        if (!cards || cards.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无认知内容，请联系培训师添加</p>';
            return;
        }

        // 从 localStorage 恢复答题状态，不再每次重置
        this._loadAnswers();

        container.innerHTML = `
            <div class="cog-hero">
                <h2 class="cog-hero-title">🧠 认识团播</h2>
                <p class="cog-hero-sub">了解团播的底层逻辑，比会操作软件更重要</p>
            </div>
            <div class="cog-stack">
                ${cards.map((card, idx) => this._renderCard(card, idx)).join("")}
            </div>
        `;

        // 绑定所有选项的点击事件
        cards.forEach(card => {
            const optionsEl = document.getElementById("cog-options-" + card.id);
            if (!optionsEl) return;
            optionsEl.querySelectorAll(".cog-option").forEach(btn => {
                btn.addEventListener("click", () => {
                    const idx = parseInt(btn.dataset.optionIndex);
                    this.checkAnswer(card.id, idx);
                });
            });
        });
    },

    /** 渲染单张认知卡片 */
    _renderCard(card, index) {
        // 场景判断题 HTML（如果有的话）
        let scenarioHTML = "";
        if (card.scenario) {
            const prevAnswer = this.answered[card.id];
            const alreadyCorrect = prevAnswer !== undefined && prevAnswer === card.scenario.answer;

            if (alreadyCorrect) {
                // 之前已答对：显示已完成状态，禁止再次操作
                scenarioHTML = `
                    <div class="cog-scenario">
                        <div class="cog-scenario-label">✅ 已完成</div>
                        <p class="cog-scenario-question">${card.scenario.question}</p>
                        <div class="cog-options">
                            ${card.scenario.options.map((opt, i) => `
                                <button class="cog-option${i === card.scenario.answer ? ' cog-option-correct' : ''}" disabled>
                                    <span class="cog-option-letter">${String.fromCharCode(65 + i)}</span>
                                    <span class="cog-option-text">${opt.substring(3)}</span>
                                </button>
                            `).join("")}
                        </div>
                        <div class="cog-feedback cog-feedback-ok" id="cog-feedback-${card.id}">
                            <div class="cog-feedback-icon">✅ 正确！</div>
                            <div class="cog-feedback-text">${card.scenario.explanation}</div>
                        </div>
                    </div>
                `;
            } else {
                scenarioHTML = `
                    <div class="cog-scenario">
                        <div class="cog-scenario-label">💡 试试看</div>
                        <p class="cog-scenario-question">${card.scenario.question}</p>
                        <div class="cog-options" id="cog-options-${card.id}">
                            ${card.scenario.options.map((opt, i) => `
                                <button class="cog-option" data-option-index="${i}">
                                    <span class="cog-option-letter">${String.fromCharCode(65 + i)}</span>
                                    <span class="cog-option-text">${opt.substring(3)}</span>
                                </button>
                            `).join("")}
                        </div>
                        <div class="cog-feedback" id="cog-feedback-${card.id}" style="display:none;"></div>
                    </div>
                `;
            }
        }

        return `
            <div class="cog-card" id="cog-card-${card.id}">
                <div class="cog-card-marker">${index + 1}</div>
                <h3 class="cog-card-title">${card.title}</h3>
                <div class="cog-card-body">${stripScripts(card.content)}</div>
                ${scenarioHTML}
            </div>
        `;
    },

    /** 检查场景题答案，显示反馈
     *  答对 → 记录、持久化、禁用按钮（不再允许修改）
     *  答错 → 显示反馈和正确答案，但不记录不持久化，保持按钮可用，允许重试 */
    checkAnswer(cardId, selectedIndex) {
        const cards = DB.getCognition();
        const card = cards.find(c => c.id === cardId);
        if (!card || !card.scenario) return;

        // 已答对 → 不允许再次修改
        const prev = this.answered[cardId];
        if (prev !== undefined && prev === card.scenario.answer) return;

        const correct = card.scenario.answer === selectedIndex;
        const optionsEl = document.getElementById("cog-options-" + cardId);
        const feedbackEl = document.getElementById("cog-feedback-" + cardId);

        if (correct) {
            // 答对：记录 + 持久化 + 禁用按钮
            this.answered[cardId] = selectedIndex;
            this._saveAnswers();

            if (optionsEl) {
                optionsEl.querySelectorAll(".cog-option").forEach(btn => {
                    btn.disabled = true;
                    const idx = parseInt(btn.dataset.optionIndex);
                    if (idx === card.scenario.answer) {
                        btn.classList.add("cog-option-correct");
                    }
                });
            }
        } else {
            // 答错：高亮正确选项（绿色）+ 错误选项（红色），但不禁用按钮，不清除之前的错误标记
            if (optionsEl) {
                optionsEl.querySelectorAll(".cog-option").forEach(btn => {
                    const idx = parseInt(btn.dataset.optionIndex);
                    // 清除上一次答错遗留的样式
                    btn.classList.remove("cog-option-wrong");
                    if (idx === card.scenario.answer) {
                        btn.classList.add("cog-option-correct");
                    } else if (idx === selectedIndex) {
                        btn.classList.add("cog-option-wrong");
                    }
                });
            }
        }

        // 显示反馈
        if (feedbackEl) {
            feedbackEl.className = "cog-feedback " + (correct ? "cog-feedback-ok" : "cog-feedback-err");
            feedbackEl.innerHTML = `
                <div class="cog-feedback-icon">${correct ? "✅ 正确！" : "❌ 不对，再试试其他选项～"}</div>
                <div class="cog-feedback-text">${card.scenario.explanation}</div>
            `;
            feedbackEl.style.display = "block";
        }

        // 滚动到反馈位置
        if (feedbackEl) {
            feedbackEl.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }
};
