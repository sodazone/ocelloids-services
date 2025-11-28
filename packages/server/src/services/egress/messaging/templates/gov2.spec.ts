import { TemplateRenderer } from '../../template.js'
import { Gov2Template } from './gov2.js'

describe('Gov2', () => {
  const renderer = new TemplateRenderer()
  it('should render Gov2Template', () => {
    renderer.render({
      template: Gov2Template,
      data: {
        metadata: {
          type: 'referendum.update',
          agentId: 'opengov',
          networkId: 'urn:ocn:polkadot:1000',
          subscriptionId: 'opengov-tg-test',
          timestamp: 1763641059010,
        },
        payload: {
          id: 1776,
          chainId: 'urn:ocn:polkadot:1000',
          content: {
            title: 'Treasury Guardian v2 - Test.0.1.0 *hello',
            link: 'https://polkadot.subsquare.io/referenda/1776',
          },
          triggeredBy: {
            name: 'Referenda.Rejected',
            data: {
              index: 1776,
              tally: {
                ayes: '172876753314892',
                nays: '383692910121746952',
                support: '189553296979477',
              },
            },
            blockHash: '0xe0c38f0caeb47b3c2408ae9138690dc4b7ca15b7bdfcb2398098b5195aea603c',
            blockNumber: '10474809',
          },
          blockNumber: '10474809',
          status: 'Rejected',
          humanized: {
            status: 'Rejected',
          },
          info: [
            28722810,
            {
              who: '12uzRiFHPB5tEKWQ2g7TKVcEy6QkwJR313h7gBcBMQKaQhZ7',
              amount: '10000000000',
            },
            {
              who: '12uzRiFHPB5tEKWQ2g7TKVcEy6QkwJR313h7gBcBMQKaQhZ7',
              amount: '1000000000000',
            },
          ],
          timeline: {
            finalizedAt: 28722810,
          },
          deposits: {},
        },
      },
    })
  })
})
