/**
 * messageQueue.js — Async Message Queue with Retry & Exponential Backoff
 *
 * Processes tasks sequentially so Telegram API isn't hammered in bursts.
 * Each failed task is retried up to `maxRetries` times with exponential backoff.
 *
 * ─── Upgrading to Bull.js + Redis (production) ────────────────────────────
 *
 *   npm install bull ioredis          (server-side Node.js only)
 *
 *   const Bull  = require('bull');
 *   const queue = new Bull('telegram-messages', {
 *     redis: { port: 6379, host: '127.0.0.1' },
 *     defaultJobOptions: {
 *       attempts:  3,
 *       backoff:   { type: 'exponential', delay: 1000 },
 *       removeOnComplete: 100,   // keep last 100 completed jobs
 *       removeOnFail:     50,
 *     },
 *   });
 *
 *   // Enqueue:
 *   queue.add({ chatId, text });
 *
 *   // Process:
 *   queue.process(async (job) => {
 *     await sendTelegramMessage(job.data.chatId, job.data.text);
 *   });
 *
 *   // Events:
 *   queue.on('failed',    (job, err)  => logger.error(job.id, err));
 *   queue.on('completed', (job, res)  => logger.info(job.id, 'done'));
 *
 * ──────────────────────────────────────────────────────────────────────────
 */

class MessageQueue {
  /**
   * @param {Object} options
   * @param {number} options.maxRetries  - Max retry attempts per task (default 3)
   * @param {number} options.baseDelay   - Base backoff delay in ms (default 1000)
   * @param {Function} options.onError   - Called when a task exhausts all retries
   */
  constructor(options = {}) {
    this._queue        = [];
    this._isProcessing = false;
    this.maxRetries    = options.maxRetries ?? 3;
    this.baseDelay     = options.baseDelay  ?? 1000;
    this.onError       = options.onError    ?? null;

    // Live stats (mirrors Bull.js job counts)
    this.stats = {
      processed : 0,
      failed    : 0,
      retried   : 0,
      queued    : 0,
    };
  }

  /**
   * Add a task to the queue.
   * @param {Function} taskFn   - Async function to execute (must return a Promise)
   * @param {string}   label    - Human-readable name shown in logs / retries
   * @returns {Promise<any>}    - Resolves when the task succeeds
   */
  enqueue(taskFn, label = "task") {
    return new Promise((resolve, reject) => {
      this.stats.queued++;
      this._queue.push({ taskFn, label, retries: 0, resolve, reject });
      if (!this._isProcessing) this._next();
    });
  }

  /** Process the next job in the queue. */
  async _next() {
    if (this._queue.length === 0) {
      this._isProcessing = false;
      return;
    }

    this._isProcessing = true;
    const job = this._queue.shift();

    try {
      const result = await job.taskFn();
      this.stats.processed++;
      job.resolve(result);
    } catch (err) {
      if (job.retries < this.maxRetries) {
        job.retries++;
        this.stats.retried++;
        const delay = this.baseDelay * Math.pow(2, job.retries - 1); // 1s → 2s → 4s
        console.warn(
          `[Queue] ⚠️  Retry ${job.retries}/${this.maxRetries} for "${job.label}" in ${delay}ms`
        );
        await this._sleep(delay);
        this._queue.unshift(job); // re-insert at front so it runs next
      } else {
        this.stats.failed++;
        console.error(
          `[Queue] ❌ "${job.label}" failed after ${this.maxRetries} retries.`, err
        );
        if (typeof this.onError === "function") this.onError(job.label, err);
        job.reject(err);
      }
    }

    this._next(); // process next item without recursion depth issue
  }

  /** Sleep helper. */
  _sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
  }

  /** Returns a snapshot of current queue stats. */
  getStats() {
    return { ...this.stats, pending: this._queue.length };
  }

  /** Clears all pending (not yet started) tasks. */
  clear() {
    const dropped = this._queue.length;
    this._queue = [];
    console.info(`[Queue] Cleared ${dropped} pending task(s).`);
  }
}

// ── Singleton instance used across the whole app ──────────────────────────
export const messageQueue = new MessageQueue({
  maxRetries : 3,
  baseDelay  : 1000,
  onError    : (label, err) => {
    console.error(`[Queue:onError] "${label}":`, err.message || err);
  },
});

export default MessageQueue;
