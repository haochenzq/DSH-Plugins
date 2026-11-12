/**
 * dsh-abyss-theme —— 客户端 bundle（手写、无需构建）。
 *
 * 宿主用 window.__ModuleLoader__ 加载本文件；factory 收到一个 require。
 *
 * 三件事，全部只动样式、不碰组件逻辑：
 *   1) 用 ctx.theme.overrideTokens 把 DSH 深色配色的 token 换成「深渊」配色；
 *   2) 额外注入一份 CSS 兜底：以 body[data-ds-dark-theme] 为作用域强制声明同一批
 *      token（!important），并让外壳容器透明，底图才透得出来；
 *   3) 取底图（走 /api 路由 fetch → blob URL），铺在 html 背景上。
 *
 * 关掉底图：localStorage.setItem('abyss.wallpaper', '0') 后刷新。
 */

window.__ModuleLoader__.load({
  id: 'dsh-abyss-theme',
  factory: function () {
    var STYLE_ID = 'dsh-abyss-theme-style'
    var ROUTE = 'api/dsh-abyss-theme/'

    /**
     * 深渊 token：把 DSH 深色配色的中性色阶整体换成带海水色相的深蓝黑，
     * 品牌蓝换成 DeepSeek 的 #4D6BFE 家族，主按钮压深到白字达标的 #3A54E6。
     */
    var TOKENS = {
      // ---- 水体：中性蓝阶（深色配色的骨架） ----
      '--dsw-static-neutral-bluish-00': '#FFFFFF',
      '--dsw-static-neutral-bluish-55': '#E3ECF7',
      '--dsw-static-neutral-bluish-60': '#E6EEF9',
      '--dsw-static-neutral-bluish-75': '#DCE6F4',
      '--dsw-static-neutral-bluish-90': '#D5E0EF',
      '--dsw-static-neutral-bluish-100': '#CBD8EA',
      '--dsw-static-neutral-bluish-150': '#C2D0E2',
      '--dsw-static-neutral-bluish-200': '#B6C6DA',
      '--dsw-static-neutral-bluish-300': '#A9B8CC',
      '--dsw-static-neutral-bluish-310': '#A4B4C8',
      '--dsw-static-neutral-bluish-400': '#7C8CA0',
      '--dsw-static-neutral-bluish-500': '#5F7084',
      '--dsw-static-neutral-bluish-600': '#4E5F73',
      '--dsw-static-neutral-bluish-700': '#3D4E62',
      '--dsw-static-neutral-bluish-750': 'rgba(44, 60, 79, 0.86)',
      '--dsw-static-neutral-bluish-800': 'rgba(28, 40, 56, 0.84)',
      '--dsw-static-neutral-bluish-850': 'rgba(16, 23, 34, 0.78)',
      '--dsw-static-neutral-bluish-875': 'rgba(9, 14, 22, 0.72)',
      '--dsw-static-neutral-bluish-900': '#0A0F17',
      '--dsw-static-neutral-bluish-950': '#04060C',
      '--dsw-static-neutral-bluish-1000': '#070B12',

      // ---- 中性阶（滚动条、行内代码、多选底色） ----
      '--dsw-static-neutral-00': '#FFFFFF',
      '--dsw-static-neutral-50': '#F7F9FC',
      '--dsw-static-neutral-100': '#EDF2F8',
      '--dsw-static-neutral-150': '#E6ECF4',
      '--dsw-static-neutral-200': '#DDE5EF',
      '--dsw-static-neutral-250': '#D4DEEA',
      '--dsw-static-neutral-300': '#C7D3E1',
      '--dsw-static-neutral-400': '#A5B4C6',
      '--dsw-static-neutral-500': '#8190A3',
      '--dsw-static-neutral-550': '#6C7B8E',
      '--dsw-static-neutral-600': '#5A697C',
      '--dsw-static-neutral-700': '#455568',
      '--dsw-static-neutral-800': '#2A3A4C',
      '--dsw-static-neutral-850': '#1E2A38',
      '--dsw-static-neutral-900': '#101720',
      '--dsw-static-neutral-1000': '#000000',

      // ---- 品牌：DeepSeek 蓝 ----
      '--dsw-static-deepseek-50': '#EDF1FF',
      '--dsw-static-deepseek-100': '#E2E9FF',
      '--dsw-static-deepseek-200': '#C9D5FF',
      '--dsw-static-deepseek-300': '#A8BBFF',
      '--dsw-static-deepseek-400': '#7B93FF',
      '--dsw-static-deepseek-450': '#4D6BFE',
      '--dsw-static-deepseek-500': '#3A54E6',
      '--dsw-static-deepseek-600': '#3146C8',
      '--dsw-static-deepseek-700-delete': '#2A3AA8',
      '--dsw-static-deepseek-800': '#22306B',
      '--dsw-static-deepseek-900': '#1A2450',
      '--dsw-static-blue-500': '#4D6BFE',

      // ---- 角色 token ----
      '--dsw-alias-brand-primary': '#3A54E6',
      '--dsw-alias-brand-primary-new-colorprimary-new-color': '#4D6BFE',
      '--dsw-alias-brand-primary-invert': '#E9F0FA',
      '--dsw-alias-brand-text': '#FFFFFF',
      '--dsw-alias-label-primary-foreground': '#FFFFFF',
      '--dsw-alias-state-business-primary': '#7B93FF',
      '--dsw-alias-state-business-tertiary': '#1F2C6E',
      '--dsw-focus-ring-color': '#7B93FF',

      // ---- 分界线：一层冷光发丝线 ----
      '--dsw-alias-border-l1': 'rgba(150, 190, 230, 0.10)',
      '--dsw-alias-border-l2-darkmode-thin': 'rgba(150, 190, 230, 0.10)',
      '--dsw-alias-border-l2': 'rgba(150, 190, 230, 0.16)',
      '--dsw-alias-border-l3': 'rgba(160, 200, 240, 0.22)',
      '--dsw-alias-border-l4': 'rgba(160, 200, 240, 0.30)',
      '--dsw-alias-border-inverted': 'rgba(120, 150, 190, 0.08)',
      '--dsw-alias-border-inverted2': 'rgba(120, 150, 190, 0.10)',

      // ---- 画布与浮层 ----
      '--dsw-alias-bg-base': 'rgba(4, 6, 12, 0.42)',
      '--dsw-alias-bg-document-preview': 'rgba(7, 11, 18, 0.94)',
      '--dsw-alias-bg-overlay': 'rgba(28, 40, 56, 0.92)',
      '--dsw-alias-bg-module-platform': 'rgba(18, 26, 38, 0.92)',
      '--dsw-alias-bg-skeleton': 'rgba(150, 190, 230, 0.06)',
      '--dsw-specific-menu': 'rgba(10, 15, 23, 0.90)',
      '--dsw-alias-menu-group-header-fill': 'rgba(11, 17, 26, 0.94)',
      '--dsw-alias-toast-bg': 'rgba(18, 26, 38, 0.96)',
      '--dsw-specific-sidebar-fill': 'rgba(7, 11, 18, 0.86)',
      '--dsw-specific-sidebar-nav-item-active': 'rgba(30, 43, 61, 0.78)',
      '--dsw-specific-sidebar-nav-item-active-accent': 'rgba(24, 34, 48, 0.90)',
      '--dsw-specific-bubble': 'rgba(16, 23, 34, 0.74)',
      '--dsw-specific-bubble-highlight': 'rgba(26, 37, 51, 0.82)',
      '--dsw-specific-input-major': 'rgba(12, 18, 28, 0.74)',
      '--dsw-specific-selector': 'rgba(20, 29, 42, 0.90)',
      '--dsw-specific-tip': 'rgba(20, 29, 42, 0.96)',

      // ---- 滚动条 ----
      '--dsw-alias-scrollbar-bg-l1': 'rgba(150, 190, 230, 0.14)',
      '--dsw-alias-scrollbar-hover-l1': 'rgba(150, 190, 230, 0.24)',
      '--dsw-alias-scrollbar-bg-l2': 'rgba(150, 190, 230, 0.18)',
      '--dsw-alias-scrollbar-hover-l2': 'rgba(150, 190, 230, 0.30)',
    }

    /** 外壳里铺了不透明底面的容器（按 DSH Web 的构建类名；缺失时选择器不匹配、无副作用）。 */
    var SHELL_SURFACES = [
      '.mP3x-q_frame',
      '.mP3x-q_mainPanel',
      '.mP3x-q_centerCol',
      '.an3WzG_root',
      '.an3WzG_viewArea',
      '.an3WzG_body',
      '.an3WzG_scrollBody',
      '.V4vHZW_root',
      '.V4vHZW_frame',
      '.V4vHZW_scroll',
      '.V4vHZW_column',
    ].join(', ')

    /** 底图是否启用：localStorage 里显式写 0 才关。 */
    function wallpaperOn() {
      try {
        return window.localStorage.getItem('abyss.wallpaper') !== '0'
      } catch (error) {
        return true
      }
    }

    /** 相对 document.baseURI 解析路由（Electron 里页面可能不是 http 源）。 */
    function assetUrl(path) {
      try {
        return new URL(ROUTE + path, document.baseURI).href
      } catch (error) {
        return ROUTE + path
      }
    }

    /** 把 TOKENS 渲染成 CSS 声明块。 */
    function tokenBlock() {
      var lines = []
      for (var name in TOKENS) lines.push('  ' + name + ': ' + TOKENS[name] + ' !important;')
      return lines.join('\n')
    }

    /** 全部注入样式。 */
    function stylesheet() {
      return [
        '/* 深渊 ABYSS —— 由 dsh-abyss-theme 注入 */',
        'html {',
        '  background-color: #04060C !important;',
        '  background-image:',
        '    radial-gradient(60% 45% at 8% 6%, rgba(53, 214, 232, 0.10) 0%, rgba(77, 107, 254, 0.05) 42%, transparent 72%),',
        '    radial-gradient(52% 40% at 88% 92%, rgba(77, 107, 254, 0.10) 0%, transparent 70%),',
        '    linear-gradient(180deg, rgba(4, 6, 12, 0.55) 0%, rgba(4, 6, 12, 0.24) 42%, rgba(2, 3, 8, 0.82) 100%),',
        '    var(--abyss-wallpaper-image, none) !important;',
        '  background-size: auto, auto, auto, cover !important;',
        '  background-position: center, center, center, center 62% !important;',
        '  background-repeat: no-repeat !important;',
        '}',
        'html[data-abyss-wallpaper="off"] { background-image: none !important; }',
        'body { background-color: transparent !important; background-image: none !important; }',
        // token 兜底层：即使主题服务的覆盖时机不对，这里也按同一份 TOKENS 强制生效
        'body[data-ds-dark-theme] {',
        tokenBlock(),
        '}',
        // 外壳透出底图
        SHELL_SURFACES + ' { background-color: transparent !important; background-image: none !important; }',
        '::selection { background: rgba(77, 107, 254, 0.38); }',
      ].join('\n')
    }

    /** 写入（或更新）全局样式表。 */
    function mountStyle() {
      var existing = document.getElementById(STYLE_ID)
      if (existing !== null) existing.remove()
      var style = document.createElement('style')
      style.id = STYLE_ID
      style.textContent = stylesheet()
      document.head.appendChild(style)
      document.documentElement.setAttribute('data-abyss-wallpaper', wallpaperOn() ? 'on' : 'off')
      return style
    }

    /**
     * 底图加载：CSS 的 url() 不经过宿主 fetch 拦截，/api 路由只能由 fetch 访问，
     * 所以先 fetch 成 blob，再把 blob URL 交给 CSS 变量。
     */
    var wallpaperObjectUrl = null
    function loadWallpaper(diag) {
      if (!wallpaperOn()) {
        document.documentElement.style.removeProperty('--abyss-wallpaper-image')
        if (diag) diag.wall = 'off'
        return
      }
      if (typeof fetch !== 'function') {
        if (diag) diag.wall = 'no-fetch'
        return
      }
      fetch(assetUrl('wallpaper.png'), { credentials: 'same-origin' }).then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status)
        return response.blob()
      }).then(function (blob) {
        if (wallpaperObjectUrl !== null) URL.revokeObjectURL(wallpaperObjectUrl)
        wallpaperObjectUrl = URL.createObjectURL(blob)
        document.documentElement.style.setProperty('--abyss-wallpaper-image', 'url("' + wallpaperObjectUrl + '")')
        if (diag) {
          diag.wall = 'ok'
          diag.wallBytes = blob.size
          try { window.localStorage.setItem('abyss.diag', JSON.stringify(diag)) } catch (error) { /* 忽略 */ }
        }
      }).catch(function (error) {
        if (diag) {
          diag.wall = 'error: ' + (error && error.message ? error.message : String(error))
          try { window.localStorage.setItem('abyss.diag', JSON.stringify(diag)) } catch (inner) { /* 忽略 */ }
        }
        console.warn('[dsh-abyss-theme] 底图加载失败：', error)
      })
    }

    /** 插件入口。 */
    function apply(ctx) {
      var style = mountStyle()
      var disposers = []
      var diag = {}

      loadWallpaper(diag)

      if (ctx.theme !== void 0 && typeof ctx.theme.overrideTokens === 'function') {
        try {
          var pairs = {}
          for (var tokenName in TOKENS) {
            pairs[tokenName] = { light: TOKENS[tokenName], dark: TOKENS[tokenName] }
          }
          var offOverride = ctx.theme.overrideTokens('dsh-abyss-theme', pairs)
          if (typeof offOverride === 'function') disposers.push(offOverride)
          diag.overrides = true
        } catch (error) {
          diag.overrideError = String(error && error.message ? error.message : error)
          console.warn('[dsh-abyss-theme] 覆盖 token 失败：', error)
        }
        try {
          // 深渊是深色主题：偏好切到内置 dark（持久化），保证 data-ds-dark-theme 存在。
          ctx.theme.setTheme('dark')
          diag.dark = true
        } catch (error) {
          diag.darkError = String(error && error.message ? error.message : error)
        }
      } else {
        diag.themeMissing = true
      }

      try {
        window.localStorage.setItem('abyss.applied', String(Date.now()))
        window.localStorage.setItem('abyss.diag', JSON.stringify(diag))
      } catch (error) {
        /* 隐私模式等场景忽略 */
      }

      // 生命周期：插件卸载 / HMR 重载时把样式与主题一起撤掉。
      if (typeof ctx.effect === 'function') {
        ctx.effect(function () {
          return function () {
            while (disposers.length > 0) {
              try {
                disposers.pop()()
              } catch (error) {
                /* 卸载阶段忽略 */
              }
            }
            if (style !== null && style.parentNode !== null) style.remove()
          }
        }, 'dsh-abyss-theme: stylesheet and theme')
      }
    }

    return { name: 'abyss-theme', apply: apply, inject: ['theme'] }
  },
})
