---
name: mcd-nutrition-coach
description: 麦当劳「麦麦营养点餐助手」参赛作品的完整复刻 / 改造 / 部署技能。当用户提到：麦麦营养点餐助手、麦当劳程序员创意开发大赛作品、营养点餐推荐原型、按身体数据推荐麦当劳一餐、Mifflin-St Jeor 一餐热量预算、多人分别推荐再合并一单、自动匹配满减券的点餐演示、Apple 模糊玻璃单文件 HTML、iOS 式滚轮选择器、要把该系统发布成公开网址或做成 GitHub skill 仓库时使用。覆盖：单文件零依赖架构（ES5、三级 backdrop-filter 更透玻璃 + 极光斑、Motion 动效层、Web Audio 9 音效、Canvas 小恐龙、57 枚自绘 SVG 图标）、6 张必须逐字照抄的数据表、5 轮宽松递进推荐算法与打分公式、8 步流程与加载节奏、61/71/52/17 四层测试法（含 jsdom 与 puppeteer 真实触屏脚本）、索引实时跟随手指的滚轮拖拽契约、sites 公网发布与 GitHub 仓库化步骤、12 条历史踩坑。
agent_created: true
---

# 麦麦营养点餐助手（MCD Nutrition Coach）

## Overview

麦当劳程序员节创意开发大赛参赛作品：一个**单文件、零外部依赖**的 HTML 应用（`index.html`，约 2700 行，`file://` 双击即可运行，移动端优先 390×844，桌面居中 440px 列）。核心价值是「按每个人的身体数据和营养目标，搭配适合的麦当劳一餐」——多人分别计算、分别推荐、合并成一单、自动用券。营养计算用 Mifflin-St Jeor 公式估算 BMR × 1.375 × 35% 作为一餐热量预算；演示数据与麦当劳 MCP（mcp.mcd.cn）返回字段同构，前端零 Token、零直连。

## 何时使用

- 要**复刻**这个系统（新任务里重建同款作品）→ 直接用 `REPRODUCE_PROMPT.md` 的提示词 + 本 skill 的约束；
- 要**改造**它（改样式、加功能、修 bug）→ 先读「核心实现要点」，遵守红线；
- 要**测试**它 → 按「测试」一节三层跑；
- 要**发布**它（公开网址 / GitHub 仓库）→ 按「部署」与「仓库化」两节。

## 线上链接与仓库

- **GitHub 仓库（本 skill 的权威源）**：https://github.com/NokAir/mcd-nutrition-coach
- **公开访问网址（WorkBuddy sites 部署，微信可打开）**：https://mcd-nutrition-coach.app.workbuddy.host/?sharecode=BV5CDL2UEC
- 改代码以 GitHub 仓库为准；本地副本仅用于本机 WorkBuddy 直接加载。

## 快速开始

```bash
# 1. 本地运行（无需构建、无依赖）
open index.html                      # 或 python3 -m http.server 8080 后访问 http://localhost:8080

# 2. 语法自检（抽出内联脚本）
awk '/^<script>$/{f=1;next} /^<\/script>$/{f=0} f' index.html > /tmp/app.js && node --check /tmp/app.js

# 3. 接入真实麦当劳 MCP（可选，演示不依赖它）
#    见 README.md「配置麦当劳 MCP」与 mcp-config.example.json
```

## 文件地图

| 文件 | 作用 |
|---|---|
| `index.html` | **唯一运行产物**：完整源码（结构/CSS/JS 全在内） |
| `SYSTEM_PROMPT.md` | 完整规格书：6 张数据表原样内容、函数契约、算法公式、DOM 契约、错误边界 E1–E29、测试方法、施工顺序 |
| `REPRODUCE_PROMPT.md` | 可整段复制的「复刻原版作品」提示词（配 SYSTEM_PROMPT.md 使用） |
| `README.md` | 功能/视觉/动效/运行方式/MCP 配置说明 |
| `MCP_INTEGRATION.md` | MCP Server / Tool / 调用流程 / 业务价值 |
| `CONTEST_DECLARATION.md` | 官方参赛声明（未改动） |
| `mcp-config.example.json` | MCP 配置示例（仅环境变量占位符，**无真实 Token**） |
| `screenshots/` | 无头浏览器走查截图（玻璃/滚轮/各步骤） |

## 核心实现要点（改代码前必读）

### 1. 架构硬约束
- 单文件三层，顺序固定：`<style>` → 8 个 `<section class="page">` + 加载层 + 反馈层 → 末尾单个 `<script>`。
- **ES5 风格**：`var` + 函数声明，不用箭头函数/模板字符串/`let`/`const`；`$` = `document.querySelector`。
- **分区顺序**：设计令牌 → `ICONS`/`icon()` → `SFX` → 6 张数据表 → 工具层 → 计算层纯函数 → `STEPS/STATE/go()` → 滚轮 `Wheel` → 各页渲染 → 加载层 → 小恐龙 → `Motion` → 事件绑定 → `go(0)`。
  `ICONS` 必须早于所有数据表（`MEAL_TYPES` 定义时即调用 `icon()`；`var` 提升不提升赋值，顺序错会 TypeError 整页白屏）。
- 计算层是**纯函数**（不碰 DOM），渲染层只读计算结果。

### 2. 数据表与算法（必须原样，否则推荐结果与测试断言漂移）
- 6 张表：`MENU`（mains/sides/drinks/desserts，字段 `id/name/kcal/protein/fat/carb/sodium/price/tags`）、`MEAL_TYPES`（5 类，`kcal:[lo,hi]`+`proteinMin`）、`TASTES`/`AVOIDS`、`GROUP_DEALS`、`STORES`、`COUPONS`。**原样内容在 `SYSTEM_PROMPT.md` 4.1–4.6，逐字照抄。**
- `bmr = 10w + 6.25h − 5age + (female ? −161 : +5)`；`mealBudget = clamp(round(bmr*1.375*0.35/50)*50, 450, 1100)`，`skip` 返回 700。
- 打分越小越优：热量偏离 + `sodium*0.004`（同分优先低钠）+ 蛋白奖励 + 口味加分 − 价格项。
- `solvePerson` 5 轮宽松递进（严格 → 放蛋白 → 区间 ±15% → ±30% → 全放开），取 Top6。
- `swapItem(r, group, dir)` 入参是**结果对象**（含 `person`/`current`），不是 person。
- `enforceBudget` 最多 60 轮换低价候选；`Option` 六项必须等于单品逐项求和（测试会验）。
- 进度条 `barMs = max(600, estMs*0.92)`，**禁止把 `threshold` 算进进度条**。

### 3. 流程与节奏
8 步：welcome → info → style → mealtype → budget → store → result → order；`go(idx)` 是唯一路由入口，`navSeq` 令牌防「加载期间被拽走」。加载时长：3000ms ×5、budget→store 10000ms（唯一弹小恐龙的页，1800ms 延迟）、order→成功态 2000ms；`NO_GAME_DELAY = 99999` 表示本页不弹游戏。每个加载页必须带「为什么需要这一步」说明条。

### 4. 视觉与交互三层
- **三级 Apple 玻璃（v3 更透）**：卡片/面板 `blur(26px) saturate(180%) brightness(1.02)` + 44% 白釉 + 1px 内高光；控件 `blur(16–18px) saturate(170%)` + 34% 白釉 + 白描边；顶栏/底栏 `blur(20–24px)` 滚动后加深。**玻璃越透，背后的光斑必须越亮**：`.aurora` 四个模糊光斑（黄/红/橙，opacity .9、`blur(64px)`，24–36s 漂移）当底色，否则 `backdrop-filter` 看不见；白釉从 66–80% 降到 28–44% 后，极光透明度与模糊半径要同步上调。只借鉴 `shuding/liquid-glass` 的边缘高光，**不要**全屏 `feDisplacementMap`（手机掉帧、小字发糊）。
- **`Motion` IIFE**：入场错峰（`--i` × 42ms）、滚动玻璃态、水波纹、桌面追光、价格数字滚动、营养条生长、光泽扫过、成功光环、桌面悬停抬升；`prefers-reduced-motion` 全部降级。
- **滚轮选择器**（年龄 5–100 / 身高 100–220 / 体重 30–200，默认 25/170/65）：**索引实时跟随手指**——`pointermove` 算 `raw = idx0 - (cy - sy)/ITEM_H`，`ni = clamp(round(vis))` 跨过整数格才重建 DOM，同时用亚像素 `drag = (ni - vis)*ITEM_H` 平滑跟随；越界 0.32 橡皮筋；松手惯性 `proj = vis - vel*130/ITEM_H`（**符号必须取负**，`vel` 是 clientY 方向）吸附；鼠标滚轮（边界 return 且不 `preventDefault`）、点击选项、键盘 ↑↓/PageUp·Down/Home·End；**窗口化渲染 + 缓存只画 ±3 项**，动画渲染 `fromIdx→idx` 整段避免空白中心带；松手必须补 `if (el._idx === before) commit(el, false)` 否则拖完值不落 `STATE`；选中值写隐藏 `input.p-num` 派发 `input` 走既有链路，数据结构不变；`role="spinbutton"` + `aria-valuenow`。
- **`SFX`**：Web Audio 纯合成 9 音（tap/select/next/back/coin/success/error/jump/hit），首次手势解锁、45ms 限流、reduced-motion 自动静音、localStorage 持久化、无 AudioContext 静默降级。
- **图标**：57 枚自绘 SVG（`ICONS` + `icon()`，24 栅格/1.7px 描边/`currentColor`），全站零 emoji；餐品前配内嵌 SVG 食物插画。

## 测试（三层，不跑完不算完成）

1. **冒烟 61/61**：计算层纯函数（预算/打分/换单品/压预算/用券/团购派生值）。
2. **集成 71/71**（jsdom，`runScripts:'dangerously'`，url 用 `http://localhost/`）：场景 A 自定义 2 人麦乐送、B 团购 3 人、D 1 人极简、F 分享已移除；每场景断言零运行时错误。
3. **滚轮专项 52/52**：渲染/键盘/滚轮/点击/拖拽/多人独立/值保留/reduced-motion/极端值全流程。
4. **拖拽专项 17/17**（`wheel_drag_test.js`）：30 步连续拖拽无空白、快甩惯性方向、100 帧内 DOM 重建 ≤20、拖完值落 `STATE`（多人独立）、橡皮筋回弹。
5. **真实浏览器**（puppeteer-core + Chrome，`page.touchscreen` 真触屏）：8 步零错误；拖滚轮时页面 `scrollY` 不变、20 次采样无空白中心带；玻璃 `backdrop-filter` 计算值生效；3 秒页不弹游戏、10 秒页弹、下单页 2 秒不弹；截图归档。

> jsdom 无 PointerEvent：用普通 `Event` + 手工补 `clientY/pointerId/pointerType` 属性即可模拟拖拽。

## 部署成公开网址

用户要求「变成可以公开访问的网址」时，用 sites 部署（静态项目，无需服务器）：

```json
{ "action": "deploy", "directory": "<项目绝对路径>", "language": "static",
  "appName": "麦麦营养点餐助手", "domainPrefix": "mcd-nutrition-coach",
  "userAskedToPublish": true }
```

- 仅当用户在**当轮消息**里明确要求发布时才传 `userAskedToPublish: true`；本地改代码不等于要发布，改完先问。
- 成功后给 `shareLink`，并告知管理入口「设置—数据管理—应用」。
- 已验证可用：`https://mcd-nutrition-coach.app.workbuddy.host/?sharecode=BV5CDL2UEC`（官方域名，微信可打开；勿用 localhost.run 免费子域，微信常拦截）。

## 做成 / 更新 GitHub skill 仓库

```bash
cd <项目目录>
git init -b main && git add -A
git commit -m "feat: 麦麦营养点餐助手（单文件零依赖 + 滚轮选择器 + Apple 玻璃）"
gh repo create mcd-nutrition-coach --public --source=. \
  --description "麦当劳程序员创意开发大赛参赛作品：按身体数据与营养目标推荐一餐的单文件 HTML 原型" --push
gh repo view --web          # 打开仓库页
```

- 推送前确认无真实 Token/密钥（`mcp-config.example.json` 只含占位符）；`CONTEST_DECLARATION.md` 保持官方原文。
- 更新线上内容：本地改完 → commit → `git push`；若要同步 sites 公开链接，需用户当轮明确要求再 deploy。

## 常见坑（直接避开）

1. `ICONS` 定义在 `MEAL_TYPES` 之后 → TypeError 整页白屏。
2. 「5+」人数用 `+v` → NaN，身体信息页空白；必须 `clamp(parseInt(v,10)||1, 1, 5)`。
3. `swapItem` 传 person 而非结果对象 → 点击即崩。
4. `scoreOption` 低钠项符号写反 → 高钠组合反而优先。
5. `btnNext` 的 `finally` 无条件解禁 → 未选录入方式也能跳页；应记录 `startStep`，仅未跳转时恢复。
6. 进度条把 `threshold` 当时长 → 3 秒页变 160 秒。
7. 拖滚轮时数据变空白、卡顿不连贯：根因是拖拽中 `idx` 不动 → 窗口固定在 ±3 → 拖出 3 格露出未渲染空白带，且每帧重建整个 `.wheel-list` DOM。正确做法：**索引实时跟随手指**（跨整数格才重建 DOM）+ 亚像素 `drag` 偏移 + `renderWindow` 缓存 + 动画渲染 `fromIdx→idx` 整段。
8. 松手后年龄/身高/体重不变：`setIdx` 只在索引变化时 `commit`，而惯性投影后的索引常等于拖拽末索引 → 值不落 `STATE`。`up()` 里必须补 `if (el._idx === before) commit(el, false)`。
9. 惯性方向甩反：`proj` 写成 `vis + vel*130/ITEM_H`。`raw = idx0 - (cy - sy)/ITEM_H` 与 clientY 反向，**必须取负号** `vis - vel*130/ITEM_H`。
10. 玻璃背后没有彩色光斑 → `backdrop-filter` 完全看不见；玻璃调更透时不同步提亮极光 → 文字发飘不可读（白釉 66–80% → 28–44%，极光 opacity .9 / blur 64px 同步上调）。
11. 门店默认选中在 HTML 拼好后才赋值 → 第一张卡无选中态；先算 `selId` 再渲染。
12. 换一批面板徽标缺全局尺寸约束 → 被撑成整块大红 M。

## 扩展方向

真实 MCP 接入（Node 服务端持 Token，前端 fetch）、菜单热更新、多目标营养模型（钠/糖/纤维）、PWA 化、拼单房间、多品牌数据包复用。三条硬约束不破坏：计算层纯函数边界、`Option` 六项=单品求和、前端零 Token 零直连。
