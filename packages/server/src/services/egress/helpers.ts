export function ifNested(
  this: ReturnType<typeof Handlebars.registerHelper>,
  obj: any,
  path: string,
  options: any,
) {
  const keys = path.split('.')
  let value = obj
  for (const key of keys) {
    if (value == null) {
      return options.inverse(this)
    }
    value = value[key]
  }
  return value ? options.fn(this) : options.inverse(this)
}

export const chainHelper = (urn: any) => {
  if (!urn || typeof urn !== 'string') {
    return ''
  }

  const parts = urn.split(':')
  if (parts.length < 4) {
    return urn
  }

  const ecosystem = parts[2]
  const chainId = parts[3]

  const ecosystems: Record<string, string> = {
    polkadot: 'Polkadot',
    kusama: 'Kusama',
    ethereum: 'Ethereum',
  }

  // Network mapping datasets
  const networks: Record<string, Record<string, string>> = {
    polkadot: {
      '0': 'Polkadot',
      '1000': 'Polkadot',
      '1001': 'Bridge Hub Polkadot',
      '2000': 'Acala',
      '2034': 'Hydration',
      '2090': 'Centrifuge',
      '2104': 'Bifrost',
      '3333': 'People Chain',
    },
    kusama: {
      '0': 'Kusama',
      '1000': 'Asset Hub Kusama',
      '1001': 'Bridge Hub Kusama',
      '2000': 'Karura',
      '2001': 'Moonriver',
      '2012': 'Bifrost Kusama',
    },
    westend: {
      '0': 'Westend',
      '1000': 'Asset Hub Westend',
    },
  }

  if (chainId === '0') {
    return ecosystems[ecosystem] ?? ecosystem
  }

  // Resolve network if known
  const netMap = networks[ecosystem]
  if (netMap && netMap[chainId]) {
    return netMap[chainId]
  }

  // Fallback
  return `${ecosystems[ecosystem] ?? ecosystem}/${chainId}`
}
