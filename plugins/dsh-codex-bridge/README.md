# DSH 和 Codex 双向聊天

Windows 上的本机桥接。两边每次选择一个已有会话。消息出现在目标会话的原生聊天里，来源显示为「【Codex】」或「【DSH】」。

## 使用

- Codex → DSH。在 Codex 告知 DSH 对话标题或会话 ID。标题同名时按工作区核对。文字、图片和普通文件通过 DSH 原生即时发送模式交给目标会话。
- DSH → Codex。纯文字用 `reply_to_codex`，附件用 `send_to_codex`。本轮有唯一授权目标时优先使用该目标，本轮没有目标时使用唯一已配对的 Codex 会话。有多个可选目标时，用 `send_to_codex` 指定其中一个链接或 ID。附件必须来自本 DSH 会话且已获授权，填写真实的附件 ID 和来源序号。

Codex 发给指定 DSH 会话的消息被接受后，桥会保存双方会话的配对。用户也可在 DSH 中明确选择一个 Codex 会话，发送成功后建立配对。配对保存在本机，重启 DSH 后仍可用于主动发送文字和附件。`--reply-to` 指向另一个 Codex 会话时只指定本次回复路径。

双方对话即时发送。空闲会话开启新一轮，活跃会话在当前轮接收输入，可能影响正在进行的工作。桌面端已持有的 Codex 会话由桌面端直接接收，未加载的会话先恢复，再发送。Codex 回执 `sent` 包含消息 ID 和轮次 ID，表示接受了本次输入。实际处理情况以接收会话为准。

### DSH 回传的载荷

| 载荷 | Codex 接收方式 |
| --- | --- |
| 纯文字 | 原生文字输入 |
| 普通文件 | 原生文字输入，附上已校验的 DSH 本机原文件路径及 SHA-256 |
| 原生图片 | 原生图片输入 |

连接 Codex 本机服务失败且尚未提交时，自动启动服务并重连一次。附件无效则报告错误。回执不明时先查目标会话，避免重复发送。

共同任务开始时约定目标、范围、分工和验收。双方在有可核对的阶段结果、下一步或真正的阻塞时主动联系。Codex 可在运行期间直接回读 DSH 原会话并继续推进。达到验收条件后停止发送，单纯的收件确认不产生新任务。

## 安装

在 Windows 上使用 DeepSeek Harness Desktop、Codex Desktop 和 Node.js 24。配套技能从固定的本机目录调用桥接客户端。请在仓库根目录执行。

~~~powershell
$source = (Resolve-Path -LiteralPath '.\plugins\dsh-codex-bridge').Path
$packages = Join-Path $env:LOCALAPPDATA 'DSH Codex Bridge\packages'
$package = Join-Path $packages '0.6.7'
if (-not (Test-Path -LiteralPath $package)) {
  New-Item -ItemType Directory -Path $packages -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $package -Recurse
}
$dsh = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
& $dsh plugin --profile desktop add "link:$package" --offline --ignore-scripts
~~~

如果版本目录已经存在，先核对它的来源。重新打开 DSH Desktop 并确认「Codex 会话协作」启用。将此版本的 [codex-to-dsh 配套技能](skill-package/codex-to-dsh)目录放入 `~/.codex/skills`，再按技能说明选择目标会话。

## 验证

0.6.7 已在桌面验证跨轮主动回传文字、原生 PNG 和普通文件引用。长轮次按实际轮次边界核对来源。在本插件目录可运行 14 项自动测试。

~~~powershell
node --test
~~~
