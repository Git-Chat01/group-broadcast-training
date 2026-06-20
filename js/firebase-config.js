/* ============================================
   firebase-config.js — Firebase 初始化与认证
   使用前请替换 FIREBASE_CONFIG 为你的项目配置
   ============================================ */

/**
 * 🔧 使用步骤：
 * 1. 前往 https://console.firebase.google.com 创建项目
 * 2. 启用 Realtime Database（asia-southeast1 节点）
 * 3. 启用 Authentication → 匿名登录
 * 4. 将下方配置替换为你的 Firebase 项目配置
 *    （控制台 → 项目设置 → 常规 → 你的应用 → Firebase SDK 代码段 → 配置）
 */
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDummyKeyReplaceWithYours",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "000000000000",
    appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxxxx"
};

/** Firebase 是否已正确配置（apiKey 非占位值） */
const _isConfigured = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.includes("Dummy");

/** 数据库引用（未配置时为 null） */
let firebaseDB = null;

/**
 * Firebase 就绪 Promise
 * - 已配置 → resolve 为数据库引用
 * - 未配置 → resolve 为 null（应用降级为纯 localStorage 模式）
 */
const firebaseReady = (async function() {
    if (!_isConfigured) {
        console.warn("[Firebase] 未配置，应用将以离线模式运行（仅 localStorage）");
        return null;
    }

    try {
        // 初始化 Firebase
        firebase.initializeApp(FIREBASE_CONFIG);
        firebaseDB = firebase.database();

        // 匿名认证
        await firebase.auth().signInAnonymously();
        console.log("[Firebase] 匿名认证成功");

        // 在线状态管理：连接断开时自动清理
        firebase.database().ref(".info/connected").on("value", function(snap) {
            if (snap.val() === true) {
                console.log("[Firebase] 已连接");
            } else {
                console.log("[Firebase] 连接断开，等待重连...");
            }
        });

        return firebaseDB;
    } catch (err) {
        console.error("[Firebase] 初始化失败，降级为离线模式：", err);
        firebaseDB = null;
        return null;
    }
})();
