# DSH Plugins

DeepSeek Harness（DSH）本地插件源码与安装说明。

| 插件 | 版本 | 功能 |
| --- | --- | --- |
| [OpenAI 接入](plugins/dsh-openai-access/README.md) | 0.2.1 | 模型选择、请求调度、限流重试与生图 |
| [轻量技能管理](plugins/dsh-simple-skills/README.md) | 0.5.1 | 浏览系统和项目技能，管理个人技能与回收站 |
| [轻量记忆](plugins/dsh-light-memory/README.md) | 0.2.0 | 本地记忆与个性化设置 |
| [AI 用量与余额](plugins/dsh-openai-usage/README.md) | 0.5.0 | 查看本地用量与已配置服务的账户数据 |
| [火山语音与 MediaKit](plugins/dsh-volc-services/README.md) | 0.1.0 | 豆包语音识别及可选的本机 MediaKit 接入 |
| [浏览器授权衔接](plugins/dsh-browser-handoff/README.md) | 0.1.0 | 将当前 DSH 的访问授权交给专用自动化浏览器 |
| [专用自动化浏览器](plugins/dsh-agent-browser/README.md) | 0.1.1 | 配置独立 Chromium 和 Playwright MCP |
| [DSH Codex Bridge](plugins/dsh-codex-bridge/README.md) | 0.7.0 | 与 Codex 主聊天当轮双向收发文字，DSH 窗口显示完整往返与回执 |
| [DSH 会话桥](plugins/dsh-session-bridge/README.md) | 0.2.0 | DSH 会话之间跨工作区即时通信与自主协作 |

## 安装

在 Windows 上使用 DeepSeek Harness Desktop。可在 DSH 的插件管理器使用 `link:<插件目录的绝对路径>` 安装。使用命令行时，在仓库根目录运行下列命令，以轻量记忆为例。

~~~powershell
$dsh = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
$plugin = (Resolve-Path -LiteralPath '.\plugins\dsh-light-memory').Path
& $dsh plugin --profile desktop add "link:$plugin"
~~~

专用自动化浏览器和 Codex 桥接的安装步骤见上表。桥接使用的 [codex-to-dsh 技能](https://github.com/haochenzq/Codex-skills/tree/main/codex-to-dsh) 在 Codex-skills 仓库维护。轻量技能管理依赖 YAML 解析库，按插件说明先安装依赖。
