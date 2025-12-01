import { createFetcher } from '@/common/http/fetch.js'

const SUBSQUARE_URLS: Record<string, string> = {
  'urn:ocn:polkadot:0': 'https://polkadot-api.subsquare.io',
  'urn:ocn:polkadot:1000': 'https://polkadot-api.subsquare.io',
  'urn:ocn:kusama:0': 'https://kusama-api.subsquare.io',
  'urn:ocn:kusama:1000': 'https://kusama-api.subsquare.io',
}
const SUBSQUARE_LINKS: Record<string, string> = {
  'urn:ocn:polkadot:0': 'https://polkadot.subsquare.io',
  'urn:ocn:polkadot:1000': 'https://polkadot.subsquare.io',
  'urn:ocn:kusama:0': 'https://kusama.subsquare.io',
  'urn:ocn:kusama:1000': 'https://kusama.subsquare.io',
}

export type ReferendumDetails = {
  title: string
  link?: string
}

function resolveReferendumLink(chainId: string, id: string | number) {
  const prefixUrl = SUBSQUARE_LINKS[chainId]
  if (!prefixUrl) {
    return undefined
  }
  return `${prefixUrl}/referenda/${id}`
}

export function createGovDataFetcher() {
  const fetchers = new Map<string, ReturnType<typeof createFetcher>>()

  function getOrCreateFetcher(chainId: string) {
    let f = fetchers.get(chainId)
    if (f) {
      return f
    }

    const prefixUrl = SUBSQUARE_URLS[chainId]
    if (!prefixUrl) {
      throw new Error(`Unsupported chain ID: ${chainId}`)
    }

    f = createFetcher({
      prefixUrl,
      timeout: 1_000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    fetchers.set(chainId, f)
    return f
  }

  return {
    async fetchDetails(chainId: string, id: string | number) {
      try {
        const response = await getOrCreateFetcher(chainId).get(`gov2/referendums/${id}`)
        return await response.json()
      } catch (error) {
        console.error(`Error fetching gov2 details: ${id}`, error)
      }
    },
    async fetchDescription(chainId: string, id: string | number) {
      let details: ReferendumDetails
      try {
        const response = await getOrCreateFetcher(chainId).get(`gov2/referendums/${id}`)
        details = await response.json()
      } catch (error) {
        console.error(`Error fetching gov2 description: ${id}`, error)
        details = {
          title: '',
        }
      }
      return {
        title: details.title,
        link: resolveReferendumLink(chainId, id),
      }
    },
  }
}

export type GovDataFetcher = ReturnType<typeof createGovDataFetcher>
