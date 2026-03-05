import { createCrosschainIssuanceAgent } from "../..";

const API_KEY = process.env.LILP_ROOT ?? ''

function normaliseDecimals(amount: string | bigint, decimals: number): string {
  const a = BigInt(amount)
  const divisor = 10n ** BigInt(decimals)

  const whole = a / divisor
  const fraction = a % divisor

  const fractionStr = fraction.toString().padStart(10, '0')

  return `${whole}.${fractionStr.slice(0,2)}`
}

// const agent = createCrosschainIssuanceAgent({
//   httpUrl: 'http://127.0.0.1:3000',
//   wsUrl: 'ws://127.0.0.1:3000',
// })
//
//
const agent = createCrosschainIssuanceAgent({
  httpUrl: 'https://dev-api.ocelloids.net',
  wsUrl: 'wss://dev-api.ocelloids.net',
  apiKey: API_KEY
})

const subIds = [
  'hyperion:polkadot-hydration_xcm'
]

for (const subId of subIds) {
  const _ws = await agent.subscribe(
    subId,
    {
      onMessage: ({ payload }) => {
        const reserve = normaliseDecimals(payload.reserve, payload.inputs.reserveDecimals)
        const remote = normaliseDecimals(payload.remote, payload.inputs.remoteDecimals)
        console.log(`[${subId}] ${payload.inputs.assetSymbol} Reserve: ${reserve} Remote: ${remote} (Diff: ${Number(reserve) - Number(remote)})`)
      },
      onError: (error) => console.log('WS error:', error),
      onClose: (event) => console.log('WS close', event.reason),
    },
  )
  console.log('connected', subId)
}
