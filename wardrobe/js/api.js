/**
 * api.js — 飞书多维表格数据读写封装
 *
 * 所有对飞书 Base 的操作都经过这里
 * 底层通过 Cloudflare Worker 代理调用飞书 Open API
 *
 * 飞书 Base API 文档：
 * https://open.feishu.cn/document/server-docs/docs/bitable-v1/bitable-overview
 */

const API = {
  /**
   * 通用请求 — 拼 Worker 地址 + 飞书 API 路径
   */
  async _request(method, feishuPath, body) {
    const url = WORKER_URL + "/api" + feishuPath;
    const opts = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (body) opts.body = JSON.stringify(body);

    const resp = await fetch(url, opts);
    const data = await resp.json();

    if (data.code !== 0) {
      console.error("API 错误:", data);
      throw new Error(data.msg || "请求失败");
    }
    return data;
  },

  /**
   * 获取单件衣服 — 扫码页用
   * 按「编号」字段搜索，返回第一条匹配记录
   */
  async getItem(itemId) {
    const data = await this._request(
      "POST",
      `/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records/search`,
      {
        filter: {
          conjunction: "and",
          conditions: [
            {
              field_name: "编号",
              operator: "is",
              value: [itemId],
            },
          ],
        },
        page_size: 1,
      }
    );
    if (!data.data.items || data.data.items.length === 0) return null;
    return this._formatRecord(data.data.items[0]);
  },

  /**
   * 获取所有衣服 — 管理后台用
   * 支持按状态筛选
   */
  async listItems(statusFilter) {
    const body = { page_size: 500 };
    if (statusFilter) {
      body.filter = {
        conjunction: "and",
        conditions: [
          {
            field_name: "状态",
            operator: "is",
            value: [statusFilter],
          },
        ],
      };
    }
    const data = await this._request(
      "POST",
      `/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records/search`,
      body
    );
    return (data.data.items || []).map((r) => this._formatRecord(r));
  },

  /**
   * 借出 — 更新状态、借用人、借出时间
   */
  async borrowItem(recordId, borrower, itemId) {
    const now = new Date();
    const dateStr =
      now.getFullYear() +
      "/" +
      String(now.getMonth() + 1).padStart(2, "0") +
      "/" +
      String(now.getDate()).padStart(2, "0");
    // 预计归还默认明天
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const returnStr =
      tomorrow.getFullYear() +
      "/" +
      String(tomorrow.getMonth() + 1).padStart(2, "0") +
      "/" +
      String(tomorrow.getDate()).padStart(2, "0");

    return this._request(
      "PUT",
      `/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records/${recordId}`,
      {
        fields: {
          状态: "已借出",
          借用人: borrower,
          借出时间: dateStr,
          预计归还: returnStr,
        },
      }
    );
  },

  /**
   * 归还
   * @param {boolean} needWash — 是否穿过需要洗
   *
   * 关键设计：如果穿了需要洗，状态直接设为"待清洗"而非"在库"
   * 这样单品页会显示 🟡 待清洗 + "洗完直接借"按钮，防止下一个人借到脏衣服
   */
  async returnItem(recordId, needWash) {
    const fields = {
      状态: needWash ? "待清洗" : "在库",
      借用人: "",
      借出时间: "",
      预计归还: "",
      清洗状态: needWash ? "待清洗" : "干净",
    };
    return this._request(
      "PUT",
      `/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records/${recordId}`,
      { fields }
    );
  },

  /**
   * 标记待清洗 — 同时更新状态和清洗状态，确保单品页正确拦截
   */
  async markWash(recordId) {
    return this._request(
      "PUT",
      `/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records/${recordId}`,
      {
        fields: {
          状态: "待清洗",
          清洗状态: "待清洗",
        },
      }
    );
  },

  /**
   * 新增衣服 — 管理员用
   */
  async addItem(fields) {
    return this._request(
      "POST",
      `/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records`,
      { fields }
    );
  },

  /**
   * 更新衣服信息 — 管理员用
   */
  async updateItem(recordId, fields) {
    return this._request(
      "PUT",
      `/open-apis/bitable/v1/apps/${BASE_TOKEN}/tables/${TABLE_ID}/records/${recordId}`,
      { fields }
    );
  },

  // ---- 统计 ----

  /**
   * 获取各状态数量 — 管理后台概览用
   *
   * 统计口径：以「状态」字段为准（归还/标记清洗时同步更新）
   * 兼容旧数据：washStatus="待清洗" 但 status≠"待清洗" 的遗留记录也计入
   */
  async getStats() {
    const all = await this.listItems();
    const stats = { total: all.length, "在库": 0, "已借出": 0, "待清洗": 0, "已报修": 0 };
    all.forEach((item) => {
      const s = item.status || "在库";
      if (stats[s] !== undefined) stats[s]++;
    });
    // 兼容旧数据：清洗状态标记了待清洗但主状态未同步的（修复前产生的数据）
    const legacyWash = all.filter(
      (i) => i.washStatus === "待清洗" && i.status !== "待清洗"
    ).length;
    stats["待清洗"] += legacyWash;
    return stats;
  },

  // ---- 内部方法 ----

  /**
   * 把飞书返回的 record 对象拍平成我们需要的格式
   *
   * 飞书 bitable v1 API 返回的字段格式：
   * - 文本字段 → rich text 数组 [{text: "...", type: "text"}] 或纯字符串
   * - URL 字段  → {link: "...", text: "...", type: "url"} 或纯字符串
   * - 单选字段 → 纯字符串
   * - 数字字段 → 纯数字
   * - 附件字段 → [{file_token: "...", name: "...", ...}]
   */
  _formatRecord(record) {
    const f = record.fields || {};

    // 提取文本字段：兼容 rich text 数组和纯字符串两种格式
    function getText(val) {
      if (Array.isArray(val)) {
        return val.map(function (v) { return (v && v.text) || ""; }).join("");
      }
      return typeof val === "string" ? val : String(val || "");
    }

    // 提取 URL 字段：兼容 {link, text, type} 对象和纯字符串
    function getUrl(val) {
      if (val && typeof val === "object" && val.link) return val.link;
      return typeof val === "string" ? val : "";
    }

    return {
      id: getText(f["编号"]),
      name: getText(f["名称"]),
      style: getText(f["风格"]),
      category: getText(f["分类"]),
      price: f["价格"] || 0,
      link: getUrl(f["购买链接"]),
      stylingNote: getText(f["搭配说明"]),
      status: getText(f["状态"]) || "在库",
      borrower: getText(f["借用人"]),
      borrowTime: getText(f["借出时间"]),
      expectedReturn: getText(f["预计归还"]),
      washStatus: getText(f["清洗状态"]) || "干净",
      remark: getText(f["备注"]),
      // 搭配图附件 — 用 file_token 走 Worker 代理，避免 tmp_url 过期
      images: (f["搭配图"] || []).map(function (att) {
        return {
          url: WORKER_URL + "/image/" + (att.file_token || ""),
          name: att.name || "",
        };
      }),
      // 飞书记录 ID（更新时需要）
      recordId: record.record_id,
    };
  },
};
