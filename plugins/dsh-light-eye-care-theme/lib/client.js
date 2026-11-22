/* 色值来源：themes/dsh-abyss-theme-design/theme.css 的 --ds-light-*。 */
window.__ModuleLoader__.load({
  id: 'dsh-light-eye-care-theme',
  factory: function () {
    var THEME_ID = 'dsh-light-eye-care-theme'
    // 此表与设计文件逐项一致；所有 DSH token 只引用这里的色值。
    var PALETTE = {
      'base': '#F5F6F2',
      'sidebar': '#EFF1EB',
      'surface': '#FAFBF8',
      'secondary-surface': '#F0F3ED',
      'selection': '#DBE9DF',
      'selection-strong': '#CFDFD5',
      'text': '#343A36',
      'text-secondary': '#505C54',
      'text-tertiary': '#566159',
      'text-disabled': '#858D84',
      'accent': '#83A995',
      'accent-ink': '#203C2D',
      'accent-hover': '#346349',
      'blue': '#668FC7',
      'blue-ink': '#315F9B',
      'blue-soft': '#E3ECF7',
      'border': '#E4E8E0',
      'border-strong': '#7E8C7F',
      'success': '#3D7355',
      'success-soft': '#E2F0E5',
      'warn': '#805712',
      'warn-soft': '#F6ECD9',
      'error': '#9B4949',
      'error-soft': '#F7E7E5',
      'inverse-surface': '#343A36',
      'inverse-text': '#FAFBF8',
      'scrollbar': '#C4CFC2',
      'scrollbar-hover': '#A9B7AA',
    }
    var TOKENS = {
      '--dsw-alias-bg-base': PALETTE.base,
      '--dsw-alias-bg-layer-1': PALETTE.surface,
      '--dsw-alias-bg-layer-2': PALETTE['secondary-surface'],
      '--dsw-alias-bg-layer-3': PALETTE.selection,
      '--dsw-alias-bg-overlay': PALETTE.surface,
      '--dsw-alias-bg-module-platform': PALETTE['secondary-surface'],
      '--dsw-alias-bg-multi-select': PALETTE.selection,
      '--dsw-alias-bg-document-preview': PALETTE.surface,
      '--dsw-alias-label-document-preview': PALETTE['text-secondary'],
      '--dsw-alias-border-l1': PALETTE.border,
      '--dsw-alias-border-l2': PALETTE['border-strong'],
      '--dsw-alias-border-l3': PALETTE['border-strong'],
      '--dsw-alias-border-l4': PALETTE['border-strong'],
      '--dsw-alias-border-selected': PALETTE['border-strong'],
      '--dsw-alias-label-primary': PALETTE.text,
      '--dsw-alias-label-primary-dimmed': PALETTE.text,
      '--dsw-alias-label-secondary': PALETTE['text-secondary'],
      '--dsw-alias-label-tertiary': PALETTE['text-tertiary'],
      '--dsw-alias-label-caption': PALETTE['text-tertiary'],
      '--dsw-alias-label-dimmed': PALETTE['text-disabled'],
      '--dsw-alias-label-primary-foreground': PALETTE['inverse-text'],
      '--dsw-alias-label-on-color': PALETTE['inverse-text'],
      '--dsw-alias-brand-primary': PALETTE.success,
      '--dsw-alias-brand-primary-new-colorprimary-new-color': PALETTE['blue-ink'],
      '--dsw-alias-brand-primary-invert': PALETTE.text,
      '--dsw-alias-brand-text': PALETTE.text,
      '--dsw-alias-button-primary-fill': PALETTE.success,
      '--dsw-alias-button-primary-hover': PALETTE['accent-hover'],
      '--dsw-alias-button-primary-dimmed': PALETTE.selection,
      '--dsw-alias-button-info-fill': PALETTE['blue-ink'],
      '--dsw-alias-button-info-hover': PALETTE['blue-ink'],
      '--dsw-alias-link': PALETTE['blue-ink'],
      '--dsw-focus-ring-color': PALETTE['blue-ink'],
      '--dsw-alias-state-business-primary': PALETTE['blue-ink'],
      '--dsw-alias-state-business-tertiary': PALETTE['blue-soft'],
      '--dsw-alias-state-success-primary': PALETTE.success,
      '--dsw-alias-state-success-secondary': PALETTE.success,
      '--dsw-alias-state-success-tertiary': PALETTE['success-soft'],
      '--dsw-alias-state-warn-label': PALETTE.warn,
      '--dsw-alias-state-warn-primary': PALETTE.warn,
      '--dsw-alias-state-warn-tertiary': PALETTE['warn-soft'],
      '--dsw-alias-state-error-primary': PALETTE.error,
      '--dsw-alias-state-error-secondary': PALETTE.error,
      '--dsw-alias-card-fill': PALETTE['secondary-surface'],
      '--dsw-alias-card-fill-hover': PALETTE.selection,
      '--dsw-alias-markdown-code-block': PALETTE['secondary-surface'],
      '--dsw-alias-markdown-code-block-banner': PALETTE['secondary-surface'],
      '--dsw-alias-markdown-inline-code': PALETTE['secondary-surface'],
      '--dsw-alias-scrollbar-bg-l1': PALETTE.scrollbar,
      '--dsw-alias-scrollbar-bg-l2': PALETTE.scrollbar,
      '--dsw-alias-scrollbar-hover-l1': PALETTE['scrollbar-hover'],
      '--dsw-alias-scrollbar-hover-l2': PALETTE['scrollbar-hover'],
      '--dsw-alias-interactive-bg-hover': PALETTE['secondary-surface'],
      '--dsw-alias-interactive-bg-hover-solid': PALETTE['secondary-surface'],
      '--dsw-alias-interactive-bg-active': PALETTE.selection,
      '--dsw-specific-sidebar-fill': PALETTE.sidebar,
      '--dsw-specific-sidebar-nav-item-active': PALETTE.selection,
      '--dsw-specific-sidebar-nav-item-active-accent': PALETTE['selection-strong'],
      '--dsw-specific-bubble': PALETTE.selection,
      '--dsw-specific-bubble-highlight': PALETTE['selection-strong'],
      '--dsw-specific-input-major': PALETTE.surface,
      '--dsw-specific-selector': PALETTE['secondary-surface'],
      '--dsw-specific-tip': PALETTE['secondary-surface'],
      '--dsw-specific-menu': PALETTE.surface,
      '--dsw-menu-surface-fill': PALETTE.surface,
      '--dsw-alias-menu-group-header-fill': PALETTE.surface,
    }

    function apply(ctx) {
      ctx.effect(function () {
        // 不读取或写入用户偏好；仅观察运行时解析出的 light/dark 色彩方案。
        var pairs = {}
        for (var name in TOKENS) pairs[name] = { light: TOKENS[name], dark: TOKENS[name] }
        var active = false
        var disposed = false
        var scheduled = false
        var removeOverride = null
        var style = null

        function removeStyle() {
          if (style) style.remove()
          style = null
          if (typeof document !== 'undefined' && document.body) document.body.removeAttribute('data-dsh-light-eye-care')
        }
        function mountStyle() {
          if (typeof document === 'undefined' || !document.head || !document.body) return
          style = document.createElement('style')
          style.dataset.plugin = THEME_ID
          style.textContent = '@media (prefers-reduced-motion: no-preference) {' +
            'body[data-dsh-light-eye-care] :where(button, a, [role="button"]) {' +
            'transition: color 140ms ease-out, background-color 140ms ease-out, border-color 140ms ease-out, box-shadow 140ms ease-out;' +
            '} }'
          document.head.appendChild(style)
          document.body.setAttribute('data-dsh-light-eye-care', '')
        }
        function reportError(error) {
          console.error('[dsh-light-eye-care-theme] 主题覆盖失败：', error)
        }
        // 不在 theme/change 广播内部产生嵌套广播：旧 snapshot 可能后写入 presenter。
        // 合并同一轮的通知，并在广播结束后读取当前主题的实际方案。
        function scheduleSync() {
          if (disposed || scheduled) return
          scheduled = true
          Promise.resolve().then(function () {
            scheduled = false
            if (disposed) return
            var wanted = ctx.theme.getTheme().active.colorScheme === 'light'
            if (wanted === active) return
            active = wanted
            if (wanted) {
              var off
              try {
                off = ctx.theme.overrideTokens(THEME_ID, pairs)
              } catch (error) {
                active = false
                throw error
              }
              // 另一个监听器可能在注册广播中卸载本插件。
              if (disposed) { Promise.resolve().then(off).catch(reportError); return }
              removeOverride = off
              mountStyle()
            } else {
              removeStyle()
              var previous = removeOverride
              removeOverride = null
              if (previous) previous()
            }
          }).catch(reportError)
        }
        var stopListening = ctx.on('theme/change', scheduleSync)
        scheduleSync()
        return function () {
          disposed = true
          stopListening()
          active = false
          removeStyle()
          var previous = removeOverride
          removeOverride = null
          // 卸载也可能发生在广播中；旧 layer 的 disposer 自带来源身份保护。
          if (previous) Promise.resolve().then(previous).catch(reportError)
        }
      }, 'light-eye-care: theme and interaction styles')
    }
    return { name: 'light-eye-care-theme', inject: ['theme'], apply: apply }
  },
})
