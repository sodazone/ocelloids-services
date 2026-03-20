import { deepCamelize } from '@/common/util.js'
import { FullJourney, FullJourneyResponse, Journey } from './repositories/types.js'

function toResponse(journey: FullJourney | Journey) {
  return deepCamelize<FullJourney | Journey>(journey)
}

export function fullJourneyToResponse(journey: FullJourney) {
  return toResponse(journey) as FullJourneyResponse
}

export function journeyToResponse(journey: Journey) {
  return toResponse(journey)
}
