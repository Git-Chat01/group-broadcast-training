/* ============================================
   auth.js — 登录认证逻辑
   ============================================ */

const Auth = {

    /** 当前登录角色：null | "trainee" | "trainer" */
    role: null,
    /** 新人艺名（仅 trainee 角色有效） */
    traineeName: "",

    /** 新人登录（仅设置内存态，不做密码校验） */
    loginAsTrainee(name) {
        const trimmed = name.trim();
        if (!trimmed) {
            return { ok: false, error: "请输入艺名" };
        }
        this.role = "trainee";
        this.traineeName = trimmed;
        return { ok: true };
    },

    // ===== 密码工具 =====

    /** SHA-256 哈希（带盐），用于密码安全存储 */
    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + "cide_salt_2026");
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    },

    /** 验证密码：读取存储的哈希，与输入密码比对 */
    async verifyPassword(name, password) {
        const storedHash = DB.getTraineePasswordHash(name);
        if (!storedHash) return false;
        const inputHash = await this.hashPassword(password);
        return inputHash === storedHash;
    },

    /** 密码强度评估
     *  低：单类型（纯数字连续/重复=25%，其他单类型=33%）
     *  中：双类型组合 = 66%
     *  高：三类型组合 = 100% */
    evaluatePasswordStrength(password) {
        if (!password) return { level: "low", label: "低", pct: 0 };

        const hasDigit = /[0-9]/.test(password);
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasSymbol = /[^a-zA-Z0-9]/.test(password);
        const typeCount = [hasDigit, hasLetter, hasSymbol].filter(Boolean).length;

        // 仅数字时检查连续或重复
        if (hasDigit && !hasLetter && !hasSymbol) {
            const isSequential = (() => {
                const codes = [...password].map(c => c.charCodeAt(0));
                if (codes.length < 2) return false;
                const diff = codes[1] - codes[0];
                if (diff !== 1 && diff !== -1) return false;
                for (let i = 2; i < codes.length; i++) {
                    if (codes[i] - codes[i - 1] !== diff) return false;
                }
                return true;
            })();
            const isRepeating = /^(\d)\1+$/.test(password);
            if (isSequential || isRepeating) {
                return { level: "low", label: "低", pct: 25 };
            }
            return { level: "low", label: "低", pct: 33 };
        }

        if (typeCount >= 3) return { level: "high", label: "高", pct: 100 };
        if (typeCount === 2) return { level: "medium", label: "中", pct: 66 };
        return { level: "low", label: "低", pct: 33 };
    },

    /** 设置新密码：校验长度 → 哈希 → 存储 */
    async setNewPassword(name, password) {
        if (!password || password.length < 6) {
            return { ok: false, error: "密码至少6位" };
        }
        const hash = await this.hashPassword(password);
        DB.setTraineePassword(name, hash);
        return { ok: true };
    },

    /** 培训师登录 */
    loginAsTrainer(password) {
        if (password === DB.getAdminPassword()) {
            this.role = "trainer";
            this.traineeName = "";
            return { ok: true };
        }
        return { ok: false, error: "密码错误" };
    },

    /** 退出登录 */
    logout() {
        this.role = null;
        this.traineeName = "";
    },

    /** 是否已登录 */
    isLoggedIn() {
        return this.role !== null;
    }
};
