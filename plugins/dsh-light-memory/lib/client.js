/**
 * 「个性化」设置页的客户端 bundle。
 *
 * 手写、无需构建：宿主用 window.__ModuleLoader__ 加载本文件，
 * factory 收到一个 require，可解析 react 与宿主客户端包。
 * 这里只用 react，UI 全部内联样式，避免依赖宿主组件库的版本差异。
 *
 * 页面能力：
 *   1. 编辑全局 AGENTS.md（用户级 $DSH_HOME、共享级 $DSH_AGENTS_HOME）
 *   2. 管理本地记忆库（检索、新增、删除），与 memory_* 工具共享同一份数据
 *
 * 数据来自同源接口 /api/dsh-personalization/*，不联网、不调用模型。
 */

window.__ModuleLoader__.load({
  id: 'dsh-light-memory',
  factory: function (require) {
    var react = require('react')
    var h = react.createElement
    var useState = react.useState
    var useEffect = react.useEffect
    var useCallback = react.useCallback

    /**
     * 接口地址。必须用 document 相对路径：Electron 里页面可能以 file:// 加载，
     * 绝对路径 /api/... 会指错源。宿主对 /api 前缀统一做 cookie 鉴权。
     */
    function endpoint(path) {
      return new URL('api/dsh-personalization' + path, document.baseURI).href
    }

    /** 最近一次请求的诊断信息，页面底部可见，便于排查"空白页"。 */
    var diagnosis = { url: '', status: 0, body: '', error: '' }

    /** fetch 封装：统一 JSON、统一错误信息。同源请求自动带鉴权 cookie。 */
    function call(path, options) {
      var init = options || {}
      init.headers = Object.assign({ 'content-type': 'application/json' }, init.headers || {})
      init.credentials = 'same-origin'
      var url = endpoint(path)
      diagnosis.url = url
      return fetch(url, init).then(function (response) {
        return response.text().then(function (text) {
          diagnosis.status = response.status
          diagnosis.body = String(text).slice(0, 300)
          diagnosis.error = ''
          var data
          try { data = text === '' ? {} : JSON.parse(text) } catch (error) { data = { ok: false, error: '响应不是 JSON' } }
          if (!response.ok || data.ok === false) {
            throw new Error(data.error || ('HTTP ' + response.status))
          }
          return data
        })
      }).catch(function (error) {
        diagnosis.error = String(error && error.message ? error.message : error)
        throw error
      })
    }

    var styles = {
      wrap: { display: 'flex', flexDirection: 'column', gap: '20px', padding: '4px 0 32px' },
      card: { border: '1px solid var(--dsh-border, rgba(127,127,127,.28))', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' },
      title: { margin: 0, fontSize: '14px', fontWeight: 600 },
      hint: { margin: 0, fontSize: '12px', opacity: 0.65, lineHeight: 1.5 },
      row: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
      textarea: { width: '100%', minHeight: '220px', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '12.5px', lineHeight: 1.6, padding: '10px', borderRadius: '8px', border: '1px solid var(--dsh-border, rgba(127,127,127,.35))', background: 'var(--dsh-input-bg, transparent)', color: 'inherit' },
      input: { flex: '1 1 220px', minWidth: '160px', padding: '7px 10px', borderRadius: '8px', border: '1px solid var(--dsh-border, rgba(127,127,127,.35))', background: 'var(--dsh-input-bg, transparent)', color: 'inherit', fontSize: '13px' },
      button: { padding: '7px 14px', borderRadius: '8px', border: '1px solid var(--dsh-border, rgba(127,127,127,.35))', background: 'var(--dsh-button-bg, rgba(127,127,127,.12))', color: 'inherit', cursor: 'pointer', fontSize: '13px' },
      primary: { padding: '7px 14px', borderRadius: '8px', border: '1px solid transparent', background: '#4c8bf5', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
      danger: { padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(220,80,80,.5)', background: 'transparent', color: '#e05656', cursor: 'pointer', fontSize: '12px' },
      error: { color: '#e05656', fontSize: '12px', margin: 0 },
      ok: { color: '#2f9e44', fontSize: '12px', margin: 0 },
      item: { display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--dsh-border, rgba(127,127,127,.18))' },
      switchWrap: { display: 'flex', alignItems: 'center', gap: '6px', flex: '0 0 auto', cursor: 'pointer', paddingTop: '2px' },
      checkbox: { width: '15px', height: '15px', cursor: 'pointer', margin: 0 },
      switchLabel: { fontSize: '11.5px', opacity: 0.75, whiteSpace: 'nowrap' },
      itemText: { flex: 1, fontSize: '13px', lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
      meta: { fontSize: '11.5px', opacity: 0.6, marginTop: '3px' },
      tab: function (active) {
        return {
          padding: '5px 12px',
          borderRadius: '999px',
          border: '1px solid ' + (active ? '#4c8bf5' : 'var(--dsh-border, rgba(127,127,127,.35))'),
          background: active ? 'rgba(76,139,245,.14)' : 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          fontSize: '12.5px',
        }
      },
    }

    /** 全局 AGENTS.md 编辑卡片。 */
    function InstructionsCard(props) {
      var targets = props.targets
      var activeId = props.activeId
      var setActiveId = props.setActiveId
      var active = targets.filter(function (t) { return t.id === activeId })[0] || targets[0]
      var draftState = useState('')
      var draft = draftState[0]
      var setDraft = draftState[1]
      var savedState = useState('')
      var saved = savedState[0]
      var setSaved = savedState[1]
      var statusState = useState(null)
      var status = statusState[0]
      var setStatus = statusState[1]
      var busyState = useState(false)
      var busy = busyState[0]
      var setBusy = busyState[1]

      useEffect(function () {
        if (!active) return
        setDraft(active.content)
        setSaved(active.content)
        setStatus(null)
      }, [activeId, active && active.updatedAt])

      if (!active) return h('div', { style: styles.card }, h('p', { style: styles.hint }, '正在读取指令文件…'))

      var dirty = draft !== saved
      var bytes = new TextEncoder().encode(draft).length

      function save() {
        setBusy(true)
        setStatus(null)
        call('/agents-md', { method: 'PUT', body: JSON.stringify({ id: active.id, content: draft }) })
          .then(function (result) {
            setSaved(draft)
            setStatus({ kind: 'ok', text: '已保存 ' + result.bytes + ' 字节' + (result.backup ? '，旧内容备份到同目录 .bak' : '') })
            if (props.onSaved) props.onSaved()
          })
          .catch(function (error) { setStatus({ kind: 'error', text: '保存失败：' + error.message }) })
          .then(function () { setBusy(false) })
      }

      return h('section', { style: styles.card },
        h('h3', { style: styles.title }, '全局 AGENTS.md'),
        h('p', { style: styles.hint },
          '这里写的内容会在每个会话开始时就加载，属于用户级指令。',
          '保存后对新会话生效；已打开的会话需要刷新或重开。',
        ),
        h('p', { style: styles.hint },
          active.path + (active.exists ? '（已存在）' : '（尚未创建，保存后新建）'),
        ),
        h('textarea', {
          style: styles.textarea,
          value: draft,
          spellCheck: false,
          placeholder: '# 全局规范\n\n例如：\n- 回答用中文，代码注释用英文\n- 改文件前先读文件\n',
          onChange: function (event) { setDraft(event.target.value) },
        }),
        h('div', { style: styles.row },
          h('button', { style: Object.assign({}, styles.primary, (busy || !dirty) ? { opacity: 0.5, cursor: 'default' } : {}), disabled: busy || !dirty, onClick: save }, busy ? '保存中…' : (dirty ? '保存' : '已保存')),
          h('button', { style: styles.button, disabled: !dirty || busy, onClick: function () { setDraft(saved) } }, '撤销修改'),
          h('span', { style: styles.hint }, bytes + ' 字节 / 上限 ' + Math.floor(props.maxBytes / 1024) + ' KiB'),
        ),
        status ? h('p', { style: status.kind === 'ok' ? styles.ok : styles.error }, status.text) : null,
      )
    }

    /** 记忆库管理卡片：全部平铺，每条可切换自动注入或删除。 */
    function MemoriesCard(props) {
      var itemsState = useState(props.items || [])
      var items = itemsState[0]
      var setItems = itemsState[1]
      var injectableState = useState(props.injectable || 0)
      var injectable = injectableState[0]
      var setInjectable = injectableState[1]
      var textState = useState('')
      var text = textState[0]
      var setText = textState[1]
      var statusState = useState(null)
      var status = statusState[0]
      var setStatus = statusState[1]
      var busyState = useState(false)
      var busy = busyState[0]
      var setBusy = busyState[1]
      var pendingState = useState({})
      var pending = pendingState[0]
      var setPending = pendingState[1]

      /** 重新拉取全部记忆（平铺，不检索）。 */
      var load = useCallback(function () {
        return call('/state')
          .then(function (data) {
            setItems(data.memories || [])
            setInjectable(data.memory ? data.memory.injectable || 0 : 0)
          })
          .catch(function (error) { setStatus({ kind: 'error', text: '读取失败：' + error.message }) })
      }, [])

      function add() {
        if (text.trim() === '') return
        setBusy(true)
        setStatus(null)
        call('/memories/add', { method: 'POST', body: JSON.stringify({ text: text.trim() }) })
          .then(function (data) {
            setText('')
            setStatus({ kind: 'ok', text: data.created ? '已新增一条记忆' : '同内容记忆已存在，已更新时间' })
            return load()
          })
          .catch(function (error) { setStatus({ kind: 'error', text: '新增失败：' + error.message }) })
          .then(function () { setBusy(false) })
      }

      function remove(id) {
        setBusy(true)
        call('/memories?id=' + encodeURIComponent(id), { method: 'DELETE' })
          .then(function () { setStatus({ kind: 'ok', text: '已删除' }); return load() })
          .catch(function (error) { setStatus({ kind: 'error', text: '删除失败：' + error.message }) })
          .then(function () { setBusy(false) })
      }

      /** 切换某条的自动注入；先本地乐观更新，失败再回滚。 */
      function toggleInject(item, next) {
        setPending(Object.assign({}, pending, { [item.id]: true }))
        setItems(items.map(function (current) {
          return current.id === item.id ? Object.assign({}, current, { inject: next }) : current
        }))
        call('/memories/inject', { method: 'PATCH', body: JSON.stringify({ id: item.id, inject: next }) })
          .then(function (data) {
            setInjectable(data.injectable || 0)
            setStatus({ kind: 'ok', text: next ? '已加入自动注入' : '已取消自动注入' })
          })
          .catch(function (error) {
            setItems(items.map(function (current) {
              return current.id === item.id ? Object.assign({}, current, { inject: !next }) : current
            }))
            setStatus({ kind: 'error', text: '切换失败：' + error.message })
          })
          .then(function () {
            var nextPending = Object.assign({}, pending)
            delete nextPending[item.id]
            setPending(nextPending)
          })
      }

      return h('section', { style: styles.card },
        h('h3', { style: styles.title }, '记忆库'),
        h('p', { style: styles.hint },
          '共 ' + items.length + ' 条，其中 ' + injectable + ' 条会自动注入到每次对话的系统提示。',
          '全局共享：任何工作区、任何会话都能看到；与 memory_save / memory_search 共用同一份本地 JSON。',
        ),
        h('div', { style: styles.row },
          h('input', {
            style: styles.input,
            value: text,
            placeholder: '新增一条记忆，例如：本项目用 pnpm',
            onChange: function (event) { setText(event.target.value) },
            onKeyDown: function (event) { if (event.key === 'Enter') add() },
          }),
          h('button', { style: Object.assign({}, styles.primary, busy ? { opacity: 0.5 } : {}), disabled: busy || text.trim() === '', onClick: add }, '新增'),
        ),
        status ? h('p', { style: status.kind === 'ok' ? styles.ok : styles.error }, status.text) : null,
        h('div', null,
          items.length === 0
            ? h('p', { style: styles.hint }, '还没有任何记忆。上面输入一句话即可新增。')
            : items.map(function (item) {
              var isPending = pending[item.id] === true
              return h('div', { key: item.id, style: styles.item },
                h('label', { style: styles.switchWrap, title: '自动注入：勾选后每次对话都会带上这条记忆' },
                  h('input', {
                    type: 'checkbox',
                    checked: item.inject === true,
                    disabled: isPending,
                    style: styles.checkbox,
                    onChange: function (event) { toggleInject(item, event.target.checked) },
                  }),
                  h('span', { style: styles.switchLabel }, item.inject === true ? '注入' : '不注入'),
                ),
                h('div', { style: styles.itemText },
                  item.text,
                  h('div', { style: styles.meta },
                    (item.tags && item.tags.length > 0) ? item.tags.join(', ') + ' · ' : '',
                    String(item.updatedAt || '').slice(0, 16).replace('T', ' '),
                  ),
                ),
                h('button', { style: styles.danger, disabled: busy, onClick: function () { remove(item.id) } }, '删除'),
              )
            }),
        ),
      )
    }

    /** 渲染诊断面板：把"空白页"变成可读的状态。 */
    function Diagnostics(props) {
      return h('section', { style: Object.assign({}, styles.card, { opacity: 0.8 }) },
        h('h3', { style: styles.title }, '诊断'),
        h('pre', {
          style: { margin: 0, fontSize: '11px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-all', opacity: 0.8 },
        }, [
          '接口地址: ' + (diagnosis.url || '(尚未请求)'),
          'HTTP 状态: ' + (diagnosis.status || '(无)'),
          '错误: ' + (diagnosis.error || '(无)'),
          '响应片段: ' + (diagnosis.body || '(空)'),
          'baseURI: ' + String(document.baseURI),
        ].join('\n')),
      )
    }

    /** 错误边界：组件内部抛错时显示错误，而不是留下空白。 */
    function Boundary(props) {
      var errorState = useState(null)
      var error = errorState[0]
      var setError = errorState[1]
      useEffect(function () {
        function onError(event) {
          var reason = event && (event.error || event.reason)
          setError(String(reason && reason.stack ? reason.stack : (reason && reason.message ? reason.message : reason)))
        }
        window.addEventListener('error', onError)
        window.addEventListener('unhandledrejection', onError)
        return function () {
          window.removeEventListener('error', onError)
          window.removeEventListener('unhandledrejection', onError)
        }
      }, [])
      if (error !== null) {
        return h('div', { style: styles.wrap },
          h('p', { style: styles.error }, '页面渲染出错'),
          h('pre', { style: { fontSize: '11px', whiteSpace: 'pre-wrap', opacity: 0.8 } }, String(error)),
          h(Diagnostics, null),
        )
      }
      return props.children
    }

    /** 整页。 */
    function PersonalizationSection() {
      var stateState = useState(null)
      var state = stateState[0]
      var setState = stateState[1]
      var errorState = useState(null)
      var error = errorState[0]
      var setError = errorState[1]
      var activeIdState = useState('global')
      var activeId = activeIdState[0]
      var setActiveId = activeIdState[1]

      var load = useCallback(function () {
        call('/state')
          .then(function (data) { setState(data); setError(null) })
          .catch(function (failure) { setError(failure && failure.message ? failure.message : String(failure)) })
      }, [])

      useEffect(function () { load() }, [load])

      if (error !== null) {
        return h('div', { style: styles.wrap },
          h('p', { style: styles.error }, '无法读取个性化数据：' + error),
          h('button', { style: styles.button, onClick: load }, '重试'),
          h(Diagnostics, null),
        )
      }
      if (state === null) {
        return h('div', { style: styles.wrap },
          h('p', { style: styles.hint }, '加载中…'),
          h(Diagnostics, null),
        )
      }

      return h(Boundary, null,
        h('div', { style: styles.wrap },
          h(InstructionsCard, {
            targets: state.instructions,
            activeId: activeId,
            setActiveId: setActiveId,
            maxBytes: state.limits.instructionBytes,
            onSaved: load,
          }),
          h(MemoriesCard, {
            items: state.memories || [],
            injectable: state.memory ? state.memory.injectable || 0 : 0,
          }),
        ),
      )
    }

    /** 插件入口：把「个性化」注册为设置里的一个分区。 */
    function apply(ctx) {
      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register({
          name: 'settings.section',
          id: 'personalization',
          order: 40,
          label: function () { return '个性化' },
        }, PersonalizationSection)
      })
    }

    return { apply: apply, inject: ['slots'] }
  },
})
