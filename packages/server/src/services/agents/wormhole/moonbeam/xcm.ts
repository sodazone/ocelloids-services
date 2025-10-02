type Junction =
  | { type: 'Parachain'; value: number }
  | { type: 'GlobalConsensus'; value: any }
  | { type: string; value: any }

type Interior =
  | { type: 'Here' }
  | { type: 'X1'; value: [Junction] }
  | { type: 'X2'; value: [Junction, Junction] }
  | { type: string; value: Junction[] }

interface Location {
  parents: number
  interior: Interior
}

function interiorToArray(interior: Interior): Junction[] {
  if (interior.type === 'Here') {
    return []
  }
  if ('value' in interior) {
    return [...interior.value]
  }
  return []
}

function arrayToInterior(junctions: Junction[]): Interior {
  switch (junctions.length) {
    case 0:
      return { type: 'Here' }
    case 1:
      return { type: 'X1', value: [junctions[0]] }
    case 2:
      return { type: 'X2', value: [junctions[0], junctions[1]] }
    default:
      return { type: `X${junctions.length}`, value: junctions }
  }
}

function isChainIdJunction(j: Junction): boolean {
  return j.type === 'Parachain' || j.type === 'GlobalConsensus'
}

export function splitLocationIntoChainPartAndBeneficiary(location: Location): [Location, Location] | null {
  const allJunctions = interiorToArray(location.interior)
  const beneficiary: Junction[] = []

  const chainPart: Junction[] = [...allJunctions]

  while (chainPart.length > 0) {
    const last = chainPart[chainPart.length - 1]
    if (isChainIdJunction(last)) {
      return [
        { parents: location.parents, interior: arrayToInterior(chainPart) },
        { parents: 0, interior: arrayToInterior(beneficiary) },
      ]
    } else {
      beneficiary.unshift(chainPart.pop()!)
    }
  }

  if (location.parents === 1) {
    return [
      { parents: 1, interior: { type: 'Here' } },
      { parents: 0, interior: arrayToInterior(beneficiary) },
    ]
  }

  return null
}
