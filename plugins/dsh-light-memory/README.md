# dsh-light-memory

轻量、**纯本地**的 DeepSeek Harness 插件：一个「个性化」设置页 + 一组记忆工具。不联网、不调用模型、无第三方依赖。

## 设置页：个性化

### 全局 AGENTS.md

直接编辑用户级指令文件，保存即时写盘：

| 项 | 值 |
|---|---|
| 路径 | `$DSH_HOME/AGENTS.md`（默认 `~/.dsh/AGENTS.md`） |
| 上限 | 256 KiB，超限拒绝并报错 |
| 备份 | 覆盖前自动写同目录 `AGENTS.md.bak` |
| 生效 | 新会话立即生效；已开会话需刷新或重开 |

### 记忆库

平铺展示全部记忆，按更新时间倒序，**每条三个动作**：

| 元素 | 作用 |
|---|---|
| 「注入 / 不注入」勾选框 | 该条是否自动注入到每次对话的系统提示 |
| 正文 + 标签 + 时间 | 阅读用 |
| 「删除」 | 直接删除该条，无回收站 |

顶部一个输入框 + 「新增」按钮：输入一句话即新增一条（默认不注入）。提交换行可直接新增。

同一句话重复新增不会堆积：正文完全相同的记录只更新时间；若此时勾了注入，注入标记会被保留/开启。

## 自动注入真的生效

勾选「注入」的记忆，会被注册成一段系统提示（`ctx.systemPrompt.section`，name `light-memory:injected`）：

```
以下是用户明确标记为「自动注入」的长期记忆，来自本地记忆库。
把它们当作背景事实；与当前任务冲突时以当前对话为准。
- 第二条：主题在 themes/dsh-abyss-theme-design
```

- **默认关闭**：新记忆不会自己进提示词，必须显式勾选
- **预算**：最多 30 条、每条截断 160 字符、整段上限 3000 字符，超出按更新时间截断
- **没有可注入项时返回空串**，宿主不渲染该段，不占上下文
- 每次写盘（页面或工具）都会刷新缓存，下一轮请求即生效

## Agent 工具

| 工具 | 参数 | 作用 |
|---|---|---|
| `memory_save` | `text`, `tags?` | 写入记忆；正文相同则更新时间 |
| `memory_search` | `query?`, `tags?`, `limit?` | 字面检索（子串 +5、词元 +2、标签 +1） |
| `memory_list` | `limit?` | 按更新时间列出 |
| `memory_forget` | `id` | 按完整 id 或唯一前缀删除 |

记忆**全局共享**，不区分工作区：任何会话、任何工作区看到同一份。

## 存储

默认 `$DSH_HOME/light-memory/memories.json`。未设置 `DSH_HOME` 时使用 `~/.dsh/light-memory/memories.json`。

```json
{
  "version": 1,
  "records": [
    { "id": "uuid", "text": "…", "tags": ["约定"], "inject": true, "createdAt": "…", "updatedAt": "…" }
  ]
}
```

- 原子写入（临时文件 + rename），读改写串行排队
- 单条 2000 字符上限；记录超 5000 条时丢弃最久未更新的
- 旧文件遗留的 `scope` / `workspace` 字段被忽略，不影响检索

## 接口

前缀 `/api/dsh-personalization`，注册在 `ctx.connection.fetch` 上，由宿主做 cookie 鉴权（未认证 401、非 owner 403）。

| 方法 | 路径 | 作用 |
|---|---|---|
| GET | `/state` | 指令文件 + 全部记忆 + 注入统计 |
| PUT | `/agents-md` | 保存指令文件 `{id, content}` |
| POST | `/memories/add` | 新增 `{text, inject?}` |
| PATCH | `/memories/inject` | 切换注入 `{id, inject}` |
| DELETE | `/memories?id=` | 删除一条 |
| GET | `/memories?query=&limit=` | 检索（工具/脚本用） |

前端必须用 document 相对地址（Electron 下页面可能是 `file://`）：
`new URL('api/dsh-personalization/state', document.baseURI)`。

## 安装与生效

```bash
$plugin = (Resolve-Path -LiteralPath '.\plugins\dsh-light-memory').Path
dsh plugin --profile desktop add "link:$plugin"
```

改了 `package.json` 的 `dsh.client` 或 `lib/client.js` 后**需重启 DSH**；只改宿主侧代码时，插件行重挂载即可。

## 配置

`cordis.patch.yml`：

| 字段 | 说明 |
|---|---|
| `dir` | 记忆存储目录（绝对路径）；留空用 `$DSH_HOME/light-memory` |
| `searchLimit` | 检索/列表默认条数，上限 50 |

## 实现说明

- 不导入任何 `@deepseek-ai/*` 包
- 客户端 bundle 手写 `window.__ModuleLoader__.load({id, factory})` classic script，无需构建；只 `require('react')`
- 设置分区：`ctx.slots.inject('settings.section', ...)`，`id: 'personalization'`、`order: 40`
- 宿主行与浏览器半区来自同一包同一行：`dsh.bundle.patch` 提供 Loader 行，`dsh.client.platform: "web"` + `exports["./client"]` 提供前端
- 路由必须走 `ctx.connection.fetch.register`；`ctx.webServer.register` 没有鉴权

## 已知限制

- 不做语义检索：换说法可能搜不到，靠标签兜底
- 不加密：JSON 明文，别写密钥、口令
- 注入是"全量带入"，不做相关性筛选；条目多时请只勾关键几条
- 页面没有撤销删除、没有批量操作
