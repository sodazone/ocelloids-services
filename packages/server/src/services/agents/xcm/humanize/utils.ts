import { AnyJson } from '@/lib.js'
import { XcmAssetRole } from '../explorer/repositories/types.js'
import { MultiAsset, MultiAssetFilter, QueryableXcmAsset, isConcrete } from './types.js'

export function extractMultiAssetFilterAssets(
  multiAssetFilter: MultiAssetFilter,
  assetsToFilter: QueryableXcmAsset[],
): QueryableXcmAsset[] {
  if (multiAssetFilter.type === 'Wild') {
    if (multiAssetFilter.value.type === 'All') {
      return assetsToFilter
    } else if (multiAssetFilter.value.type === 'AllOf') {
      const wildMultiAsset = multiAssetFilter.value.value
      const asset = assetsToFilter.find(
        (transferred) => transferred.location === extractLocation(wildMultiAsset.id),
      )
      if (asset) {
        return [asset]
      }
    } else if (multiAssetFilter.value.type === 'AllCounted') {
      const count = Number(multiAssetFilter.value.value)
      return assetsToFilter.slice(0, count)
    } else if (multiAssetFilter.value.type === 'AllOfCounted') {
      const wildMultiAsset = multiAssetFilter.value.value
      return assetsToFilter
        .filter((transferred) => transferred.location === extractLocation(wildMultiAsset.id))
        .slice(0, Number(wildMultiAsset.count))
    }
  } else if (multiAssetFilter.type === 'Definite') {
    return parseMultiAsset(multiAssetFilter.value as MultiAsset[])
  }
  throw new Error(`MultiAssetFilter structure not supported`)
}

export function stringifyMultilocation(multiLocation: AnyJson) {
  return JSON.stringify(multiLocation, (_, value) =>
    typeof value === 'string' ? value.replaceAll(',', '') : value,
  )
}

export function extractLocation(id: MultiAsset['id']): string {
  const multiLocation = isConcrete(id) ? id.value : id
  return multiLocation ? stringifyMultilocation(multiLocation) : ''
}

export function parseMultiAsset(multiAssets: MultiAsset[], role?: XcmAssetRole): QueryableXcmAsset[] {
  return multiAssets
    .filter((asset) => asset.fun.type === 'Fungible')
    .map((asset) => ({
      location: extractLocation(asset.id),
      amount: BigInt(asset.fun.value.replaceAll(',', '')),
      role,
    }))
}
