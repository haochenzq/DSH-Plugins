# DSH 的 OpenAI 模型接入

DSH Desktop `0.2.2-rc.1` 已启用 `@local/dsh-openai-access` `0.2.1`。OpenAI 原生模型菜单按以下顺序显示。

| 显示名称 | OpenAI API ID |
| --- | --- |
| GPT-6 Astra | `gpt-6-astra` |
| GPT-6.1 Sol | `gpt-6.1-sol` |
| GPT-6.1 Terra | `gpt-6.1-terra` |
| GPT-6 Luna | `gpt-6-luna` |

其他支持 Responses API 的 OpenAI GPT 和 o 系列文本模型由 DSH 的 `consult_openai_model` 工具按 ID 调用。可在 DSH 对话中说“请用 `gpt-6-sol` 对下面这段内容给个意见”，再附上允许发送的内容。工具保持当前会话模型，向 OpenAI 发送显式提供的文本，单次限制 2,048 输出令牌。

在 DSH 对话中要求用 OpenAI 生图时，`generate_openai_image` 用 GPT Image 2.5 Flare 生成一张 1024×1024 图片，并把它保存为原生会话附件。插件在「对话」页的该轮回复末尾接入 DSH 原生图库，直接读取会话中已有的成功生图记录。

插件与原生模型配置均复用 DSH 宿主可见的 `OPENAI_API_KEY`。配置和插件目录只保存变量名与模型资料。菜单的本地诊断见运行副本旁的 `status.local.json`。

## 维护

在仓库根目录将插件链接到 DSH Desktop。菜单名单维护在本目录的 `cordis.patch.yml`。桌面已有自定义 `llm-pi-ai` 配置时，请检查它是否覆盖插件提供的模型配置。

~~~powershell
$plugin = (Resolve-Path -LiteralPath '.\plugins\dsh-openai-access').Path
dsh plugin --profile desktop add "link:$plugin"
~~~

当前使用基线为 `0.2.1`，包含动态调度。后续出现实际问题时，按日志定位，修复并验证后再更新版本。上下文压缩沿用 DSH 原有机制。

移除使用 `dsh plugin --profile desktop remove @local/dsh-openai-access`。

## 原生对话限流

OpenAI 原生对话遇到 `RATE_LIMIT` 时，插件将错误文字中的等待时间交给 DSH 原生重试器。缺少等待提示时，从 2 秒起按指数退避。单次自动等待上限为 60 秒。使用已安装的 DSH 适配器和重试器验证了 10 个场景，并通过本机模拟 429 确认服务端要求等待 1.4 秒时才发出第二次 HTTP 请求、要求等待 65 秒时结束自动重试。

## 并发请求调度

2026-11-12 加入动态调度。插件用 DSH 已有的 token 统计估算请求大小，额度够就发。大请求等待时，较小的请求可以使用剩余额度。每个等待的大请求最多让出本地预算的 15%，之后优先为它积累额度。停止任务会取消尚未发出的请求。

本机调度参考 [OpenAI 的标准 Build 限额](https://developers.openai.com/api/docs/guides/rate-limits)，为 Astra、Sol、Terra 合用一组 100 万 TPM 的预算，为 Luna 使用独立的 200 万 TPM 预算，每组留出 10% 余量。这是本机的调度设定，实际组织和项目额度以 OpenAI 返回为准。遇到带额度明细的 TPM 限流时，按服务端报告收紧本地剩余额度。其他限流按服务端提示等待。本机调度覆盖四款原生对话模型及工具中对这四款模型的调用。

已用桌面所带 DSH 适配器与本机模拟端点核验短请求先行、大请求最终放行、取消等待、模型组隔离和 429 后的调度。桌面重新启动后，`status.local.json` 已报告 `requestScheduling: true`，并返回四款模型。
