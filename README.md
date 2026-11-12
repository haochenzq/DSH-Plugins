# DSH Plugins

DeepSeek Harness（DSH）本地插件源码与安装说明。

| 插件 | 版本 | 功能 |
| --- | --- | --- |
| [OpenAI 接入](plugins/dsh-openai-access/README.md) | 0.2.1 | 模型选择、请求调度、限流重试与生图 |
| [轻量技能管理](plugins/dsh-simple-skills/README.md) | 0.1.1 | 浏览系统技能，管理个人技能 |
| [轻量记忆](plugins/dsh-light-memory/README.md) | 0.2.0 | 本地记忆与个性化设置 |
| [深空探索 Cosmos](plugins/dsh-cosmos-theme/README.md) | 0.2.0 | 可切换场景与动效的宇宙主题 |
| [深渊 ABYSS](plugins/dsh-abyss-theme/README.md) | 0.1.0 | 深海配色与鲸鱼底图 |
| [浏览器授权衔接](plugins/dsh-browser-handoff/README.md) | 0.1.0 | 将当前 DSH 的访问授权交给专用自动化浏览器 |
| [专用自动化浏览器](plugins/dsh-agent-browser/README.md) | 0.1.0 | 配置独立 Chromium 和 Playwright MCP |
| [DSH Codex Bridge](plugins/dsh-codex-bridge/README.md) | 0.6.7 | DSH 和 Codex 之间双向传送消息与附件，支持保存会话配对 |
| [DSH 会话桥](plugins/dsh-session-bridge/README.md) | 0.2.0 | DSH 会话之间跨工作区即时通信与自主协作 |

## 安装

在 Windows 上使用 DeepSeek Harness Desktop。可在 DSH 的插件管理器使用 `link:<插件目录的绝对路径>` 安装。使用命令行时，在仓库根目录运行下列命令，以深空探索为例。

~~~powershell
$dsh = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
$plugin = (Resolve-Path -LiteralPath '.\plugins\dsh-cosmos-theme').Path
& $dsh plugin --profile desktop add "link:$plugin"
~~~

专用自动化浏览器和 Codex 桥接有各自的安装步骤，见上表。深空探索和深渊建议只启用一个主题。轻量技能管理依赖 YAML 解析库，按插件说明先安装依赖。
