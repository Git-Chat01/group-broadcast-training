# 话术练习系统 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为团播主持新人构建话术练习系统——16个场景模板、版本迭代、培训师批注、手机端优先。

**Architecture:** 在现有三层架构（数据层→业务层→控制层）上扩展。数据层新增 `Defaults.scriptTemplates` 和脚本版本存储方法；业务层在 `trainee.js` 新增话术渲染逻辑，`trainer.js` 新增批注功能；控制层在 `app.js` 新增 Tab 路由。全部修改现有文件，不新增 JS 文件。

**Tech Stack:** 纯前端 SPA，零框架，localStorage 存储，CSS 变量体系。

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `js/data.js` | 修改 | 新增 `Defaults.scriptTemplates`（16模板），DATA_VERSION → 11 |
| `js/storage.js` | 修改 | 新增脚本模板读取/版本保存/批注方法 + 合并逻辑 |
| `index.html` | 修改 | 新增话术练习 Tab 按钮 + panel div |
| `js/app.js` | 修改 | 新增话术 Tab 切换路由 |
| `css/style.css` | 修改 | 全部话术系统样式（~200行） |
| `js/trainee.js` | 修改 | 新增场景列表+详情+保存+试读（~350行） |
| `js/trainer.js` | 修改 | 新增话术监管+批注（~100行） |

---

### Task 1: 数据层 — 模板数据 + 存储方法

**Files:**
- Modify: `js/data.js`
- Modify: `js/storage.js`

- [ ] **Step 1: 在 data.js 中新增 `Defaults.scriptTemplates`**

在 `Defaults.exams` 赋值之前插入以下代码，并修改 `DATA_VERSION`：

```javascript
// data.js — 在 const DATA_VERSION = 10; 改为 11
const DATA_VERSION = 11;

// 在 Defaults 对象中，checklist 之后、exams 之前插入:
Defaults.scriptTemplates = [
    // ===== 开场环节 =====
    {
        id: "st-opening",
        category: "开场环节",
        scene: "开场拉数据",
        goal: "快速挤进流量层级，完成关注/点赞/灯牌/评论四维数据积累",
        logic: "开场10-20分钟是平台给流量的窗口期。这个阶段你的核心任务不是展示才艺，是用最简单无脑的互动指令让每个进来的人\"动手\"——点关注是最低成本的，点赞是条件反射式的，扣1扣2是不需要思考的，灯牌是身份认同的起点。先让人\"动手\"，再让人\"动心\"。记住一个原则：不要让用户思考，能多便捷就多便捷。数据达标了，下个环节的流量才有保障。",
        examples: [
            "欢迎新进直播间的家人们！现在是XX团的接龙舞环节，没点关注的把关注点了，开播第一时间提醒你，别下次想找我们又找不到了～",
            "家人们点赞冲3万，3万赞一到立马发福袋！福袋口令打一打——\"这么大包就我一个人抢？\"，抢到了回来扣1，没抢到的扣2，想要再来的扣3！",
            "现在在线280个人，灯牌才16个，这比例不对啊家人们。亮个灯牌就一毛钱的事儿，但对我来说是你在说\"我在\"。还没亮灯牌的兄弟，花一毛钱让我记住你，一会儿抽奖优先抽亮灯牌的。"
        ],
        tips: [
            "前30秒抛福利钩子+今日亮点预告，让人知道\"留下来有东西\"",
            "音乐选1.2倍速强鼓点，制造紧张活力感，侧面影响主播的力量感",
            "数据要求要具象化——说\"5个灯牌\"比\"来点灯牌\"有效10倍",
            "具象性要求根据实时在线人数调整，十个人要五万赞是不现实的"
        ]
    },
    {
        id: "st-rules",
        category: "开场环节",
        scene: "玩法规则介绍",
        goal: "让第一次进来的游客在30秒内理解刺保偷踢怎么玩",
        logic: "新用户进来看到一堆人在投票，如果没人解释规则，3秒就走了。你的规则介绍要像游戏新手引导一样——不说术语，不念说明书，用最直白的语言让游客理解\"你的投票能决定主播去留\"。核心心法：把规则翻译成权力——\"你想让她留她就留，你想换人就换人\"。让游客感觉自己是导演而不是观众。",
        examples: [
            "刚进来的宝宝不懂怎么玩的，看过来！很简单——现在的规则叫\"扣1留扣2换\"。喜欢台上这个主播的，公屏扣1，她就能多跳一支舞。看腻了想换人的，扣2，满20个2直接换下一个！就这么简单，是不是比高考容易多了？",
            "接下来进入投票环节！小心心=想让她留下来，小抖音=想换人看新的。你是导演她来演，你想看谁就看谁。第一次玩的兄弟别害羞，选一个试试，投错了又不会扣你工资～"
        ],
        tips: [
            "不要一口气把刺保偷踢全部讲完，先用\"扣1留扣2换\"降低理解门槛",
            "把规则翻译成\"权力\"——让游客感觉到\"我能决定\"而不是\"我要花钱\"",
            "语气轻松像介绍游戏规则，不要像念公司制度"
        ]
    ],

    // ===== 血条PK =====
    {
        id: "st-assassin",
        category: "血条PK",
        scene: "刺客/刀门",
        goal: "让用户产生\"我要保她留下来\"的冲动，把围观变成参与",
        logic: "刺客模式的核心心法是\"对抗\"。主播被刺的那一刻，用户的身份从\"旁观者\"变成了\"参与者\"——她的去留跟我有关了。你要做的就是把这种\"有关\"放大。关键技巧：叫主播名字（不叫\"她\"），把票数差距喊出来（具象化紧迫感），把救她的成本降到最低（\"一个小心心就能帮忙\"）。不要让用户觉得\"反正有人会救\"，要让他觉得\"我不出手她真会走\"。",
        examples: [
            "来了！小贤被刀了！现在票数是对方180票对小贤的90票，需要拉到180的两倍也就是360票才能活。觉得小贤今晚值不值得留下来的，票数直接砸过来！就现在，别等！",
            "小贤现在差得很远啊兄弟们，还差两百多票。一个小心心也是救，一个小抖音也是救，别觉得自己的票小就不动手，十个一人一毛钱她就活了。她能不能留，就看你们手指动不动了。"
        ],
        tips: [
            "叫主播名字，不要只说\"她\"，让粉丝觉得你认识\"他的人\"",
            "把\"2倍票数\"换算成具体数字喊出来——\"还差200票\"比\"差很多\"有压迫感",
            "降低出手心理门槛——\"一个小心心也是救\"打消\"我票太小不好意思出手\"的心态",
            "语调前低后高，倒数时语速加快，最后\"活了！\"或\"可惜了！\"要拉长音"
        ]
    },
    {
        id: "st-revive",
        category: "血条PK",
        scene: "复活赛/背刺",
        goal: "利用5秒反转窗口制造情绪过山车，刺激两方同时上票",
        logic: "复活成功的那一刻是直播间情绪最高涨的节点——守护方觉得\"我们赢了\"，但3秒后如果被背刺，刺客方立刻扬眉吐气。这种\"刚活过来又被干掉\"的反转，是去留团最有传播力的内容。你的任务不是拉偏架，是两边都拱火。对守护方说\"守住了吗？还不稳！\"，对刺客方说\"5秒内2倍票就能反杀，手速呢？\"。两边同时被激活，票数自然往上飙。",
        examples: [
            "活了！小贤拉到了360票成功复活！守护的兄弟们牛——等等！5秒背刺窗口还没关！刺客们听好了，现在需要720票就能再次把她刀掉，手上有票的就这5秒钟，过了就没了！5、4、3——",
            "天呐刚活过来又被刺了！守护的兄弟你们服吗？反正我是替小贤不服！复活需要翻到背刺票数的两倍，谁第一个带头，兄弟们跟着众筹，一个都别掉队！"
        ],
        tips: [
            "复活成功的\"活了\"要喊得激情，制造守护方爽感",
            "背刺窗口只有5秒，倒数要快到让刺客来不及思考",
            "两边都拱火、不拉偏架——刺客和守护都是你的票仓",
            "如果最终没复活成功，也要给守护方台阶：\"兄弟们尽力了，下轮再来\""
        ]
    },
    {
        id: "st-protect",
        category: "血条PK",
        scene: "保门/守护",
        goal: "让守护者感到\"被需要\"，刺激持续上票而非一次性消费",
        logic: "守护的底层逻辑不是\"我喜欢这个主播\"，是\"这个主播需要我\"。你要让守护者感觉到——台上这个人能不能留，我说了算。关键技巧：叫守护者的名字（强化个人身份），把他和主播的关系具象化（\"她是你的门面\"），把守护行为标签化（\"贤家军\"\"U家军\"）。不要只说\"谢谢大哥\"，要说\"大哥一出手，整个直播间的节奏都稳了\"。让守护者感受到他的消费创造了秩序。",
        examples: [
            "U哥出手了！你看U哥一出手，整个节奏就稳住了。U哥是小贤的定海神针，每次小贤被刀，U哥从来没让兄弟们失望过。贤家军的兄弟们跟上，U哥带了头，一人一个小心心众筹起来！",
            "守护的兄弟现在别松手，现在领先不代表等下还领先。你想想对面刺客看到这个票差会怎么想——\"就这？再来两票就超了\"。所以别给对面机会，把优势拉大到让他们绝望。"
        ],
        tips: [
            "叫守护者的名字，让他感受到个人身份而非\"又一个消费用户\"",
            "给守护行为起标签——\"贤家军\"\"定海神针\"——制造归属感",
            "不要在守护者上票后就冷落，持续给他\"战况汇报\"和\"独家信息\""
        ]
    },
    {
        id: "st-steal",
        category: "血条PK",
        scene: "偷塔",
        goal: "在PK倒计时最后时刻制造极致紧迫感，激发\"用小票打掉大票\"的消费快感",
        logic: "偷塔玩家的爽点不是\"我支持了谁\"，是\"我在最后一秒让所有人都白干了\"。这种\"以小博大\"的消费快感是团播最强的转化引擎之一。你的任务是为偷塔者创造完美的\"犯罪环境\"——一是让他们知道时间窗口（倒计时最后几秒），二是降低心理负担（\"偷塔也是一种玩法，不用不好意思\"），三是在偷成功后给足情绪反馈（\"我的天！被偷了！这就是老六的快乐！\"）。记住：偷塔不是\"偷袭\"，是\"玩法\"——你对偷塔者的态度决定了他们会不会再来。",
        examples: [
            "最后10秒！守住守住——8、7、6、5、4——我的天！！被偷了！！是谁？！是XX哥在最后一秒出手了！XX哥你不讲武德但是帅啊，用小票打掉了人家守了一整场的大票，这就是偷塔的快乐！",
            "还剩30秒，票差120，看起来挺稳的对吧？别被骗了，这个票差在团播里叫\"舒适区\"——越舒适越容易被偷。偷塔的兄弟我知道你已经在搓手了，最后10秒我倒数的时候，你想上就上，这是你的玩法，不用管别人怎么想。"
        ],
        tips: [
            "最后10秒倒计时是必须的——节奏感是偷塔的催化剂",
            "偷成功后第一时间喊出偷塔者的名字，给足排面",
            "对偷塔者的态度要兴奋而非愤怒——\"帅\"比\"偷袭可耻\"更能让他下次再来",
            "偷塔失败也要给刺客面子：\"差点就翻了，XX哥下次提前两秒出手\""
        ]
    },
    {
        id: "st-kick",
        category: "血条PK",
        scene: "踢门/反踢",
        goal: "利用反差情绪——前一秒守护赢、后一秒被踢——刺激双方持续对抗",
        logic: "踢门和偷塔的区别：偷塔是\"最后时刻的反转\"，踢门是\"反转之后的反转\"。守护方刚花了大钱把人救回来，刺客方立刻用更大票数踢掉——这种\"我刚赢了你又把我干了\"的反差，是两种完全不同的消费心理在博弈。守护方消费的是\"保护欲\"，踢门方消费的是\"支配感\"。你要做的是把这两种情绪都放大：对守护说\"不服就干回去\"，对踢的说\"就是这种气势\"。",
        examples: [
            "U哥守住了！小贤活了——等等还没完，踢门窗口还在！现在是反踢阶段，对面出多少守护这边就要翻倍才能顶住。刺客你敢踢吗？你敢踢U哥就敢翻倍跟你杠！这就是去留团最刺激的环节！",
            "踢了！！XX哥二倍反踢！前一秒U哥还稳如泰山，下一秒剧情反转！XX哥就是这个直播间的不确定因素，你永远不知道他会在什么时候出手。U哥，怎么说？是让兄弟们继续众筹还是先放一放等下一轮？"
        ],
        tips: [
            "踢门和偷塔的情绪不同——踢门是\"明的\"，要渲染\"正面硬刚\"而非\"暗算\"",
            "踢成功后给被踢方一个情绪出口：\"下轮再来\"、\"先放一放\"，别把人逼走",
            "把踢门渲染成\"实力展示\"而非\"捣乱\"——踢门方也是你的核心用户"
        ]
    },
    {
        id: "st-pk-open",
        category: "血条PK",
        scene: "PK前期造势",
        goal: "开局30秒内制造\"大战一触即发\"的氛围，让人不敢走",
        logic: "PK开局的前30秒决定了这场PK的票数天花板。你的任务是用声音和节奏制造\"要开战了\"的信号——语速加快、BGM切战斗曲、把对阵双方的名字和看点喊出来。核心心法：制造\"期待感\"让观众留下来看，制造\"紧迫感\"让人赶紧出手。不要一上来就要大票，先让人\"破个蛋\"——第一个出手的人会带动后面的人。",
        examples: [
            "来了来了来了！新一轮血条——小贤对阵开心！这是今晚第三次相遇了，前两次各赢一局，这一把就是决胜局！贤家军的兄弟准备好了吗？开心的守护者在哪里？先把蛋破了，谁先破蛋谁先有气势！",
            "兄弟们，这把咱们披上黄金铠甲，骑上汗血宝马，挥军北上！对面已经严阵以待了——先别管大票小票，先破个蛋讨个好彩头。一个小心心就是一面旗，先把旗插上！"
        ],
        tips: [
            "开场30秒不要直接要钱，先制造\"有看头\"的期待——\"第三次相遇\"\"决胜局\"",
            "\"先破蛋\"是降低出手门槛的万能话术，一个小心心谁都有",
            "BGM在PK开始那一刻切强节奏，音乐本身就是气氛催化剂",
            "把对阵双方\"标签化\"——\"贤家军\"对\"开心守护团\"——制造阵营感"
        ]
    },
    {
        id: "st-pk-close",
        category: "血条PK",
        scene: "PK后期守塔",
        goal: "最后10秒把所有观望的人卷进来，制造\"全直播间一起倒数\"的集体行为",
        logic: "最后10秒是全直播间注意力最集中的时刻。你的语速、语调、措辞要同时达到顶峰——语速快到不给思考时间，语调高到穿透手机，措辞简化到只剩动作指令。不要让任何人觉得\"看看就行\"，要让所有人觉得\"我不动手就错过了\"。核心心法：把\"守塔\"变成一个集体仪式——不是某个人在守，是\"我们\"在守，评论区刷\"守\"字就是参与。",
        examples: [
            "最后10秒！所有人！屏刷\"守\"！手上有的别留了，秒了它！9、8、7——还有！还有人出手！6、5、4——血条压成血丝了兄弟们！3、2——守住了！！贤家军牛X！",
            "兄弟姐妹们最后15秒票差不到30票！什么叫一念天堂一念地狱？这就是！刺客想偷，守护想守，15秒后只有一方能笑。守护的兄弟——你们的票就是小贤的护盾，现在不秒更待何时？！"
        ],
        tips: [
            "最后10秒必须倒数——这是强制所有人\"参与\"的集体仪式",
            "倒数要快到不给犹豫时间，每个数字间隔不超过一秒",
            "喊\"屏刷守\"是让没钱上票的用户也能参与——他们弹幕了就不走了",
            "守住了要立刻给守护方英雄待遇——\"贤家军牛X\"——让他们下次还愿意守"
        ]
    },
    {
        id: "st-streak",
        category: "血条PK",
        scene: "十连展示/通关",
        goal: "给连胜主播仪式感，给消费用户成就感，把通关变成下一次消费的起点",
        logic: "十连胜不只是主播的荣耀，更是所有支持过ta的用户的\"联合战绩\"。你要让消费用户感觉到——\"她的十连胜里有我一票\"。核心心法：把成功归功于用户而非主播。不要说\"小贤太厉害了\"，要说\"贤家军打出了十连胜\"。然后立刻引导下一轮——通关不是结束，是下一个挑战的开始。戴皇冠、发表感言、独舞，每个环节都是\"让用户拍下来发朋友圈\"的传播素材。",
        examples: [
            "十连胜！！贤家军打出来了！！不是小贤一个人打的，是在场每一个投过票的兄弟一起打的！现在给小贤戴上皇冠——来，小贤有什么话想对支持你的兄弟们说？",
            "这是今晚的第一个十连！小贤的solo独舞准备好了吗？家人们想看什么曲子，公屏刷起来！还没关注的兄弟现在把关注点了，下一轮更精彩，别等下找不到我们。"
        ],
        tips: [
            "\"你的十连胜里有我一票\"是让用户下次还来的核心心理锚点",
            "戴皇冠动作要慢——让用户截图、录屏、发朋友圈",
            "感言环节控制在1分钟内，不要让节奏断太久",
            "十连结束后立刻预告下一轮对阵，不要给用户离场窗口"
        ]
    },

    // ===== 应急场景 =====
    {
        id: "st-cold",
        category: "应急场景",
        scene: "拉票冷场/无人上票",
        goal: "在无人上票的尴尬时刻把场子重新热起来，不给观众离场理由",
        logic: "冷场是所有主持都会遇到的状况。新人最容易犯的错误是冷场了还硬拉——越拉越冷、越冷越慌、越慌越不会说话。正确做法：先承认冷场的合理性（\"这个点大家可能都在吃饭\"），然后用\"非付费互动\"把气氛先拉回来（弹幕扣1、猜谜、调侃主播），最后再回到拉票。核心心法：票可以等，人不能走。先用互动把人留住，票自然就有了。",
        examples: [
            "哎哟这个点大家都去吃饭了是吧？没事，台上主播不会饿——她们靠仙气活着的。趁现在人少我问你们一个问题：你们觉得小贤和小U谁的舞感更好？公屏打名字，我等下让得票多的那个先跳！",
            "现在票数没动啊，我先说——没票不丢人，谁都有手头紧的时候。但你们的手指又没断，公屏陪主播聊两句总可以吧？弹幕扣一波\"在\"，让我看到至少还有人在！只要你们还在，这直播间就不会冷～"
        ],
        tips: [
            "硬拉不如不拉——先转移焦点做互动，气氛回来再拉票",
            "自嘲式破冰比硬撑有效：\"这个点大家都在吃饭是吧\"——承认现实反而让人放松",
            "给不花钱的用户找事做：弹幕扣字、投票、猜谜——参与感是第一位的",
            "不要表现出焦虑或埋怨，你的情绪会传染——你慌了观众更慌"
        ]
    },
    {
        id: "st-host-down",
        category: "应急场景",
        scene: "主播拉不上票",
        goal: "在主播自己都撑不住场的时候接过节奏，保护主播尊严同时稳住票仓",
        logic: "主播拉不上票有两种情况：一是确实没人支持（新主播），二是老主播今天状态不对。无论哪种，你的角色都不是\"替她拉票\"，而是\"帮她找台阶同时给她争取时间\"。不要让主播在台上硬扛——越扛越惨，粉丝看着也难受。你要做的是用幽默解围、用话术把她的\"拉不上票\"重新定义（\"今天不是她的日子\"而非\"她不行\"），然后快速转到下一个环节。保护主播的面子就是保护整个团的品牌。",
        examples: [
            "好了好了，小贤今天水逆，咱们放她一马。不怪她不努力，怪今天星象不利——等会儿水逆完了你们再看，肯定不一样。咱们先让开心上来，开心你准备好接盘了吗？",
            "兄弟们，小贤今天嗓子状态确实不太好，这个她自己也知道。但你们想想，嗓子不好还硬撑着来播是为了谁？不就是为了不想让等了一天的你们失望吗。所以票数不重要，态度摆在这了。接下来换开心接棒，贤家军如果想继续支持小贤的，先去喝口水休息一下，下轮见。"
        ],
        tips: [
            "不要当着观众的面责怪主播——保护主播=保护品牌",
            "把\"拉不上票\"重新定义为外部原因（水逆/状态不好/今天不是她的日子），而非能力问题",
            "给粉丝一个\"不丢脸\"的下台阶：\"先休息，下轮见\"——让他们愿意回来",
            "转场要快，不要给观众太多时间品味\"尴尬\""
        ]
    },
    {
        id: "st-crisis",
        category: "应急场景",
        scene: "突发状况处理",
        goal: "在意外发生时稳定直播间情绪，把事故变成\"活人感\"加分项",
        logic: "突发状况（黑粉带节奏、技术故障、弹幕节奏乱了）考验的是主持的\"兜底能力\"。核心原则：你有多稳，直播间就有多稳。分情况处理——黑粉带节奏：不正面杠，用幽默化解（\"我厚脸皮能扛，主播扛不住\"）。技术故障：坦诚但不慌张（\"设备不给力，大家等我一分钟\"）。弹幕节奏乱：用一个强制互动的指令把所有人注意力拉回统一轨道（\"所有人公屏扣1\"）。所有处理方式的底层逻辑都是：你不是在解决问题，你是在稳住一群看着问题发生的人。",
        examples: [
            "哎新进来的宝宝不懂就多看，点关注加灯牌慢慢学。别上来就怼主播啊，主播心理脆弱得很，你一句她能哭到明天。我就不一样了——我厚脸皮，你们有意见冲我来，我接着。来，刚才怼人的那个兄弟，你说，我陪你聊。",
            "设备崩了！稍等我一分钟，大家别走啊——这时候走你对得起刚才投的票吗。趁这一分钟，没关注的把关注点了，关注了没亮灯牌的亮个灯牌，灯牌亮了的把名字改了——别用数字名，取个好记的，下次我见到直接叫你。"
        ],
        tips: [
            "黑粉来了不要封、不要怼、不要慌——用幽默化解最体面",
            "技术故障时坦诚+给观众找事做——\"趁这一分钟关注点起来\"——把等人变成有目的的等待",
            "弹幕节奏乱了用一个统一的互动指令拉回来——\"所有人公屏扣1\"——强制注意力聚焦",
            "处理完后不要反复解释——翻篇，继续正常节奏——越解释越像有问题"
        ]
    },

    // ===== 收尾+通用 =====
    {
        id: "st-thanks",
        category: "收尾+通用",
        scene: "谢榜",
        goal: "让每一个消费用户在谢榜中感受到\"被铭记\"，把单次消费转化为长期关系",
        logic: "谢榜是所有消费体验的最后一道工序——前面的拉票、上票、PK都是\"买入\"，谢榜是\"落袋\"。一个好的谢榜应该让用户感觉：我花的每一分钱都被看见了、被记录了、被珍视了。核心技巧：大礼物用户要单独点名+细节（\"XX哥送的那个城堡，是在小贤被刀最惨的时候出来的\"），中小票用户用集体感谢（\"所有众筹的兄弟\"）但要让他们觉得\"我在那个'所有'里面\"。谢榜不是走过场，是给用户制造\"下次还想来\"的理由。",
        examples: [
            "终于到了我最喜欢的环节——谢榜。今天首先要感谢U哥，U哥每次出手都是在小贤最需要的时候。今天那把被刀到快走了，U哥一个城堡直接翻盘，有没有？小贤你记不记得那次？——不记得也得记得啊，这可是你榜一！",
            "还有所有众筹的兄弟——小心心、棒棒糖、亲吻、玫瑰，每一个我都看到了。我知道送大票的是少数，但我更知道这个直播间是靠每一个众筹的兄弟撑起来的。没有你们，大票不会来；没有你们，主播站不住。谢谢在场的每一个人，你们的名字在榜上，也在我们心里。"
        ],
        tips: [
            "大礼物用户点名+消费细节——\"在XX被刀最惨的时候出来的\"——证明你真的在关注",
            "中小票用户集体感谢但要让他们感受到被包含——\"你们撑起了这个直播间\"",
            "让主播一起谢——主播自己记住支持她的游客，主持补充细节",
            "谢榜控制在3-5分钟，不要拖太久——最好的感谢是下次更好的直播"
        ]
    },
    {
        id: "st-signoff",
        category: "收尾+通用",
        scene: "下播预告+导流",
        goal: "把直播间的流量转化为可持续的用户池——关注/粉丝群/下次开播提醒",
        logic: "下播前的最后5分钟是转化\"路人→关注\"\"关注→粉丝群\"\"粉丝→铁粉\"的黄金时间。核心逻辑是制造\"错失恐惧\"——如果你现在不走这步，下次你找不到我们。具体动作：预告下次内容（给回来的理由）、引导关注（低门槛留存）、引导粉丝群（深绑定）、制造\"今天没看到的你亏了\"（传播素材）。每一步都给一个明确的\"为什么\"——不是因为求你了，是因为对你好。",
        examples: [
            "好了家人们，今天的团播到这就差不多了。感谢每一位陪到最后的，尤其是现在还在公屏的——你们是真爱。没关注的把关注点了，下次开播第一时间收到提醒，别想找我们的时候翻半天找不到。粉丝群在主页，群里每天发今日未播花絮，主播的素颜照也在群里——好吧这句是骗你们的。",
            "预告一下——明天同一时间，小贤和开心要挑战一个全新的玩法，我还没想好叫什么名字，但肯定比今天还刺激。想看的把关注点了，明天开播系统会自动提醒你。今天错过的也别遗憾，明天补上就行～"
        ],
        tips: [
            "每一个留存动作都给\"为什么\"——\"关注了下次不迷路\"比\"点个关注吧\"有效得多",
            "预告要有具体内容而非空话——\"全新玩法\"比\"精彩继续\"更让人想来",
            "用轻松甚至开玩笑的方式引导粉丝群——不让人有被推销的压力",
            "下播不要拖——说完该说的，干脆利落地再见——拖沓反而让人对下次没期待"
        ]
    },
    {
        id: "st-gift",
        category: "收尾+通用",
        scene: "礼物感谢（分层）",
        goal: "让不同消费层级的用户都获得匹配的情绪回报，分层满足、分层绑定",
        logic: "送礼的心理本质是\"用物质换情感\"。不同价值的礼物对应不同的情感需求：小心心要的是存在感（\"我看到你了\"），中档礼物要的是归属感（\"你是我们的人了\"），大礼物要的是专属感（\"你不一样\"）。你的感谢要精准匹配——给存在感的不要上升到专属，给专属的不要下降到泛泛而谢。另外核心铁律：不对比（不说A多B少）、不嫌弃（小票也要谢）、不道德绑架（不暗示不送就不够意思）。",
        examples: [
            "XX的小心心一闪，我看到你了！一闪一闪亮晶晶，满屏都是小星星～被惦记的感觉真好，常来玩！",
            "XX的跑车来了！这不是跑车这是一辆感情的列车啊——上了这趟车以后就是一家人了，搭车的扣1，还没上车的赶紧的！",
            "哇！！U哥的城堡！！这份心意不是钱能衡量的——U哥你知道最让我感动的是什么吗？不是城堡本身，是你每次都在最需要的时候出现。你不只是观众，你是这个团的底气。谢谢U哥，这个情我记下了。"
        ],
        tips: [
            "小心心要的是\"被看见\"——叫名字就够了，不用过度感谢",
            "中档礼物要的是\"归属感\"——\"上了这趟车以后就是一家人\"",
            "大礼物要的是\"专属感\"——强调时机的特殊性和个人的不可替代性",
            "不对比、不嫌弃、不道德绑架——这是底线",
            "对大礼物用户，感谢后要继续在后续环节cue到——\"U哥你觉得呢\"——让他持续有存在感"
        ]
    }
];
```

- [ ] **Step 2: 在 storage.js 的 init 方法中添加脚本模板合并调用**

在 `DB.init()` 中，`this._mergeChecklist` 之后添加：

```javascript
this._mergeScriptTemplates(defaults.scriptTemplates || []);
```

- [ ] **Step 3: 在 storage.js 中添加合并方法**

在 `_mergeChecklist` 之后添加：

```javascript
_mergeScriptTemplates(defaultTemplates) {
    const existing = this.getScriptTemplates();
    const existingMap = new Map(existing.map(m => [m.id, m]));
    let changed = false;

    defaultTemplates.forEach(dt => {
        const old = existingMap.get(dt.id);
        if (!old) {
            existing.push(dt);
            changed = true;
        } else {
            // 已有模板：更新所有字段（确保内容改进生效）
            old.category = dt.category;
            old.scene = dt.scene;
            old.goal = dt.goal;
            old.logic = dt.logic;
            old.examples = dt.examples;
            old.tips = dt.tips;
            changed = true;
        }
    });

    if (changed) this.saveScriptTemplates(existing);
},
```

- [ ] **Step 4: 在 storage.js 中添加脚本存储方法**

在 `getChecklistProgress` 方法之后添加：

```javascript
// ===== 话术模板 =====
getScriptTemplates() {
    try { return JSON.parse(localStorage.getItem("scriptTemplates")) || []; }
    catch (e) { return []; }
},
saveScriptTemplates(templates) {
    localStorage.setItem("scriptTemplates", JSON.stringify(templates));
},

// ===== 新人话术版本 =====

/** 获取新人所有话术数据 */
getScripts(name) {
    const t = this.getTrainee(name);
    return t.scripts || {};
},

/** 保存新版本（每次保存递增版本号，新建副本） */
saveScriptVersion(name, templateId, content, status) {
    const trainees = this.getTrainees();
    if (!trainees[name]) trainees[name] = { moduleProgress: {}, examHistory: [], checklistProgress: {} };
    if (!trainees[name].scripts) trainees[name].scripts = {};

    const sc = trainees[name].scripts[templateId] || { versions: [], activeVersion: 0 };
    const newVersion = sc.versions.length + 1;

    sc.versions.push({
        version: newVersion,
        content: content,
        createdAt: new Date().toLocaleString("zh-CN"),
        feedback: null
    });
    sc.activeVersion = newVersion;
    sc.status = status || "draft";  // "draft" | "submitted" | "reviewed"

    trainees[name].scripts[templateId] = sc;
    this.saveTrainees(trainees);
    return newVersion;
},

/** 更新草稿（不创建新版本，直接修改当前激活版本的内容） */
saveScriptDraft(name, templateId, content) {
    const trainees = this.getTrainees();
    if (!trainees[name] || !trainees[name].scripts) return;

    const sc = trainees[name].scripts[templateId];
    if (!sc) return;

    const active = sc.versions.find(v => v.version === sc.activeVersion);
    if (active && active.feedback === null) {
        // 当前版本还没有批注，直接修改
        active.content = content;
        active.createdAt = new Date().toLocaleString("zh-CN");
        sc.status = "draft";
    } else {
        // 已有批注的版本不能修改，创建新版本
        const newVersion = sc.versions.length + 1;
        sc.versions.push({
            version: newVersion,
            content: content,
            createdAt: new Date().toLocaleString("zh-CN"),
            feedback: null
        });
        sc.activeVersion = newVersion;
        sc.status = "draft";
    }
    this.saveTrainees(trainees);
},

/** 提交给培训师 */
submitScript(name, templateId) {
    const trainees = this.getTrainees();
    if (!trainees[name] || !trainees[name].scripts) return;
    const sc = trainees[name].scripts[templateId];
    if (sc) {
        sc.status = "submitted";
        this.saveTrainees(trainees);
    }
},

/** 切换激活版本 */
setActiveScriptVersion(name, templateId, versionNum) {
    const trainees = this.getTrainees();
    if (!trainees[name] || !trainees[name].scripts) return;
    const sc = trainees[name].scripts[templateId];
    if (sc && sc.versions.find(v => v.version === versionNum)) {
        sc.activeVersion = versionNum;
        this.saveTrainees(trainees);
    }
},

/** 培训师添加批注 */
addScriptFeedback(name, templateId, versionNum, feedbackText) {
    const trainees = this.getTrainees();
    if (!trainees[name] || !trainees[name].scripts) return;
    const sc = trainees[name].scripts[templateId];
    if (!sc) return;
    const ver = sc.versions.find(v => v.version === versionNum);
    if (ver) {
        ver.feedback = {
            trainer: "培训师",
            text: feedbackText,
            createdAt: new Date().toLocaleString("zh-CN")
        };
        sc.status = "reviewed";
        this.saveTrainees(trainees);
    }
},
```

- [ ] **Step 5: 在 storage.js init 中新增 scriptTemplates 初始写入**

在首次初始化代码块中（`if (!storedVersion)` 内），`localStorage.setItem("checklist", ...)` 之后添加：

```javascript
localStorage.setItem("scriptTemplates", JSON.stringify(defaults.scriptTemplates || []));
```

- [ ] **Step 6: 在浏览器中验证数据初始化**

打开 `index.html`，打开浏览器控制台，执行：

```javascript
// 清掉旧数据测试首次初始化
localStorage.clear();
location.reload();
// 然后检查
JSON.parse(localStorage.getItem("scriptTemplates")).length
// 预期: 16
DB.getScriptTemplates()[0].scene
// 预期: "开场拉数据"
```

---

### Task 2: HTML 结构 — 新增话术练习 Tab 和面板

**Files:**
- Modify: `index.html`

- [ ] **Step 1: 在 index.html 新人端 Tab 导航中添加话术练习按钮**

找到 `<button class="tab-btn" data-tab="progress">我的进度</button>`，在它前面插入：

```html
<button class="tab-btn" data-tab="script">话术练习</button>
```

完整的新人端 Tab 导航变为：

```html
<nav class="tab-nav">
    <button class="tab-btn active" data-tab="study">培训模块</button>
    <button class="tab-btn" data-tab="exam">试卷考试</button>
    <button class="tab-btn" data-tab="script">话术练习</button>
    <button class="tab-btn" data-tab="progress">我的进度</button>
</nav>
```

- [ ] **Step 2: 在 index.html 新人端 main-content 中添加话术面板**

找到 `<section class="tab-panel" id="trainee-panel-progress"></section>`，在它前面插入：

```html
<section class="tab-panel" id="trainee-panel-script"></section>
```

- [ ] **Step 3: 验证 HTML 结构**

打开 `index.html`，在控制台检查：

```javascript
document.getElementById("trainee-panel-script") !== null
// 预期: true
document.querySelectorAll("#view-trainee .tab-btn").length
// 预期: 4
```

---

### Task 3: App.js — Tab 切换路由

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: 在 switchTraineeTab 中添加话术面板的路由**

在 `switchTraineeTab` 方法的条件分支中，找到最后一行 `if (tabName === "progress")` 之后，添加：

```javascript
if (tabName === "script") Trainee.renderScriptPanel();
```

完整的方法变为：

```javascript
switchTraineeTab(tabName) {
    // 更新按钮状态
    document.querySelectorAll("#view-trainee .tab-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.tab === tabName);
    });
    // 更新面板
    document.querySelectorAll("#view-trainee .tab-panel").forEach(p => {
        p.classList.toggle("active", p.id === "trainee-panel-" + tabName);
    });
    // 渲染对应内容
    if (tabName === "study") Trainee.renderStudyPanel();
    if (tabName === "exam") Trainee.renderExamPanel();
    if (tabName === "script") Trainee.renderScriptPanel();
    if (tabName === "progress") Trainee.renderProgressPanel();
},
```

- [ ] **Step 3: 验证 Tab 切换**

打开 `index.html`，登录为新人，点击"话术练习"Tab，确认控制台无报错（当前 `renderScriptPanel` 还不存在，预期报错是正常的——下一步会实现）。

---

### Task 4: CSS — 话术系统全部样式

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: 在 style.css 末尾添加话术系统样式**

```css
/* ============================================
   话术练习系统
   ============================================ */

/* --- 场景列表 --- */
.script-summary {
    display: flex;
    gap: 16px;
    padding: 16px;
    margin-bottom: 8px;
    font-size: 14px;
    color: var(--text-secondary);
    background: var(--bg-card);
    border-radius: 12px;
    flex-wrap: wrap;
}
.script-summary strong {
    color: var(--text-primary);
}

/* 场景分类手风琴 — 复用 checklist-category 结构 */
.script-category {
    margin-bottom: 12px;
    border-radius: 12px;
    background: var(--bg-card);
    overflow: hidden;
}
.script-cat-header {
    display: flex;
    align-items: center;
    padding: 14px 16px;
    cursor: pointer;
    user-select: none;
    min-height: 48px;
    gap: 10px;
}
.script-cat-header:active {
    background: rgba(0,0,0,0.04);
}
.script-cat-arrow {
    font-size: 12px;
    color: var(--text-muted);
    width: 16px;
    flex-shrink: 0;
}
.script-cat-name {
    flex: 1;
    font-weight: 600;
    font-size: 15px;
}
.script-cat-count {
    font-size: 13px;
    color: var(--text-secondary);
    flex-shrink: 0;
}
.script-cat-body {
    /* 展开/折叠控制 */
}

/* 场景列表项 */
.script-item {
    display: flex;
    align-items: center;
    padding: 12px 16px 12px 40px;
    min-height: 48px;
    cursor: pointer;
    gap: 10px;
    border-top: 1px solid var(--border);
    transition: background 0.15s;
}
.script-item:active {
    background: rgba(0,0,0,0.04);
}
.script-item-icon {
    font-size: 18px;
    flex-shrink: 0;
    width: 24px;
    text-align: center;
}
.script-item-icon.unwritten { color: var(--danger); }
.script-item-icon.draft { color: var(--warning); }
.script-item-icon.written { color: var(--success); }
.script-item-icon.reviewed { color: #FF3B30; }  /* 有批注 — 红色圆点 */

.script-item-text {
    flex: 1;
    font-size: 14px;
    color: var(--text-primary);
}
.script-item-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 10px;
    flex-shrink: 0;
    font-weight: 500;
}
.script-item-badge.feedback {
    background: #FFE5E5;
    color: #FF3B30;
}

/* --- 场景详情页 --- */
.script-detail {
    padding-bottom: 200px; /* 给底部固定栏留空间 */
}
.script-detail-header {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    gap: 12px;
    background: var(--bg-card);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    z-index: 5;
}
.script-detail-back {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: var(--bg-secondary);
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.script-detail-back:active {
    background: var(--border);
}
.script-detail-title {
    flex: 1;
    font-size: 16px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.script-version-select {
    font-size: 13px;
    padding: 4px 8px;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text-primary);
    flex-shrink: 0;
    max-width: 100px;
}

/* 详情区块 */
.script-section {
    padding: 16px;
    border-bottom: 1px solid var(--border);
}
.script-section-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
}
.script-section.goal .script-section-text {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.5;
}
.script-section.logic .script-section-text {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.7;
}
.script-section.tips ul {
    margin: 0;
    padding-left: 18px;
}
.script-section.tips li {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.6;
    margin-bottom: 4px;
}

/* 示范话术滑动区 */
.script-examples-wrapper {
    position: relative;
    overflow: hidden;
    min-height: 80px;
}
.script-examples-track {
    display: flex;
    transition: transform 0.3s ease;
    will-change: transform;
}
.script-example-card {
    flex: 0 0 100%;
    padding: 16px;
    background: var(--bg-secondary);
    border-radius: 10px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-primary);
    font-style: italic;
    min-height: 60px;
    box-sizing: border-box;
}
.script-example-nav {
    display: flex;
    justify-content: center;
    gap: 16px;
    padding: 8px 0;
}
.script-example-nav button {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1px solid var(--border);
    background: var(--bg-card);
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
}
.script-example-nav button:active {
    background: var(--bg-secondary);
}
.script-example-nav button:disabled {
    opacity: 0.3;
}
.script-example-dots {
    display: flex;
    align-items: center;
    gap: 6px;
}
.script-example-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--border);
    transition: background 0.2s;
}
.script-example-dot.active {
    background: var(--primary);
    width: 18px;
    border-radius: 3px;
}

/* --- 培训师批注 --- */
.feedback-block {
    margin: 0 16px 16px 16px;
    padding: 14px 16px;
    background: #FFFBF0;
    border-left: 3px solid #FF9500;
    border-radius: 0 8px 8px 0;
}
.feedback-block-label {
    font-size: 12px;
    font-weight: 600;
    color: #FF9500;
    margin-bottom: 6px;
}
.feedback-block-text {
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.6;
}
.feedback-block-meta {
    font-size: 12px;
    color: var(--text-muted);
    margin-top: 6px;
}

/* --- 底部固定输入栏 --- */
.script-input-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-card);
    border-top: 1px solid var(--border);
    padding: 10px 16px;
    padding-bottom: max(10px, env(safe-area-inset-bottom));
    z-index: 10;
    max-width: 600px;
    margin: 0 auto;
    box-shadow: 0 -2px 10px rgba(0,0,0,0.06);
}
@media (min-width: 601px) {
    .script-input-bar {
        /* 桌面端底栏跟随内容区宽度 */
        left: 50%;
        transform: translateX(-50%);
        width: 100%;
    }
}
.script-input-bar textarea {
    width: 100%;
    min-height: 60px;
    max-height: 200px;
    padding: 12px;
    font-size: 15px;
    line-height: 1.5;
    border: 1px solid var(--border);
    border-radius: 10px;
    resize: vertical;
    font-family: inherit;
    background: var(--bg-secondary);
    color: var(--text-primary);
    box-sizing: border-box;
}
.script-input-bar textarea::placeholder {
    color: var(--text-muted);
    font-size: 14px;
}
.script-input-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
}
.script-input-actions button {
    flex: 1;
    min-height: 44px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    border: none;
}
.btn-script-draft {
    background: var(--bg-secondary);
    color: var(--text-secondary);
}
.btn-script-draft:active {
    background: var(--border);
}
.btn-script-submit {
    background: var(--primary);
    color: #fff;
}
.btn-script-submit:active {
    opacity: 0.85;
}
.btn-script-read {
    background: var(--bg-secondary);
    color: var(--primary);
    border: 1.5px solid var(--primary) !important;
    flex: 0.4;
}
.btn-script-read:active {
    background: rgba(0,122,255,0.08);
}

/* --- 试读模式 --- */
.read-mode-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: #1C1C1E;
    z-index: 100;
    display: flex;
    flex-direction: column;
    padding: 24px;
}
.read-mode-content {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}
.read-mode-text {
    font-size: 20px;
    line-height: 1.8;
    color: #FFFFFF;
    text-align: center;
    max-width: 400px;
    word-break: break-word;
}
.read-mode-close {
    min-height: 50px;
    border-radius: 12px;
    border: none;
    background: rgba(255,255,255,0.12);
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    margin-top: 16px;
}
.read-mode-close:active {
    background: rgba(255,255,255,0.2);
}

/* --- 培训师端话术卡片 --- */
.trainer-script-stats {
    font-size: 13px;
    color: var(--text-secondary);
    margin-top: 6px;
    cursor: pointer;
}
.trainer-script-stats:hover {
    color: var(--primary);
    text-decoration: underline;
}
.script-trainer-feedback-input {
    width: 100%;
    min-height: 80px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 10px;
    font-size: 14px;
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
    box-sizing: border-box;
    margin-top: 8px;
}
```

---

### Task 5: Trainee — 场景列表渲染

**Files:**
- Modify: `js/trainee.js`

- [ ] **Step 1: 添加 renderScriptPanel 方法**

在 `Trainee` 对象中（`renderStudyPanel` 前或 `renderProgressPanel` 后都行），添加：

```javascript
// ==================== 话术练习 ====================

/** 渲染话术场景列表 */
renderScriptPanel() {
    const container = document.getElementById("trainee-panel-script");
    const templates = DB.getScriptTemplates();
    const scripts = DB.getScripts(Auth.traineeName);

    if (templates.length === 0) {
        container.innerHTML = '<p class="empty-state">暂无话术模板，请联系培训师添加</p>';
        return;
    }

    // 按分类分组
    const groups = new Map();
    templates.forEach(t => {
        if (!groups.has(t.category)) groups.set(t.category, []);
        groups.get(t.category).push(t);
    });

    // 统计
    let totalWritten = 0, totalReviewed = 0;
    templates.forEach(t => {
        const s = scripts[t.id];
        if (s && s.status !== "draft" && s.versions.length > 0) totalWritten++;
        if (s && s.status === "reviewed") totalReviewed++;
    });

    const iconMap = {
        unwritten: '<span class="script-item-icon unwritten">○</span>',
        draft: '<span class="script-item-icon draft">◐</span>',
        written: '<span class="script-item-icon written">✓</span>',
        reviewed: '<span class="script-item-icon reviewed">🔴</span>'
    };

    let catsHTML = "";
    let first = true;
    groups.forEach((items, catName) => {
        const catWritten = items.filter(t => {
            const s = scripts[t.id];
            return s && s.status !== "draft" && s.versions.length > 0;
        }).length;
        const catColor = catWritten === items.length ? "var(--success)"
            : (catWritten === 0 ? "var(--text-muted)" : "var(--warning)");
        const catId = "sc-" + catName.replace(/[^a-zA-Z0-9一-龥]/g, "");

        catsHTML += `
            <div class="script-category">
                <div class="script-cat-header" onclick="Trainee.toggleCategory('${catId}')">
                    <span class="script-cat-arrow" id="${catId}-arrow">${first ? "▼" : "▶"}</span>
                    <span class="script-cat-name">${catName}</span>
                    <span class="script-cat-count" style="color:${catColor};">${catWritten}/${items.length}</span>
                </div>
                <div class="script-cat-body" id="${catId}-body" style="${first ? "" : "display:none;"}">
                    ${items.map(t => {
                        const s = scripts[t.id];
                        let status = "unwritten";
                        if (s) {
                            if (s.status === "reviewed") status = "reviewed";
                            else if (s.status === "submitted") status = "written";
                            else if (s.status === "draft" && s.versions.length > 0) status = "draft";
                        }
                        let badgeHTML = "";
                        if (s && s.status === "reviewed" && s.versions[s.activeVersion - 1] && s.versions[s.activeVersion - 1].feedback) {
                            badgeHTML = '<span class="script-item-badge feedback">有批注</span>';
                        }
                        return `
                            <div class="script-item" onclick="Trainee.openScriptScene('${t.id}')">
                                ${iconMap[status]}
                                <span class="script-item-text">${t.scene}</span>
                                ${badgeHTML}
                            </div>`;
                    }).join("")}
                </div>
            </div>`;
        first = false;
    });

    container.innerHTML = `
        <div class="script-summary">
            <span>已完成 <strong>${totalWritten}</strong> / ${templates.length}</span>
            <span>培训师已批 <strong>${totalReviewed}</strong> 个</span>
        </div>
        ${catsHTML}
    `;
},
```

- [ ] **Step 2: 验证列表渲染**

打开 `index.html`，登录新人，切换到"话术练习"Tab。确认：
- 显示 4 个分类，默认第一个展开
- 16 个场景全部显示
- 所有状态为 ○（未写）

---

### Task 6: Trainee — 场景详情页渲染

**Files:**
- Modify: `js/trainee.js`

- [ ] **Step 1: 添加 openScriptScene 方法**

在 `renderScriptPanel` 之后添加：

```javascript
/** 当前正在查看的话术场景ID */
currentScriptId: null,

/** 打开话术场景详情 */
openScriptScene(templateId) {
    const templates = DB.getScriptTemplates();
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    this.currentScriptId = templateId;
    const scripts = DB.getScripts(Auth.traineeName);
    const sc = scripts[templateId];
    const activeV = sc ? sc.activeVersion : 0;
    const currentContent = sc && activeV > 0
        ? (sc.versions.find(v => v.version === activeV) || {}).content || ""
        : "";
    const currentFeedback = sc && activeV > 0
        ? (sc.versions.find(v => v.version === activeV) || {}).feedback
        : null;

    // 版本选项
    let versionOptions = `<option value="0">新建</option>`;
    if (sc) {
        sc.versions.forEach(v => {
            const sel = v.version === activeV ? " selected" : "";
            versionOptions += `<option value="${v.version}"${sel}>版本 ${v.version}</option>`;
        });
    }

    // 示范话术
    const examplesHTML = (template.examples || []).length > 0
        ? template.examples.map((ex, i) => `
            <div class="script-example-card">${this.escapeHtml(ex)}</div>
        `).join("")
        : '<div class="script-example-card" style="color:var(--text-muted);">暂无示范</div>';

    const dotsHTML = (template.examples || []).map((_, i) => `
        <span class="script-example-dot ${i === 0 ? 'active' : ''}" data-dot="${i}"></span>
    `).join("");

    // 关键技巧
    const tipsHTML = (template.tips || []).length > 0
        ? `<ul>${template.tips.map(tip => `<li>${this.escapeHtml(tip)}</li>`).join("")}</ul>`
        : '<p style="color:var(--text-muted);">暂无技巧</p>';

    // 批注
    let feedbackHTML = "";
    if (currentFeedback) {
        feedbackHTML = `
            <div class="feedback-block">
                <div class="feedback-block-label">📝 培训师批注（版本 ${activeV}）</div>
                <div class="feedback-block-text">${this.escapeHtml(currentFeedback.text)}</div>
                <div class="feedback-block-meta">${currentFeedback.trainer} · ${currentFeedback.createdAt}</div>
            </div>`;
    }

    const container = document.getElementById("trainee-panel-script");
    container.innerHTML = `
        <div class="script-detail">
            <div class="script-detail-header">
                <button class="script-detail-back" onclick="Trainee.renderScriptPanel()" aria-label="返回">←</button>
                <span class="script-detail-title">${template.scene}</span>
                <select class="script-version-select" id="scriptVersionSelect" onchange="Trainee.switchScriptVersion('${templateId}', this.value)">
                    ${versionOptions}
                </select>
            </div>

            <div class="script-section goal">
                <div class="script-section-label">📍 目的</div>
                <div class="script-section-text">${this.escapeHtml(template.goal)}</div>
            </div>

            <div class="script-section logic">
                <div class="script-section-label">🧠 逻辑思维</div>
                <div class="script-section-text">${this.escapeHtml(template.logic)}</div>
            </div>

            <div class="script-section">
                <div class="script-section-label">💬 示范话术</div>
                <div class="script-examples-wrapper">
                    <div class="script-examples-track" id="scriptExamplesTrack">
                        ${examplesHTML}
                    </div>
                </div>
                ${(template.examples || []).length > 1 ? `
                <div class="script-example-nav">
                    <button id="btnExPrev" disabled onclick="Trainee.slideExample(-1)">‹</button>
                    <span class="script-example-dots">${dotsHTML}</span>
                    <button id="btnExNext" onclick="Trainee.slideExample(1)">›</button>
                </div>` : ""}
            </div>

            <div class="script-section tips">
                <div class="script-section-label">💡 关键技巧</div>
                ${tipsHTML}
            </div>

            ${feedbackHTML}
        </div>

        <div class="script-input-bar">
            <textarea id="scriptContentInput" placeholder="在这里写你自己的话术版本...">${this.escapeHtml(currentContent)}</textarea>
            <div class="script-input-actions">
                <button class="btn-script-draft" onclick="Trainee.saveScriptDraft()">保存草稿</button>
                <button class="btn-script-read" onclick="Trainee.openReadMode()">试读</button>
                <button class="btn-script-submit" onclick="Trainee.submitScript()">提交</button>
            </div>
        </div>
    `;

    // 初始化示范话术当前索引
    this._exampleIndex = 0;
},
```

---

### Task 7: Trainee — 保存/提交/版本切换逻辑

**Files:**
- Modify: `js/trainee.js`

- [ ] **Step 1: 添加保存草稿、提交、版本切换、示范滑动方法**

在 `openScriptScene` 之后添加：

```javascript
/** 示范话术当前索引 */
_exampleIndex: 0,

/** 示范话术左右滑动 */
slideExample(dir) {
    const templates = DB.getScriptTemplates();
    const template = templates.find(t => t.id === this.currentScriptId);
    if (!template) return;
    const total = (template.examples || []).length;
    if (total <= 1) return;

    this._exampleIndex += dir;
    if (this._exampleIndex < 0) this._exampleIndex = 0;
    if (this._exampleIndex >= total) this._exampleIndex = total - 1;

    const track = document.getElementById("scriptExamplesTrack");
    if (track) {
        track.style.transform = `translateX(-${this._exampleIndex * 100}%)`;
    }
    // 更新按钮状态
    const prevBtn = document.getElementById("btnExPrev");
    const nextBtn = document.getElementById("btnExNext");
    if (prevBtn) prevBtn.disabled = this._exampleIndex === 0;
    if (nextBtn) nextBtn.disabled = this._exampleIndex === total - 1;
    // 更新圆点
    document.querySelectorAll(".script-example-dot").forEach((d, i) => {
        d.classList.toggle("active", i === this._exampleIndex);
    });
},

/** 保存草稿 */
saveScriptDraft() {
    const content = document.getElementById("scriptContentInput").value.trim();
    if (!content) { alert("请先写点内容再保存"); return; }
    DB.saveScriptDraft(Auth.traineeName, this.currentScriptId, content);
    // 更新按钮文案提示
    const textarea = document.getElementById("scriptContentInput");
    const origBg = textarea.style.background;
    textarea.style.background = "#E8F5E9";
    setTimeout(() => { textarea.style.background = origBg; }, 300);
    // 回到列表刷新状态
    setTimeout(() => this.renderScriptPanel(), 500);
},

/** 提交给培训师 */
submitScript() {
    const content = document.getElementById("scriptContentInput").value.trim();
    if (!content) { alert("请先写内容再提交"); return; }

    DB.saveScriptDraft(Auth.traineeName, this.currentScriptId, content);
    DB.submitScript(Auth.traineeName, this.currentScriptId);
    alert("已提交给培训师，等待批注～");
    this.renderScriptPanel();
},

/** 切换版本 */
switchScriptVersion(templateId, versionNum) {
    const vn = parseInt(versionNum);
    if (vn === 0) {
        // 新建版本：清空输入框
        document.getElementById("scriptContentInput").value = "";
        document.getElementById("scriptVersionSelect").value = "0";
    } else {
        DB.setActiveScriptVersion(Auth.traineeName, templateId, vn);
        this.openScriptScene(templateId);
    }
},

/** 打开试读模式 */
openReadMode() {
    const content = document.getElementById("scriptContentInput").value.trim();
    if (!content) { alert("还没有写内容，先写点东西再试读吧"); return; }

    const overlay = document.createElement("div");
    overlay.className = "read-mode-overlay";
    overlay.id = "readModeOverlay";
    overlay.innerHTML = `
        <div class="read-mode-content">
            <div class="read-mode-text">${this.escapeHtml(content).replace(/\n/g, "<br>")}</div>
        </div>
        <button class="read-mode-close" onclick="document.getElementById('readModeOverlay').remove()">关闭</button>
    `;
    overlay.addEventListener("click", function(e) {
        if (e.target === this) this.remove();
    });
    document.body.appendChild(overlay);
},
```

- [ ] **Step 2: 验证保存和提交流程**

打开 `index.html`，登录新人：
- 进入"话术练习" → 点"开场拉数据"
- 在底部输入框写一段话 → 点"保存草稿"
- 确认返回列表后状态变为 ◐ 草稿
- 再进入 → 确认内容还在 → 修改 → 点"提交"
- 确认列表状态变为 ✓

---

### Task 8: Trainee — 版本历史查看

**Files:**
- Modify: `js/trainee.js`

- [ ] **Step 1: 修改 openScriptScene，在有历史版本时显示版本切换下拉**

（此功能已在 Task 6 的版本下拉中实现，此处验证即可）

切换到历史版本后，详情页展示该版本的内容和批注，底部固定栏显示该版本的内容（只读）。

- [ ] **Step 2: 验证版本切换**

打开 `index.html`，进入一个话术场景，保存多版，切换版本确认内容正确切换。

---

### Task 9: Trainer — 话术监管和批注

**Files:**
- Modify: `js/trainer.js`

- [ ] **Step 1: 在 renderMonitorPanel 的新人卡片中添加话术统计**

找到每个新人卡片的 HTML 渲染处（`clMastered}/${checklist.length}` 之后），在 `</div>` 之前添加话术统计行：

```javascript
const templates = DB.getScriptTemplates();
const scripts = DB.getScripts(name);
let scriptWritten = 0, scriptPending = 0;
templates.forEach(t => {
    const s = scripts[t.id];
    if (s && s.status === "submitted") scriptPending++;
    if (s && s.status !== "draft" && s.versions.length > 0) scriptWritten++;
});

// 在卡片末尾（能力掌握那行之后）添加：
<div class="trainer-script-stats" onclick="Trainer.viewTraineeScripts('${name}')">
    话术进度：${scriptWritten}/${templates.length} 已写${scriptPending > 0 ? ' · ' + scriptPending + ' 个待批注' : ''}
</div>
```

- [ ] **Step 2: 添加 viewTraineeScripts 方法**

在 `Trainer` 对象中添加（`deleteTrainee` 之前或之后）：

```javascript
/** 查看某新人的话术列表 */
viewTraineeScripts(name) {
    const container = document.getElementById("trainer-panel-monitor");
    const templates = DB.getScriptTemplates();
    const scripts = DB.getScripts(name);

    const groups = new Map();
    templates.forEach(t => {
        if (!groups.has(t.category)) groups.set(t.category, []);
        groups.get(t.category).push(t);
    });

    let catsHTML = "";
    let first = true;
    groups.forEach((items, catName) => {
        const catId = "tsc-" + catName.replace(/[^a-zA-Z0-9一-龥]/g, "");
        catsHTML += `
            <div class="script-category">
                <div class="script-cat-header" onclick="Trainee.toggleCategory('${catId}')">
                    <span class="script-cat-arrow" id="${catId}-arrow">${first ? "▼" : "▶"}</span>
                    <span class="script-cat-name">${catName}</span>
                </div>
                <div class="script-cat-body" id="${catId}-body" style="${first ? "" : "display:none;"}">
                    ${items.map(t => {
                        const s = scripts[t.id];
                        let st = "unwritten";
                        if (s) {
                            if (s.status === "submitted") st = "submitted";
                            else if (s.status === "reviewed") st = "reviewed";
                            else if (s.versions.length > 0) st = "draft";
                        }
                        const icons = { unwritten: "○", draft: "◐", submitted: "⚠", reviewed: "✓" };
                        const iconColors = { unwritten: "var(--danger)", draft: "var(--warning)", submitted: "#FF9500", reviewed: "var(--success)" };
                        return `
                            <div class="script-item" onclick="Trainer.openScriptFeedback('${name}', '${t.id}')">
                                <span class="script-item-icon" style="color:${iconColors[st]};">${icons[st]}</span>
                                <span class="script-item-text">${t.scene}</span>
                                ${st === "submitted" ? '<span class="script-item-badge feedback">待批注</span>' : ''}
                            </div>`;
                    }).join("")}
                </div>
            </div>`;
        first = false;
    });

    container.innerHTML = `
        <div style="padding:16px;">
            <button class="btn btn-ghost btn-sm" onclick="Trainer.renderMonitorPanel()">← 返回监管列表</button>
            <h3 style="margin:12px 0;">${name} 的话术练习</h3>
            ${catsHTML}
        </div>
    `;
},

/** 打开批注页面 */
openScriptFeedback(name, templateId) {
    const container = document.getElementById("trainer-panel-monitor");
    const templates = DB.getScriptTemplates();
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    const scripts = DB.getScripts(name);
    const sc = scripts[templateId];
    const activeV = sc ? sc.activeVersion : 0;
    const currentVer = sc && activeV > 0 ? sc.versions.find(v => v.version === activeV) : null;
    const currentContent = currentVer ? currentVer.content : "（该场景尚未提交）";
    const currentFeedback = currentVer ? currentVer.feedback : null;

    let feedbackHTML = "";
    if (currentFeedback) {
        feedbackHTML = `
            <div class="feedback-block">
                <div class="feedback-block-label">我之前的批注（版本 ${activeV}）</div>
                <div class="feedback-block-text">${Trainer.escHtml(currentFeedback.text)}</div>
                <div class="feedback-block-meta">${currentFeedback.createdAt}</div>
            </div>`;
    }

    container.innerHTML = `
        <div class="script-detail">
            <div class="script-detail-header">
                <button class="script-detail-back" onclick="Trainer.viewTraineeScripts('${name}')">←</button>
                <span class="script-detail-title">${template.scene} — ${name}</span>
            </div>

            <div class="script-section goal">
                <div class="script-section-label">📍 模板目的</div>
                <div class="script-section-text">${Trainer.escHtml(template.goal)}</div>
            </div>

            <div class="script-section">
                <div class="script-section-label">✏️ ${name} 的版本（版本 ${activeV}）</div>
                <div class="script-section-text" style="white-space:pre-wrap;background:var(--bg-secondary);padding:14px;border-radius:10px;font-size:14px;line-height:1.6;">
                    ${Trainer.escHtml(currentContent)}
                </div>
            </div>

            ${feedbackHTML}

            <div class="script-section">
                <div class="script-section-label">📝 ${currentFeedback ? '修改批注' : '添加批注'}</div>
                <textarea class="script-trainer-feedback-input" id="trainerFeedbackInput" placeholder="给出具体的修改建议...">${currentFeedback ? Trainer.escHtml(currentFeedback.text) : ''}</textarea>
                <button class="btn btn-primary" style="margin-top:10px;width:100%;" onclick="Trainer.submitFeedback('${name}', '${templateId}', ${activeV})">
                    ${currentFeedback ? '更新批注' : '提交批注'}
                </button>
            </div>
        </div>
    `;
},

/** 提交批注 */
submitFeedback(name, templateId, versionNum) {
    const text = document.getElementById("trainerFeedbackInput").value.trim();
    if (!text) { alert("请填写批注内容"); return; }
    DB.addScriptFeedback(name, templateId, versionNum, text);
    alert("批注已提交！新人下次打开话术就能看到～");
    this.openScriptFeedback(name, templateId);
},
```

- [ ] **Step 2: 验证培训师端功能**

打开 `index.html`，登录培训师：
- 进"新人监管" → 确认每个新人卡片显示话术进度
- 点话术进度 → 进话术列表 → 点一个场景 → 确认看到新人的版本
- 填写批注 → 提交 → 确认批注显示

---

### Task 10: 集成验收

**Files:**
- 无

- [ ] **Step 1: 完整流程测试**

按以下路径走一遍：

1. 清 localStorage，刷新页面
2. 新人登录 → 确认 4 个 Tab
3. 话术练习 → 确认 16 个场景、4 个分类、手风琴折叠
4. 点"开场拉数据" → 确认目的/逻辑/示范/技巧完整展示
5. 示范话术左右滑动
6. 底部输入框写内容 → 保存草稿 → 确认列表状态
7. 再进入 → 提交 → 确认状态
8. 写第二个版本 → 版本切换
9. 点试读 → 确认大字模式
10. 培训师登录 → 新人监管 → 话术进度 → 批注
11. 新人再进 → 确认 🔴 有批注状态 → 查看批注

- [ ] **Step 2: 手机端验证**

用 Chrome DevTools 切换到 375px 宽度，确认：
- 所有文字可读、无横向溢出
- 列表项可点击（≥48px）
- 底部固定栏正常显示
- 示范话术滑动正常
- 试读模式大字清晰
