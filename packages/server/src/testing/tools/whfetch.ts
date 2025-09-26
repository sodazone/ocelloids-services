import { WormholescanClient } from '@/services/networking/apis/wormhole/index.js'
import { mapOperationToJourney } from '@/services/networking/apis/wormhole/mappers/index.js'

const client = new WormholescanClient()

const op = await client.fetchOperationById(
  '2/0000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585/564970',
)

console.log('\n\n-\n\n', JSON.stringify(op, null, 2))
console.log('\n\n-\n\n', JSON.stringify(mapOperationToJourney(op), null, 2))
