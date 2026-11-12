export const inject = ['tools', 'connection', 'webApp'];
export const NAVIGATE = 'mcp__agent_browser__browser_navigate';
export function localRoot(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Only the current clean 127.0.0.1 HTTP root is supported.');
  }
  return url.href;
}
export function apply(ctx) {
  ctx.tools.register({
    name: 'dsh_browser_connect',
    description: 'Authorize the dedicated automation browser to access this running local DSH. Use when DSH page navigation returns 401 and the user has requested connecting it. Returns only the clean URL and handoff status; use browser_snapshot afterwards to verify the page.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: {
      schema: { type: 'object', properties: { status: { type: 'string' }, url: { type: 'string' } }, required: ['status', 'url'], additionalProperties: false },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    timeoutMs: 120000,
    async execute(_args, exec) {
      const url = localRoot(ctx.webApp.getAdvertisedUrl());
      const nav = ctx.tools.executable(NAVIGATE, exec.agent, exec.toolSet);
      if (!nav) return { status: 'browser-tool-unavailable', url };
      const inner = { ...exec, name: NAVIGATE, schema: nav, arguments: { url } };
      if (ctx.tools.checkGuards(inner)) return { status: 'browser-navigation-denied', url };
      exec.signal.throwIfAborted();
      try {
        // Program binding: token exists only in the service-to-MCP call, never in tool output.
        const result = await nav.execute({ url: ctx.connection.authenticatedUrl(url) }, inner);
        exec.signal.throwIfAborted();
        return { status: result?.isError ? 'handoff-failed' : 'handoff-complete-verify-with-snapshot', url };
      } catch {
        // MCP errors may echo arguments; never propagate those messages or stacks.
        exec.signal.throwIfAborted();
        return { status: 'handoff-failed', url };
      }
    },
  });
}
