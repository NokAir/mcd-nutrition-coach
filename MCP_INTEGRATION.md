# MCP_INTEGRATION.md

本文档说明「麦麦营养点餐助手」实际使用的麦当劳 MCP Server、Tool、调用流程与业务价值。

## 1. MCP Server

| 项 | 值 |
|---|---|
| 服务提供方 | 麦当劳中国 |
| 接入地址 | `https://mcp.mcd.cn` |
| 传输协议 | Streamable HTTP |
| 鉴权方式 | 请求头 `Authorization: Bearer ${MCD_MCP_TOKEN}` |
| Token 申请 | [open.mcd.cn/mcp](https://open.mcd.cn/mcp) 手机号登录 → 控制台 → 激活 |
| 官方仓库 | [M-China/mcd-mcp-server](https://github.com/M-China/mcd-mcp-server) |
| 限流 | 每 Token 600 次/分钟，超限返回 429；401 表示 Token 无效/过期/未携带 |

## 2. 使用的 Tool 清单

| Tool | 用途 | 在本项目中的位置 |
|---|---|---|
| `now-time-info` | 获取当前时间 | 识别早/午/晚/夜市，决定可售菜单 |
| `query-nearby-stores` | 查询附近可用门店 | 自提 / 得来速模式选店；UI 中按实时定位排序、随位置自动更新 |
| `delivery-query-addresses` | 查询配送地址列表 | 麦乐送模式选择收货地址 |
| `delivery-query-stores` | 查询可配送门店 | 麦乐送模式选店 |
| `query-meals` | 查询门店在售菜单（分类、编码、价格） | 拉取当次菜单，推荐的数据底座 |
| `query-meal-detail` | 查询餐品/套餐详情与可替换项 | 自定义搭配的替换（去酱、换无糖等） |
| `list-nutrition-foods` | 餐品营养数据 | **营养推荐核心数据源**（热量、蛋白质、脂肪、碳水、钠、钙） |
| `query-store-coupons` | 门店优惠券 | 优惠匹配 |
| `query-my-coupons` | 账户优惠券 | 优惠匹配 |
| `available-coupons` + `auto-bind-coupons` | 麦麦省券查询与一键领取 | 省钱链路（需用户确认） |
| `calculate-price` | 计算原价/优惠/应付金额 | 到手价核价 |
| `create-order` | 创建真实订单 | **仅在用户明确确认后调用**，返回订单号与支付链接 |
| `campaign-calendar` | 营销活动日历 | 团购套餐模式的活动参考 |

## 3. 调用流程

与 UI 原型 `index.html` 的 9 步流程一一对应：

```
① 用餐人数（1–5+）
② 身体信息（年龄/性别/身高/体重 → BMI；或跳过）
③ 点餐模式
     ├─ 自定义搭配 → 走 ④–⑨ 的单人/多人分别推荐链路
     └─ 团购套餐   → query-meals + campaign-calendar → 套餐检索
④ 餐型选择（5 类：节俭 / 健身 / 均衡 / 轻食 / 放纵，各有热量区间与蛋白门槛）
⑤ 口味偏好（爱吃辣/不吃辣/偏爱酸甜/喜欢清淡/爱吃酥脆/无偏好）
⑥ 预算 + 忌口 + 取餐方式
     ├─ 麦乐送 → delivery-query-addresses → delivery-query-stores
     ├─ 到店   → query-nearby-stores
     └─ 得来速 → query-nearby-stores（筛支持得来速的门店）
⑦ 选店（门店列表按取餐渠道实时过滤）
⑧ now-time-info（时段分流）→ list-nutrition-foods → 本地建立营养索引
⑨ 按每人餐型 + 热量预算（BMR×1.375×35%）本地筛选候选组合
     ├─ 忌口 / 「不吃辣」为硬过滤，其余口味为排序加权
     ├─ 候选在达标区间内按「钠升序 → 蛋白质降序 → 价格升序」排序
     └─ 换饮品/换小食 → query-meal-detail（同 round 候选项替换）
⑩ query-store-coupons + query-my-coupons（+ available-coupons）
⑪ calculate-price → 到手价；超预算时本地降级候选后重新核价
⑫ 用户明确确认 → create-order → 返回订单号与支付链接
```

UI 原型 `index.html` 中的「模拟数据层」（`MENU` / `MEAL_TYPES` / `GROUP_DEALS` / `STORES` / `COUPONS`）按上表工具的返回字段结构组织，页面上的每一次「加载」都对应真实链路中的一步 MCP 调用，便于后续无缝替换为真实数据。

## 4. 关键实现说明（接口注意事项）

- `list-nutrition-foods` 返回 **TOON 文本**而非 JSON：需先从首行提取字段定义再逐行解析；`nutritionDescription` 可能为 `null` 或含逗号，不能简单按逗号切分
- `query-meals` 的价格单位是「元」且通常为字符串；`calculate-price` 返回的价格单位是「分」，展示时需除以 100
- 套餐替换只能发生在**同一个 round 的候选项**中；「去酱」通过 `modification` 传递；「可乐换无糖」属于同轮零加价替换
- 到店自取 `beType=1`，后续调用无需传 `beCode`
- 限流 600 次/分钟：组合枚举等重计算放本地，只对少量候选调 `calculate-price`
- `create-order` 是真实写操作：必须由用户明确确认后触发，Skill 不自动下单
- **团购套餐**：官方 MCP 工具清单中暂无团购套餐查询能力，UI 原型中的 `GROUP_DEALS` 为演示数据；真实场景中团购信息来自美团/抖音等第三方渠道，接入时需额外对接相应开放平台

## 5. 业务价值

1. **把「吃什么」从拍脑袋变成按数据决策**：5 类餐型方案覆盖从省钱到放纵的不同目标，热量预算来自真实公式，营养指标来自 MCP 实时数据
2. **多人场景一键协调**：每人独立目标分别推荐，忌口/口味分别生效，合并一单，降低聚餐决策成本
3. **省钱链路闭环**：门店券 + 账户券 + 麦麦省券自动匹配，实时核价；预算超支自动降级并如实告知
4. **等待时间不浪费**：像素 M + 进度条 + 小恐龙跑酷小游戏，把检索等待变成品牌化互动

## 6. 真实链路实测记录（2026-10-24）

以下调用均在真实 MCP（`https://mcp.mcd.cn`，Bearer Token）上实测通过，`success:true`：

| # | Tool | 入参（要点） | 返回（要点） |
|---|---|---|---|
| 1 | `now-time-info` | — | `2026-10-24 14:44:06`，GMT+8 |
| 2 | `query-nearby-stores` | `searchType=2, city=天津市, keyword=蓟州区, beType=1` | 3 家真实门店（见下） |
| 3 | `query-meals` | `storeCode=1950564, orderType=1, beType=1` | 北京建外SOHO 店完整在售菜单（分类 + 商品编码 + 现价/原价） |
| 4 | `calculate-price` | 同店 + 麦辣鸡腿汉堡(1440)×1 + 中薯条(4810)×1 + 可乐(9900008751)×1 | 合计 4550 分 = ¥45.5；`takeWayList=[eat-in 堂食, take-in-store 外带]` |
| 5 | `create-order` | 同店 + `orderType=1, beType=1, takeWayCode=take-in-store` | **真实订单创建成功**（见下） |

**实测真实门店（已作为快照接入 `index.html` 门店页，`REAL_STORES` 表）**：

| 门店 | 地址 | MCP 距离 | storeCode | 营业时间 | 状态 |
|---|---|---|---|---|---|
| 麦当劳天津渔阳南路餐厅 | 渔阳南路16号 | 170m | 1980128 | 07:00–23:00 | 营业中 · 支持预约 |
| 麦当劳天津蓟州万达广场餐厅 | 渔阳镇溪水路6号万达广场一楼 | 3385m | 1980269 | 07:00–23:00 | 营业中 · 支持预约 |
| 麦当劳天津天一绿海得来速餐厅 | 渔阳镇翠湖东路北端东侧天一绿海城48号楼1F | 3757m | 1980278 | 07:00–23:00 | **暂停营业** · 得来速 |

> 说明：① MCP 未返回门店经纬度（`longitude/latitude` 为 0）——**该问题已解决**：先用 Photon 反解用户定位得行政区划，再用 MCP 返回的 3 个距离与 Photon 街道/地标坐标做三角交叉验证，反推出自洽的门店坐标（详见第 7 节），实时模式下门店距离改为「定位 → 门店」的真实直线距离（haversine，随移动实时变化）；② 该快照为 `beType=1`（到店自取）查询结果，**未包含麦乐送配送数据**，因此外送模式下真实门店分组自动隐藏（诚实标注，不冒充）；③ 快照带查询日期，页面明示数据来源与获取时间。

**实测真实订单（2026-10-24 14:46，用户明确要求调用 `create-order`）**：

- 订单号 `1030374810000755255084692794` · 支付 ID `111034115722323759104`
- 门店：麦当劳北京建外SOHO(A座)餐厅（1950564）· 东三环中路39号院建外SOHO-A座
- 商品：麦辣鸡腿汉堡 ¥22.5 + 中薯条 ¥13.5 + 可乐(小杯) ¥9.5 = **¥45.5**（外带，无餐具）
- 状态：待支付；支付链接 `https://m.mcd.cn/mcp/scanToPay?orderId=1030374810000755255084692794`；支付截止 15:01:41（过期自动取消）
- 结论：`create-order` 全链路（选店 → 菜单 → 核价 → 下单 → 支付链接）真实可用；UI 原型中的下单仍为**演示态**（不真实扣款），真实下单按项目约定仅在用户明确确认后由 Skill 侧发起

## 7. 实时模式：页面 + 服务端代理（2026-10-24 第十九轮）

### 7.1 为什么必须由服务端代理

`index.html` 是单文件静态页，可以 `file://` 直接打开、也可以挂到任意静态托管。MCP Token 是**私有凭证**，一旦写进页面等于公开泄露；同时浏览器直连 `https://mcp.mcd.cn` 会被 CORS 拦截。因此真实链路必须有一层服务端持有 Token：

```
┌─────────────┐  相对路径 api/*   ┌──────────────────┐  Bearer Token  ┌─────────────┐
│  index.html │ ───────────────→ │ server.js（代理） │ ─────────────→ │ mcp.mcd.cn  │
│ （无 Token） │ ←─────────────── │  （持有 Token）   │ ←───────────── │  麦当劳 MCP  │
└─────────────┘     JSON          └──────────────────┘   JSON-RPC     └─────────────┘
```

页面只发相对路径请求（`api/health`、`api/stores`、`api/menu`、`api/quote`、`api/order`），**永远不接触 Token**。未命中代理（如 `file://` 打开）时自动保持快照 + 演示模式，行为与之前完全一致。

### 7.2 服务端 `server.js`（零依赖，仅用 Node 内置 `http`）

| 端点 | 方法 | 内部调用的 MCP Tool | 返回 |
|---|---|---|---|
| `/api/health` | GET | — | `{live:true}` 表示服务端已加载 Token，页面据此进入实时模式 |
| `/api/stores?lat&lng` | GET | `query-nearby-stores` | 按定位反解出的行政区划查真实门店，补齐坐标与区域 |
| `/api/menu?store` | GET | `query-meals` | 门店在售菜单（服务端缓存） |
| `/api/quote` | POST | `calculate-price` | 麦当劳实时核价（元 + 分），含未匹配餐品说明 |
| `/api/order` | POST | `calculate-price` → `create-order` | 真实订单号 + 支付链接 `payH5Url` |

- Token 来源：`process.env.MCD_MCP_TOKEN` 或同目录 `mcp-token.txt`（已加入 `.gitignore`，且静态托管显式拦截 `.txt` 与点开头文件，Token 不会被下发）
- 下单限流：默认每 IP 每小时 3 单（`MCD_ORDER_LIMIT` 可调），防止公开链接被滥用
- MCP 错误会翻译成人话：`QUOTA / RATE / CLOSED / SOLD_OUT / UNKNOWN`

### 7.3 踩过的坑（都已在代码里固化）

1. **MCP 返回体不是纯 JSON**：`content[0].text` 是「API Response Information」Markdown 包裹 + 内嵌 JSON，直接 `JSON.parse` 必失败 → 用 `extractJson()` 做花括号配平扫描后提取。
2. **国内网络 Nominatim 不可用** → 改用 Photon（`photon.komoot.io`）反解/正向地理编码，可返回中文行政区划。
3. **MCP 门店无经纬度**：用「3 个 MCP 距离 × Photon 街道/地标坐标」三角交叉验证，取唯一自洽组合（渔阳南路 40.0434,117.4011 / 万达 40.0228,117.3716 / 天一绿海 40.0338,117.4401），误差在街道级，页面如实标注坐标来源为 OSM。
4. **演示菜单 ≠ 真实菜单**：`中薯条` 在真实菜单里叫「中薯条」但实际商品名带规格后缀、`美汁源橙汁` 含弯引号 → 用归一化名称匹配 + 子串兜底，未匹配到的餐品在核价处如实列出「该店无在售商品，未计入」。
5. **写操作必须二次确认**：点「提交订单并支付」先弹确认框，确认后才调 `create-order`。
6. **平台侧当日下单额度上限**：MCP 会返回「今日下单数已经上限」。这不是本页故障，页面会如实告知并提供「改用演示模式完成体验」，流程不被打断。

### 7.4 实时模式实测（2026-10-24）

| 项 | 结果 |
|---|---|
| 定位 | 天津市蓟州区（40.0521, 117.4011），`watchPosition` 实时跟随 |
| 门店 | MCP 实时返回 3 家，分组标题「真实门店 · 麦当劳 MCP 实时查询（天津市蓟州区）」 |
| 距离 | 967m / 3.9km / 4.1km，标注「直线距离」（定位 → 门店 haversine，随移动变化） |
| 核价 | `calculate-price` 实时返回 ¥32.0（麦麦脆汁鸡1块 + 苹果片 + 小杯鲜萃咖啡） |
| 下单 | `create-order` 成功，订单号 `1030930480000808643633772773` |
| 支付 | `payH5Url = https://m.mcd.cn/mcp/scanToPay?orderId=1030930480000808643633772773`，成功页 2 秒倒计时自动跳转，附「立即前往支付 / 留在本页」兜底 |

> 注：联调当天麦当劳 MCP 的**当日下单额度**在数次实测后触顶，此后调用返回「今日下单数已经上限」。真实下单链路（订单号 + 支付链接）已在上表中实测拿到，属平台侧限制，非本页故障。

### 7.5 回归测试

| 套件 | 用例数 | 结果 |
|---|---|---|
| `mcd_smoke_test.js`（演示模式冒烟） | 61 | 全通过 |
| `mcd_dom_test.js`（集成） | 71 | 全通过 |
| `wheel_test.js`（滚轮） | 52 | 全通过 |
| `wheel_drag_test.js`（拖拽） | 21 | 全通过 |
| `real_store_verify.js`（真实门店） | 10 | 全通过 |
| `live_e2e.js`（实时模式端到端 L1–L13） | 14 | 全通过 |
