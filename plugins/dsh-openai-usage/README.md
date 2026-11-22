# dsh-openai-usage

在 DSH 左侧栏底部显示 DeepSeek、OpenAI 和火山引擎的余额。点击入口打开「AI 用量与余额」。

## 功能

- **DeepSeek 余额（官方）**：通过 DSH 账户服务的 `getBalance` 读取平台充值钱包与赠送钱包余额（通常为 CNY），登录 DSH 账户即可显示；未登录时明确提示。
- **OpenAI 估算余额**：先在 OpenAI 标签配置 Admin key，再录入账单页显示的当前余额。录入时同步官方花费基准，此后用该基准的变化额自动扣减；例：余额 $200、基准花费 $15，花费增至 $20 后估算余额为 $195。卡片显示初始余额、花费变化和同步时间；侧栏标记「估算」。旧快照没有花费基准，需重新录入。
- **本机 token 统计（双供应商）**：按日、按供应商、按模型累计输入/输出/缓存读/缓存写与请求数。数据来自 DSH 的 `llm/stream` usage chunk（`deepseek-account`、`deepseek-official`、`openai` 等所有路由都会记录）以及本地 OpenAI 访问工具上报的 usage。落在 `$DSH_HOME/openai-usage/usage.json`，schema 2 会自动迁移旧 schema 1 数据。
- **OpenAI 账户级官方数据（可选）**：配置只读 Admin key 后，显示本月花费、本月 tokens 与请求数（Costs + usage API），并展开**本月每日花费曲线**（悬停看当天花费与 token）与**本月按模型官方明细**（请求/输入/输出/缓存读）。
- **DeepSeek 峰谷用量**：按请求完成时间把 DeepSeek 用量分成「谷时 / 峰时」（默认谷时 00:30–08:30 北京时间，即 DeepSeek 优惠时段），面板显示近 30 天占比条与各自的 tokens；窗口可用 `DSH_AI_USAGE_OFFPEAK=HH:MM-HH:MM` 覆盖。升级前的历史记录未区分峰谷。
- **火山引擎官方数据**：费用中心的资金账户可用余额（CNY）、方舟指定项目本月输入和输出 token、请求数、按日图和按模型表。按日图是仿方舟控制台的输入/输出双序列面积折线图；分区标题旁的状态徽标显示已同步 / 部分同步失败 / 未配置。豆包语音和 AI MediaKit 采用费用中心已出账数据，显示官方计费项、原始用量单位和应付金额。按账单中的产品名称识别两种服务。
- **侧栏底部入口**位于账号菜单上方。折叠侧栏时为图标按钮。
- **面板**含「全部 / DeepSeek / OpenAI / 火山引擎」标签。「全部」展示本机 DSH token，火山标签展示有权查看的官方账户和项目数据。

## 口径与限制

- token 只统计**这台机器上的 DSH**发起的请求（DeepSeek 账户/官方 API、OpenAI 路由、其它已注册供应商归入「其它」），不含网页、其它应用、其它设备。
- DeepSeek 余额来自官方账户接口（充值 + 赠送钱包），货币以接口返回为准；OpenAI 不提供余额接口，余额是手动录入减去同一组织的官方 Costs 花费变化，不是真实余额。官方出账可能延迟，录入前产生但后来出账的费用也可能被扣减。充值、赠金、退款或组织变更后请重新校准；更换或清除 Admin key 会使旧基准失效。
- OpenAI 花费按录入时所在 UTC 日至当前的官方日桶累计，并以当时累计值为基准，支持跨月及分页；会话侧栏或面板打开时最多每 10 分钟同步一次，手动刷新可强制同步。同步失败保留上次估算并标明错误；没有 Admin key 或旧快照缺少基准时不显示估算余额。
- 官方花费（OpenAI Costs）与本地 token 是两个口径，不保证互相换算一致。
- 数据只由本插件写入，单进程串行；不做多实例并发保护。

## 安装

开发期 link 安装（等价于在 profile 的 `dependencies` 加 `link:`）：

```powershell
$plugin = (Resolve-Path -LiteralPath '.\plugins\dsh-openai-usage').Path
dsh plugin --profile desktop add "link:$plugin"
```

或在插件管理页选择「添加插件」并指向本目录。安装后重启 DSH，左侧栏底部出现「AI 用量」，首次打开自动读取。

## 环境变量（可选）

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DSH_OPENAI_USAGE_ADMIN_KEY` | `OPENAI_ADMIN_API_KEY` | 存放 OpenAI Admin key 的凭据名（先读 DSH 凭据库，再读同名环境变量） |
| `DSH_OPENAI_USAGE_ADMIN_REFRESH_MINUTES` | `10` | OpenAI 官方数据缓存分钟数 |
| `DSH_AI_USAGE_OFFPEAK` | `00:30-08:30` | DeepSeek 谷时窗口（本地时间），支持跨零点如 `22:00-06:00` |
| `DSH_VOLCENGINE_ARK_PROJECT` | `default` | 方舟官方 token 用量的项目名 |
| `VOLCENGINE_ACCESS_KEY`、`VOLCENGINE_SECRET_KEY` | 空 | 可选的现成火山 IAM 凭据引用或环境变量 |

火山 IAM 可在「火山引擎」标签输入并保存到 DSH 凭据库 `VOLCENGINE_USAGE_IAM`。使用有权查询 `billing:QueryBalanceAcct`、`billing:ListBillDetail` 和 `ark:GetInferenceUsage` 的只读 IAM 密钥。豆包语音、MediaKit 和方舟推理的业务 API Key 用于调用服务。查询时三项独立返回结果，自动同步间隔为 10 分钟。若某项临时失败，仍显示该项最后成功的数据和时间。账单数据随出账更新。

## 验证步骤

1. 重启 DSH 后，左侧栏底部（账号菜单上方）出现「AI 用量」，右侧显示余额（DeepSeek 已登录时显示 `¥…`，OpenAI 有快照时显示 `$…`）。
2. 点开面板：DeepSeek 余额卡显示充值余额（及非零赠送余额）；OpenAI 卡显示估算余额或提示录入。旧快照升级后需要重新录入。
3. 用 DeepSeek 模型跑一次会话，刷新面板后「今日」与「按模型」应增加，且底部「全部」tab 的合计包含 DeepSeek。
4. 切换到 OpenAI tab，配置只读 Admin key 后录入当前余额；确认卡片及侧栏显示估算余额、基准和同步时间。稍后点「刷新」，核对估算值 = 录入余额 −（当前累计花费 − 录入时累计花费）；官方账单有延迟，不要求立即变化。
5. 数据文件路径显示在面板底部，可直接读取 `%USERPROFILE%\.dsh\openai-usage\usage.json` 核对（schemaVersion=2）。
6. 打开火山标签保存只读 IAM 密钥，核对侧栏和卡片的人民币余额，检查方舟本月计数及语音、MediaKit 账单用量。清除已保存凭据后，有现成环境凭据时会恢复使用该凭据。

## 排查

- **DeepSeek 余额显示「未登录」**：在 设置 → 账户 登录 DSH 账号后重开面板；余额读取失败时卡片会显示错误原因。
- **面板空白 / 读不到数据**：确认插件已启用；浏览器控制台看 `/api/openai-usage/summary` 是否 404/401；宿主重启后需重新加载客户端模块。
- **OpenAI Admin 同步报 401/403**：key 不是 Admin key 或不属于该组织；不影响本地用量与余额快照。
- **火山某项同步失败**：检查该 IAM 用户对相应接口和方舟项目的权限。浏览器端可检查 `/api/openai-usage/volcengine` 的各项状态。
- **数据文件损坏**：插件以空数据启动并写日志；删除 `usage.json` 可重置（会丢历史统计）。
- **数字比 dashboard 小/大**：正常——只统计 DSH 本机来源；DeepSeek 余额是账户钱包，不是本机用量换算。
