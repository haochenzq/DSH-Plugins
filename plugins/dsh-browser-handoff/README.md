# 浏览器授权衔接

Host-only 本地插件。为已请求连接当前 DSH 的用户提供 `dsh_browser_connect({})`，从 `webApp.getAdvertisedUrl()` 获取当前地址，限定干净的 HTTP 127.0.0.1 根路径，经官方 `connection.authenticatedUrl` 直接交给当前可执行的 `agent_browser` 导航工具。不是认证绕过，不读取凭据、日志或浏览器 profile。

## 安装 / 使用 / 撤销

使用插件管理器 install_bundle 安装本目录绝对路径。默认配置 `{}`，无持久化 token 和无远程资源。DSH >=0.2.2-rc.1 <0.3.0。先安装[专用自动化浏览器](../dsh-agent-browser/README.md)，并在当前会话启用其 `agent_browser` 工具。

用户要求连接后调用 `dsh_browser_connect`，然后用 browser_snapshot 验证实际页面。仅 handoff-complete 不能证明已加载。重启 DSH 后端口变化时重新连接，不缓存端口。工具不会自动运行，也不修改原有导航工具。

停用或移除 `dsh-browser-handoff` 即移除连接工具；已授予浏览器的官方 Cookie 仍遵循 DSH 自身有效期，卸载插件不撤销它。需要终止该浏览器授权时由用户清除此专用浏览器站点数据。不要因此清理用户私人浏览器。

## 安全与诊断

仅允许当前进程宣告的 127.0.0.1 HTTP 根地址；拒绝远程 authority、自定义路径、查询和 hash。只绑定现有 browser_navigate 工具，尊重该 Agent 的可执行工具集和同步 guards，不注册通用代理工具。此工具本身作为独立授权操作走正常工具调用入口。Host-only，无客户端注入，lib/client.js 仅为项目包结构约定保留。

返回 browser-tool-unavailable：当前会话未启用对应 MCP；browser-navigation-denied：存在 guard 拒绝；handoff-failed：浏览器调用失败，错误被抑制以避免回显认证链接。普通返回只含状态与干净地址，不回传底层工具结果。token 在 MCP 导航进程中短暂使用，该进程属于受信任授权接收方；不承诺第三方浏览器内部无历史或日志。

显示资源为原创 SVG 与中英文 meta；插件设置行图标须实测。真实验收：401 → 连接 → 干净 URL 下 DSH snapshot 正常 → 刷新仍正常。禁止以单纯工具登记认定连接成功。
