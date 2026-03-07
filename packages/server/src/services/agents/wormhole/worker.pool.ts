import { ulid } from 'ulidx'
import { Worker } from 'worker_threads'

type StreamCallback = (msg: any) => void

export class WormholeWorkerPool {
  private worker: Worker
  private callbacks: Map<string, (result: any) => void> = new Map()
  private streamCallbacks: StreamCallback[] = []

  constructor(path: string | URL, workerData: { dataPath: string }) {
    this.worker = new Worker(path, { workerData })
    this.worker.on('message', (msg) => {
      if (msg.requestId) {
        const cb = this.callbacks.get(msg.requestId)
        if (cb) {
          cb(msg.result)
          this.callbacks.delete(msg.requestId)
        }
      } else if (msg.type === 'stream') {
        this.streamCallbacks.forEach((cb) => cb(msg.payload))
      }
    })
  }

  run<T>(type: string, payload: any): Promise<T> {
    const requestId = ulid()
    return new Promise((resolve, _reject) => {
      this.callbacks.set(requestId, resolve)
      this.worker.postMessage({ type, payload: { ...payload, requestId } })
    })
  }

  onStream(cb: StreamCallback) {
    this.streamCallbacks.push(cb)
  }
}
