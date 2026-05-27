/* ============================================
   data.js — 默认数据定义
   9套试卷 · 能力清单（9类37项）
   ============================================ */

/** 数据版本号 — 修改 Defaults 后递增，storage.js 自动合并新旧数据 */
const DATA_VERSION = 10;

const Defaults = {
    adminPassword: "xsx2001..",

    modules: [],  // 旧版 PPT 式模块已废弃，由能力清单 + 考试体系取代

    exams: {},  // 由 exams_data.js 补充

    // 软件硬件能力清单（9大类37项）
    checklist: [
        // ===== 软件类 =====
        // OBS Studio
        { id: "obs-scene", category: "OBS Studio", item: "场景添加、命名与切换" },
        { id: "obs-source", category: "OBS Studio", item: "图片/视频/文字等素材添加" },
        { id: "obs-hotkey", category: "OBS Studio", item: "快捷键设置（场景切换、摄像头开关等）" },
        { id: "obs-vcam", category: "OBS Studio", item: "启动虚拟摄像头（供直播伴侣使用）" },

        // 抖音直播伴侣
        { id: "dy-uid", category: "抖音直播伴侣", item: "团播管理 — 添加成员 UID" },
        { id: "dy-img", category: "抖音直播伴侣", item: "添加图片素材" },
        { id: "dy-video", category: "抖音直播伴侣", item: "添加视频素材" },
        { id: "dy-text", category: "抖音直播伴侣", item: "添加文字" },
        { id: "dy-screenshot", category: "抖音直播伴侣", item: "截图功能" },
        { id: "dy-vote", category: "抖音直播伴侣", item: "连击投票工具配置" },
        { id: "dy-pk", category: "抖音直播伴侣", item: "双人 PK 血条配置" },
        { id: "dy-challenge", category: "抖音直播伴侣", item: "单人闯关/冲刺挑战/团员榜单" },
        { id: "dy-countdown", category: "抖音直播伴侣", item: "拉票倒计时" },
        { id: "dy-ranking", category: "抖音直播伴侣", item: "投票/点赞榜单" },
        { id: "dy-games", category: "抖音直播伴侣", item: "互动小游戏（切水果、大鱼吃小鱼等）" },
        { id: "dy-cocreate", category: "抖音直播伴侣", item: "共创入口（新账号满7天后可用）" },

        // 小红花音效
        { id: "xhhy-play", category: "小红花音效", item: "音效播放与快捷键使用" },
        { id: "xhhy-import", category: "小红花音效", item: "自定义导入音效（支持视频导入）" },
        { id: "xhhy-backup", category: "小红花音效", item: "音效配置导出备份" },

        // Studio-One 声卡机架
        { id: "so-startup", category: "Studio-One 声卡机架", item: "正确启动与关闭机架软件" },
        { id: "so-fader", category: "Studio-One 声卡机架", item: "调节音杆（推杆操作）" },
        { id: "so-channel", category: "Studio-One 声卡机架", item: "关闭/开启通道" },
        { id: "so-noclick", category: "Studio-One 声卡机架", item: "不乱点其他按钮（只操作推杆和喇叭）" },

        // ===== 硬件类 =====
        // 声卡与麦克风
        { id: "sc-connect", category: "声卡与麦克风", item: "声卡设备连接与线路识别" },
        { id: "sc-freq", category: "声卡与麦克风", item: "无线麦克风频率匹配" },
        { id: "sc-close", category: "声卡与麦克风", item: "关闭声卡时的正确操作（弹窗点「否」）" },

        // 监视器与显示屏
        { id: "mon-connect", category: "监视器与显示屏", item: "监视器（副屏）连接电脑" },
        { id: "mon-switch", category: "监视器与显示屏", item: "信号源切换（短按切换，长按确定）" },

        // 相机与散热
        { id: "cam-power", category: "相机与散热", item: "相机开关操作" },
        { id: "cam-cooling", category: "相机与散热", item: "水冷散热器 — 与相机同步关闭（防受潮）" },
        { id: "cam-fan", category: "相机与散热", item: "散热小风扇 — 防过热导致画面黑屏" },

        // 灯光设备
        { id: "light-face", category: "灯光设备", item: "面光配置与调整" },
        { id: "light-leg", category: "灯光设备", item: "腿光配置与调整" },
        { id: "light-rim", category: "灯光设备", item: "轮廓光配置与调整" },

        // 直播间整体硬件
        { id: "room-power", category: "直播间整体硬件", item: "独立完成全套设备开关机" },
        { id: "room-debug", category: "直播间整体硬件", item: "常见故障检测与排除" },
        { id: "room-cable", category: "直播间整体硬件", item: "硬件线路识别与拔插" }
    ]
};
