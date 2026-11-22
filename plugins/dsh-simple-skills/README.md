# 轻量技能管理（开发版）0.5.1

轻量技能管理：不含下载市场，系统技能与项目技能只读，个人技能支持新建、编辑、切换调用方式、移入回收站、恢复和彻底删除。已有的 desktop profile 本地 link 安装需重载后才会运行新版本。

## 界面结构

- **列表页**与**新建/编辑页**分开，不再在列表下方堆叠表单：列表页显示标题、右上角主操作按钮、分类标签、搜索框和技能卡片；点技能或「新建技能」进入独立页面，页内左上「返回」回列表。
- 分类为文字式标签（系统自带 / 个人技能 / 项目技能 / 回收站），当前分类带高亮底色；搜索框带放大镜图标、占满可用宽度；无内容时显示居中空状态插图与说明。
- 「新建技能」常驻右上角，任何分类下都可直接新建（会自动切到个人技能分类，因为技能只能建在个人目录）；按钮与「刷新」完全同一尺寸：`height:32px`、字号 13px、字重 400、内边距 12px、圆角 9px、`box-sizing:border-box`，仅用品牌底色区分主次。编辑页把「保存技能」「移入回收站」放在右上角，系统技能页右上为「保存中文描述」。
- 页面内容限宽 1000px 居中，配色与字号优先读取主题 `--ds-*` 变量（缺失时回退到面板自带样式）。

## 功能

- 左侧「技能管理」原生面板入口，四个分类：系统自带 / 个人技能 / 项目技能 / 回收站；支持按名称、中文描述和原始描述搜索。
- **系统自带**：取宿主全局 `skills.snapshot` 中 `source=bundled` 的技能，只读；正文经 `skills.get` 读取。内置 8 个系统技能有中文描述；其他系统技能可手动填写中文描述覆盖，存于本插件自己的文件（`$DSH_HOME/simple-skills/descriptions.json`），留空即清除，不修改系统技能原文件。
- **个人技能**：管理 `$DSH_HOME/skills`（默认 `~/.dsh/skills`）下直接的 `.md` 文件与 `<name>/SKILL.md` 目录技能；共享、自定义目录暂不支持，因此不等于全部个人技能。
- **项目技能**：只读。取工作区注册表（`ctx.workspaceRegistry`）里每个已登记项目的路径，按 DSH 的同一规则算出项目根（含 `.git` 的最近祖先目录，否则工作区目录本身），列出 `<根>/.dsh/skills` 与 `<根>/.agents/skills` 下的技能；按项目分组显示标题与路径，点开可看只读原文。不修改项目文件，也不提供新建/删除/调用开关。
- **编辑**：分项模式填写名称、描述、正文；高级原文模式直接编辑完整 Markdown（仍要求 YAML 头部 name 与技能名一致）。两种模式各自保留草稿，保存一种前若另一种有改动会先确认。新建时名称与描述在提交前校验（小写字母、数字、短横线，≤100）。
- **防丢失**：返回列表、新建、打开其他技能前若有未保存修改会确认；页面刷新/关闭触发浏览器离开提示；保存进行中禁止编辑与切换；新建后未输入内容不算草稿。
- **调用方式（个人技能）**：两个独立开关对应 DSH 文件技能的原生 frontmatter 字段——「允许模型调用」写 `disable-model-invocation`（关闭即 `true`），「允许用户通过 / 调用」写 `user-invocable`（关闭即 `false`）；省略即默认允许。只改这两个键，保留其他字段与注释，并用修订哈希防并发覆盖。这是调用控制，**不是安全边界**，也不撤回已载入会话历史；生效依赖宿主重新扫描，正在运行的步骤或未开启 watch 时不保证即时。
- **删除**：个人技能先整体移入 `$DSH_HOME/simple-skills-trash/<uuid>/`；可在「回收站」恢复，或选择「彻底删除」并确认。彻底删除不可恢复，目录型技能的全部附件也会删除。恢复时同名已存在会拒绝，不覆盖。回收目录位于技能扫描目录之外，不会被当作技能加载。
- 不联网、不调用模型、不添加模型工具；不改系统技能文件。

## 系统技能为什么没有逐项启停

系统内置技能（如 Office 的 7 个）由各自 provider 一次注册，`modelInvocable` / `userInvocable` 在 provider 中硬编码为允许；DSH registry 没有公开的单技能启停设置接口。插件因此只显示其只读状态，不提供会误导的开关。若要影响这类技能，只能停用整个提供插件（不属于本插件的单技能开关）。

## 文件与位置

| 内容 | 位置 |
| --- | --- |
| 个人技能 | `$DSH_HOME/skills/*.md`、`$DSH_HOME/skills/<name>/SKILL.md` |
| 中文描述覆盖 | `$DSH_HOME/simple-skills/descriptions.json` |
| 回收站 | `$DSH_HOME/simple-skills-trash/<uuid>/`（`meta.json` + `payload`） |
| 项目技能（只读） | `<项目根>/.dsh/skills/*.md`、`<项目根>/.dsh/skills/<name>/SKILL.md` |
| 项目共享技能（只读） | `<项目根>/.agents/skills/*.md`、`<项目根>/.agents/skills/<name>/SKILL.md` |

## 安全措施与边界

- 新建排他写入（`wx`）；编辑使用内容哈希修订检查 + 同目录原子替换；YAML 用 `yaml` 解析并校验 `name` 与 `description`。
- 拒绝目标及全部祖先中的符号链接与 junction；恢复使用排他创建（`mkdir` / `COPYFILE_EXCL`），不覆盖同名；目录恢复失败时只回滚本次新建的目标。
- 写入串行化在单个 store 实例内；**不能**防御恶意本地进程的 TOCTOU，也不是文件权限隔离。
- 项目技能只读：`/project` 路由只接受工作区注册表里已登记的项目根（按规范化路径比对），不提供写入、删除或开关；符号链接目录按 store 的既有规则拒绝。

## 安装、卸载与验收

```powershell
$plugin = (Resolve-Path -LiteralPath '.\plugins\dsh-simple-skills').Path
pnpm --dir "$plugin" install --frozen-lockfile --ignore-scripts
dsh plugin --profile desktop add "link:$plugin"
dsh plugin --profile desktop remove dsh-simple-skills
```

宿主侧 `lib/index.js` 变更需重启 DSH 生效；客户端 `lib/client.js` 变更刷新页面后重新加载。

验收清单：左栏入口；系统技能只读且中文描述可保存/清除；个人新建、分项与原文保存、非法名称或描述被拒、并发冲突提示；两开关分别生效且保留其他 frontmatter；移入回收站后列表消失、恢复后回归且同名不覆盖；对专用测试技能验证彻底删除的取消、确认、附件删除及成功或失败提示，勿操作真实需保留的数据；项目分类按工作区分组列出 `.dsh/skills` 与 `.agents/skills` 并可只读打开；禁用后入口消失且 API 404；卸载后无残留配置。

诊断：页面根 `[data-simple-skills]`；同源 `/api/simple-skills/list|project|system|save|policy|trash|restore|delete-permanently|description`；浏览器控制台与页面错误提示。`complete=false` 表示目录读取不完整。`list` 的 `projects` 为空时，先确认该项目已在侧栏作为工作区登记（项目技能按工作区注册表枚举，不按当前会话目录猜测）。

## 测试

```powershell
node --test test/*.test.mjs
```

使用临时目录与模拟宿主 ctx，不读写真实个人技能或 profile。当前 7 个测试文件共 34 项通过，覆盖存储、目录技能附件保护、彻底删除与路径边界、中文描述、项目技能发现、路由契约、界面组件行为，以及「真实客户端代码 → 真实路由 → 临时目录真实文件」的端到端契约。
