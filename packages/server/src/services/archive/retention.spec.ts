import { afterEach, beforeEach, describe, expect, it, Mock, vi } from 'vitest'
import { _log } from '@/testing/services.js'
import { ArchiveRepository } from './repository.js'
import { ArchiveRetentionJob, RetentionPolicy } from './retention.js'

// Jan 1, 2022, 00:00:00 UTC
const TIME = 1640995200000

describe('ArchiveRetentionJob', () => {
  let repository: ArchiveRepository
  let job: ArchiveRetentionJob
  let policy: RetentionPolicy
  let cleanUpOldLogs: Mock<(...args: any[]) => any>

  beforeAll(() => {
    vi.useFakeTimers()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.setSystemTime(TIME)

    // Mock the repository
    cleanUpOldLogs = vi.fn()
    repository = {
      cleanUpOldLogs,
    } as unknown as ArchiveRepository

    // Define the retention policy
    policy = {
      tickMillis: 1000,
      period: '1_days',
    }

    // Create the ArchiveRetentionJob instance
    job = new ArchiveRetentionJob(_log, repository, policy)
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('should call cleanUpOldLogs on each tick', () => {
    const mockDeleted = [{ numDeletedRows: 5 }]
    cleanUpOldLogs.mockResolvedValue(mockDeleted)

    job.start()

    vi.advanceTimersByTime(1000)

    expect(cleanUpOldLogs).toHaveBeenCalledWith(1640908801000)
  })

  it('should work if no records are deleted on tick', async () => {
    const mockDeleted: never[] = []
    cleanUpOldLogs.mockResolvedValue(mockDeleted)

    job.start()

    vi.advanceTimersByTime(1000)

    expect(repository.cleanUpOldLogs).toHaveBeenCalledWith(1640908801000)
  })

  it('should handle errors in the tick method', async () => {
    const error = new Error('Something went wrong')
    cleanUpOldLogs.mockRejectedValue(error)

    job.start()

    vi.advanceTimersByTime(1000)

    expect(repository.cleanUpOldLogs).toHaveBeenCalledWith(1640908801000)
  })
})
