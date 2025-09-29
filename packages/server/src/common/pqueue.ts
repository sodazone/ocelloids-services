// PriorityQueue.ts
export interface QueueItem<K> {
  key: K
  priority: number
  requestingUIDs: Set<string>
  seq: number
}

export class MaxEnqueuedError extends Error {
  constructor(message: string = 'Maximum number of enqueued items reached.') {
    super(message)
    this.name = 'MaxEnqueuedError'
    Object.setPrototypeOf(this, MaxEnqueuedError.prototype)
  }
}

export class PriorityQueue<K> {
  readonly #heap: QueueItem<K>[] = []
  readonly #items = new Map<K, QueueItem<K>>()
  readonly #indexMap = new Map<K, number>()
  readonly #uidCount = new Map<string, number>()

  readonly #maxEnqueuedItems: number
  #seq = 0

  constructor(config?: { maxEnqueuedItems?: number }) {
    this.#maxEnqueuedItems = config?.maxEnqueuedItems ?? 50
  }

  /**
   * Add an address to the queue with priority.
   * If it already exists, increases its priority.
   */
  enqueue(key: K, uid?: string, priorityBoost = 1) {
    if (uid) {
      const count = this.#uidCount.get(uid) ?? 0
      if (count >= this.#maxEnqueuedItems) {
        throw new MaxEnqueuedError()
      }
      this.#uidCount.set(uid, count + 1)
    }

    const existing = this.#items.get(key)
    if (!existing) {
      const item: QueueItem<K> = {
        key,
        priority: uid ? 10 : 1,
        requestingUIDs: new Set(uid ? [uid] : []),
        seq: this.#seq++,
      }
      this.#items.set(key, item)
      this.#heapPush(item)
    } else {
      // bump priority
      existing.priority += priorityBoost
      if (uid) {
        existing.requestingUIDs.add(uid)
      }
      const idx = this.#indexMap.get(key)!
      this.#heapifyUp(idx)
    }
  }

  /**
   * Removes and returns the highest priority address.
   */
  dequeue(): K | undefined {
    const item = this.#heapPop()
    if (!item) {
      return undefined
    }

    this.#items.delete(item.key)
    this.#indexMap.delete(item.key)

    for (const uid of item.requestingUIDs) {
      const count = this.#uidCount.get(uid)
      if (count !== undefined) {
        if (count <= 1) {
          this.#uidCount.delete(uid)
        } else {
          this.#uidCount.set(uid, count - 1)
        }
      }
    }

    return item.key
  }

  get size(): number {
    return this.#heap.length
  }

  has(key: K) {
    return this.#items.has(key)
  }

  getUIDCount(uid: string): number {
    return this.#uidCount.get(uid) ?? 0
  }

  // --- Binary Heap Implementation (max-heap by priority, stable by seq) ---

  #compare(a: QueueItem<K>, b: QueueItem<K>): boolean {
    // return true if a should be above b
    if (a.priority !== b.priority) {
      return a.priority > b.priority
    }
    // tie-breaker: smaller seq (earlier enqueue) wins
    return a.seq < b.seq
  }

  #heapPush(item: QueueItem<K>): void {
    this.#heap.push(item)
    const idx = this.#heap.length - 1
    this.#indexMap.set(item.key, idx)
    this.#heapifyUp(idx)
  }

  #heapPop(): QueueItem<K> | undefined {
    if (this.#heap.length === 0) {
      return undefined
    }
    const top = this.#heap[0]
    const end = this.#heap.pop()!
    this.#indexMap.delete(top.key)

    if (this.#heap.length > 0) {
      this.#heap[0] = end
      this.#indexMap.set(end.key, 0)
      this.#heapifyDown(0)
    }
    return top
  }

  #heapifyUp(idx: number): void {
    let index = idx
    const heap = this.#heap
    while (index > 0) {
      const parent = (index - 1) >> 1
      if (this.#compare(heap[index], heap[parent])) {
        ;[heap[index], heap[parent]] = [heap[parent], heap[index]]
        this.#indexMap.set(heap[index].key, index)
        this.#indexMap.set(heap[parent].key, parent)
        index = parent
      } else {
        break
      }
    }
  }

  #heapifyDown(idx: number): void {
    let index = idx
    const heap = this.#heap
    const length = heap.length
    while (true) {
      let largest = index
      const left = (index << 1) + 1
      const right = left + 1

      if (left < length && this.#compare(heap[left], heap[largest])) {
        largest = left
      }
      if (right < length && this.#compare(heap[right], heap[largest])) {
        largest = right
      }
      if (largest === index) {
        break
      }
      ;[heap[index], heap[largest]] = [heap[largest], heap[index]]
      this.#indexMap.set(heap[index].key, index)
      this.#indexMap.set(heap[largest].key, largest)
      index = largest
    }
  }
}
