import { TemplateRenderer } from '../../template.js'
import { Gov2Template } from './gov2.js'

describe('Gov2', () => {
  const renderer = new TemplateRenderer()
  it('should render rejection payload', () => {
    renderer.render({
      template: Gov2Template,
      data: {
        payload: {
          id: 617,
          chainId: 'urn:ocn:kusama:1000',
          triggeredBy: {
            name: 'Referenda.Rejected',
            data: {
              index: 617,
              tally: { ayes: '102537270388596405', nays: '343287503590891733', support: '24743370388596405' },
            },
            blockHash: '0x9475ae9815fe076deb69c06bdd3043d90878791fc597dc6e7e14d042691bc694',
            blockNumber: '11895842',
          },
          blockNumber: '11895842',
          status: 'Rejected',
          info: [
            31243952,
            { who: 'D67W9MmqCjspzTVmNXL1uQXxDGAJDXvdkTwpBYQjaApT1mT', amount: '33333333333' },
            { who: 'D67W9MmqCjspzTVmNXL1uQXxDGAJDXvdkTwpBYQjaApT1mT', amount: '6666666666600' },
          ],
          timeline: { finalizedAt: 31243952 },
          deposits: {},
          content: {
            title: '[Medium Spender] Referendum #617',
            link: 'https://kusama.subsquare.io/referenda/617',
          },
          humanized: { status: '👎 Rejected' },
        },
      },
    })
  })
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
          info: {
            track: 33,
            origin: {
              type: 'Origins',
              value: {
                type: 'MediumSpender',
              },
            },
          },
          timeline: {
            finalizedAt: 28722810,
          },
          deposits: {},
        },
      },
    })
  })
})
