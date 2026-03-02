import { createCrosschainIssuanceAgent } from "../..";

function normaliseDecimals(amount: string | bigint, decimals: number): string {
  const a = BigInt(amount)
  const divisor = 10n ** BigInt(decimals)

  const whole = a / divisor
  const fraction = a % divisor

  const fractionStr = fraction.toString().padStart(10, '0')

  return `${whole}.${fractionStr.slice(0,2)}`
}

const agent = createCrosschainIssuanceAgent({
  httpUrl: 'http://127.0.0.1:3000',
  wsUrl: 'ws://127.0.0.1:3000',
})

const subIds = [
  'usdt-1984-hydration',
  'usdt-1984-moonbeam',
  'ethereum-usdt-assethub',
  'assethub-tbtc-hydration',
  'moonbeam-wbtc-hydration',
  'assethub-DOT-astar',
  'assethub-DOT-bifrost',
  'assethub-DOT-kusama',
  'kusama-KSM-assethub',
  'assethub-DOT-hydration',
  'assethub-DOT-moonbeam',
  'snow-ethereum-ETH-assethub',
  'bifrost-VDOT-hydration'
]

for (const subId of subIds) {
  const _ws = await agent.subscribe(
    subId,
    {
      onMessage: ({ payload }) => {
        const reserve = normaliseDecimals(payload.reserve, payload.inputs.reserveDecimals)
        const remote = normaliseDecimals(payload.remote, payload.inputs.remoteDecimals)
        console.log(`[${subId}] Reserve: ${reserve} Remote: ${remote} (Diff: ${Number(reserve) - Number(remote)})`)
      },
      onError: (error) => console.log(error),
      onClose: (event) => console.log(event.reason),
    },
  )
  console.log('connected', subId)
}
