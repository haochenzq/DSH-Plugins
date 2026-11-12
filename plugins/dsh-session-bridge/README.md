# DSH 会话桥

让同一 DSH 实例里的两个独立会话跨工作区通信。消息在接收方当前轮的下一步送达，也能唤醒空闲或尚未打开的会话。

## 使用

- 单次消息可以说「给『整理资料』会话发消息，请它告诉我整理进度」。
- 持续协作可以说「和『整理资料』会话协作，核对两份清单并汇总差异」。发起后双方自主推进，插件没有轮数、时长或消息条数上限。
- 目标完成、需要用户处理权限或阻塞、用户叫停时，协作结束并给出状态。协作状态保存在 DSH 进程内。

| 工具 | 用法 |
| --- | --- |
| `session_bridge_peers` | 列出会话 ID、标题、工作区和状态 |
| `session_bridge_send` | 用 `session` 和 `message` 发送一条消息。目标可以是完整 ID、唯一前缀或唯一标题 |
| `session_bridge_reply` | 用 `message` 回复消息。协作消息可传 `collaborationId` 指定对应协作 |
| `session_bridge_converse` | 用 `target` 和 `objective` 发起持续协作，返回协作 ID |
| `session_bridge_finish` | 用 `status` 结束协作。状态为 `done`、`blocked` 或 `stopped`。提供 `summary` 说明结果或阻塞，多项协作时还需指定 `collaborationId` |

## 安装

在 Windows 上使用 DeepSeek Harness Desktop。在仓库根目录运行下列命令，再重新打开 DSH。

~~~powershell
$dsh = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
$plugin = (Resolve-Path -LiteralPath '.\plugins\dsh-session-bridge').Path
& $dsh plugin --profile desktop add "link:$plugin" --offline --ignore-scripts
~~~

也可在 DSH 插件管理器选择此插件的目录。卸载时运行 `dsh plugin --profile desktop remove dsh-session-bridge`，然后重新打开 DSH。

## 配置

| 配置 | 默认值 | 行为 |
| --- | --- | --- |
| `requireSameWorkspace` | `false` | 设为 `true` 后只允许同一工作区通信 |
| `allowColdSessions` | `true` | 允许恢复尚未打开的会话 |
| `wakeTarget` | `true` | 原生插话或唤醒空闲会话。设为 `false` 时投递消息，由目标下一步读取 |
| `maxHops` | `0` | 普通消息的可选跳数上限，`0` 表示不限 |
| `maxSendsPerMinute` | `0` | 普通消息的可选每分钟条数上限，`0` 表示不限 |
| `maxMessageChars` | `8000` | 单条消息的字符上限 |
| `peerLimit` | `20` | 会话列表默认返回条数 |

## 验证

0.2.0 已在桌面验证跨工作区普通消息、持续协作往返 10 跳、遇阻结束、用户叫停和拒绝叫停后的回复。在本插件目录运行 9 项自动测试。

~~~powershell
node --test
~~~
