/** Volcengine (火山引擎) Doubao cloud speech recognition for DSH voice input.
 *
 * Registers one `speechToText` provider named by `providerId`. Audio arrives as a
 * complete 16 kHz mono PCM16 WAV from the browser; this plugin forwards it inline
 * as base64 to the official Doubao ASR "flash" endpoint (no media upload, no
 * persistence) and returns the recognized text.
 *
 * The business credential is never stored in the profile: it is read from the
 * existing local credential entry (or VOLC_ASR_API_KEY) at call time.
 */
import { isAbsolute } from 'node:path'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

export const name = 'speech-to-text-doubao'
export const inject = ['speechToText']

const ENDPOINT = 'https://openspeech.bytedance.com/api/v3/auc/bigmodel/recognize/flash'
const RESOURCE_ID = 'volc.bigasr.auc_turbo'
const OK = '20000000'
const NO_SPEECH = '20000003'

/** Resolve runtime settings, applying documented defaults. */
function settings(config) {
  const merged = {
    providerId: config?.providerId ?? 'doubao-cloud',
    credentialFile: config?.credentialFile ?? '',
    credentialLine: config?.credentialLine ?? 1,
    credentialPrefix: config?.credentialPrefix ?? '',
    envName: config?.envName ?? 'VOLC_ASR_API_KEY',
    timeoutMs: config?.timeoutMs ?? 60_000,
  }
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(merged.providerId))
    throw new Error('providerId 只能包含字母、数字、点、下划线和连字符')
  if (merged.credentialFile && !isAbsolute(merged.credentialFile))
    throw new Error('credentialFile 必须是绝对路径')
  if (!Number.isInteger(merged.credentialLine) || merged.credentialLine < 1)
    throw new Error('credentialLine 必须是从 1 开始的行号')
  if (!Number.isInteger(merged.timeoutMs) || merged.timeoutMs < 1_000 || merged.timeoutMs > 600_000)
    throw new Error('timeoutMs 必须在 1000 到 600000 之间')
  return merged
}

/** Read the business API key from the configured environment variable or credential line. */
function readCredential(cfg) {
  const fromEnv = (process.env[cfg.envName] ?? '').trim()
  if (fromEnv) return fromEnv
  if (!cfg.credentialFile) throw new Error(`请设置 ${cfg.envName} 或指定 credentialFile`)
  let lines
  try {
    lines = readFileSync(cfg.credentialFile, 'utf8').split(/\r?\n/)
  } catch {
    throw new Error('无法读取火山凭据文件；请检查 credentialFile')
  }
  const raw = (lines[cfg.credentialLine - 1] ?? '').trim()
  if (!raw) throw new Error(`火山凭据文件第 ${cfg.credentialLine} 行为空`)
  const prefix = cfg.credentialPrefix ?? ''
  if (prefix) {
    if (!raw.startsWith(prefix))
      throw new Error('凭据行的标签与 credentialPrefix 不一致；请核对后重试')
    const value = raw.slice(prefix.length).trim()
    if (!value) throw new Error('凭据行标签后没有密钥内容')
    return value
  }
  return raw
}

/** Measure duration of a canonical RIFF/WAVE recording without decoding samples. */
function wavSeconds(bytes) {
  if (bytes.byteLength < 44) return undefined
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const tag = (offset) =>
    String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3])
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return undefined
  let offset = 12
  let rate = 16_000
  let channels = 1
  let bits = 16
  let dataBytes
  while (offset + 8 <= bytes.byteLength) {
    const id = tag(offset)
    const size = view.getUint32(offset + 4, true)
    if (id === 'fmt ' && offset + 24 <= bytes.byteLength) {
      channels = view.getUint16(offset + 10, true)
      rate = view.getUint32(offset + 12, true)
      bits = view.getUint16(offset + 22, true)
    } else if (id === 'data') {
      dataBytes = Math.min(size, bytes.byteLength - offset - 8)
      break
    }
    offset += 8 + size + (size % 2)
  }
  const byteRate = rate * channels * (bits / 8)
  if (!dataBytes || !byteRate) return undefined
  return dataBytes / byteRate
}

/** Concise, credential-free failure text: status code plus a bounded, sanitized message. */
function describeFailure(status, message, secret) {
  let safe = ''
  if (typeof message === 'string') {
    safe = message
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/[^\p{L}\p{N} .,:;_()\[\]\/-]/gu, '')
      .trim()
      .slice(0, 120)
    if (secret && secret.length >= 8 && safe.includes(secret)) safe = safe.split(secret).join('[redacted]')
  }
  return `豆包语音返回 ${status ?? '未知状态'}${safe ? `：${safe}` : ''}`
}

export function apply(ctx, config) {
  const cfg = settings(config)

  const provider = {
    info: {
      id: cfg.providerId,
      name: '豆包语音（火山引擎）',
      location: 'cloud',
      languages: ['auto', 'zh', 'en'],
    },

    transcribe: async (input, signal) => {
      const key = readCredential(cfg)
      const started = performance.now()
      const body = {
        user: { uid: 'dsh-voice-input' },
        audio: { data: Buffer.from(input.audio).toString('base64'), format: 'wav' },
        request: {
          model_name: 'bigmodel',
          enable_itn: true,
          enable_punc: true,
          enable_ddc: false,
          show_utterances: false,
          enable_speaker_info: false,
        },
      }
      const timeout = AbortSignal.timeout(cfg.timeoutMs)
      let response
      try {
        response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            'X-Api-Key': key,
            'X-Api-Resource-Id': RESOURCE_ID,
            'X-Api-Request-Id': randomUUID(),
            'X-Api-Sequence': '-1',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.any([signal, timeout]),
          redirect: 'error',
        })
      } catch (error) {
        if (signal.aborted) throw signal.reason ?? new Error('语音识别已取消')
        if (timeout.aborted) throw new Error('豆包语音请求超时')
        throw new Error('豆包语音网络请求失败；请检查网络后重试')
      }
      const status = response.headers.get('x-api-status-code')
      const providerMessage = response.headers.get('x-api-message') ?? ''
      let data = null
      try {
        data = await response.json()
      } catch {
        // A proxy page or empty body is reported below without echoing it.
      }
      if (!response.ok || (status !== OK && status !== NO_SPEECH))
        throw new Error(describeFailure(status ?? `HTTP ${response.status}`, providerMessage, key))
      const text = typeof data?.result?.text === 'string' ? data.result.text : ''
      const reported = Number(data?.audio_info?.duration)
      const audioSeconds = Number.isFinite(reported) && reported > 0
        ? reported / 1000
        : (wavSeconds(input.audio) ?? 0)
      return {
        text,
        audioSeconds,
        inferenceSeconds: (performance.now() - started) / 1000,
      }
    },
  }

  ctx.effect(() => ctx.speechToText.register(provider))
}
