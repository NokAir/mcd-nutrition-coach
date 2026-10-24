# 复刻「麦麦营养点餐助手」原版作品 · 提示词

> 用法：把下面「==== 提示词开始 ====」到「==== 提示词结束 ====」之间的全部内容复制到新任务里；
> **同时把同目录的 `SYSTEM_PROMPT.md` 一并作为参考资料提供**（里面的 6 张数据表必须逐字照抄，见提示词第 6 条）。

==== 提示词开始 ====

请完整复刻一个名为「麦麦营养点餐助手（MCD Nutrition Coach）」的单文件网页应用原型。这是麦当劳程序员节创意开发大赛的参赛作品，基于麦当劳 MCP（mcp.mcd.cn）的场景设计。产物必须是**一个 `index.html`**：HTML + 内联 `<style>` + 内联 `<script>`，零外部依赖、零 CDN、零 emoji、零音频文件，双击（`file://`）即可运行，移动端优先（390×844），桌面端居中 440px 列。总代码量约 2700 行。

## 1. 产品目标与场景

让用户「按每个人的身体数据和营养目标，搭配适合的麦当劳一餐」：解决「想吃麦当劳但怕长胖」「多人聚餐众口难调」「怎么点最划算」三个问题。用户先选人数（1–5+，5+ 按 5 人处理），逐人或统一录入身体数据与偏好，系统用 Mifflin-St Jeor 公式估算每人一餐热量预算，结合餐品营养数据推荐组合，合并成一单并自动匹配优惠券，最后到确认下单页。演示态下单，不真实扣款。

## 2. 交互流程（8 步，`STEPS` 数组驱动，`go(idx)` 是唯一路由入口）

① 开始（`welcome`，选人数，1 人时隐藏「录入方式」卡片直接进表单）→ ② 身体信息（`info`，手动逐个录入 / 跳过；年龄·身高·体重为滚轮选择器；BMI 徽章实时计算）→ ③ 点餐模式（`style`，随心搭配 / 团购套餐）→ ④ 餐型选择（`mealtype`，5 类餐型卡片，多人时顶部切换成员、选完自动跳下一位）→ ⑤ 预算·取餐·口味合并页（`budget`，总预算 + 到店/麦乐送 + 9 类忌口硬过滤 + 6 个口味标签按人独立；团购模式全员统一）→ ⑥ 选择门店（`store`，实时定位 + 按渠道过滤，麦乐送只列可配送门店，20 秒心跳刷新距离）→ ⑦ 营养推荐（`result`，每人一张卡：热量/蛋白/脂肪/碳水/钠/钙，可换饮品/换小食，预算超支自动降级并弹窗告知）→ ⑧ 确认下单（`order`，订单汇总 + 满减券自动匹配 + 示意到手价；提交后进入成功态，按钮保持禁用不可重复提交）。

除 ①→② 外每步之间都有加载层：③④⑥⑦ 步 3000ms、⑤→⑥ 10000ms（唯一保留小恐龙的页，1.8 秒弹出）、⑧→成功态 2000ms；其余加载页用 `NO_GAME_DELAY = 99999` 不弹游戏。每个加载页必须带「为什么需要这一步」说明条（`<b>为什么…？</b>` 开头 + 一句人话解释 + 一句隐私/边界说明）。

## 3. 技术架构与硬约束

- 单文件三层，顺序固定：`<head>` 内 `<style>` → `<body>` 内 8 个 `<section class="page">`（绝对定位切换，`.page.active` 显示）+ 加载层 + Toast/模态反馈层 → 末尾单个 `<script>`。
- **ES5 风格**：一律 `var` + 函数声明、不用箭头函数/模板字符串/`let`/`const`；`$` = `document.querySelector`；全局挂载，不用模块。
- **代码分区顺序强约束**：设计令牌 → `ICONS`/`icon()` → `SFX` → 6 张数据表 → 工具层（`fmt/sum/toast/invalid/showModal`）→ 计算层纯函数 → `STEPS/STATE/go()` → 滚轮 `Wheel` → 各页渲染函数 → 加载层 → 小恐龙 → `Motion` 动效层 → 事件绑定 → `go(0)`。
  `ICONS` 必须定义在所有数据表之前（`MEAL_TYPES` 定义时就要调用 `icon()`，否则 `var` 提升不提升赋值会 TypeError，整页白屏）。
- 分层边界：计算层全部是**纯函数**（不碰 DOM、不读全局可变状态，除 `STATE.avoids`），渲染层只读计算结果。

## 4. 必须实现的模块（M1–M15）

M1 品牌壳与导航（顶栏 Logo/标题/步数徽标/音效开关、底部进度条与上一步/下一步）｜M2 流程状态机（`STATE.step` + `navSeq` 导航令牌，防止加载期间被强行拽走）｜M3 身体信息与营养计算（`bmi/bmiLabel/bmr/mealBudget/recommendType` + 滚轮选择器）｜M4 餐型方案引擎（5 类：节俭大学生干饭餐/健身能量伙伴餐/日常轻松均衡餐/轻食控卡体验餐/欢乐放纵畅享餐，各有热量区间与蛋白门槛）｜M5 组合求解与预算降级（枚举主餐×小食×饮品（放纵餐再加甜品），5 轮宽松递进，取 Top6）｜M6 团购套餐检索（按人数/预算/渠道/忌口过滤，按人均热量匹配度排序）｜M7 门店检索与实时定位（haversine 距离、`watchPosition` + 心跳 + 手动刷新、拒绝授权回退演示距离并如实标注）｜M8 结果展示与替换（营养条形图、换饮品/换小食/换一批）｜M9 订单确认与演示下单（自动用券、订单号、成功光环）｜M10 加载层与节奏控制｜M11 小恐龙跑酷（Canvas，跳跃/障碍/计分/撞击，零依赖）｜M12 音效引擎（`SFX` IIFE）｜M13 自绘 SVG 图标系统（57 枚，24 栅格、1.7px 描边、`currentColor` 继承）｜M14 视觉设计系统｜M15 Toast 与模态反馈层。

## 5. 数据模型与接口契约

- **6 张数据表必须逐字复刻**：`MENU`（mains/sides/drinks/desserts，字段 `id/name/kcal/protein/fat/carb/sodium/price/tags`）、`MEAL_TYPES`（5 类，`kcal:[lo,hi]` + `proteinMin` + 文案）、`TASTES` 与 `AVOIDS`、`GROUP_DEALS`、`STORES`（演示坐标）、`COUPONS`（满 80 减 18 / 满 50 减 10 / 满 30 减 5，不可叠加）。**这 6 张表的原样内容在随附 `SYSTEM_PROMPT.md` 的 4.1–4.6 节，必须照抄，一个数字都不要改**——推荐结果、测试断言都依赖它们。
- `Person`：`{name, gender:'male'|'female', age:5–100, height:100–220, weight:30–200, skip, mealType, tastes[], pick}`；滚轮默认值 `age:25/height:170/weight:65`。
- `STATE`：`{step, peopleCount, infoMode, persons[], style, budget, avoids[], dining, storeId, results[], groupList, groupPick, groupDeal, orderId, teenWarned, swapCount, unifiedTastes[], activePerson, userPos}`。
- `Option`/`Result`：六项营养（kcal/protein/fat/carb/sodium）+ price 必须等于单品逐项求和（不变量，测试会验）。
- 关键函数签名与算法（`bmi/bmr/mealBudget/recommendType/scoreOption/solvePerson/swapItem/enforceBudget/bestCoupon/solveGroupDeals/startMcLoading/load`）见 `SYSTEM_PROMPT.md` 4.10–4.12，**必须按其中公式实现**：
  - `mealBudget = clamp(round(bmr*1.375*0.35/50)*50, 450, 1100)`，`skip` 返回 700；
  - `bmr = 10w + 6.25h − 5age + (female ? −161 : +5)`；
  - 打分越小越优：热量偏离项 + `sodium*0.004`（保证同分优先低钠）+ 蛋白奖励 + 口味加分 − 价格项；
  - `swapItem(r, group, dir)` 入参是**结果对象**（含 `person` 与 `current`），不是 person——这是历史 bug 点；
  - 进度条 `barMs = max(600, estMs*0.92)`，**禁止把 `threshold` 算进进度条**。
- DOM 契约（id 必须存在）：`page-welcome/info/style/mealtype/budget/store/result/order`、`stepChip/soundToggle/progressBar/btnBack/btnNext`、`loader/loaderMsg/loaderSub/loaderWhy/loaderBar/loaderPct/loaderGame/dinoCanvas/dinoScore`、`toastWrap/modalWrap`、`infoDynamic/infoModeCard/bmiBadge{0..4}/skipBodyLink`、`budgetInput/budgetPeopleNote/avoidChips/diningChips/groupDiningTip`、`storeList/storeSub/storeStatus/storeRefreshBtn`；滚轮结构为 `#infoDynamic .wheel[data-i][data-k]` + 子节点 `.wheel-band/.wheel-list/.wheel-item[data-v]` + 隐藏 `input.p-num[data-i][data-k]`。
- 外部 MCP 只做文档层约定（`now-time-info/query-nearby-stores/delivery-query-* /query-meals/query-meal-detail/list-nutrition-foods/*coupons/calculate-price/create-order/campaign-calendar`），**前端零 Token、零直连**，营养数据唯一来源标注为 MCP，演示数据必须诚实标注。

## 6. 视觉与交互规格（复刻的重点，做不好就不像原版）

- **品牌色**：麦当劳红 `#DA291C`（深 `#B01208`）、黄 `#FFC72C`（浅 `#FFF4CC`）、黑 `#27251F`、米白底 `#FCFBF8→#F6F4F0`；圆角 18px、阴影三级。
- **Apple 式模糊玻璃（三级，v3 更透）**：卡片/换一批面板/弹窗 `backdrop-filter:blur(26px) saturate(180%) brightness(1.02)` + 44% 白釉 + 1px 内高光；控件（`.opt/.mt-opt/.chip/.ps-chip/按钮`）`blur(16–18px) saturate(170%)` + 34% 白釉 + 白描边；顶栏/底栏 `blur(20–24px)` 且滚动超过 8px 后加深（`.brandbar.scrolled`）。**关键前提**：必须先有 `.aurora` 四个模糊彩色光斑（品牌黄/红/橙，opacity .9、`blur(64px)`，24–36s 缓慢漂移）作为玻璃背后的底色，否则 `backdrop-filter` 看不出任何效果；**玻璃越透，极光必须越亮**（白釉从 66–80% 降到 28–44%，极光透明度与模糊半径要同步上调），否则文字发飘不可读。配色思路来自两个公开实践：`kevinbism/liquid-glass-effect`（纯 CSS 玻璃配方）与 `shuding/liquid-glass`（只借鉴「高光沿边缘」，**不要**引入全屏 `feDisplacementMap`，手机端会掉帧、小字发糊）。
- **动效层 `Motion` IIFE**（全部可降级）：页面入场 + 子元素按 `--i` 错峰上浮（42ms 递进）、滚动玻璃态（rAF 节流）、步数徽标弹一下、按钮水波纹、桌面光标追光（`--mx/--my`）、价格数字滚动（720ms 三次缓出）、营养条生长、主按钮光泽扫过、进度条流光、下单成功光环、桌面悬停抬升（仅 `(hover:hover) and (pointer:fine)`）。`prefers-reduced-motion: reduce` 时 CSS 动画时长压到 0.01ms、JS 跳过全部动效、音效自动静音。
- **滚轮选择器（年龄/身高/体重）**：`.wheel` 高 120px（每格 40px，选中项固定居中），三层结构 = 居中白底选中带 `.wheel-band` + 上下渐隐 `.wheel-fade` + 选项列表 `.wheel-list`；选中项红色加粗放大。四种操作：① 触屏/鼠标按住上下拖（`setPointerCapture`；第二根手指的 `pointerdown` 忽略，防基准重置；`lostpointercapture` 兜底 `up()`）。`pointerdown` 记 `idx0 = el._idx`；`pointermove` 算 `raw = idx0 - (cy - sy)/ITEM_H`，**索引实时跟随手指**——`ni = clamp(round(vis))` 跨过整数格才更新 DOM，同时用亚像素 `el._drag = (ni - vis)*ITEM_H` 平滑跟随；**越界橡皮筋必须用饱和阻尼**：`vis = lo - 0.5*(1 - exp(-(lo-raw)/1.2))`（底部对称），最多拉出半格——否则深拉时选中数字被整体拉出滚轮，看起来就是"数据被隐藏"；松手惯性 `proj = vis - v*130/ITEM_H`——**符号必须取负**（`raw` 与 clientY 反向），且**速度按停顿时长指数衰减** `v = vel*exp(-(Date.now()-lastMoveT)/120)`（手指停住再松手不产生幽灵惯性），投影钳制在 `idx±20` 格；② 桌面鼠标滚轮 ±1 格，**到边界直接 return 且不 `preventDefault`**（放行页面滚动），70ms 限流；③ 点击某一项；④ 键盘 ↑↓/←→ ±1、PageUp/PageDown ±5、Home/End。**窗口化渲染 + 节点池**：`renderWindow` 只保留当前 ±3 项共 7 个 `.wheel-item`（绝对定位 `top = i*40`，列表 `translateY(40 - idx*40 + drag)`），并维护 `el._pool` 节点池——按需增删节点、只更新既有节点的 值/top/on 类，**绝不在指针手势进行中 `innerHTML` 整体重建**（真实手机尤其 iOS 在手势期间销毁目标节点会丢指针事件、出现闪断空白）；带吸附动画时**渲染 `fromIdx→idx` 整段**再于 380ms 后收窄回 ±BUF，否则动画期间会露出空白中心带；松手后必须补 `if (el._idx === before) commit(el, false)`，否则惯性投影索引等于拖拽末索引时值不落 `STATE`。数据流：选中值写隐藏 `input.p-num` 并派发 `input` 事件，由既有 `.p-num oninput` 落入 `STATE.persons[i][k]` 并触发 `updateBmiBadge(i)`——不新增数据通路。带 `tabindex=0` + `role="spinbutton"` + `aria-valuenow/valuetext`，换项播 `SFX.play('tap')`。范围：年龄 5–100、身高 100–220、体重 30–200，与 `validatePersons` 完全一致；`WHEEL_DEF = {age:25, height:170, weight:65}`，空值/非数字渲染前统一回落。
- **音效引擎 `SFX`**：Web Audio 纯合成，零音频文件。9 种音（tap/select/next/back/coin/success/error/jump/hit），AudioContext 单例 + 主增益总线（`VOL=0.22`）+ 指数包络防爆音；首次手势解锁（`resume()` + 1 样本静音缓冲，兼容 iOS Safari 与微信 webview）；同名 45ms 限流防叠音；`prefers-reduced-motion` 自动静音；静音开关 `localStorage` 持久化（try/catch 包裹）；无 AudioContext 环境静默降级。全局 `pointerdown` 委托一处路由覆盖全部按钮（含动态渲染卡片）。
- **图标系统**：57 枚自绘 SVG 图标（餐型/口味/头像/操作/状态/营养/门店/食物/加载页漂浮物），`ICONS` 字典 + `icon()` 函数生成，**全站零 emoji**；每个餐品名称前还要配内嵌 SVG 食物插画（全菜单覆盖，自绘矢量，无版权风险）。
- **加载层**：像素 M 动画 + 进度条 + 「为什么」说明条；仅 10 秒页弹小恐龙。
- **门店实时定位**：`navigator.geolocation` + haversine 距离 + 20 秒心跳 + 手动刷新按钮，拒绝授权回退演示距离并标注「未获得定位授权」；位置不存储不上传。

## 7. 文案与合规红线（复刻时最容易走样）

1. 「麦麦」用于品牌自称，称呼用户用「你」不用「您」。
2. 数字规范：价格一位小数（`¥23.5`）；热量整数 + `kcal`；蛋白/脂肪/碳水整数 + `g`；钠整数 + `mg`。
3. 每个加载页说明条必须回答「为什么」，并附一句数据边界说明（如「身体数据只用于估算一餐热量预算，不上传」）。
4. 轻食餐型必须带「不建议青少年长期选择」，放纵餐必须带「适合偶尔犒劳」；禁止「治疗/改善/疗效」等医疗表述；热量预算为公式估算，不构成医疗或营养建议。
5. 诚实标注三处：团购数据为演示用途（官方 MCP 暂无团购工具）、门店为演示坐标、下单不会真实扣款。
6. 零 emoji、零外链、零 Token、零真实数据冒充；配置文件只用环境变量占位符。
7. 注明「参赛项目为麦当劳程序员节创意开发大赛参赛作品，由参赛者独立开发，非麦当劳官方产品」。

## 8. 测试与验收（不跑完不算完成）

1. **语法**：抽出内联脚本 `node --check` 通过。
2. **冒烟 61/61**：计算层纯函数单测（bmi/bmr/预算/打分/换单品/压预算/用券/团购派生值）。
3. **集成 71/71**（jsdom，`runScripts:'dangerously'`，url 用 `http://localhost/`）：场景 A 自定义 2 人麦乐送全 8 步、场景 B 团购 3 人、场景 D 1 人极简流程、场景 F 分享功能已移除；每场景断言零运行时错误。
4. **滚轮专项 52/52**：渲染（3 个滚轮/7 个节点/默认值/隐藏 input 同步/spinbutton 语义）、键盘、鼠标滚轮（含边界放行）、点击选项、触摸拖拽（`pointerdown/move/up` + 惯性方向 + 橡皮筋 + 不越界）、多人 9 个滚轮相互独立、离开页面再回来值保留、`prefers-reduced-motion` 仍可用、极端值（100 岁/200kg/100cm）走完整推荐不崩。
5. **拖拽专项 21/21**（`wheel_drag_test.js`）：30 步连续拖拽全程无空白中心带、快甩惯性方向正确（上甩变大/下甩变小）、100 帧内 DOM 更新 ≤20 次、拖完值落 `STATE`（多人相互独立）、橡皮筋回弹不越界；**回归新增**：深拉 600px 橡皮筋位移 ≤ 半格（选中数字不被拉出滚轮）、深拉全程中心带始终有数据、拖拽中 item 节点引用稳定（不整体重建 DOM）、停住 400ms 后松手落点=手指停留处（无幽灵惯性）。
6. **导航防护**：加载期间点上一步不会被拽走（`navSeq` 令牌）。
7. **真实节奏触屏复现**（`wheel_repro_real.js`，puppeteer 真触屏 + 16ms 帧节奏）：慢速拖拽中含 250ms 停顿、停顿 400ms 后松手、边缘外 200px 深拉、120ms 内连甩两次——四场景中心带全程有数据、无空文本、`scrollY` 不变、零运行时错误。
8. **真实浏览器走查**（Chrome 无头 + `page.touchscreen`）：8 步全流程零错误；真实触屏拖滚轮 400px 全程 20 次采样无空白、值正确变化且页面 `scrollY` 不变；玻璃 `backdrop-filter` 计算值生效；3 秒页不弹游戏、10 秒页弹游戏、下单页 2 秒不弹；至少 12 张截图归档 `screenshots/`。
9. **DoD 清单**：预算 10 元、忌口全选、5 人、跳过身体数据四种极端路径均不崩；结果页六项营养 = 菜品行求和（抽查 3 人）；README/`SYSTEM_PROMPT.md`/`workbuddy.md` 与代码一致；移除设计工具注入的 `data-page-node-id` 属性。

## 9. 交付物

`index.html`（唯一运行产物）+ `README.md`（功能/视觉/动效/运行方式/MCP 配置）+ `SYSTEM_PROMPT.md`（完整复刻规格）+ `CONTEST_DECLARATION.md`（官方参赛声明原文）+ `mcp-config.example.json`（仅环境变量占位符）+ `MCP_INTEGRATION.md`（MCP Server/Tool/调用流程/业务价值）+ `screenshots/` 走查截图。

## 10. 常见坑（直接避开）

- `ICONS` 定义在 `MEAL_TYPES` 之后 → 运行期 TypeError，整页白屏。
- 「5+」人数用 `+v` 转成 NaN → 身体信息页空白；必须 `clamp(parseInt(v,10)||1, 1, 5)`。
- `swapItem` 传 person 而不是结果对象 → 点击即崩。
- `scoreOption` 低钠项符号写反 → 高钠组合反而优先。
- `btnNext` 的 `finally` 无条件解禁 → 未选录入方式也能跳页；应记录 `startStep`，仅当未跳转时才恢复可用。
- 进度条把 `threshold` 当时长 → 3 秒页变 160 秒。
- 拖滚轮数据变空白、卡顿不连贯：拖拽中 `idx` 不动 → 窗口固定 ±3 → 拖出 3 格露出未渲染空白带，且每帧重建整个 `.wheel-list`。正确：**索引实时跟随手指**（跨整数格才更新 DOM）+ 亚像素 `drag` 偏移 + 节点池（只更新既有节点，不 innerHTML 重建）+ 动画渲染 `fromIdx→idx` 整段。
- **拖到边缘继续拉，选中数字被拉出滚轮（数据被隐藏）**：橡皮筋用线性 `0.32` 系数不设上限，深拉 200px 时选中项整体移出可视带。必须用饱和阻尼且**最多拉出半格**：`vis = lo - 0.5*(1 - exp(-(lo-raw)/1.2))`。
- 松手后年龄/身高/体重不变：`setIdx` 只在索引变化时 `commit`，惯性投影索引常等于拖拽末索引 → 值不落 `STATE`；`up()` 必须补 `if (el._idx === before) commit(el, false)`。
- **幽灵惯性：手指停住几秒再松手，滚轮凭空跳出好几格**：`up()` 直接用了最后一次 `pointermove` 的陈旧速度。必须按停顿时长指数衰减：`v = vel * exp(-(Date.now()-lastMoveT)/120)`，并把投影钳制在 ±20 格内。
- 惯性方向甩反：`proj` 写成 `vis + vel*130/ITEM_H`；`raw = idx0 - (cy - sy)/ITEM_H` 与 clientY 反向，**必须取负号** `vis - vel*130/ITEM_H`。
- 玻璃背后没有彩色光斑 → `backdrop-filter` 完全看不见；玻璃调更透时不同步提亮极光 → 文字发飘不可读（白釉 66–80% → 28–44%，极光 opacity .9 / blur 64px 同步上调）。
- 门店默认选中在 HTML 拼好后才赋值 → 第一张卡片没有选中态；应先算 `selId` 再渲染。
- 换一批面板的徽标缺全局尺寸约束 → 被撑成整块大红 M。

==== 提示词结束 ====
