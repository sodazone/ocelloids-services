import { Codec, Registry } from '@polkadot/types-codec/types'
import { hexToU8a, stringCamelCase } from '@polkadot/util'

export function getLocationIfAny(assetDetails: Record<string, any>) {
  const { location } = assetDetails
  if (location) {
    return location.toJSON === undefined ? location : location.toJSON()
  }
  return undefined
}

export function extractConstant(
  registry: Registry,
  palletName: string,
  constantName: string,
): Codec | undefined {
  for (const { constants, name } of registry.metadata.pallets) {
    if (stringCamelCase(name) === palletName) {
      const constant = constants.find((constant) => stringCamelCase(constant.name) === constantName)
      if (constant) {
        const codec = registry.createTypeUnsafe(registry.createLookupType(constant.type), [
          hexToU8a(constant.value.toHex()),
        ])
        return codec
      }
    }
  }
  return undefined
}
