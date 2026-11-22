# DSH 与 Codex 文字通话

在普通 Codex 主聊天里粘贴一个 DSH 会话 ID，Codex 会在当前轮次发起配对。DSH 窗口保留双方的消息原文及发件状态。一个 DSH 会话同时只连接一个 Codex 主聊天。共享本机文件或图片时，把绝对路径写在正文中。

## 安装 0.7.0

需要 Windows、DeepSeek Harness Desktop、Codex Desktop 和 Node.js 24。在本仓库根目录运行以下 PowerShell 命令。若要更新同名安装，先备份其中的本地修改。

~~~powershell
$source = (Resolve-Path -LiteralPath '.\plugins\dsh-codex-bridge').Path
$package = Join-Path $env:LOCALAPPDATA 'DSH Codex Bridge\packages\0.7.0'
New-Item -ItemType Directory -Path $package -Force | Out-Null
$manifest = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $source 'package.json') | ConvertFrom-Json
foreach ($entry in @('package.json') + $manifest.files) {
  $destination = Join-Path $package (Split-Path -Parent $entry)
  New-Item -ItemType Directory -Path $destination -Force | Out-Null
  Copy-Item -Path (Join-Path $source $entry) -Destination $destination -Force -ErrorAction Stop
}
$dsh = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
& $dsh plugin --profile desktop add "link:$package" --offline --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'DSH 插件安装失败。' }
node (Join-Path $package 'configure-hooks.js')
if ($LASTEXITCODE -ne 0) { throw 'Codex 钩子配置失败。' }
~~~

1. 从 Codex-skills 仓库把完整的 `codex-to-dsh` 目录复制到 Codex 用户技能目录，默认是 `~/.codex/skills`。若设置了 `CODEX_HOME`，目标是其下的 `skills` 目录。[配套 Codex 技能](https://github.com/haochenzq/Codex-skills/tree/main/codex-to-dsh)
2. 在 Codex 的 `/hooks` 中审阅并信任本次安装目录的 `turn-channel.js`。安装器将 `UserPromptSubmit`、`PreToolUse`、`PostToolUse`、`Stop`、`Interrupt` 五项命令合并到用户级配置，修改已有配置时会保留备份。从旧版升级时，检查并停用仍指向旧版安装目录的桥接钩子。
3. 等 DSH 当前工作结束，正常退出后重新打开 DSH Desktop。打开普通 Codex 主聊天，粘贴目标 DSH 会话 ID。配对成功回执中的版本应为 `0.7.0`。

## 使用和验收

让 Codex 发一句带换行的文字，在 DSH 原会话核对全文。让 DSH 使用 `reply_to_codex(message)` 回一句不同的文字，在同一 DSH 窗口检查发件原文及“Codex 已接收”状态，再到 Codex 当前聊天核对回信。断线或轮次结束后需重新配对。

配对由技能订阅本机事件。已有连接上，Codex 也可使用客户端向该 DSH 会话发送文字。每条新消息使用独立的请求 UUID。

~~~powershell
$bridge = Join-Path $env:LOCALAPPDATA 'DSH Codex Bridge\packages\0.7.0\client.js'
node $bridge send '<DSH 会话 ID>' ([guid]::NewGuid().ToString()) '请查看本机文件 C:\Example\notes.txt。'
~~~

在本插件源码目录运行 `node --test`，可验证配对、即时收发、断开、聊天显示和钩子安装。
