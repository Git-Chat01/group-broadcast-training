/**
 * admin.js — 服装库管理后台
 *
 * URL: aivar.cc/wardrobe/
 * 功能：概览统计、筛选列表
 */

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  let currentFilter = "";
  let items = [];

  // ---- 登录 ----
  function checkLogin() {
    const loggedIn = sessionStorage.getItem("wardrobe_admin");
    if (loggedIn === "1") {
      showAdmin();
    } else {
      showLogin();
    }
  }

  function showLogin() {
    $("#view-login").style.display = "block";
    $("#view-admin").style.display = "none";
  }

  function showAdmin() {
    $("#view-login").style.display = "none";
    $("#view-admin").style.display = "block";
    loadData();
  }

  $("#btnLogin").onclick = function () {
    const pwd = $("#inputPassword").value.trim();
    if (pwd === ADMIN_PASSWORD) {
      sessionStorage.setItem("wardrobe_admin", "1");
      showAdmin();
    } else {
      const err = $("#loginError");
      err.textContent = "密码错误";
      err.style.display = "block";
    }
  };

  $("#inputPassword").onkeydown = function (e) {
    if (e.key === "Enter") $("#btnLogin").click();
  };

  $("#btnLogout").onclick = function () {
    sessionStorage.removeItem("wardrobe_admin");
    showLogin();
    items = [];
    currentFilter = "";
    resetFilterTabs();
  };

  // ---- 筛选 Tab ----
  function resetFilterTabs() {
    $$(".filter-tab").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === currentFilter);
    });
  }

  $("#filterTabs").onclick = function (e) {
    const btn = e.target.closest(".filter-tab");
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    resetFilterTabs();
    renderList();
  };

  // ---- 加载数据 ----
  async function loadData() {
    $("#adminList").innerHTML = '<div class="loading">加载中...</div>';
    try {
      items = await API.listItems(currentFilter || null);
      renderStats();
      renderList();
    } catch (err) {
      console.error(err);
      $("#adminList").innerHTML =
        '<div class="loading" style="color:var(--danger);">加载失败，请检查网络</div>';
    }
  }

  // ---- 统计概览 ----
  function renderStats() {
    const stats = { total: items.length, "在库": 0, "已借出": 0, "待清洗": 0, "已报修": 0 };
    items.forEach((i) => {
      const s = i.status || "在库";
      if (stats[s] !== undefined) stats[s]++;
    });
    // 兼容旧数据：清洗状态标记了待清洗但主状态未同步的遗留记录
    items.forEach((i) => {
      if (i.washStatus === "待清洗" && i.status !== "待清洗") {
        stats["待清洗"]++;
      }
    });

    $("#adminStats").innerHTML =
      '<div class="stat-card stat-total">' +
      '<div class="stat-num">' +
      stats.total +
      "</div>" +
      '<div class="stat-label">全部</div>' +
      "</div>" +
      '<div class="stat-card stat-in">' +
      '<div class="stat-num">' +
      stats["在库"] +
      "</div>" +
      '<div class="stat-label">在库</div>' +
      "</div>" +
      '<div class="stat-card stat-out">' +
      '<div class="stat-num">' +
      stats["已借出"] +
      "</div>" +
      '<div class="stat-label">已借出</div>' +
      "</div>" +
      '<div class="stat-card stat-wash">' +
      '<div class="stat-num">' +
      stats["待清洗"] +
      "</div>" +
      '<div class="stat-label">待清洗</div>' +
      "</div>";
  }

  // ---- 列表渲染 ----
  function renderList() {
    const filtered = currentFilter
      ? items.filter(
          (i) =>
            i.status === currentFilter ||
            (currentFilter === "待清洗" && i.washStatus === "待清洗")
        )
      : items;

    if (filtered.length === 0) {
      $("#adminList").innerHTML =
        '<div class="empty-state">暂无' +
        (currentFilter || "") +
        "的衣服</div>";
      return;
    }

    let html = "";
    filtered.forEach((item) => {
      const statusIcon = { "在库": "🟢", "已借出": "🔴", "待清洗": "🟡", "已报修": "⚫" }[
        item.status
      ] || "";
      const washIcon = item.washStatus === "待清洗" ? " 🧹" : "";

      html +=
        '<div class="item-card' +
        (item.status === "已借出" ? " card-out" : "") +
        (item.washStatus === "待清洗" ? " card-dirty" : "") +
        '">' +
        '<div class="item-card-left">' +
        (item.images.length > 0
          ? '<img class="item-card-img" src="' +
            escAttr(item.images[0].url) +
            '" alt="" loading="lazy" onerror="this.style.display=\'none\'" />'
          : '<div class="item-card-noimg">📷</div>') +
        "</div>" +
        '<div class="item-card-body">' +
        '<div class="item-card-title">' +
        esc(item.id) +
        " " +
        esc(item.name) +
        "</div>" +
        '<div class="item-card-meta">' +
        esc(item.style || "") +
        " · ¥" +
        esc(item.price) +
        "</div>" +
        '<div class="item-card-status">' +
        statusIcon +
        " " +
        esc(item.status) +
        washIcon +
        (item.borrower ? " · " + esc(item.borrower) : "") +
        (item.borrowTime ? " · " + esc(item.borrowTime) : "") +
        "</div>" +
        "</div>" +
        "</div>";
    });

    $("#adminList").innerHTML = html;
  }

  // ---- 工具 ----
  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;");
  }

  // ---- 启动 ----
  document.addEventListener("DOMContentLoaded", checkLogin);
})();
