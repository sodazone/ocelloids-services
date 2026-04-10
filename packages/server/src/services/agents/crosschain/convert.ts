import { deepCamelize } from '@/common/util.js'
import { FullJourney, FullJourneyResponse, Journey } from './repositories/types.js'

function toResponse(journey: FullJourney | Journey) {
  const j = deepCamelize<FullJourney | Journey>(journey)
  return {
    ...j,
    createdAt: Number(j.createdAt),
    sentAt: j.sentAt !== undefined ? Number(j.sentAt) : undefined,
    recvAt: j.recvAt !== undefined ? Number(j.recvAt) : undefined,
  }
}

export function fullJourneyToResponse(journey: FullJourney) {
  return toResponse(journey) as FullJourneyResponse
}

export function journeyToResponse(journey: Journey) {
  return toResponse(journey)
}
