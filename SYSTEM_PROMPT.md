# 系统提示词：复刻「麦麦营养点餐助手」

> **使用方式**：把本文件从「## 一、项目目标」开始到「## 十一、重建施工顺序」的全部内容，整段复制给一个具备本地文件读写能力的编码 Agent，即可从零重建系统。文中所有数值、文案、数据结构均为实测值，可原样落码；标注「必须原样」的部分不要改写，否则视觉、算法与测试结果会不一致。
>
> **交付形态**：单文件 `index.html`（约 2100 行，HTML + 内联 CSS + 内联 JS，零外部依赖，双击即可运行）+ 4 份说明文档（`README.md`、`MCP_INTEGRATION.md`、`CONTEST_DECLARATION.md`、`workbuddy.md`）+ `screenshots/` 走查截图。

---

## 一、项目目标、用途与适用场景

### 1.1 一句话定位
一个**麦当劳移动端点餐向导单页应用**：用户输入人数与身体数据（可跳过），系统按营养学公式估算每人的一餐热量预算，在 5 类「餐型方案」约束下从真实菜单中枚举「主餐 × 小食 × 饮品（× 甜品）」组合，按低钠、高蛋白、贴合口味、不超预算排序，输出可解释的推荐结果，并支持单品替换、优惠券匹配、门店选择与下单确认。

### 1.2 可验收的目标（DoD）
| # | 目标 | 验收标准 |
|---|---|---|
| G1 | 完整点餐闭环 | 8 步全部可走通，1 人与多人均可成功生成推荐并进入订单页 |
| G2 | 营养计算可解释 | 每人产出 BMI、BMR、一餐热量预算，并在 UI 上标注口径（公式名、系数） |
| G3 | 推荐结果可审计 | 每个组合展示热量/蛋白/脂肪/碳水/钠/价格六项，且与商品营养表逐项求和一致 |
| G4 | 预算可控 | 总价超预算时自动降级为更便宜组合，并如实提示「仍可能超支」 |
| G5 | 极端输入不崩 | 忌口全选、预算 10 元、年龄 5 岁/100 岁等极端输入下给出友好降级而非报错 |
| G6 | 零依赖可分发 | 无 CDN、无外链字体、无图片文件、无音频文件；断网可运行 |
| G7 | 诚实标注 | 演示数据（团购、门店、优惠券、下单）在 UI 与文档中明确标注，不伪装成真实接口 |

### 1.3 适用场景
1. **门店/大赛演示**：麦当劳程序员创意开发大赛类场景，需要可离线演示、可截图录屏的完整产品形态。
2. **营养决策辅助**：多人拼单时按各自热量目标分别推荐，避免"一桌人吃同一份"。
3. **MCP 能力前端原型**：作为麦当劳 MCP（`mcp.mcd.cn`）的可视化外壳，验证工具编排与交互路径。
4. **教学/二次开发基线**：作为「单文件 HTML 应用」「Web Audio 音效引擎」「Canvas 小游戏」的工程范例。

### 1.4 明确不做（非目标）
- 不做后端、不做账号体系、不做真实支付、不做数据持久化（除音效开关）。
- 不在前端持有任何 Token；不发起任何外部网络请求。
- 不采集可识别个人身份的信息；身高体重年龄仅存于内存，刷新即失效。
- 不承诺医学结论：所有营养建议措辞必须是「参考/建议」，不得表述为诊断或处方。

### 1.5 合规底线
- 品牌色与 Logo 仅用于设计演示，需在文档中声明非官方产品。
- 团购、门店、优惠券为演示数据，必须标注「演示数据」。
- 下单为 UI 演示，必须明示「不会真实扣款」。

---

## 二、核心功能模块划分

### 2.1 模块清单
| ID | 模块 | 职责 | 关键实现 | 主要产出 |
|---|---|---|---|---|
| M1 | 品牌壳与导航 | 顶栏（Logo/标题/步数徽标/音效开关）、底部进度条、上一步/下一步按钮、页面容器 | `.brandbar` + `.app` + 8 个 `.page` 绝对切换 | 全局框架 |
| M2 | 流程状态机 | 维护 `STATE.step`、页面切换、按钮文案与禁用态、回退 | `STEPS` 数组 + `go(idx)` + `NEXT_LABELS` | 路由权威 |
| M3 | 身体信息与营养计算 | 采集人数/性别/年龄/身高/体重（年龄/身高/体重为滚轮选择器），实时 BMI 徽标，估算热量预算 | `Wheel` IIFE + `wheelField()` + `bmi()` `bmr()` `mealBudget()` `recommendType()` | `Person` 对象 |
| M4 | 餐型方案引擎 | 5 类餐型的热量区间、蛋白下限、推荐规则 | `MEAL_TYPES` + `renderMealTypes()` | `p.mealType` |
| M5 | 组合求解与预算降级 | 枚举组合、区间过滤、打分排序、Top6、换单品、总价压降 | `solvePerson()` `swapItem()` `enforceBudget()` | `Result[]` |
| M6 | 团购套餐检索 | 按人数/预算/就餐方式/忌口过滤套餐，按人均热量匹配度排序 | `solveGroupDeals()` | `groupList` |
| M7 | 门店检索与实时定位 | 按渠道过滤门店、按距离排序、定位授权与 20s 心跳 | `haversine()` `startStoreLive()` | `storeId` |
| M8 | 结果展示与替换 | 营养条形图、菜品行、贴士、换饮品/换小食、换一批 | `renderResult()` `nutriBar()` `swapOne()` | 可视化结果 |
| M9 | 订单确认与演示下单 | 汇总餐品、优惠券、应付金额、订单号 | `renderOrder()` `renderOrderSuccess()` | 订单卡 |
| M10 | 加载页与节奏控制 | 全屏加载层、进度条、像素 M、说明条、小游戏弹出时机 | `startMcLoading()` `load()` | 等待体验 |
| M11 | 小恐龙跑酷 | Canvas 游戏，跳跃/障碍/计分/撞击 | `startDino()` `stopDino()` | 等待期娱乐 |
| M12 | 音效引擎 | 9 种合成音效、手势解锁、限流、静音持久化 | `SFX` IIFE + `SOUNDS` | 交互反馈 |
| M13 | 图标系统 | 57 枚 24 栅格线性图标，`currentColor` 继承 | `ICONS` + `icon()` | 全站图标 |
| M14 | 视觉设计系统 | 设计令牌、阴影分级、玻璃拟态、动效曲线、响应式 440px | `:root` 变量 + 组件类 | 视觉一致性 |
| M15 | 反馈层 | Toast（1.9s 自动消失）、模态弹窗（带动作回调） | `toast()` `showModal()` `invalid()` | 用户提示 |

### 2.2 模块依赖关系（自上而下为"被依赖 → 依赖"）
```
M14 视觉令牌
  └─ M13 图标系统（必须最早初始化，见 3.4）
       ├─ M12 音效引擎（refresh 用到 icon）
       ├─ M1 品牌壳
       │    └─ M2 流程状态机
       │         ├─ M3 → M4 → M5 → M8 → M9
       │         │              └─ M7（门店影响可用套餐与配送文案）
       │         │              └─ M6（团购分支，替代 M5 的个人求解）
       │         └─ M10 加载层 ← M11 小游戏 / M12 音效
       └─ M15 反馈层（被 M3/M5/M7/M9 调用）
```
**关键耦合点**：
- M5 依赖 M3（`mealBudget`）与 M4（热量区间/蛋白下限）。
- M6 与 M5 互斥：`STATE.style === 'group'` 走 M6，否则走 M5。
- M2 的 `go()` 是唯一页面入口，任何模块都不得直接 `classList.add('active')`。
- M10 的加载时长必须与 M2 的目标页一致，且要经过 `navSeq` 令牌校验后才允许跳转。

---

## 三、技术架构、选型与依赖

### 3.1 架构形态
单文件三层，顺序固定：`<head>` 内 `<style>`（约 450 行）→ `<body>` 内 8 个 `<section class="page">` + 加载层 + 弹窗层 → 末尾单个 `<script>`（约 1500 行，非 module）。
- 视图层：`innerHTML` 字符串拼接，重渲染后重新绑定事件。
- 状态层：单一可变全局对象 `STATE`，无观察者、无 diff。
- 计算层：纯函数（入参 → 返回值），不读写 DOM，便于 Node 直接测试。

### 3.2 关键选型与理由
| 决策点 | 选择 | 理由 / 禁止项 |
|---|---|---|
| 框架 | 原生 JS（ES5 语法为主） | 零依赖、`file://` 可运行；禁止 React/Vue/构建链 |
| 样式 | 原生 CSS + CSS 变量 + 内联 `<style>` | 避免外链样式被墙/被 CSP 拦；禁止 Tailwind CDN |
| 图标 | 自绘 SVG 字典 | 替代 emoji 与图标字体；**禁止 emoji**（仅允许排版符号 ✓） |
| 动画 | CSS transition/keyframes + Canvas | 禁止引入动画库（原版曾用 CDN 动画库，已移除） |
| 音效 | Web Audio API 实时合成 | 零音频文件、包体不增；禁止 `<audio src>` |
| 数据 | 内存常量对象 | 禁止 fetch 外部 JSON |
| 持久化 | `localStorage`（仅音效开关一个键） | 必须 try/catch 包裹，失败静默 |
| 模块化 | 单文件 + 分区注释 | 便于「一文件分发」；不拆 ES module |

### 3.3 依赖清单
| 类型 | 依赖 | 版本要求 | 说明 |
|---|---|---|---|
| 运行时 | 无 | — | 仅需支持 ES5 + CSS 变量的浏览器 |
| 构建 | 无 | — | 无 npm、无打包 |
| 开发期测试 | Node.js | ≥ 18（实测 22.22.2） | 语法检查 + 纯逻辑冒烟 |
| 开发期测试 | jsdom | ≥ 22 | 集成测试，禁用 `runScripts:'dangerously'` 之外的捷径 |
| 开发期测试 | puppeteer-core | ≥ 21 + 本机 Chrome | 无头视觉走查与截图 |
| 可选服务端 | 麦当劳 MCP | Streamable HTTP，`https://mcp.mcd.cn` | 仅文档与配置示例，原型不调用 |

### 3.4 代码分区顺序（强约束，顺序错会整站崩）
```
1. :root 设计令牌 → 2. 组件 CSS → 3. 页面 HTML
4. $ / $$ 选择器简写
5. ICONS 字典 + icon()          ← 必须早于 6、7
6. SFX 音效引擎                  ← 内部调用 icon()
7. MENU 商品数据
8. MEAL_TYPES / MEAL_TYPE_ORDER  ← 定义时即调用 icon()，故必须在 5 之后
9. TASTES / AVOIDS / GROUP_DEALS / STORES / COUPONS / AVATARS
10. FOOD_ART 食物插画 + findItem/groupOf
11. 工具函数（fmt/sum/toast/invalid/showModal）
12. 营养计算 → 忌口口味 → 组合求解 → 团购求解
13. STEPS / NEXT_LABELS / STATE / resetState
14. 各页渲染函数
15. 路由 go() + navSeq
16. 加载层 startMcLoading/load + 小恐龙
17. 事件绑定（bindOptions / btnNext / 门店刷新 / 音效开关）
18. go(0) 启动
```
> **原因**：`var` 只提升声明不提升赋值，`MEAL_TYPES` 在定义时立即执行 `icon(...)`，若 `ICONS`/`icon()` 尚未赋值即会 `TypeError` 导致后续全部脚本不执行（页面一片白、按钮无响应）。

### 3.5 命名与作用域约定
- 一律使用 `var` + 函数声明，挂全局；不使用 `let/const`、箭头函数、模板字符串（保持 ES5 兼容与可直接被 `new Function` 沙箱执行）。
- DOM 简写固定为 `var $ = s => document.querySelector(s)` 的 ES5 形式：`function(s){ return document.querySelector(s); }`；`$$` 返回 `NodeList`（用 `.forEach`）。
- 公开可测函数（供测试直接调用）：`bmi bmiLabel bmr mealBudget recommendType itemAvoided tasteOk tasteBonus poolFor optionFrom scoreOption solvePerson groupAlternatives swapItem enforceBudget bestCoupon dealNutrition dealContainsAvoid solveGroupDeals`。
- 事件绑定统一写成 `el.onclick = fn`（覆盖式），避免重复绑定造成多次触发。

---

## 四、数据模型、字段含义与接口约定

### 4.1 商品表 `MENU`（必须原样，单位：kcal / g / mg / 元）
```js
var MENU = {
  mains: [
    {id:'bigmac',       name:'巨无霸',        kcal:530, protein:26, fat:28, carb:45, sodium:1050, price:23.5, tags:{beef:1,cheese:1}},
    {id:'spicy',        name:'麦辣鸡腿汉堡',  kcal:570, protein:27, fat:32, carb:48, sodium:1150, price:24,   tags:{chicken:1,spicy:1}},
    {id:'grilled',      name:'板烧鸡腿堡',    kcal:420, protein:24, fat:17, carb:44, sodium:920,  price:22,   tags:{chicken:1}},
    {id:'doublecheese', name:'双层吉士汉堡',  kcal:450, protein:25, fat:24, carb:40, sodium:1100, price:20,   tags:{beef:1,cheese:1}},
    {id:'fish',         name:'麦香鱼',        kcal:380, protein:19, fat:18, carb:42, sodium:780,  price:18,   tags:{fish:1}},
    {id:'mcrispy',      name:'麦麦脆汁鸡(大)', kcal:390, protein:29, fat:22, carb:18, sodium:980,  price:14,   tags:{chicken:1,fried:1}},
    {id:'mcmuffin',     name:'猪柳麦满分',    kcal:308, protein:16, fat:16, carb:24, sodium:781,  price:13,   tags:{pork:1,egg:1,cheese:1}},
    {id:'eggcheese',    name:'烟肉蛋麦满分',  kcal:290, protein:14, fat:13, carb:28, sodium:690,  price:12,   tags:{pork:1,egg:1,cheese:1}}
  ],
  sides: [
    {id:'fries-m', name:'中薯条',      kcal:340, protein:4,  fat:16, carb:44, sodium:290, price:11.5, tags:{fried:1}},
    {id:'fries-s', name:'小薯条',      kcal:230, protein:3,  fat:11, carb:30, sodium:200, price:8.5,  tags:{fried:1}},
    {id:'corn',    name:'玉米杯(小)',   kcal:90,  protein:3,  fat:1,  carb:19, sodium:15,  price:7,    tags:{light:1}},
    {id:'nuggets', name:'麦乐鸡(5块)',  kcal:250, protein:14, fat:15, carb:16, sodium:520, price:11,   tags:{chicken:1,fried:1}},
    {id:'apple',   name:'苹果片',      kcal:50,  protein:0,  fat:0,  carb:13, sodium:0,   price:6,    tags:{light:1,sweet:1}}
  ],
  drinks: [
    {id:'cola-m',    name:'中杯可口可乐', kcal:180, protein:0, fat:0, carb:45, sodium:15, price:9,  tags:{cola:1}},
    {id:'cola-zero', name:'中杯无糖可乐', kcal:0,   protein:0, fat:0, carb:0,  sodium:35, price:9,  tags:{cola:1}},
    {id:'sprite-m',  name:'中杯雪碧',     kcal:170, protein:0, fat:0, carb:44, sodium:14, price:9,  tags:{cola:1}},
    {id:'coffee',    name:'鲜煮咖啡',     kcal:0,   protein:1, fat:0, carb:0,  sodium:5,  price:8,  tags:{}},
    {id:'oj',        name:'美汁源橙汁',   kcal:160, protein:1, fat:0, carb:38, sodium:20, price:10, tags:{sweet:1}}
  ],
  desserts: [
    {id:'mcflurry', name:'麦旋风(奥利奥)', kcal:300, protein:7, fat:10, carb:45, sodium:180, price:12,  tags:{dairy:1,sweet:1}},
    {id:'pie',      name:'菠萝派',         kcal:250, protein:2, fat:12, carb:34, sodium:160, price:8.5, tags:{sweet:1,sour:1}},
    {id:'sundae',   name:'草莓新地',       kcal:220, protein:5, fat:6,  carb:36, sodium:85,  price:9,   tags:{dairy:1,sweet:1}}
  ],
  extra: [
    {id:'wings', name:'麦辣鸡翅(4块)', kcal:340, protein:22, fat:22, carb:16, sodium:880, price:16, tags:{chicken:1,spicy:1,fried:1}}
  ]
};
```
字段含义：`id` 全局唯一键，同时索引 `FOOD_ART` 插画；`kcal` 热量；`protein/fat/carb` 三大营养素（g）；`sodium` 钠（mg，排序核心）；`price` 单价（元，保留 1 位小数）；`tags` 布尔标记集合，取值必须落在 `{beef,pork,chicken,fish,egg,cheese,cola,fried,spicy,sweet,sour,dairy,light}` 内，用于忌口硬过滤与口味加分。

### 4.2 餐型表 `MEAL_TYPES`
| key | 名称 | 热量区间 kcal | 蛋白下限 g | 推荐规则 |
|---|---|---|---|---|
| `budget` | 节俭大学生干饭餐 | [400, 550] | 20 | 用户手动选 |
| `fitness` | 健身能量伙伴餐 | [550, 700] | 30 | BMI < 18.5 或 用户选 |
| `balanced` | 日常轻松均衡餐 | [450, 600] | 18 | 默认 / 16 岁以下 / BMI 18.5–24 |
| `light` | 轻食控卡体验餐 | [300, 420] | 12 | BMI ≥ 24 或 用户选 |
| `indulge` | 欢乐放纵畅享餐 | `null`（不限） | 0 | 用户选；**唯一会加入甜品的餐型** |

字段：`name` 显示名、`tag` 短标签、`icon` 图标 SVG、`kcal` 二元数组或 null、`proteinMin` 最小蛋白、`desc` 一句话说明。`MEAL_TYPE_ORDER` 固定为 `['budget','fitness','balanced','light','indulge']`。

### 4.3 口味与忌口
```js
var TASTES = [  // 6 项，多选；'none' 与其他项互斥（选了 none 则清空其他）
  {k:'spicy', n:'爱吃辣'}, {k:'nospicy', n:'不吃辣'}, {k:'soursweet', n:'偏爱酸甜'},
  {k:'light', n:'喜欢清淡'}, {k:'crispy', n:'爱吃酥脆口感'}, {k:'none', n:'没有特别偏好'}
];
var AVOIDS = [ // 9 项，硬过滤
  {k:'spicy',n:'辣味'}, {k:'beef',n:'牛肉'}, {k:'pork',n:'猪肉'},
  {k:'chicken',n:'鸡肉'}, {k:'fish',n:'鱼肉'}, {k:'egg',n:'鸡蛋'},
  {k:'cheese',n:'芝士/乳制品'}, {k:'cola',n:'碳酸饮料'}, {k:'fried',n:'油炸食品'}
];
```
- `nospicy` 是**硬约束**（`tasteOk` 直接排除 `tags.spicy`），不是加分项。
- 忌口是**硬过滤**（`itemAvoided`），命中即出局，任何放宽轮次都不解除。

### 4.4 团购套餐 `GROUP_DEALS`（演示数据）
```js
var GROUP_DEALS = [
  {id:'g1', name:'麦麦双人欢聚桶',   people:[2,2], price:69,  orig:89,  dining:['instore'],           items:[['bigmac',2],['fries-m',1],['wings',1],['cola-m',2]],        valid:'2026-12-31', note:'仅限到店核销，不支持麦乐送'},
  {id:'g2', name:'麦乐送双人分享餐', people:[2,2], price:59,  orig:78,  dining:['delivery'],          items:[['grilled',2],['fries-s',1],['nuggets',1],['cola-zero',2]],  valid:'2026-11-30', note:'仅支持麦乐送配送'},
  {id:'g3', name:'家庭分享桶',       people:[3,4], price:99,  orig:128, dining:['instore'],           items:[['spicy',1],['grilled',1],['fries-m',2],['nuggets',1],['wings',1],['cola-m',3]], valid:'2026-12-31', note:'仅限到店核销；含辣味单品'},
  {id:'g4', name:'家庭均衡分享桶',   people:[3,4], price:95,  orig:120, dining:['instore','delivery'],items:[['fish',2],['corn',2],['apple',1],['oj',3]],                valid:'2027-01-31', note:'到店/麦乐送均可'},
  {id:'g5', name:'多人畅享团聚桶',   people:[5,9], price:159, orig:198, dining:['instore','delivery'],items:[['bigmac',2],['grilled',2],['mcrispy',2],['fries-m',2],['nuggets',1],['cola-m',4]], valid:'2026-12-31', note:'到店/麦乐送均可'}
];
```
字段：`people` 人数闭区间；`dining` 可用渠道数组；`items` 为 `[商品id, 份数]` 二元组数组；`price/orig` 现价/原价；`valid` 有效期（仅展示，不参与过滤）；`note` 核销说明。
**必须在 UI 与文档标注**：团购为演示数据，真实团购来自美团/抖音等渠道，不在麦当劳 MCP 官方工具清单内。

### 4.5 门店 `STORES`（演示坐标）
```js
var STORES = [
  {id:'s1', name:'麦当劳(蓟州鼓楼店)',   addr:'蓟州区鼓楼广场东北侧',  dist:0.6, drive:true,  delivery:true,  lat:40.0462, lng:117.4085},
  {id:'s2', name:'麦当劳(蓟州中昌店)',   addr:'蓟州区中昌北路 168 号', dist:1.8, drive:true,  delivery:true,  lat:40.0415, lng:117.3962},
  {id:'s3', name:'麦当劳(蓟州人民路店)', addr:'蓟州区人民西路 22 号',  dist:2.5, drive:false, delivery:true,  lat:40.0521, lng:117.4011},
  {id:'s4', name:'麦当劳(蓟州府君山店)', addr:'蓟州区府君山广场南',    dist:4.2, drive:true,  delivery:false, lat:40.0558, lng:117.4233}
];
```
`dist` 为兜底演示距离（km）；有定位授权时用 `haversine` 实时计算覆盖；`drive` 得来速、`delivery` 麦乐送。

### 4.6 优惠券 `COUPONS`
```js
var COUPONS = [ {id:'c1',name:'满 30 减 6',min:30,off:6},
                {id:'c2',name:'满 50 减 10',min:50,off:10},
                {id:'c3',name:'满 80 减 18',min:80,off:18} ];
```
`bestCoupon(subtotal)`：取 `subtotal >= min` 中 `off` 最大者，无则返回 `null`（不可叠加）。

### 4.7 用户对象 `Person`
| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| `name` | string | 非空，默认 `['我','小伙伴A','小伙伴B','小伙伴C','小伙伴D'][i]` | 称呼 |
| `gender` | `'male' \| 'female'` | 默认 `'male'` | 影响 BMR 常数项 |
| `age` | number | 5–100 | 岁；滚轮选择器默认 `25` |
| `height` | number | 100–220 | cm；滚轮选择器默认 `170` |
| `weight` | number | 30–200 | kg；滚轮选择器默认 `65` |
| `skip` | boolean | 默认 false | 跳过身体数据时 true，此时 `mealBudget=700` |
| `mealType` | key \| null | 必须是 `MEAL_TYPES` 的键 | 初次进入餐型页时自动填 `recommendType(p)` |
| `tastes` | string[] | 至少 1 项，空则补 `['none']` | 口味偏好 |

### 4.8 全局状态 `STATE`
```js
var STATE = {
  step:0,            // 当前步骤索引 0–7
  peopleCount:1,     // 1–5
  infoMode:null,     // 'manual' | 'skip' | null
  persons:[],        // Person[]
  style:null,        // 'custom' | 'group'
  budget:0,          // 全员合计预算（元），>=10 才可继续
  avoids:[],         // 忌口 key 数组
  dining:null,       // 'instore' | 'delivery'
  storeId:null,      // 门店 id
  results:[],        // Result[]
  groupList:[],      // 团购候选
  groupPick:0,       // 当前选中团购索引
  groupDeal:null,    // 当前选中团购
  orderId:null,      // 演示订单号
  teenWarned:false,  // 青少年轻食提示是否已弹过一次
  swapCount:0,       // 换单品次数
  unifiedTastes:[],  // 团购模式下的统一口味
  activePerson:0,    // 餐型页当前编辑的成员
  userPos:null       // {lat,lng} | null
};
```
`resetState()` 必须逐字段复位（不可用 `STATE = {}` 重建，避免闭包持有旧引用），并调用 `stopStoreLive()`。

### 4.9 组合对象 `Option` 与结果对象 `Result`
```js
// Option：由 optionFrom(items) 生成
{ items:[item,...], kcal:Number, protein:Number, fat:Number, carb:Number, sodium:Number, price:Number, score:Number }
// Result：每人一条
{ person:Person, budget:Number, options:Option[],  // 最多 6 条
  relaxed:Boolean,                                 // 是否降级放宽过
  pick:Number,                                     // 当前选中索引
  current:Option|null }                            // 当前展示组合
```
**不变量**：`Option` 的六项营养与价格必须恒等于 `items` 对应字段之和；任何替换后必须调用 `refreshOption()` 或重建 `optionFrom()` 重算，禁止只改 `items`。

### 4.10 内部函数接口契约
| 函数 | 签名 | 入参约束 | 返回 | 备注 |
|---|---|---|---|---|
| `bmi` | `(p:Person) => Number` | 身高体重为数字 | BMI 值 | `w / (h/100)^2` |
| `bmiLabel` | `(b:Number) => {t,c}` | — | 文案与颜色类 | <18.5 偏瘦 / <24 正常 / <28 超重 / ≥28 肥胖 |
| `bmr` | `(p:Person) => Number` | — | 基础代谢 kcal | `10w + 6.25h − 5age + (female ? −161 : +5)` |
| `mealBudget` | `(p:Person) => Number` | `skip` 或空则返回 700 | 一餐热量预算 | `clamp(round(bmr*1.375*0.35/50)*50, 450, 1100)` |
| `recommendType` | `(p) => mealTypeKey` | — | 推荐餐型 | skip→balanced；age<16→balanced；BMI<18.5→fitness；<24→balanced；否则 light |
| `itemAvoided` | `(item) => Boolean` | 读 `STATE.avoids` | 是否命中忌口 | 硬过滤 |
| `tasteOk` | `(item, tastes[]) => Boolean` | — | 是否可入池 | 仅处理 `nospicy` 排除辣 |
| `tasteBonus` | `(item, tastes[]) => Number` | — | 加分值 | spicy/soursweet/light/crispy 各 +1，light 遇 fried −1 |
| `poolFor` | `(poolName, p) => Item[]` | `poolName ∈ MENU 键` | 过滤后候选池 | 忌口 + tasteOk |
| `optionFrom` | `(items[]) => Option` | 非空 | 汇总对象 | 六项求和 |
| `scoreOption` | `(o, type) => Number` | — | 越小越优 | 见 4.11 |
| `solvePerson` | `(p) => {budget, options[:6], relaxed}` | — | 单个人推荐 | 5 轮降级 |
| `groupAlternatives` | `(p, groupName) => Item[]` | `groupName ∈ {drinks,sides}` | 排序后候选 | 按餐型排序策略 |
| `swapItem` | `(r:Result, groupName, dir:±1) => Boolean` | `r.person/r.current` 必须存在 | 是否换成功 | 不越热量区间、不降蛋白 |
| `enforceBudget` | `(results[], budget) => Boolean` | — | 是否压到预算内 | 最多 60 轮 |
| `bestCoupon` | `(subtotal) => Coupon\|null` | — | 最优券 | 不叠加 |
| `solveGroupDeals` | `() => Deal[]` | 读 STATE | 过滤+排序后的套餐 | 见 4.11 |
| `go` | `(idx:0–7) => void` | 越界不调用 | 无 | 唯一路由入口，内部 `navSeq++` |
| `startMcLoading` | `(task,msg,sub,threshold,why,estMs) => Promise` | `task` 返回 Promise | 任务结果 | 见 4.12 |
| `load` | `(ms,msg,sub,why,gameDelay) => Promise` | — | 延时结果 | `startMcLoading` 的封装 |
| `Wheel.init` | `(root:Element) => void` | 扫描 `root` 内 `.wheel`，已绑定（`_wheelBound`）的跳过 | 无 | 在 `renderInfoDynamic()` 里 `box.innerHTML` 之后、`p-num` oninput 绑定之后调用 |
| `wheelField` | `(i:Number, k:'age'\|'height'\|'weight') => String` | `STATE.persons[i]` 存在 | 滚轮 HTML 片段 | 范围写死 `WHEEL_RANGE`，与 `validatePersons` 完全一致 |

**滚轮选择器 `Wheel` 实现契约（年龄/身高/体重）**

| 项 | 约定 |
|---|---|
| 常量 | `ITEM_H = 40`（每格高度，`.wheel` 高度 = 3×40 = 120px，选中项固定居中）、`BUF = 3`（上下各多渲染 3 项）、吸附动画 `transform .3s cubic-bezier(.22,1,.36,1)` |
| 交互 | ① `pointerdown/move/up` 拖拽（`setPointerCapture`）。`pointerdown` 记录 `idx0 = el._idx`、`el._vis = el._idx`；`pointermove` 计算 `raw = idx0 - (cy - sy)/ITEM_H`，**索引实时跟随手指**（`ni = clamp(round(vis))`，`vis` 为 `raw` 的 0.32 橡皮筋值），同时用亚像素偏移 `el._drag = (ni - vis)*ITEM_H` 做平滑跟随；`ni === el._idx` 时**不重建 DOM**（跨过整数格才重建）；越界 0.32 系数橡皮筋。`up`：`before = el._idx; proj = (el._vis||el._idx) - vel*130/ITEM_H; setIdx(round(proj), true, false, before)`——**惯性方向必须取负号**（`raw` 是 `cy - sy` 的负向，`vel` 是 clientY 方向速度）。② `wheel` 事件 ±1 格，**滚到边界时 return 且不 `preventDefault`**（放行页面滚动），70ms 限流；③ 点击 `.wheel-item` 直接选中（拖拽过的 `moved` 标记屏蔽误触）；④ 键盘 ↑↓/←→ ±1、PageUp/PageDown ±5、Home/End 到头 |
| 渲染 | **窗口化 + 缓存**：`renderWindow(el, s, e)` 只输出 `[idx-BUF, idx+BUF]` 共 ≤7 个 `.wheel-item`（绝对定位 `top = i*ITEM_H`），并以 `el._ws/_we/_widx/_wlen` 缓存，仅在范围/高亮/长度变化时才碰 DOM；`.wheel-list` 用 `translateY(ITEM_H - idx*ITEM_H + drag)` 定位（`applyTransform`）；170+ 选项也只有 7 个节点。`setIdx(el, idx, anim, quiet, fromIdx)` 带动画时**渲染 `fromIdx→idx` 整段**（动画期间不出现空白中心带），380ms 后再收窄回 ±BUF。拖动全程每帧 DOM 重建次数为 0~数次（只有跨整数格时） |
| 松手提交 | `up()` 里 `setIdx(round(proj), ...)` 后必须补 `if (el._idx === before) commit(el, false);`——否则当投影后索引与拖拽末索引相同时 `setIdx` 判定 `changed=false` 不提交，**拖拽结束的值不会落入 `STATE`**（历史 bug：年龄/身高/体重拖完不变） |
| 数据流 | 选中后 `commit()` 写隐藏 `input.p-num.value` 并 `dispatchEvent(new Event('input',{bubbles:true}))`，由既有 `.p-num oninput` 处理器落入 `STATE.persons[i][k]` 并触发 `updateBmiBadge(i)`——**不新增数据通路，`Person` 结构不变** |
| 语义 | `.wheel` 带 `tabindex="0"` + `role="spinbutton"` + `aria-valuenow`/`aria-valuetext` |
| 默认值 | `WHEEL_DEF = {age:25, height:170, weight:65}`（滚轮必须有当前值；空值/非数字在 `renderInfoDynamic` 里统一回落） |
| 降级 | `prefers-reduced-motion: reduce` 时关掉吸附过渡（交互仍可用）；换项音效走 `SFX.play('tap')`（自带 45ms 限流与静音开关） |
| 样式 | `.wheel`（`touch-action:none` + `overflow:hidden` + `user-select:none`，**液态玻璃**：`background:rgba(255,255,255,.42)` + `backdrop-filter:blur(14px) saturate(160%)` + `border:1px solid var(--glass-stroke)`）、`.wheel-band`（居中白底选中带）、`.wheel-fade`（上下渐隐）、`.wheel-item.on`（红色加粗放大） |

### 4.11 算法契约（必须按此实现，否则推荐结果会漂移）
**① 打分（越小越优，`sodiumTerm = sodium * 0.004` 保证同分优先低钠）**
```
budget   : price + sodiumTerm
fitness  : -protein + sodiumTerm
balanced : |kcal - 525| - protein*0.2 + sodiumTerm
light    : |kcal - 360| + (含 fried ? 12 : 0) + sodiumTerm
indulge  : -( kcal*0.06 - price*0.4 + (items.length>=4 ? 60 : 0) ) + sodiumTerm*0.5
最终分数 = scoreOption(o, type) - tasteFit(o, p) * 0.6     // tasteFit 为全组合 tasteBonus 之和
```
**② 单个人求解 5 轮降级**（任一轮有候选即停止，返回 `relaxed = 轮次>0`）
| 轮 | 热量区间 | 蛋白下限 | 口味池 |
|---|---|---|---|
| 1 | 餐型原区间 | `proteinMin` | 过滤 |
| 2 | 餐型原区间 | 0 | 过滤 |
| 3 | `[lo*0.85, hi*1.15]` | 0 | 过滤 |
| 4 | `[lo*0.7, hi*1.3]` | 0 | 不过滤（仅忌口） |
| 5 | 不限 | 0 | 不过滤 |
- 枚举维度：主餐 × 小食 × 饮品（× 甜品，仅 `indulge`）。
- 区间过滤后再做蛋白下限过滤，最后打分排序取前 6。
- 5 轮全空则返回 `options: []`，由 UI 提示"已推荐相近选项/请放宽条件"。

**③ 换单品 `swapItem`**
- 定位：`drinks` 对应 `items[2]`，`sides` 对应 `items[1]`。
- 轮转查找下一个候选，跳过会导致热量越出 `[lo*0.7, hi*1.3]` 的；若原蛋白未达 `proteinMin` 且新组合蛋白更低则跳过。
- **入参必须是结果对象 `r`（含 `person` 与 `current`）**，不是 `person`——这是历史 bug 点。

**④ 预算压降 `enforceBudget`**
- 目标：`Σ result.current.price <= budget`。
- 每轮按当前价从高到低遍历，把该人换成其 `options` 里最便宜的一项；成功即跳出本轮；无改进则终止；最多 60 轮。
- 返回 `false` 时 UI 必须弹窗说明「已挑高性价比单品，但仍可能超支」，并提供「返回调整预算」动作（跳 `go(4)`）。

**⑤ 团购求解 `solveGroupDeals`**
- 过滤：人数落在 `people` 区间 → `price <= STATE.budget` → `dining` 含 `STATE.dining` → 不含忌口商品。
- 派生：`_nutri`（整份营养）、`_perPerson = round(kcal / peopleCount)`、`_match = |_perPerson - avgBudget|`，`avgBudget` 为各人 `mealBudget` 均值（无结果时 700）。
- 排序：`_match` 升序，再 `price` 升序。

### 4.12 加载层接口契约
```
startMcLoading(task, msg, sub, threshold, why, estMs) -> Promise<task() 结果>
  task      : () => Promise<any>        // 真实任务；原型用 mockApi(ms)
  msg       : string                    // 主标题（loading 文案）
  sub       : string                    // 副标题
  threshold : number                    // 小游戏弹出延迟(ms)，默认 1500
  why       : string(HTML)              // 「为什么」说明条，允许 <b>
  estMs     : number                    // 任务预计总时长，仅用于进度条速度
```
- **进度条**：`barMs = max(600, (estMs || threshold) * 0.92)`；先过渡到 92%，任务完成时置 100%，并保证至少 480ms 的收尾可见时间。**禁止把 `threshold` 算进进度条**（会放大十倍以上）。
- **小游戏**：`setTimeout(threshold)` 后若加载层仍在显示，则展示游戏；任务完成时 `clearTimeout`。
- `NO_GAME_DELAY = 99999`：大于任何加载时长，等效「本页不弹游戏」。

**加载节奏表（必须原样）**
| 来源步骤 | 时长 | 目标页 | 小游戏 |
|---|---|---|---|
| welcome | 3000ms | info | 否 |
| info | 3000ms | style | 否 |
| style | 3000ms | mealtype | 否 |
| mealtype | 3000ms | budget | 否 |
| budget | 10000ms（gameDelay 1800） | store | **是** |
| store | 3000ms | result | 否 |
| result | 3000ms | order | 否 |
| order | 2000ms | 成功态 | 否 |

### 4.13 DOM 契约（id 必须存在，脚本按此取值）
| 区域 | 必需 id |
|---|---|
| 页面容器 | `page-welcome` `page-info` `page-style` `page-mealtype` `page-budget` `page-store` `page-result` `page-order` |
| 顶栏/底栏 | `stepChip` `soundToggle` `progressBar` `btnBack` `btnNext` |
| 加载层 | `loader` `loaderMsg` `loaderSub` `loaderWhy` `loaderBar` `loaderPct` `loaderGame` `dinoCanvas` `dinoScore` |
| 反馈层 | `toastWrap` `modalWrap` |
| 身体信息 | `infoDynamic` `infoModeCard` `bmiBadge{0..4}` `skipBodyLink`（可选） |
| 身体信息·滚轮 | `#infoDynamic .wheel[data-i][data-k]`（`data-k` = `age`/`height`/`weight`，`data-min`/`data-max`/`data-step`/`data-val`/`data-unit`）+ 子节点 `.wheel-band` `.wheel-list` `.wheel-item[data-v]`（仅当前 ±3 项）+ 隐藏 `input.p-num[data-i][data-k]` |
| 预算页 | `budgetInput` `budgetPeopleNote` `avoidChips` `diningChips` `groupDiningTip` |
| 门店页 | `storeList` `storeSub` `storeStatus` `storeRefreshBtn` |
| 结果页 | 由 `renderResult()` 动态生成，交互元素用 `data-i` / `data-id` 标记 |

### 4.14 外部 MCP 接口约定（文档层，原型不调用）
| 工具 | 输入要点 | 输出要点 | 约束 |
|---|---|---|---|
| `now-time-info` | 无 | 当前时间/餐段 | 用于判断可售菜单 |
| `query-nearby-stores` | 经纬度、半径、渠道 | 门店 id/名称/地址/坐标/能力 | 自提/得来速选店 |
| `delivery-query-addresses` | 用户标识 | 地址列表 | 麦乐送前置 |
| `delivery-query-stores` | 地址/坐标 | 可配送门店 | 麦乐送选店 |
| `query-meals` | 门店 id、餐段 | 分类、编码、价格 | 菜单底座 |
| `query-meal-detail` | 商品编码 | 详情、可替换项 | 去酱/换无糖等 |
| `list-nutrition-foods` | 商品编码集合 | 热量/蛋白/脂肪/碳水/钠/钙 | **营养数据唯一来源**，前端不得硬编码冒充 |
| `query-store-coupons` / `query-my-coupons` | 门店 id / 用户 | 券列表、门槛、面额 | 券不可叠加 |
| `available-coupons` + `auto-bind-coupons` | 门店/用户 | 可领券、领取结果 | **必须用户确认后才领取** |
| `calculate-price` | 商品行、券 | 原价/优惠/应付 | 下单前核价 |
| `create-order` | 商品行、门店、渠道、联系方式 | 订单号、支付链接 | **仅用户明确确认后调用** |
| `campaign-calendar` | 时间范围 | 活动列表 | 团购活动参考 |
- 鉴权：`Authorization: Bearer ${MCD_MCP_TOKEN}`，Streamable HTTP，限流 600 次/分钟（429 为超限，401 为 Token 无效）。
- **前端零 Token**：Token 只允许存在于服务端环境变量；仓库内仅提供 `mcp-config.example.json` 占位符。

### 4.15 本地存储约定
| 键 | 类型 | 含义 | 失败策略 |
|---|---|---|---|
| `mcd_sound_muted` | `'0' \| '1'` | 音效静音状态 | 读写均 try/catch 静默，默认不静音 |

---

## 五、用户角色与交互流程

### 5.1 角色
| 角色 | 特征 | 主要诉求 | 系统对应 |
|---|---|---|---|
| 单人用餐者 | 1 人，愿意填身体数据 | 想要"适合我"的一餐 | 直接进手动表单，隐藏录入方式选择 |
| 单人懒用户 | 1 人，不愿填数据 | 快速出结果 | 「不想填写身体数据？直接选餐型」→ `infoMode='skip'`，预算固定 700 |
| 多人拼单组织者 | 2–5 人 | 一单满足不同目标 | 每人独立 `Person` + 独立推荐，再合并总价 |
| 团购偏好者 | 任意人数 | 直接买现成套餐 | `style='group'`，走 `solveGroupDeals` |
| 预算敏感者 | 任意 | 不超支、要券 | 预算滑杆 + `enforceBudget` + `bestCoupon` |

### 5.2 主流程（8 步，`STEPS` 顺序不可调换）
| # | key | 页面 | 用户输入 | 进入下一步的校验 | 按钮文案 |
|---|---|---|---|---|---|
| 1 | `welcome` | 开始 | 人数 1/2/3/4/5+ | 已选人数 | 开始点餐 |
| 2 | `info` | 身体信息 | 录入方式（多人时）、称呼、性别、年龄、身高、体重 | 手动模式逐人校验 5 项 | 下一步 |
| 3 | `style` | 点餐模式 | 随心搭配 / 团购套餐 | 已选模式 | 下一步 |
| 4 | `mealtype` | 餐型选择 | 逐人切换并选 5 类餐型之一 | 每人 `mealType` 非空 | 下一步 |
| 5 | `budget` | 预算·取餐方式·忌口及口味 | 合计预算、到店/麦乐送、忌口多选、口味 | `budget>=10` 且 `dining` 已选 且 每人 `tastes` 非空（团购看 `unifiedTastes`） | 下一步 |
| 6 | `store` | 选择门店 | 门店卡片单选 | `storeId` 非空（默认第一家） | 下一步 |
| 7 | `result` | 营养推荐 | 换饮品/换小食/换一批、切换成员 | 无（可空结果） | 确认下单 |
| 8 | `order` | 确认下单 | 核对餐品与金额 | 无 | 提交订单 |

### 5.3 三条分支
```
① 单人：welcome(1 人) → info 直接显示表单（隐藏方式选择） → 其余一致
② 多人：welcome(2–5) → info 先选「手动逐个录入 / 跳过身体数据」 → 逐人表单 → 其余一致
③ 团购：style=group → mealtype 页选统一口味 → budget 页隐藏个人口味、显示团购提示
        → store → result 展示套餐卡（无个人组合） → order 汇总套餐
```
- 从团购切回随心搭配必须有显式入口（结果页「切回随心搭配模式」按钮 + `data-val` 重置）。
- 团购模式下 `persons[].tastes` 全部清空，只保留 `STATE.unifiedTastes`。

### 5.4 回退与改道规则
- `btnBack` 仅在 `step>0` 可见，点击 `go(step-1)`。
- 加载期间点「上一步」：`go()` 内 `navSeq++`，待定的 `if (navSeq !== myNav) return;` 使旧跳转作废，用户停留在他选的那一页。
- 离开 `store` 页时 `stopStoreLive()`（清 `watchPosition` 与 20s 定时器）。
- 修改上游输入后必须重算：预算/口味/餐型变动后再进结果页会重新 `computeResults()`。

### 5.5 关键交互细节
- 单选组：先清所有 `.sel/.on`，再给当前项加；同时写 `STATE` 对应字段并解禁 `btnNext`。
- 数字输入：`oninput` 内 `value.replace(/[^\d.]/g,'')`，避免负数/字母/科学计数法。
- BMI 徽标：身高 100–220、体重 30–200 之外一律显示 `BMI --`。
- 口味 `none` 与其他互斥：选 `none` 清空其他；选其他移除 `none`。
- Toast 文案必须可执行（"请填写第 2 位年龄需在 5-100 之间"），禁止只说"输入有误"。
- 结果页「换一批」按 `options` 顺序轮转 `pick`，不走网络。

---

## 六、配置项与环境要求

### 6.1 运行环境
| 项 | 要求 |
|---|---|
| 浏览器 | iOS Safari 14+ / Android Chrome 90+ / 微信内置浏览器（X5/XWEB）/ 桌面 Chrome、Safari、Edge |
| 打开方式 | `file://` 双击 或 任意静态服务器；不需要 Node 运行时 |
| 视口 | 移动优先，`.app` 最大宽 440px，居中；`maximum-scale=1,user-scalable=no` |
| 网络 | 可完全离线；不发起任何请求 |
| 字体 | 系统字体栈：`-apple-system, BlinkMacSystemFont, "PingFang SC", "Source Han Sans CN", "Microsoft YaHei", Arial, sans-serif` |

### 6.2 可调配置常量（集中在脚本顶部，改这里即可）
| 常量/位置 | 默认值 | 作用 |
|---|---|---|
| `NO_GAME_DELAY` | `99999` | 加载页"不弹小游戏"的哨兵值 |
| `THROTTLE_MS`（SFX 内） | `45` | 同名音效最小间隔，防叠音 |
| `barMs` 系数 | `0.92` | 进度条从 0→92% 的时长占预计总时长比例 |
| 收尾最短时间 | `480ms` | 进度条到 100% 后的可见时长 |
| 加载时长 | 3000 / 10000 / 2000 | 见 4.12 节奏表 |
| 长加载游戏延迟 | `1800ms` | 预算→门店页游戏弹出时机 |
| 预算下限 | `10` 元 | `budgetInput` 校验 |
| 人数范围 | `1–5` | welcome 页选项 |
| 体征范围 | age 5–100 / h 100–220 / w 30–200 | `validatePersons` |
| 结果条数 | `6` | `solvePerson` 返回上限 |
| 预算压降上限 | `60` 轮 | `enforceBudget` 防死循环 |
| 团购人数上限 | `9` | `g5.people[1]` |
| 定位心跳 | `20000ms` | `startStoreLive` |
| 门店定位超时 | `8000/10000ms` | 刷新按钮/监听 |
| 小恐龙参数 | W260 H84 G62 S2.4，重力 `0.46`，起跳 `-7.4`，障碍间隔 `max(48, 85-floor(score/40))` 帧，速度 `2.1+score*0.0006` | 手感参数 |
| 音效参数 | 见 6.3 | 频率/时长/波形 |

### 6.3 音效参数表（9 种，全部合成，无音频文件）
| 名 | 频率(Hz) | 时长(s) | 波形 | 音量 | 触发点 |
|---|---|---|---|---|---|
| `tap` | 660→440 | 0.07 | triangle | 0.45 | 普通按钮兜底 |
| `select` | 520→760 | 0.06 | 默认(sine) | 0.50 | 选项选中、音效开关 |
| `next` | 587.33 → 783.99（两段） | 0.07+0.10 | triangle | 0.50 | 下一步成功 |
| `back` | 493.88→329.63 | 0.09 | triangle | 0.45 | 上一步 |
| `coin` | 1567.98 → 2093 | 0.05+0.08 | 默认 | 0.32 | 复制成功 |
| `success` | 659.25 → 987.77 | 0.12+0.24 | 默认 | 0.50 | 下单成功 |
| `error` | 196→146.83 | 0.12 | square | 0.22 | 校验失败 |
| `jump` | 330→720 | 0.09 | triangle | 0.40 | 小恐龙起跳 |
| `hit` | 174→82 | 0.16 | square | 0.30 | 小恐龙撞击 |

### 6.4 部署前提
1. 单文件即可分发，无需构建；建议同时提供 `python3 -m http.server` 本地预览。
2. 微信分享需公网可访问地址（`file://` 链接在他人设备上无效）；如需内网穿透，用 `ssh -R` 类工具并注意链接稳定性。
3. 若要接真实 MCP：Token 必须由服务端持有，前端只与自建后端通信；`mcp-config.example.json` 只放 `MCD_MCP_TOKEN` 占位符。
4. 参赛/商用前确认品牌使用授权与免责声明（`CONTEST_DECLARATION.md`）。

---

## 七、错误处理策略与边界情况

### 7.1 原则
1. **计算层永不抛异常**：所有求解函数对空池、零候选返回 `{options: []}` 而非抛错。
2. **UI 层给可执行提示**：错误必须说明"哪一项、什么范围、怎么改"。
3. **能力缺失可降级**：无定位 → 演示距离；无 AudioContext → 静默；无 localStorage → 不持久化；无 `requestAnimationFrame` → 不影响主流程。
4. **不阻塞主流程**：非关键能力失败不得让按钮卡死；`btnNext` 必须在 `finally` 中恢复可用。
5. **不谎报**：降级后必须改变文案（如"未获得定位授权，展示演示距离"）。

### 7.2 边界情况处理表
| # | 场景 | 触发条件 | 处理方式 | 用户可见结果 |
|---|---|---|---|---|
| E1 | 称呼为空 | `!p.name` | `invalid('请填写第N位的称呼')` + error 音 | Toast，停留原页 |
| E2 | 年龄越界 | `!(age>=5 && age<=100)` | 同上，按人定位 | "第N位年龄需在 5-100 之间" |
| E3 | 身高越界 | 不在 100–220 | 同上 | "第N位身高需在 100-220cm 之间" |
| E4 | 体重越界 | 不在 30–200 | 同上 | "第N位体重需在 30-200kg 之间" |
| E5 | 预算过低 | `<10` | `btnNext.disabled = true` | 按钮置灰，不弹错 |
| E6 | 未选就餐方式 | `!STATE.dining` | 同上 | 按钮置灰 |
| E7 | 未选口味 | 有人 `tastes` 为空 | 同上 | 按钮置灰 |
| E8 | 总价超预算 | `enforceBudget` 返回 false | 模态框：已挑高性价比单品但仍可能超支；提供"返回调整预算与口味"→`go(4)` | 可继续也可改 |
| E9 | 组合全空 | 5 轮降级后无候选 | 模态框提示"已为你推荐相近选项"（实际为空则结果页 `showExhausted()`） | 可换一批/放宽 |
| E10 | 团购无匹配 | 过滤后 `groupList.length===0` | 结果页提示 + "切回随心搭配模式"按钮 | 可自选模式 |
| E11 | 忌口全选 | 9 项全选 | 候选池为空 → 走 E9；不得崩溃 | 友好提示 |
| E12 | 定位被拒 | `getCurrentPosition` 失败 | 保持 `STORES.dist` 演示距离，文案改"未获得定位授权" | 列表仍可用 |
| E13 | 定位超时 | 8–10s 无响应 | 同上，并按演示距离刷新 | Toast 提示 |
| E14 | 无定位 API | `!navigator.geolocation` | 跳过监听，直出演示距离 | 正常选店 |
| E15 | 定位跨页残留 | 离开门店页 | `stopStoreLive()` 清 watch + interval | 无后台耗电 |
| E16 | AudioContext 缺失 | jsdom/旧浏览器 | `ctxGet()` 返回 null，`play()` 直接返回 | 静音但不报错 |
| E17 | 首个音效无声 | iOS/微信策略 | 首次 `pointerdown/touchstart/keydown` 执行 `resume()` + 播 1 采样静音缓冲 | 后续手势有声 |
| E18 | 音效叠音 | 快速连点 | 同名 45ms 限流 | 听感干净 |
| E19 | 系统减少动效 | `prefers-reduced-motion: reduce` | `isMuted()` 恒 true，按钮显示关闭态 | 自动静音（可手动开） |
| E20 | localStorage 不可用 | `file://` 或隐私模式 | 读写 try/catch 静默 | 开关仅本次有效 |
| E21 | 加载期间改道 | 点"上一步"/重开 | `navSeq` 令牌失效旧跳转 | 不会被拽走 |
| E22 | 按钮重复点击 | 连点下一步 | 点击即 `disabled=true`，`finally` 恢复 | 不会重复建单 |
| E23 | 订单页完成态 | 已生成 `orderId` | 保持按钮禁用，不重复提交 | 只能重开 |
| E24 | 人数选项异常 | 传入非数字（如 `"5+"`） | `peopleCount = clamp(parseInt(v,10) \|\| 1, 1, 5)`；**不要写 `+v`** | 5+ 按 5 人处理 |
| E25 | jsdom 无 `localStorage` | 测试环境 `file://` | 统一 try/catch；测试改用 `http://localhost` | 测试不红 |
| E26 | 小游戏无输入 | 用户不点 | 自动奔跑计分，撞击后分数归零继续 | 不影响加载完成 |
| E27 | 滚轮值缺失/非数字 | 旧数据 `age:''`、脚本误写 | `renderInfoDynamic` 统一回落到 `WHEEL_DEF`；`data-val` 匹配不到时取中间项 | 滚轮永远有选中项 |
| E28 | 滚轮拖到边界 | 上/下滑过头 | 0.32 系数橡皮筋 + `setIdx` 内 `clamp(0, len-1)` | 不会露出空白、不会死循环 |
| E29 | 滚轮上滚鼠标滚轮 | 已在边界 | 直接 `return` 且不 `preventDefault` | 页面继续正常滚动 |

### 7.3 绝不允许的写法
- `window.open` / `location.href = ...` / `about:blank`：会触发宿主环境异常弹窗，且破坏单页体验。
- 直接用 `innerHTML` 塞含 SVG 的用户输入（必须 `textContent` 或转义）。
- 在 `setInterval` 中重渲染整页却不清理旧定时器。
- 用 `STATE = {...}` 重新赋值（会丢失外部闭包引用）。

---

## 八、测试与验证方法

### 8.1 三层测试金字塔
```
第 3 层  视觉走查   puppeteer-core + 本机 Chrome，逐步截图人工核对（12 张）
第 2 层  集成测试   jsdom 装载整页，模拟点击走完 8 步，断言 DOM 与 STATE（71 条）
第 1 层  逻辑冒烟   Node 直接执行脚本片段，纯函数断言（61 条）
第 0 层  静态检查   node --check 语法 + emoji/外链审计
```

### 8.2 静态检查（每次改完必跑）
```bash
# 1) 抽出 <script> 内容做语法检查
sed -n '/<script>/,/<\/script>/p' index.html | sed '1d;$d' > /tmp/app.js
node --check /tmp/app.js
# 2) 零 emoji 审计（仅允许 ✓ 等排版符号）
grep -nP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' index.html
# 3) 零外链审计（不应有 http(s):// 资源引用）
grep -nE '(src|href)="https?://' index.html
```

### 8.3 逻辑冒烟测试（61 条，Node 直跑）
**做法**：把 `index.html` 内脚本读成字符串，用 `new Function` 注入最小 DOM 桩（`document.querySelector` 返回假对象、`localStorage` 用内存对象、`requestAnimationFrame` 空实现），拿到函数引用后断言。
**断言分组**：
| 组 | 条数 | 代表断言 |
|---|---|---|
| BMI / BMR / 预算 | 12 | 70kg/175cm/25岁男 → BMI≈22.9、BMR≈1674、预算落在 450–1100 且为 50 的整数倍 |
| 餐型推荐 | 5 | 16 岁以下必须 `balanced`；BMI 17 → `fitness`；BMI 26 → `light` |
| 忌口硬过滤 | 9 | 勾"牛肉"后 `bigmac`/`doublecheese` 必不进池；勾"油炸"后 `fries-m`/`nuggets` 必不进池 |
| 口味硬约束 | 4 | `nospicy` 下 `spicy`/`wings` 不出现在任何结果 |
| 组合求解 | 10 | `indulge` 结果含 4 件；`fitness` 蛋白 ≥30；所有结果营养 = 单品求和 |
| 预算压降 | 6 | 预算 40 时 3 人总价必 ≤40 或返回 false 并触发提示 |
| 优惠券 | 4 | 55 元 → 满 50 减 10；29 元 → null；85 元 → 减 18 |
| 团购 | 8 | 2 人到店 → g1 可选、g2 不可选；含辣忌口时 g3 被排除；人数 5 → g5 可用 |
| 门店距离 | 3 | 同点距离为 0；北京↔天津约 110–140km |
**通过标准**：61/61 全绿，任何红即阻断交付。

### 8.4 集成测试（jsdom，71 条）
**做法**：`new JSDOM(html, {runScripts:'dangerously', url:'http://localhost/'})` 装载整页，通过 `dom.window.document` 取元素，`el.click()` 驱动，断言 `classList.contains('active')`、`textContent`、`window.STATE`。
**关键技巧**：
- 等待必须用**轮询判定**而非固定 `sleep`：`await waitPage(key)`，条件为 `#page-${key}.classList.contains('active') && !#loader.classList.contains('show')`。
- `url` 必须给 `http://localhost/`，否则 `file://` 下 `localStorage` 访问抛 `SecurityError`。
- 每次重渲染后旧 DOM 引用失效，需重新 `querySelector`。
**场景**：
| 场景 | 覆盖 |
|---|---|
| ① 单人全流程 | 1 人 → 手填 → 均衡餐 → 预算 → 门店 → 结果 → 下单成功，逐步断言文案与状态 |
| ② 多人全流程 | 3 人各自餐型 → 结果页 3 张成员卡 → 切换成员 |
| ③ 极端输入 | 忌口全选、预算 10、结果页不崩且有降级提示 |
| ④ 加载改道 | 长加载中点上一步，最终停留原页（导航防护） |
| ⑤ 全流程零报错 | 挂 `window.onerror` 与 `console.error` 计数，走完 8 步必须为 0 |
| ⑥ 结构回归 | 8 个 page 均存在、每步 `btnNext` 文案正确、关键 id 齐全 |
**通过标准**：71/71 全绿 + 零 console 错误。

### 8.5 导航防护专项
单独脚本验证：`go()` 递增 `navSeq`；点击 `btnNext` 记录 `myNav`；加载中途 `go(step-1)`；断言最终 `STATE.step` 为用户改道后的值，且页面 `.active` 与之一致。

### 8.6 视觉走查（puppeteer-core + 本机 Chrome）
```js
const b = await puppeteer.launch({ executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless:'new' });
await page.setViewport({ width:390, height:844, deviceScaleFactor:2 });
```
- 每步：等 `#loader` 消失 → 点击选项 → 等页面 `.active` → `screenshot()` 存 `screenshots/NN-*.png`。
- 必查项：加载页像素 M 与进度百分比、结果页营养条颜色（绿/橙/红语义）、订单页金额对齐、顶栏步数、音效开关状态。
- 交付前至少 12 张：8 步各 1 + 加载页 + 游戏态 + 订单成功态 + 移动端长屏。

### 8.7 交付前自检清单（DoD）
- [ ] `node --check` 通过；61/61；71/71；导航专项通过。
- [ ] 8 步全流程在无头 Chrome 中零错误走通。
- [ ] 3 秒加载页不弹游戏，10 秒页弹游戏，下单页 2 秒不弹。
- [ ] 结果页每张卡片的六项营养 = 菜品行求和（抽查 3 人）。
- [ ] 预算 10 元、忌口全选、5 人、跳过身体数据 四种极端路径均不崩。
- [ ] 零 emoji、零外链、零 Token、零真实数据冒充。
- [ ] 音效：首个手势后有声音、开关可持久化、reduced-motion 自动静音。
- [ ] README / MCP_INTEGRATION / workbuddy.md 与代码一致（步骤数、特性、加载时长）。
- [ ] 移除设计工具注入的 `data-page-node-id` 属性（保留会污染 DOM 与 diff）。

---

## 九、可扩展方向与演进空间

| 方向 | 具体做法 | 前置条件 | 价值 |
|---|---|---|---|
| 真实 MCP 接入 | 自建轻量 Node 服务包装 `query-meals`/`list-nutrition-foods`/`create-order`，前端 fetch 该服务 | 服务端持有 Token；CORS | 从演示变可用产品 |
| 账号与历史 | 登录后保存「我的常点」「上次搭配」，用云端数据库 | 需要账号体系 | 提升复购与个性化 |
| 菜单热更新 | 菜单/营养/价格从服务端下发，前端只保留渲染与算法 | 数据契约稳定（按 4.1 字段） | 不必每次改版重发文件 |
| 真实定位与门店 | 接高德/腾讯地图逆地理编码，替换演示坐标 | 地图 Key（服务端代理） | 距离与门店真实可信 |
| 营养模型升级 | 引入钠/糖/纤维/钙的多目标优化，或按 DASH/地中海饮食打分 | 营养数据更完整 | 从"控卡"升级为"膳食质量" |
| 无障碍与国际化 | 全量 `aria-*`、键盘可达、`lang` 切换、文案抽离 i18n 字典 | — | 覆盖面与合规 |
| 工程化拆分 | 按 M1–M15 拆成模块，Vite 打包，保留"单文件产物"作为发布形态 | 引入构建链 | 可维护性提升，但需保证 `file://` 仍可用 |
| PWA 化 | 加 manifest + service worker，支持添加到主屏与离线 | 需 HTTPS | 移动端体验接近原生 |
| 数据看板 | 记录选择分布、放弃步骤、换单品次数（匿名） | 需埋点与隐私声明 | 优化推荐策略 |
| 多品牌复用 | 把 `MENU/MEAL_TYPES/GROUP_DEALS/STORES` 抽成"品牌数据包" | 数据结构抽象 | 一套引擎服务多品牌 |
| 社交化 | 拼单房间：多人各自在手机上填偏好，房主汇总 | 需后端与实时通道 | 真实多人场景 |

**演进时的三条硬约束（不要破坏）**：
1. 保持"计算层纯函数"边界——否则单测与复用会一起失效。
2. 保持 `Option` 六项 = 单品求和的**不变量**——否则结果可信度崩塌。
3. 保持"前端零 Token、零直连"——否则合规与安全评审不过。

---

## 十、措辞与文案规范（复刻时容易走样，必须遵守）

1. **称呼统一**："麦麦"用于品牌自称（麦麦提醒/麦麦小贴士/麦麦省券），"你"而非"您"。
2. **数字规范**：价格一位小数（`¥23.5`）；热量整数 + `kcal`；蛋白/脂肪/碳水整数 + `g`；钠整数 + `mg`。
3. **解释性文案必须回答"为什么"**：每个加载页的 `why` 段用 `<b>为什么…？</b>` 开头，随后一句人话解释 + 一句隐私/边界说明。
4. **风险措辞**：轻食页必须带"不建议青少年长期选择"；放纵餐必须带"适合偶尔犒劳"；不得出现"治疗/改善/疗效"。
5. **诚实标注三处**：团购（演示数据）、门店（演示坐标）、下单（不会真实扣款）。
6. **禁用 emoji**：一律用 `icon()` 产出的 SVG；允许的排版符号仅 `✓ ← → · ｜`。

---

## 十一、重建施工顺序（给执行 Agent 的逐步清单）

| 步 | 动作 | 完成标志 |
|---|---|---|
| 1 | 建 `index.html` 骨架：`meta`（charset/viewport/theme-color `#DA291C`）+ `<style>` + 8 个 `<section class="page">` | 页面空白但无报错 |
| 2 | 写设计令牌与组件 CSS（品牌色、阴影三级、玻璃拟态、`.opt/.chip/.card/.btn`、`prefers-reduced-motion`） | 静态样式可用 |
| 3 | 建 `ICONS`（57 枚）+ `icon()`，**放在所有数据定义之前** | 任取图标可渲染 |
| 4 | 建 `SFX`（9 音效 + 解锁 + 限流 + 持久化 + 全局委托）与顶栏 `#soundToggle` | 点按钮有声、开关生效 |
| 5 | 录入 `MENU / MEAL_TYPES / TASTES / AVOIDS / GROUP_DEALS / STORES / COUPONS / AVATARS` 与 `FOOD_ART` | 数据可被 `findItem` 命中 |
| 6 | 写工具层：`$ $$ fmt sum toast invalid showModal hideModal` | Toast/弹窗可弹 |
| 7 | 写计算层：`bmi bmr mealBudget recommendType itemAvoided tasteOk tasteBonus poolFor optionFrom scoreOption tasteFit solvePerson groupAlternatives swapItem refreshOption enforceBudget bestCoupon dealNutrition dealContainsAvoid solveGroupDeals` | 61 条冒烟可跑 |
| 8 | 写 `STEPS/NEXT_LABELS/STATE/resetState` 与 `go()`（含 `navSeq`） | 8 页可切换 |
| 9 | 逐页写渲染：`renderInfoDynamic / updateBmiBadge / validatePersons / renderMealTypes / renderTasteSection / renderBudget / updateBudgetNext / renderStores / renderResult / renderOrder / renderOrderSuccess` | 每页有内容且可交互 |
| 9b | 写滚轮选择器：`WHEEL_RANGE/WHEEL_DEF` + `Wheel` IIFE + `wheelField()`，替换 `renderInfoDynamic` 里的三个 `input.p-num`（保留隐藏 `input.p-num`），并补 `.wheel/.wheel-band/.wheel-fade/.wheel-item` CSS | 触屏拖拽/滚轮/点击/键盘四种方式都能改值并刷新 BMI |
| 10 | 写加载层 `startMcLoading/load` + `NO_GAME_DELAY` + 小恐龙 `startDino/stopDino` | 进度条与游戏按 4.12 表现 |
| 11 | 绑事件：`bindOptions` ×3、`btnNext`（8 个分支 + `finally` 恢复）、`storeRefreshBtn`、`soundToggle`、`go(0)` | 全流程可走通 |
| 12 | 跑测试：语法 → 61 冒烟 → 71 集成 → 导航专项 → puppeteer 截图 | 全绿 |
| 13 | 写文档四件套 + 截图归档，核对步骤数/特性/时长一致性 | 文档与代码零冲突 |

**最小可用里程碑（MVP）**：完成 1–11 步即为可演示产品；12–13 为交付质量门槛。
**时间预估（单 Agent）**：骨架与样式 1 轮，数据与算法 2 轮，渲染与交互 3 轮，加载与音效 1 轮，测试与文档 2 轮，共约 9 个迭代轮次。

---

## 附：一句话校验法
交付前问自己三句话，任一答不上就不能算完成：
1. **换个人、换个预算、换个忌口，结果会变吗？**（会 → 算法真在跑，不是写死的）
2. **断网、静音、拒绝定位，还能走完 8 步吗？**（能 → 降级做对了）
3. **我说的每个数字，能从商品表逐项加出来吗？**（能 → 没有编数据）
