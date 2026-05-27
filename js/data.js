/* ============================================
   data.js — 培训模块和题库
   9套试卷 · 5个培训模块
   ============================================ */

/** 数据版本号 — 修改 Defaults 后递增，storage.js 自动合并新旧数据 */
const DATA_VERSION = 9;

const Defaults = {
    adminPassword: "xsx2001..",

    modules: [
        {
            id: "m1", title: "主持速成训练计划", hasExam: false, examId: null,
            content: `<h3>新主持 6 天速成训练计划</h3><p>本计划为新主持入职前 6 天的培训安排，每天有明确的学习目标和考核要求。</p><hr><h3>第一天：认知学习</h3><p><strong>目标：</strong></p><ol><li>完成市面上所有规格团播的玩法认知和变现逻辑</li><li>完成团播行为规范</li><li>团播画面调优答题考核（需完成满分）</li></ol><hr><h3>第二天：硬件练习</h3><p><strong>目标：</strong></p><ol><li>完成独立直播间的开关，故障检测处理，硬件线路拔插</li><li>完成团播综合基础能力考试（需完成满分）</li></ol><hr><h3>第三天：软件操作</h3><p><strong>目标：</strong></p><ol><li>完成独立直播软件的操作开关、使用，团播应用的UID添加、血条/投票等应用</li><li>完成团播工具使用基础 / 团播开播流程能力考试（需完成满分）</li></ol><hr><h3>第四天：话术背诵</h3><p><strong>目标：</strong></p><ol><li>完成三个板块的话术流程练习：开场 → 两分钟拉票 → 礼物感谢</li><li>语态练习</li><li>录屏语态反馈</li></ol><p><strong>作业：</strong>自我评价以及发展方向</p><hr><h3>第五天：日常管理安排认知</h3><p><strong>目标：</strong></p><ol><li>独立完成单日团播的流程梳理，新团 7-21 天落地计划</li><li>给予随机日常直播安排，进行复盘练习</li></ol><hr><h3>第六天：通关练习</h3><p><strong>目标：</strong></p><ol><li>独立开关直播间设备，完成软硬件设备的使用</li><li>独立完成 5-10 分钟录屏练习：开场3分钟 → 拉票2分钟 → 感谢总结1分钟</li></ol>
<div class="screenshot-section"><p class="screenshot-label">主持训练操作截图参考</p><img src="images/training/page_12.png" class="screenshot-img" onclick="this.classList.toggle('zoomed')" alt="主持训练-参考图1"><img src="images/training/page_13.png" class="screenshot-img" onclick="this.classList.toggle('zoomed')" alt="主持训练-参考图2"><img src="images/training/page_14.png" class="screenshot-img" onclick="this.classList.toggle('zoomed')" alt="主持训练-参考图3"></div>`
        },
        {
            id: "m2", title: "团播软件操作指南", hasExam: false, examId: null,
            content: `<h3>一、OBS Studio</h3><p>用 OBS 代替摄像头可以呈现更多的画面效果，有较多的插件功能更加齐全。主持要会使用 OBS 添加图片视频素材，开关摄像头，以及设置快捷键。</p><ul><li><strong>场景添加：</strong>在场景页面下找到窗口下方加号，然后给场景命名</li><li><strong>图片/视频添加：</strong>找到源窗口下方加号，找到"图像"点击进去</li><li><strong>快捷键设置：</strong>OBS 快捷键可以设置很多功能快捷键，场景切换、摄像头开启关闭、窗口切换等</li><li><strong>启动虚拟摄像头：</strong>直播伴侣用的是 OBS 为摄像头，OBS 摄像头不打开情况下直播伴侣就没有画面显示</li></ul>
<div class="screenshot-section"><p class="screenshot-label">OBS 操作截图参考</p><img src="images/training/page_01.png" class="screenshot-img" onclick="this.classList.toggle('zoomed')" alt="OBS 软件界面与基本操作"><img src="images/training/page_02.png" class="screenshot-img" onclick="this.classList.toggle('zoomed')" alt="OBS 虚拟摄像头启动"></div>
<h3>二、抖音伴侣</h3><p>抖音官方直播平台，提供了全面的开播功能如：PK 互动、福袋红包发放、连击投票工具等。</p><ul><li><strong>UID 添加：</strong>团播管理 → 添加成员 → 输入主播 UID</li><li><strong>连击投票：</strong>团播管理 → 团播玩法 → 连击投票工具</li><li><strong>双人 PK 血条：</strong>团播管理 → 团员限时竞争 → 玩法配置</li><li><strong>单人闯关 / 冲刺挑战 / 团员榜单：</strong>团播管理 → 团播玩法</li><li><strong>共创入口：</strong>设置 → 直播间 → 直播间共创（新账号需播满七天后会有）</li></ul>
<div class="screenshot-section"><p class="screenshot-label">抖音伴侣操作截图参考</p><img src="images/training/page_03.png" class="screenshot-img" onclick="this.classList.toggle('zoomed')" alt="抖音伴侣-素材添加与UID"><img src="images/training/page_04.png" class="screenshot-img" onclick="this.classList.toggle('zoomed')" alt="抖音伴侣-PK血条与闯关"><img src="images/training/page_05.png" class="screenshot-img" onclick="this.classList.toggle('zoomed')" alt="抖音伴侣-冲刺挑战与榜单"><img src="images/training/page_06.png" class="screenshot-img" onclick="this.classList.toggle('zoomed')" alt="抖音伴侣-镜头特效与共创"></div>
<h3>三、小红花音效</h3><p>播放音效舞蹈的主要软件，音效齐全，辅助主持做开播互动和情绪价值输出。自定义导入 → 导入音效 → 可以直接视频导入会自动识别音效。养成备份习惯。</p><h3>四、互动工具</h3><p>互动工具里有很多好用的插件，如拉票倒计时、投票、点赞榜单、水果切切切、大鱼吃小鱼、pose挑战、躲避小鸟等。</p>
<div class="screenshot-section"><p class="screenshot-label">小红花音效操作截图参考</p><img src="images/training/page_07.png" class="screenshot-img" onclick="this.classList.toggle('zoomed')" alt="小红花音效-基础功能与快捷键"><img src="images/training/page_08.png" class="screenshot-img" onclick="this.classList.toggle('zoomed')" alt="小红花音效-导入导出备份"></div>`
        },
        {
            id: "m3", title: "音频与硬件设备", hasExam: false, examId: null,
            content: `<h3>一、声卡与麦克风</h3><p>声卡是连接主机声音音频输出设备，配合声卡机架（Studio-One 等类似驱动软件）通过调音后正常使用。无线麦克风需调好频率与发射器频率一致即可发出声音。</p>
<div class="screenshot-section"><p class="screenshot-label">声卡与麦克风实物参考</p><img src="images/training/page_09.png" class="screenshot-img" onclick="this.classList.toggle('zoomed')" alt="声卡设备与连接示意"></div>
<h3>二、机架操作注意事项</h3><p>声卡界面相对复杂，主持不要乱点造成声音效果出现影响，只需要动推杆和小喇叭即可。关闭声卡时弹出窗口，点击"否"退出，不要点错。</p>
<div class="screenshot-section"><p class="screenshot-label">机架操作截图参考</p><img src="images/training/page_10.png" class="screenshot-img" onclick="this.classList.toggle('zoomed')" alt="声卡机架 Studio-One 界面"></div>
<h3>三、硬件开关规范</h3><ul><li><strong>监视器连接电脑副屏：</strong>短按"切换"，长按"确定"</li><li><strong>相机及散热器开关：</strong>小风扇和散热器防止相机过热导致画面黑屏。关闭相机的同时要连水冷散热器一起关闭，否则一直开水冷散热会导致相机受潮</li><li>错误开关方式会导致设备受损或影响使用</li></ul>
<div class="screenshot-section"><p class="screenshot-label">硬件设备开关操作截图参考</p><img src="images/training/page_11.png" class="screenshot-img" onclick="this.classList.toggle('zoomed')" alt="直播间硬件开关操作示意"></div>`
        },
        {
            id: "m4", title: "团播画风调优基础", hasExam: true, examId: "exam-hfyt",
            content: `<h3>一、团播画风概述</h3><p>团播画风是指团队直播中视觉呈现的整体风格，包括服化道（服装、化妆、道具）、场景搭建、灯光布置、上镜效果等要素。</p><h3>二、服化道规范（60分基础）</h3><ul><li>根据团风格和成员人设选择服装，避免过度暴露和违规着装</li><li>明确每位成员的妆容风格（甜美/国风/复古/酷飒等）</li><li>发型保持清爽有型，避免显油、贴头皮、无造型</li><li>合理搭配道具，禁用蕾丝面具、皮鞭等违规道具</li></ul><h3>三、场景与灯光</h3><ul><li>基础灯光配置：面光 + 腿光 + 轮廓光</li><li>避免场景过于简单只加顶灯</li><li>避免使用星空幕布</li><li>避免舞台背景过于复杂、图案小而乱</li></ul><h3>四、上镜效果</h3><ul><li>避免过度美颜导致面部变形</li><li>避免滤镜过重造成面部惨白或色调偏青</li><li>避免过度拉伸导致身体比例失调</li><li>使用"蓝光"画质开播提高清晰度</li></ul>`
        },
        {
            id: "m5", title: "团播行为规范", hasExam: true, examId: "exam-xwgf",
            content: `<h3>一、60分达标体系</h3><p>团播账号的"60分"是平台对直播内容质量的评分体系，低于60分为不达标，影响公会收益和账号权限。</p><ul><li><strong>查看路径：</strong>公会后台 → 主播列表 → 团播 → 评级明细</li><li><strong>打分周期：</strong>上月25号至本月25号</li><li><strong>提升方法：</strong>每天在公会后台查看达标状态与评级明细，发现0分场次立刻整改</li></ul><h3>二、常见违规类型</h3><ul><li><strong>服装违规：</strong>全员紧身性感类服装、JK/校服类幼态装扮、露沟、露下臀线、超短裙裤</li><li><strong>场景违规：</strong>教室/校园、法庭、医院、办公室、包间围/转餐桌等场景娱乐化</li><li><strong>玩法违规：</strong>低俗动作、营造偷窥感、遮挡模糊人脸、贴纸未对应舞蹈名称</li><li><strong>道具违规：</strong>兔耳朵、红色/紫色暧昧灯光、蕾丝面具、皮鞭、镂空服饰、渔网袜</li></ul><h3>三、不达标的后果</h3><ul><li>不达标团对应月份的所有公会收益全部扣除</li><li>公会团播60分达标率≤65%且底线违规场次过高，公会将被处罚</li></ul>`
        }
    ],

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
