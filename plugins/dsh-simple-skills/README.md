# 轻量技能管理

版本 0.1.1。系统技能描述支持中文显示，个人技能描述保留原文。

- 左侧「技能管理」原生面板入口，系统自带 / 个人技能两类、搜索、正文浏览。
- 系统技能取宿主全局 skills.snapshot，source=bundled，只读；不冒充当前会话或预设专属目录。
- 个人技能管理 `$DSH_HOME/skills`（默认用户 .dsh/skills）的直接 `.md` 文件与 `<name>/SKILL.md` 目录技能；共享、项目技能暂不支持，不能称为全部个人技能。
- 支持新建与编辑；无删除与启停。新建不覆盖已有文件；编辑使用内容哈希与同目录原子替换。使用 YAML 解析器校验 name、description，保留原文，拒绝祖先链接/junction 与越界。不是针对恶意本地进程的无竞态安全隔离。
- 已通过 Node 语法检查与临时目录存储测试：新建、目录型编辑、重复拒绝、并发冲突、路径越界、无效元数据。测试未读写真实个人技能。
- 已在桌面端验证技能列表、中文描述、搜索、只读正文和插件启停。个人技能保存通过临时目录后端测试。
- 不联网、不调用模型、不添加模型工具。不改系统技能文件。

## 安装与卸载

在仓库根目录安装依赖，再把插件链接到 DSH。

```powershell
$plugin = (Resolve-Path -LiteralPath '.\plugins\dsh-simple-skills').Path
pnpm --dir "$plugin" install --frozen-lockfile
dsh plugin --profile desktop add "link:$plugin"
```

卸载时运行下列命令。

```powershell
dsh plugin --profile desktop remove dsh-simple-skills
```

挂载配置为空，无自定义目录。安装后刷新既有 DSH 页面；不开替代服务。
在仓库根目录运行 `node --test plugins/dsh-simple-skills/test/store.test.mjs` 验证存储。
诊断：页面根 `[data-simple-skills]`；同源 `/api/simple-skills/list`；浏览器控制台与页面错误提示。注册表 complete=false 显示不完整；全局目录可能没有预设专属系统技能。
