# 专用自动化浏览器

本配置使用 Playwright MCP 和独立的 Chromium 用户数据目录，向 DSH 注册 **agent_browser**。适用于 DSH Desktop 0.2.2-rc.1，可配合[浏览器授权衔接](../dsh-browser-handoff/README.md)使用。

[配置文件](bundle/cordis.patch.yml)保留了现行启动参数和独立 Chromium 的配置，路径使用通用 Windows 示例。安装时按文件中的「可替换」标记填写本机实际路径。

| 位置 | 填写内容 |
| --- | --- |
| command | Node.js 可执行文件 |
| args 第一项 | 安装后的 Playwright MCP 的 cli.js |
| --executable-path 后一项 | 专用 Chromium 的可执行文件 |
| --user-data-dir 后一项 | 专用 Chromium 的用户数据目录 |
| --output-dir 后一项 | 浏览器输出目录 |
| cwd | Playwright MCP 的工作目录 |
| env.PLAYWRIGHT_BROWSERS_PATH | Playwright 的浏览器存放目录 |

在仓库根目录安装锁定版本的 Playwright MCP。

~~~powershell
$plugin = (Resolve-Path -LiteralPath '.\plugins\dsh-agent-browser').Path
npm --prefix "$plugin" ci
~~~

将配置中的 cwd 填为上面的插件目录，将第一项 args 填为该目录下安装的 Playwright MCP 入口。核对其余路径后，在同一个终端链接安装。

~~~powershell
$dsh = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
$bundle = Join-Path $plugin 'bundle'
& $dsh plugin --profile desktop add "link:$bundle"
~~~

保留专用用户数据目录的隔离。使用既有浏览器安装时，填入该安装的可执行文件路径。安装后在 DSH 中核对 agent_browser 工具可用。
