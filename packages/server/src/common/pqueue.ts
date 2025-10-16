/**
 * Represents an item in the priority queue.
 * Each item has a unique key, priority value, set of requesting UIDs, and a sequence number (for tie-breaking).
 */
export interface QueueItem<K> {
  key: K
  priority: number
  requestingUIDs: Set<string>
  seq: number
}

/**
 * Error thrown when a UID exceeds the allowed number of enqueued items.
 */
export class MaxEnqueuedError extends Error {
  constructor(message: string = 'Maximum number of enqueued items reached.') {
    super(message)
    this.name = 'MaxEnqueuedError'
    Object.setPrototypeOf(this, MaxEnqueuedError.prototype)
  }
}

/**
 * A stable max-priority queue that:
 * - Stores items with priorities (higher = earlier dequeue)
 * - Enforces per-UID enqueue limits
 * - Supports increasing priority of existing items
 * - Maintains FIFO order among equal priorities using sequence numbers
 */
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
   * Adds an item (key) to the queue.
   * - If it's new, creates a QueueItem with base priority.
   * - If it exists, increases its priority.
   * - Optionally associates it with a UID (which is limited by maxEnqueuedItems).
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
      existing.priority += priorityBoost
      if (uid) {
        existing.requestingUIDs.add(uid)
      }
      const idx = this.#indexMap.get(key)!
      this.#heapifyUp(idx)
    }
  }

  /**
   * Removes and returns the key with the highest priority.
   * Updates UID counters accordingly.
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

  /** Number of items currently in the queue. */
  get size(): number {
    return this.#heap.length
  }

  /** Returns true if the queue contains a given key. */
  has(key: K) {
    return this.#items.has(key)
  }

  /** Returns how many items a UID currently has enqueued. */
  getUIDCount(uid: string): number {
    return this.#uidCount.get(uid) ?? 0
  }

  /** Compare two queue items — higher priority or earlier seq comes first. */
  #compare(a: QueueItem<K>, b: QueueItem<K>): boolean {
    if (a.priority !== b.priority) {
      return a.priority > b.priority
    }
    return a.seq < b.seq
  }

  /** Push item to heap and adjust upward. */
  #heapPush(item: QueueItem<K>): void {
    this.#heap.push(item)
    const idx = this.#heap.length - 1
    this.#indexMap.set(item.key, idx)
    this.#heapifyUp(idx)
  }

  /** Pop highest-priority item from heap and reheapify downward. */
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

  /** Bubble an item up until heap order is restored. */
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

  /** Push an item down until heap order is restored. */
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
