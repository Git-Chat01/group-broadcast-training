/* ============================================
   auth.js — 登录认证逻辑
   ============================================ */

const Auth = {

    /** 当前登录角色：null | "trainee" | "trainer" */
    role: null,
    /** 新人艺名（仅 trainee 角色有效） */
    traineeName: "",

    /** 新人登录 */
    loginAsTrainee(name) {
        const trimmed = name.trim();
        if (!trimmed) {
            return { ok: false, error: "请输入艺名" };
        }
        this.role = "trainee";
        this.traineeName = trimmed;
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
