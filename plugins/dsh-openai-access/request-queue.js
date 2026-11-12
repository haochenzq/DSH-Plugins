const maxTimerDelay = 2_147_483_647

export class RequestQueue {
  #pending = new Set()
  #capacity
  #refillPerMs
  #available
  #lastRefill = performance.now()
  #pausedUntil = 0
  #timer

  constructor(tokensPerMinute) {
    this.#capacity = tokensPerMinute * 0.9
    this.#available = this.#capacity
    this.#refillPerMs = this.#capacity / 60_000
  }

  wait(tokens, signal) {
    signal.throwIfAborted()
    return new Promise((resolve, reject) => {
      const entry = {
        tokens,
        bypassBudget: this.#capacity * 0.15,
        admit() {
          signal.removeEventListener('abort', cancel)
          resolve()
        },
      }
      const cancel = () => {
        this.#pending.delete(entry)
        reject(signal.reason)
        this.#drain()
      }
      signal.addEventListener('abort', cancel, { once: true })
      this.#pending.add(entry)
      this.#drain()
    })
  }

  pause(milliseconds) {
    this.#pausedUntil = Math.max(this.#pausedUntil, performance.now() + milliseconds)
    this.#drain()
  }

  observeRemaining(tokens) {
    this.#refill(performance.now())
    this.#available = Math.min(this.#available, tokens)
    this.#drain()
  }

  #refill(now) {
    this.#available = Math.min(this.#capacity, this.#available + (now - this.#lastRefill) * this.#refillPerMs)
    this.#lastRefill = now
  }

  #admit(entry, cost) {
    this.#available -= cost
    this.#pending.delete(entry)
    entry.admit()
  }

  #wakeAfter(milliseconds) {
    this.#timer = setTimeout(() => this.#drain(), Math.min(Math.ceil(milliseconds), maxTimerDelay))
  }

  #drain() {
    clearTimeout(this.#timer)
    if (this.#pending.size === 0) return

    const now = performance.now()
    this.#refill(now)
    if (this.#pausedUntil > now) {
      this.#wakeAfter(this.#pausedUntil - now)
      return
    }

    for (const oldest of this.#pending) {
      // A request larger than the local budget can run alone once it refills.
      const cost = Math.min(oldest.tokens, this.#capacity)
      if (cost <= this.#available) {
        this.#admit(oldest, cost)
        continue
      }

      // Small requests can use spare capacity while the oldest request refills.
      // Bound their total cost so a busy stream of small requests cannot starve it.
      let nextCost = cost
      for (const entry of this.#pending) {
        if (entry === oldest || entry.tokens > oldest.bypassBudget) continue
        if (entry.tokens <= this.#available) {
          oldest.bypassBudget -= entry.tokens
          this.#admit(entry, entry.tokens)
        } else {
          nextCost = Math.min(nextCost, entry.tokens)
        }
      }
      if (nextCost > oldest.bypassBudget) nextCost = cost
      this.#wakeAfter((nextCost - this.#available) / this.#refillPerMs)
      return
    }
  }
}
