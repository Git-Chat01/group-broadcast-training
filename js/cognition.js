/* ============================================
   cognition.js — 团播认知模块
   阅读卡片 + 场景判断题（不记分，纯学习）
   ============================================ */

const Cognition = {

    // 记录用户已作答的题目（仅内存，不持久化——纯学习工具）
    answered: {},

    /** 渲染团播认知面板 — 卡片流 + 每张底部嵌场景判断题 */
    renderPanel() {
        const container = document.getElementById("trainee-panel-cognition");
        const cards = DB.getCognition();  // storage.js 读取 cognition 数据
        if (!cards || cards.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无认知内容，请联系培训师添加</p>';
            return;
        }

        // 重置答题状态（每次进入重新开始）
        this.answered = {};

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

        return `
            <div class="cog-card" id="cog-card-${card.id}">
                <div class="cog-card-marker">${index + 1}</div>
                <h3 class="cog-card-title">${card.title}</h3>
                <div class="cog-card-body">${card.content}</div>
                ${scenarioHTML}
            </div>
        `;
    },

    /** 检查场景题答案，显示反馈 */
    checkAnswer(cardId, selectedIndex) {
        const cards = DB.getCognition();
        const card = cards.find(c => c.id === cardId);
        if (!card || !card.scenario) return;

        // 已作答则不允许修改（避免反复试答案）
        if (this.answered[cardId]) return;

        const correct = card.scenario.answer === selectedIndex;
        this.answered[cardId] = selectedIndex;

        // 禁用所有选项按钮
        const optionsEl = document.getElementById("cog-options-" + cardId);
        if (optionsEl) {
            optionsEl.querySelectorAll(".cog-option").forEach(btn => {
                btn.disabled = true;
                // 标记正确选项（绿色）和用户选择（如选错则标红）
                const idx = parseInt(btn.dataset.optionIndex);
                if (idx === card.scenario.answer) {
                    btn.classList.add("cog-option-correct");
                } else if (idx === selectedIndex && !correct) {
                    btn.classList.add("cog-option-wrong");
                }
            });
        }

        // 显示反馈
        const feedbackEl = document.getElementById("cog-feedback-" + cardId);
        if (feedbackEl) {
            const isCorrect = correct;
            feedbackEl.className = "cog-feedback " + (isCorrect ? "cog-feedback-ok" : "cog-feedback-err");
            feedbackEl.innerHTML = `
                <div class="cog-feedback-icon">${isCorrect ? "✅ 正确！" : "❌ 不对"}</div>
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
