# dsh-abyss-theme · 深渊 ABYSS

DeepSeek Harness Web 界面的深色主题插件。概念：**深海寻光**（DeepSeek = 深 + 寻）。
配色与底图来自 `themes/dsh-abyss-theme-design/` 设计稿（[theme.css](../../themes/dsh-abyss-theme-design/theme.css) 是 token 源头）。

- **配色**：通过 `ctx.theme.register` 覆盖 DSH 的 `--dsw-*` token（深色配色），不动任何组件 DOM。
- **底图**：OpenAI `gpt-image-2.5-flare` 生成的深海底图（鲸身由发光粒子构成），以三层压暗铺在文档画布后面。
- **离线**：底图由本插件自己的 `/api/dsh-abyss-theme/*` 路由提供（走宿主 cookie 鉴权），不联网、不调用模型。

## 安装（本地 link）

```powershell
$plugin = (Resolve-Path -LiteralPath '.\plugins\dsh-abyss-theme').Path
dsh plugin --profile desktop add "link:$plugin"
```

安装后重启 DeepSeek Harness（或刷新界面）生效。

## 排查

- 刷新一次界面（`Ctrl+R`）后仍未变色：看 `localStorage` 里有没有 `abyss.applied`（主题脚本跑过）与 `abyss.diag`（注册/底图结果）。
- 底图不出现但配色生效：说明 `fetch` 拿到底图后，外壳容器把背景盖住了 —— 本包已把 DSH 外壳容器（`.mP3x-q_frame` 等）置透明；这些哈希类名随构建变化，升级 DSH 后需要按新类名补一条选择器。
- 临时关底图排查：`localStorage.setItem('abyss.wallpaper', '0')` 后刷新，只剩纯深海底色。

## 已知限制

- 只覆盖 token 与外壳背景，不改任何组件逻辑；DSH 大版本升级后 token 名或类名可能变动。
- 会把外观偏好设为内置 `dark`（持久化），因为深渊是深色主题。
- 「极夜 / 关闭底图」目前靠 `localStorage` 切换，暂未做设置页 UI。

## 配置

`cordis.patch.yml` 里的 `config.wallpaper`：

- `true`（默认）：深海配色 + 鲸鱼底图。
- `false`：只换配色，底图路由返回 404，界面为纯深海底色。

浏览器端也可以随时关掉底图：开发者工具里执行
`localStorage.setItem('abyss.wallpaper', '0')` 后刷新；改回 `'1'` 恢复。

## 卸载

```powershell
dsh plugin --profile desktop remove dsh-abyss-theme
```

## 文件

```
dsh-abyss-theme/
├─ package.json        dsh.bundle.patch + dsh.client.platform = web
├─ cordis.patch.yml    插到 profile 配置树的那一行
├─ lib/index.js        宿主侧：注册底图资源路由
├─ lib/client.js       客户端：注册主题 token + 注入底图样式
└─ assets/
   ├─ wallpaper.png    压暗模糊版底图（界面用）
   └─ deepseek-abyss.png 原图（高清，供其它场景）
```

## 附：主题要点（与设计稿一致）

| 项 | 值 |
| --- | --- |
| 主文字 | `#E9F0FA`（对 `#04060C` 17.7:1） |
| 次文字 / 说明 | `#A9B8CC`（10.1:1）/ `#7C8CA0`（5.6:1） |
| 品牌蓝 | `#4D6BFE`；主按钮底 `#3A54E6`（白字 5.85:1），品牌亮度交给外发光 |
| 水体 | `#04060C → #070B12 → #0A0F17 → #101925 → #16212E → #1F2D3E` |
| 分界线 | 冷光发丝线 `rgba(150,190,230,.10 → .30)` |
| 焦点环 | `#7B93FF` |
