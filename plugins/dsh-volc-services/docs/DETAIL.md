# 火山豆包语音与 MediaKit

本插件把两项本机已有的火山引擎能力接入 DSH，不复制密钥，也不改动其它插件。

## 豆包语音识别（DSH 语音输入）

- 注册名为 `doubao-cloud` 的云端识别器，作为语音输入的可选识别器出现，默认选择保持安装前的本地 SenseVoice 不变。
- 录音由浏览器采集为 16 kHz 单声道 PCM16 WAV，完整录音以 base64 内联发送到火山官方极速语音识别接口（资源 `volc.bigasr.auc_turbo`），只取回文字。不先上传媒体、不生成持久任务，DSH 也不保存音频或转写历史。
- 识别器无需下载模型，安装后即为 ready。本地 SenseVoice 识别器仍保留，可在语音设置里随时切回。
- 语音凭据优先读取宿主的 `VOLC_ASR_API_KEY`，也支持显式配置的本机文件。

## MediaKit 工具

- 复用本机现有 MediaKit 入口（VideoTools 的 Python 运行时 + `run_api.py mediakit_server`），以 stdio 连接，工具名前缀 `mcp__volcmediakit__`：
  - `mediakit_connection_status`：只读检查本地凭据配置，不联网。
  - `mediakit_upload_media`：把明确指定的本地媒体上传到 MediaKit（默认保留 30 天）。
  - `mediakit_submit_task` / `mediakit_query_task`：提交并查询 `asr-subtitles`、`transcode-audio`、`extract-audio`、`video-ocr`、`call-maas-proxy` 任务。
  - `mediakit_analyze_video`：MediaKit 视觉对话，仅画面、不含音轨。
- MediaKit 凭据由所配置的本机 MediaKit 运行器管理。

## 范围与限制

- 移除本插件会撤销语音识别器。若另行配置了 MediaKit，移除桌面补丁中的 `volc-mediakit-mcp` 条目即可停用该接入。
- 语音识别会把这段录音发送到火山云端；需要完全离线时请切回本地 SenseVoice。
- MediaKit 上传是向火山服务的显式操作，会产生存储/处理计费；工具不会自动重试或自动重传。
- 云端计费与账单口径由火山控制台为准，本插件不提供余额或账单展示。
