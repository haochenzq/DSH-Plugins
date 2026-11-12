import { writeFile } from 'node:fs/promises'
import { RequestQueue } from './request-queue.js'

export const inject = ['tools', 'credentials', 'llm', 'attachments']
const toolName = 'consult_openai_model'
const imageTool = 'generate_openai_image'
const imageModel = 'gpt-image-2.5-flare'
const outputLimit = 2048

function retryDelay(message) {
  const wait = /\bplease try again in (?:(\d+(?:\.\d+)?)m(?!s)\s*)?(?:(\d+(?:\.\d+)?)(ms|s))?(?=[.\s]|$)/i.exec(message)
  if (!wait) return
  const [, minutes, duration, unit] = wait
  const milliseconds = Number(minutes ?? 0) * 60_000 +
    Number(duration ?? 0) * (unit?.toLowerCase() === 's' ? 1000 : 1)
  if (Number.isFinite(milliseconds) && milliseconds > 0) return Math.ceil(milliseconds)
}

function observeRateLimit(queue, message, wait) {
  const snapshot = /\bTPM\b[^\r\n]*?\bLimit (\d+), Used (\d+), Requested \d+/i.exec(message)
  if (snapshot) {
    queue.observeRemaining(Math.max(0, Number(snapshot[1]) - Number(snapshot[2])))
  } else {
    queue.pause(wait ?? 2000)
  }
}

function estimateRequest(ctx, request) {
  const meter = ctx.get('tokenMeter')
  const session = request.purpose === undefined && request.sessionId !== undefined
    ? ctx.get('sessions')?.get(request.sessionId)
    : undefined
  if (session && meter) {
    const config = session.requestHeader()?.config
    if (config?.provider === request.provider && config.model === request.model) {
      try {
        return Math.max(request.maxTokens ?? 0, meter.measure(session).totalTokens, 1)
      } catch {
        // Use the request itself if the session meter cannot supply a measurement.
      }
    }
  }

  const messages = request.messages.reduce((total, message) =>
    total + (meter?.estimateMessage(message) ?? Math.ceil(JSON.stringify(message.content).length / 4)), 0)
  const tools = request.tools?.length ? Math.ceil(JSON.stringify(request.tools).length / 4) : 0
  return Math.max(request.maxTokens ?? 0, messages + tools, 1)
}

async function requestOpenAI(ctx, route, body, signal, timeout, queue, lifetime) {
  const key = (await ctx.credentials.resolve('OPENAI_API_KEY'))?.value
  if (!key) throw new Error('The DSH host cannot see OPENAI_API_KEY.')
  if (queue) {
    const waitSignal = AbortSignal.any([signal, lifetime])
    await queue.wait(Math.max(body.max_output_tokens, Math.ceil(body.input.length / 4)), waitSignal)
    waitSignal.throwIfAborted()
  }
  const response = await fetch('https://api.openai.com/v1/' + route, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(timeout)]),
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => null))?.error
    const code = error?.code
    if (queue && response.status === 429 && (code === 'rate_limit_exceeded' || code === 'slow_down')) {
      const seconds = Number(response.headers.get('retry-after'))
      const milliseconds = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : retryDelay(error.message)
      observeRateLimit(queue, error.message, milliseconds)
    }
    const safeCode = typeof code === 'string' && /^[a-z0-9_]{1,80}$/.test(code) ? ' (' + code + ')' : ''
    throw new Error('OpenAI request failed: HTTP ' + response.status + safeCode)
  }
  return response.json()
}

export function apply(ctx) {
  const lifetime = new AbortController()
  const sharedQueue = new RequestQueue(1_000_000)
  const queues = new Map([
    ['gpt-6-astra', sharedQueue],
    ['gpt-6.1-sol', sharedQueue],
    ['gpt-6.1-terra', sharedQueue],
    ['gpt-6-luna', new RequestQueue(2_000_000)],
  ])
  ctx.effect(() => () => lifetime.abort())

  ctx.on('llm/stream', (request, next) => {
    const queue = request.provider === 'openai' ? queues.get(request.model) : undefined
    if (!queue) return next()
    return (async function* () {
      const signal = request.signal ? AbortSignal.any([request.signal, lifetime.signal]) : lifetime.signal
      await queue.wait(estimateRequest(ctx, request), signal)
      signal.throwIfAborted()
      for await (const chunk of next()) {
        const failure = chunk.type === 'finish' && chunk.reason.failure
        if (failure?.code === 'RATE_LIMIT') {
          observeRateLimit(queue, failure.message, failure.providerRetryAfterMs ?? retryDelay(failure.message))
        }
        yield chunk
      }
    })()
  })

  // The pi-ai adapter forwards the error text without a structured retry delay.
  ctx.on('agent/request-error', (request, next) => {
    const { provider, failure } = request
    if (provider === 'openai' && failure.code === 'RATE_LIMIT' && failure.providerRetryAfterMs == null) {
      const milliseconds = retryDelay(failure.message)
      if (milliseconds !== undefined) request.failure = { ...failure, providerRetryAfterMs: milliseconds }
    }
    return next()
  }, { prepend: true })

  ctx.tools.register({
    name: toolName,
    description: 'Consult a specific OpenAI language model without switching the session model. Use only when the user authorizes OpenAI for this task. Provide its exact API model ID and only the text needed for this request. Never include keys, credentials, or unrelated history. Returns text from the official OpenAI Responses API.',
    parameters: {
      type: 'object',
      properties: {
        model: { type: 'string', description: 'Exact model ID, such as gpt-6-sol.' },
        input: { type: 'string', description: 'Self-contained text to send to OpenAI.' },
      },
      required: ['model', 'input'],
      additionalProperties: false,
    },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    async execute({ model, input }, exec) {
      if (typeof model !== 'string' || !/^(?:gpt-[0-9]|o[1-9])[a-z0-9._-]{0,120}$/.test(model) ||
          /(?:^|-)(?:audio|realtime|transcribe|tts|image|cyber)(?:-|$)/.test(model)) {
        throw new Error('Provide the exact ID of an OpenAI text model that supports the Responses API.')
      }
      if (typeof input !== 'string' || !input.trim() || input.length > 12000) {
        throw new Error('Provide 1–12,000 characters of task text.')
      }
      const result = await requestOpenAI(ctx, 'responses',
        { model, input, max_output_tokens: outputLimit, store: false }, exec.signal, 75_000, queues.get(model), lifetime.signal)
      const messages = Array.isArray(result.output) ? result.output : []
      const text = messages.filter(item => item.type === 'message').flatMap(item => item.content)
        .filter(part => part?.type === 'output_text').map(part => part.text).join('\n')
      if (!text) throw new Error('OpenAI returned no text (status: ' + (result.status || 'unknown') + ').')
      return JSON.stringify({ model: result.model, status: result.status, text })
    },
  })

  ctx.tools.register({
    name: imageTool,
    timeoutMs: 125_000,
    description: 'Generate one 1024×1024 image with OpenAI GPT Image 2.5 Flare and attach it to the current DSH chat. Use only when the user asks for OpenAI image generation. Submit only the authorized image prompt. Do not retry an uncertain request automatically.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The visual description of the one image to generate.' },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['attachmentId', 'mediaType', 'bytes', 'width', 'height', 'name'],
        properties: {
          attachmentId: { type: 'string' },
          mediaType: { type: 'string' },
          bytes: { type: 'integer' },
          width: { type: 'integer' },
          height: { type: 'integer' },
          name: { type: 'string' },
        },
      },
      render: (_args, attachment) => [
        { type: 'text', text: 'OpenAI ' + imageModel + ' generated ' + attachment.width + '×' + attachment.height + '.' },
        { type: 'image', attachment },
      ],
    },
    async execute({ prompt }, exec) {
      if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 8000) {
        throw new Error('Provide 1–8,000 characters of image prompt.')
      }
      const result = await requestOpenAI(ctx, 'images/generations', {
        model: imageModel, prompt: prompt.trim(), n: 1, size: '1024x1024', quality: 'low', output_format: 'png',
      }, exec.signal, 120_000)
      const encoded = result.data?.[0]?.b64_json
      if (typeof encoded !== 'string' || !encoded || encoded.length > 16 * 1024 * 1024) {
        throw new Error('OpenAI did not return an image within the attachment limit.')
      }
      const data = Buffer.from(encoded, 'base64')
      if (!data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
        throw new Error('OpenAI did not return a valid PNG payload.')
      }
      exec.signal.throwIfAborted()
      const name = 'openai-flare.png'
      const ref = await ctx.attachments.saveImage({ data, mediaType: 'image/png', name })
      return { attachmentId: ref.attachmentId, mediaType: ref.mediaType, bytes: ref.bytes,
        width: ref.width, height: ref.height, name: ref.name ?? name }
    },
  })

  // Report the native picker catalog without opening the desktop window or reading a key value.
  let active = true
  let revision = 0
  const statusFile = new URL('./status.local.json', import.meta.url)
  const publish = async () => {
    const current = ++revision
    const models = await ctx.llm.listModels('openai').catch(() => [])
    if (!active || current !== revision) return
    await writeFile(statusFile, JSON.stringify({
      updatedAt: new Date().toISOString(),
      menuModels: models.map(({ id, name }) => ({ id, name })),
      requestScheduling: true,
      tool: toolName,
      imageTool,
      chatImageClient: Boolean(ctx.get('clientModules')?.clientPath('@local/dsh-openai-access')),
    }, null, 2) + '\n').catch(() => ctx.logger('openai-access').warn('Could not write local menu status.'))
  }
  ctx.on('llm/adapters-updated', () => { void publish() })
  ctx.effect(() => {
    void publish()
    return () => { active = false }
  })
}
