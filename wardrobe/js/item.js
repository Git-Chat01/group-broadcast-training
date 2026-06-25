/**
 * item.js — 扫码单品页逻辑
 *
 * URL: aivar.cc/wardrobe/item.html?id=T001
 * 主播用微信扫码后看到的页面
 */

(function () {
  "use strict";

  // ---- 状态 ----
  let currentItem = null;
  let currentImgIndex = 0;

  // ---- DOM 引用 ----
  const $ = (sel) => document.querySelector(sel);

  // ---- 初始化 ----
  async function init() {
    // 点击弹窗遮罩关闭弹窗
    $("#modalOverlay").onclick = function (e) {
      if (e.target === this) closeModal();
    };

    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      showEmpty("未指定衣服编号");
      return;
    }

    $("#itemIdBadge").textContent = id;

    try {
      currentItem = await API.getItem(id);
      if (!currentItem) {
        showEmpty("未找到这件衣服，请联系管理员");
        return;
      }
      renderItem();
    } catch (err) {
      console.error(err);
      showEmpty("加载失败，请检查网络后重试");
    }
  }

  function showEmpty(msg) {
    $("#itemGallery").innerHTML =
      '<div class="empty-state" style="padding:60px 20px;text-align:center;color:var(--text-muted);">' +
      msg +
      "</div>";
    $("#itemInfo").style.display = "none";
    $("#itemActions").innerHTML = "";
  }

  // ---- 渲染 ----
  function renderItem() {
    const item = currentItem;

    // 状态标签
    const statusMap = {
      在库: ["🟢", "status-in"],
      "已借出": ["🔴", "status-out"],
      待清洗: ["🟡", "status-wash"],
      "已报修": ["⚫", "status-broken"],
    };
    const [statusIcon, statusClass] = statusMap[item.status] || ["", ""];
    $("#itemStatusBadge").textContent = statusIcon + " " + item.status;
    $("#itemStatusBadge").className = "item-status-badge " + statusClass;

    // 搭配图
    renderGallery(item.images);

    // 信息
    $("#itemName").textContent = item.name || "未命名";
    $("#itemStyle").textContent = item.style || "";
    $("#itemCategory").textContent = item.category || "";
    $("#itemPrice").textContent = item.price ? "¥" + item.price : "";
    $("#itemStyling").textContent = item.stylingNote || "";

    if (!item.stylingNote) $("#itemStyling").style.display = "none";

    // 操作按钮
    renderActions(item);
  }

  function renderGallery(images) {
    const gallery = $("#itemGallery");
    if (!images || images.length === 0) {
      gallery.innerHTML =
        '<div class="gallery-empty">暂无搭配图</div>';
      return;
    }

    // 主图
    const mainImg = $("#galleryImg");
    mainImg.src = images[0].url;
    mainImg.alt = "搭配图";
    mainImg.onerror = function () {
      this.src = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect fill='%23f0f0f0' width='300' height='300'/><text x='150' y='155' text-anchor='middle' fill='%23999' font-size='14'>图片加载失败</text></svg>";
    };

    // 多图切换：支持点击左右半区 + 触摸滑动
    if (images.length > 1) {
      mainImg.style.cursor = "pointer";

      // 切换到指定索引
      function switchTo(newIndex) {
        currentImgIndex = ((newIndex % images.length) + images.length) % images.length;
        mainImg.src = images[currentImgIndex].url;
        updateDots(images.length);
      }

      // PC：点击左右半区切换
      mainImg.onclick = function (e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        if (x < rect.width / 2) {
          switchTo(currentImgIndex - 1);
        } else {
          switchTo(currentImgIndex + 1);
        }
      };

      // 移动端：触摸滑动
      let touchStartX = 0;
      mainImg.addEventListener("touchstart", function (e) {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });

      mainImg.addEventListener("touchend", function (e) {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        // 滑动距离超过 50px 才算有效滑动
        if (Math.abs(deltaX) > 50) {
          e.preventDefault(); // 阻止页面滚动
          if (deltaX < 0) {
            switchTo(currentImgIndex + 1); // 左滑 → 下一张
          } else {
            switchTo(currentImgIndex - 1); // 右滑 → 上一张
          }
        }
      });
    }

    // 小圆点
    if (images.length > 1) {
      updateDots(images.length);
    }
  }

  function updateDots(total) {
    let html = "";
    for (let i = 0; i < total; i++) {
      html +=
        '<span class="dot' +
        (i === currentImgIndex ? " active" : "") +
        '"></span>';
    }
    $("#galleryDots").innerHTML = html;
  }

  function renderActions(item) {
    const container = $("#itemActions");
    let html = "";

    if (item.status === "在库") {
      // 在库 → 可以借
      html +=
        '<button class="btn btn-primary btn-lg btn-block" onclick="Item.borrow()">👋 我要借这件</button>';
    } else if (item.status === "已借出") {
      // 已借出 → 显示借用人，可以归还
      html +=
        '<div class="borrower-notice">📤 当前借用人：<strong>' +
        (item.borrower || "未知") +
        "</strong></div>";
      html +=
        '<button class="btn btn-success btn-lg btn-block" onclick="Item.returnItem()">🔄 归还登记</button>';
      html +=
        '<button class="btn btn-outline btn-block" onclick="Item.markWash()" style="margin-top:8px;">🧹 标记需清洗</button>';
    } else if (item.status === "待清洗") {
      html +=
        '<div class="borrower-notice">🧹 这件衣服正在等待清洗</div>';
      // 清洗完了也可以直接借
      html +=
        '<button class="btn btn-primary btn-block" onclick="Item.borrow()" style="margin-top:8px;">👋 洗完直接借</button>';
    } else if (item.status === "已报修") {
      html +=
        '<div class="borrower-notice" style="color:var(--danger);">⚠️ 这件衣服已报修，暂不可用</div>';
    }

    container.innerHTML = html;
  }

  // ---- 借出 ----
  function borrow() {
    const saved = localStorage.getItem(STORAGE_KEY_BORROWER) || "";
    showModal(
      "借出登记 — " + currentItem.name,
      '<div class="form-group">' +
        '<label>你的艺名 + 手机尾号</label>' +
        '<input type="text" id="borrowName" class="input" placeholder="例：鱼丸8897" value="' +
        escAttr(saved) +
        '" autocomplete="off" />' +
        "</div>" +
        '<p class="form-hint">手机尾号用来区分同名主播，不会被公开</p>',
      async function () {
        const name = document.getElementById("borrowName").value.trim();
        if (!name) {
          showToast("请填写艺名+手机尾号");
          return false;
        }
        try {
          await API.borrowItem(currentItem.recordId, name, currentItem.id);
          localStorage.setItem(STORAGE_KEY_BORROWER, name);
          closeModal();
          showToast("借出成功！");
          // 刷新页面状态
          setTimeout(() => init(), 800);
        } catch (err) {
          console.error("借出失败:", err);
          showToast("操作失败：" + (err.message || "未知错误"));
          return false;
        }
      }
    );
  }

  // ---- 归还 ----
  function returnItem() {
    showModal(
      "归还登记 — " + currentItem.name,
      '<p style="text-align:center;font-size:18px;margin:16px 0;">穿过了吗？</p>' +
        '<div style="display:flex;gap:12px;">' +
        '<button class="btn btn-outline btn-block" id="btnReturnWorn" style="flex:1;">👗 穿了，需清洗</button>' +
        '<button class="btn btn-outline btn-block" id="btnReturnClean" style="flex:1;">✨ 没穿，直接还</button>' +
        "</div>",
      null // 不在 confirm 时处理，改用事件绑定
    );

    document.getElementById("btnReturnWorn").onclick = async function () {
      try {
        await API.returnItem(currentItem.recordId, true);
        closeModal();
        showToast("已归还，已标记待清洗");
        setTimeout(() => init(), 800);
      } catch (err) {
        console.error("归还失败:", err);
        showToast("操作失败：" + (err.message || "未知错误"));
      }
    };

    document.getElementById("btnReturnClean").onclick = async function () {
      try {
        await API.returnItem(currentItem.recordId, false);
        closeModal();
        showToast("已归还");
        setTimeout(() => init(), 800);
      } catch (err) {
        console.error("归还失败:", err);
        showToast("操作失败：" + (err.message || "未知错误"));
      }
    };
  }

  // ---- 标记待洗 ----
  function markWash() {
    showModal(
      "标记需清洗？",
      "<p>确认后这件衣服会出现在「待清洗」列表里</p>",
      async function () {
        try {
          await API.markWash(currentItem.recordId);
          closeModal();
          showToast("已标记");
          setTimeout(() => init(), 800);
        } catch (err) {
          console.error("标记清洗失败:", err);
          showToast("操作失败：" + (err.message || "未知错误"));
          return false;
        }
      }
    );
  }

  // ---- 弹窗 ----
  function showModal(title, body, onConfirm) {
    const sheet = $("#modalSheet");
    let html =
      '<div class="modal-header">' +
      '<h3>' +
      esc(title) +
      "</h3>" +
      '<button class="modal-close" onclick="Item.closeModal()">✕</button>' +
      "</div>" +
      '<div class="modal-body">' +
      body +
      "</div>";

    if (onConfirm) {
      html +=
        '<div class="modal-footer">' +
        '<button class="btn btn-primary btn-block" id="btnConfirm">确认</button>' +
        "</div>";
    }

    sheet.innerHTML = html;
    $("#modalOverlay").style.display = "flex";

    if (onConfirm) {
      document.getElementById("btnConfirm").onclick = onConfirm;
    }
  }

  function closeModal() {
    $("#modalOverlay").style.display = "none";
  }

  // ---- Toast ----
  function showToast(msg) {
    const toast = $("#toast");
    toast.textContent = msg;
    toast.style.display = "block";
    toast.classList.add("toast-show");
    setTimeout(() => {
      toast.classList.remove("toast-show");
      setTimeout(() => (toast.style.display = "none"), 300);
    }, 2000);
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

  // ---- 暴露到全局 ----
  window.Item = {
    init,
    borrow,
    returnItem,
    markWash,
    closeModal,
  };

  // 页面加载
  document.addEventListener("DOMContentLoaded", init);
})();
