# 火山语音与 MediaKit

DSH 语音输入可选择「豆包语音（火山引擎）」在线转写录音。MediaKit 工具可按需接入已配置的本机 stdio 服务。

## 豆包语音

1. 让 DSH 宿主进程可以读取环境变量 `VOLC_ASR_API_KEY`。如需改用本机文件，在 `speech-to-text-doubao` 配置中填写 `credentialFile` 的绝对路径，以及可选的 `credentialLine`（从 1 开始）和 `credentialPrefix`（默认空字符串）。环境变量优先。
2. 在仓库根目录将插件链接到桌面 profile。

~~~powershell
$plugin = (Resolve-Path -LiteralPath '.\plugins\dsh-volc-services').Path
dsh plugin --profile desktop add "link:$plugin"
~~~

3. 在 DSH 语音输入设置中选用 `doubao-cloud`。录音将发送到火山引擎的在线语音识别接口。需要本地识别时可在同一设置中选回本地识别器。

## MediaKit

已有支持 `run_api.py mediakit_server` 的运行器时，在[示例配置](docs/mediakit.patch.example.yml)中填写其 Python 和入口脚本绝对路径，再把示例中的插件条目加入桌面 profile 的补丁。服务由读者自行配置并提供凭据，插件包只内置语音识别器。[接口与计费说明](docs/DETAIL.md)
