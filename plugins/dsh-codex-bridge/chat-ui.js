window.__ModuleLoader__.load({
  id: '@local/dsh-codex-bridge',
  factory(require) {
    const { createElement } = require('react')
    const kind = 'codex-bridge-outbound'
    const tool = 'reply_to_codex'
    const received = 'Codex 已接收'
    const failed = '发送失败'
    const waiting = '等待回执'
    const unconfirmed = '回执未确认'
    const reconnectNotice = '未发给 Codex：当前没有连接。请在 Codex 重新接通后，再手动发送。'
    const unconfirmedNotice = 'Codex 未确认接收，请先核对原会话，不要重发。'
    const failedNotice = '未能发给 Codex，请查看卡片中的原因。'

    function parse(value) {
      try { return JSON.parse(value) } catch { return null }
    }

    function textOf(content) {
      if (typeof content === 'string') return content
      return Array.isArray(content)
        ? content.filter(part => part?.type === 'text' && typeof part.text === 'string').map(part => part.text).join('')
        : ''
    }

    function reasonOf(text, error) {
      const reason = text.replace(/^Error:\s*/, '').trim()
      if (reason) return reason
      for (const value of [error?.reason, error?.message, error?.code]) {
        if (typeof value === 'string' && value.trim()) return value.trim()
      }
      return '未提供失败原因'
    }

    // A reply_to_codex result is either a failure with its real reason or the current
    // live-received receipt; any other receipt is not treated as delivered.
    function outcome(data, final = false) {
      const result = data?.message ?? data
      if (!result) return null
      const text = textOf(result.content)
      if (result.isError === true || data?.error || result.error) {
        const error = data?.error ?? result.error
        const reason = reasonOf(text, error)
        const diagnostic = [reason, error?.code, error?.message].filter(Boolean).join(' ')
        if (/codex-delivery-unknown|did not confirm writing the output|delivery is unknown|未确认接收|timed out|timeout|connection.closed|closed before replying|aborted|超时|中断/i.test(diagnostic)) {
          return { status: unconfirmed, reason, notice: unconfirmedNotice }
        }
        const disconnected = /pair-disconnected|codex-no-live-receiver|No connected receiver for the selected DSH session and Codex turn|当前通话未连接|未配对/i.test(diagnostic)
        return { status: failed, reason, notice: disconnected ? reconnectNotice : failedNotice }
      }
      if (parse(text)?.status === 'live-received') return { status: received }
      if (!text && !final) return null
      return { status: unconfirmed, notice: unconfirmedNotice }
    }

    const definition = {
      kind, target: 'chat',
      match(event) {
        const data = event.data
        if (event.type === 'tool/call' && data.name === tool) {
          return { id: String(data.callId), role: 'start' }
        }
        if (event.type === 'tool/result' && event.surfaceOp === 'append') {
          const id = data.message?.source?.callId ?? data.message?.toolCallId
          return typeof id === 'string' ? { id, role: 'update' } : null
        }
        if ((event.type === 'tool/ptc-dispatch-start' || event.type === 'tool/ptc-dispatch') && data.name === tool) {
          return { id: String(data.subCallId), role: 'start' }
        }
        return null
      },
      start(_context, { event }) {
        const { arguments: raw } = event.data
        const args = typeof raw === 'string' ? parse(raw) : raw
        if (typeof args?.message !== 'string' || !args.message.trim()) return null
        // Keep the sent text verbatim: indentation and line breaks stay part of the record.
        return { message: args.message, ...(outcome(event.data) ?? { status: waiting }) }
      },
      update({ state }, { event }) {
        const result = state ? outcome(event.data, event.type === 'tool/result') : null
        if (!result || state.status === received) return state
        return { message: state.message, ...result }
      },
      buildViewNode(context) {
        if (!context.start || !context.state) return null
        return {
          key: context.key, id: context.id, kind, target: 'chat',
          anchorSeq: context.start.event.seq, location: context.start.location,
          visibility: 'visible', groupTree: 'input', data: context.state,
        }
      },
    }

    function OutboundMessage({ node }) {
      const { message, status, reason, notice } = node.data
      return createElement('section', { 'aria-label': 'DSH 发往 Codex', style: { marginBlock: '0.6em' } },
        createElement('strong', null, 'DSH → Codex'),
        createElement('span', { style: { marginInlineStart: '0.8em', opacity: 0.75 } }, status),
        createElement('div', { 'aria-live': 'polite', 'aria-atomic': true },
          notice ? createElement('strong', { style: { display: 'block', marginBlockStart: '0.25em' } }, notice) : null),
        createElement('div', { style: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', userSelect: 'text' } }, message),
        reason
          ? createElement('small', { style: { display: 'block', opacity: 0.75, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } }, '原因：' + reason)
          : null)
    }

    return {
      inject: ['uiConversation', 'slots'],
      apply(ctx) {
        ctx.uiConversation.events.register(definition)
        ctx.slots.inject('conversation.chat.node', () =>
          ctx.slots.register({ name: 'conversation.chat.node', key: kind }, OutboundMessage))
      },
    }
  },
})
