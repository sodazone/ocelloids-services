import { MaxEnqueuedError, PriorityQueue } from './pqueue.js'

describe('PriorityQueue', () => {
  it('enqueues and dequeues in priority order', () => {
    const q = new PriorityQueue<string>()

    q.enqueue('a') // priority 1
    q.enqueue('b', 'u1') // priority 10
    q.enqueue('c') // priority 1

    expect(q.size).toBe(3)
    expect(q.dequeue()).toBe('b')
    expect(q.dequeue()).toBe('a')
    expect(q.dequeue()).toBe('c')
    expect(q.dequeue()).toBeUndefined()
  })

  it('increases priority when re-enqueued', () => {
    const q = new PriorityQueue<string>()
    q.enqueue('a')
    q.enqueue('b')
    q.enqueue('a', undefined, 5) // bump priority
    expect(q.dequeue()).toBe('a')
    expect(q.dequeue()).toBe('b')
  })

  it('tracks UID counts and enforces maxEnqueuedAddresses', () => {
    const q = new PriorityQueue<string>({ maxEnqueuedItems: 2 })

    q.enqueue('a', 'u1')
    q.enqueue('b', 'u1')
    expect(q.getUIDCount('u1')).toBe(2)
    expect(() => q.enqueue('c', 'u1')).toThrow(MaxEnqueuedError)
  })

  it('reduces UID count when items are dequeued', () => {
    const q = new PriorityQueue<string>()

    q.enqueue('a', 'u1')
    q.enqueue('b', 'u1')
    expect(q.getUIDCount('u1')).toBe(2)

    expect(q.dequeue()).toBe('a')
    expect(q.getUIDCount('u1')).toBe(1)

    expect(q.dequeue()).toBe('b')
    expect(q.getUIDCount('u1')).toBe(0)
  })

  it('has() returns true for items in the queue', () => {
    const q = new PriorityQueue<string>()
    q.enqueue('x')
    expect(q.has('x')).toBe(true)
    expect(q.has('y')).toBe(false)
    q.dequeue()
    expect(q.has('x')).toBe(false)
  })

  it('throws MaxEnqueuedError independently per UID', () => {
    const q = new PriorityQueue<string>({ maxEnqueuedItems: 2 })

    q.enqueue('a', 'u1')
    q.enqueue('b', 'u2')

    expect(q.getUIDCount('u1')).toBe(1)
    expect(q.getUIDCount('u2')).toBe(1)

    // Each UID can enqueue 1 more
    q.enqueue('c', 'u1')
    q.enqueue('d', 'u2')

    // Both UIDs reached max now
    expect(() => q.enqueue('e', 'u1')).toThrow(MaxEnqueuedError)
    expect(() => q.enqueue('f', 'u2')).toThrow(MaxEnqueuedError)
  })

  it('removes UID from count map when all requested items are dequeued', () => {
    const q = new PriorityQueue<string>()

    q.enqueue('a', 'u1')
    q.enqueue('b', 'u1')
    q.enqueue('c', 'u2')

    expect(q.getUIDCount('u1')).toBe(2)
    expect(q.getUIDCount('u2')).toBe(1)

    expect(q.dequeue()).toBe('a')
    expect(q.getUIDCount('u1')).toBe(1)
    expect(q.getUIDCount('u2')).toBe(1)

    expect(q.dequeue()).toBe('b')
    expect(q.getUIDCount('u1')).toBe(0) // removed
    expect(q.getUIDCount('u2')).toBe(1)

    expect(q.dequeue()).toBe('c')
    expect(q.getUIDCount('u2')).toBe(0) // removed
  })

  it('does not add the same address twice to the queue', () => {
    const q = new PriorityQueue<string>()

    q.enqueue('a') // new item
    q.enqueue('a', 'u1', 5) // should NOT add new entry, only bump priority
    q.enqueue('a')
    q.enqueue('a')

    // Still only one item in the queue
    expect(q.size).toBe(1)
    expect(q.has('a')).toBe(true)

    // And we can dequeue it once
    expect(q.dequeue()).toBe('a')
    expect(q.dequeue()).toBeUndefined()
  })
})
