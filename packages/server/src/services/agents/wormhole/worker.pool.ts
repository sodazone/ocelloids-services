import { ulid } from 'ulidx'
import { Worker } from 'worker_threads'

type StreamCallback = (msg: any) => void

type Pending = {
  resolve: (result: any) => void
  reject: (err: any) => void
}

export class WormholeWorkerPool {
  private worker: Worker
  private callbacks: Map<string, Pending> = new Map()
  private streamCallbacks: StreamCallback[] = []

  constructor(path: string | URL, workerData: { dataPath: string }) {
    this.worker = new Worker(path, { workerData })
    this.worker.on('message', (msg) => {
      if (msg.requestId) {
        const pending = this.callbacks.get(msg.requestId)
        if (!pending) {
          return
        }

        this.callbacks.delete(msg.requestId)

        if (msg.type === 'error') {
          pending.reject(new Error(msg.error))
        } else {
          pending.resolve(msg.result)
        }
      } else if (msg.type === 'stream') {
        this.streamCallbacks.forEach((cb) => cb(msg.payload))
      }
    })
    this.worker.on('error', (err) => {
      this.rejectAll(err)
    })
    this.worker.on('exit', (code) => {
      if (code !== 0) {
        this.rejectAll(new Error(`Worker exited with code ${code}`))
      }
    })
  }

  run<T>(type: string, payload?: any): Promise<T> {
    const requestId = ulid()
    return new Promise((resolve, reject) => {
      this.callbacks.set(requestId, { resolve, reject })
      this.worker.postMessage({ type, payload: { ...(payload ?? {}), requestId } })
    })
  }

  onStream(cb: StreamCallback) {
    this.streamCallbacks.push(cb)
  }

  private rejectAll(err: Error) {
    for (const [, pending] of this.callbacks) {
      pending.reject(err)
    }
    this.callbacks.clear()
  }
}
