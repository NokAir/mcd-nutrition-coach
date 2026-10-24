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
