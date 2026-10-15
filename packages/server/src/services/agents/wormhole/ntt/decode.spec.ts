import { _test_whscanResponse } from '@/testing/apis/wormhole/data.js'
import { decodeNttFromRawVaa, toNttOp } from './decode.js'

describe('wormhole payload decoding', () => {
  describe('decodeTransferPayload', () => {
    it('should decode raw VAA with NTT payload', () => {
      const vaa =
        'AQAAAAcNACUGlO9kCFrOGYo63vKgIqLJJDKNK5s9kNYegsAXng5KbDFuyK+y7GL3fYz2iVClh+l/qNK+5lixzZbNKzdVXKcBA5VB2qUkIYMx9SeiVadKiI6R72JGL71fXZLZdM5VLEi+RkJvCCxgeETvOyeAQrtGiOnUDe/0BxZpdyZ4+6kbc0QABo9G2NkiB6N2xAhp6syVJMLkVXOxTZiasYXHY7WyYGTxRlvd9Cv8DywMPnVFsrG6l9oyJYC8fpc4fHgSRUjHyCsABx9RN1G3T+h8O8mUhNyWQ0WpnikLq94ToPMbw5C124FEHpsBuDt+3zNsrRRobIjJ7NX3N8Nqc9sP9HvQDbx8HEcBCFKQMQHT/hqkto5OaMRUn2sLgsmK2W07NJ2cmebKlxN6MuB+fJ1vYNvD+/eox9PgSqt5ktAvGSM/1RvtfMO1/GMACYZErX/paDeGDY76fra6Ql/mH2Ebg3J5ANtppWRutREiGxh/igUn5CL4vF4M7Z+agFv5Erp1g1ZYKtg63ulWyDABC2NbcixEzLaEVIs4Xa+nXl2lWSXZCCuzlc8QZkwMt4awF3Iwasirbycmc7HihcfybkrYQCNrmLgNezkhcVYPOhAADIryE2oOO8l5TExt6gFd6+pNk5xiWCtUMWrY6r40MIGDdMPZ8zqxa8nyaHZh60MWuCYfSUMJExRprtWcatu9JHQBDR+ft88TLduXDXCseRoiuO3prS1XZHmlBYlBeS/4ECqsHteE3SEZKlKL7DToghM9aDg3bNsTwh3nAOokXOebxJ4AD8ZOym0yLDh3yUG6sd2tRVhp4mLnnwDcPqcl/ODF+u9lUDDYnsaCpFO5Y4dwsK+ubHcdUxPQPISU4P2QnjaZffcAEFQlgFVRlmDqh6Y+Kz8Mrt1U9+JIYphpwdrWbsTFzMGnXPKwOemTkgG+TNAwuv8plR8nVCgfp0EbPdNfjCjCI/0AEWahvtCuuDHwiJUtMbbLmpa4T+czGFHQpziE3/npl3ufHkwIZn4Z456cyNkeo6zBazCgjKN8KcMROxjLuAJ6xUMAEig9VCy8kD4JOl1NrtsMDLVKLTgNtxR9dQyHeP/kika3Jxv2NECJhKDXSH1O6QVVEzTaHm4LsHnJsB2nABIIPEIBas5F2gAAAAAAD8pAkkIDFtVc+7mkecoj/fD1oIZKgMdVtG4HHINPvzl2AAAAAAAAAAYAmUX/EMpAkkIDFtVc+7mkecoj/fD1oIZKgMdVtG4HHINPvzl2AAAAAAAAAAAAAAAA4gztX1eYzU/rx64YIwm59RNF4MwAkQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFsqooS669J38Hicc/PtfLvE0PFf2ffuZD9l9C7t60LAgAT5lOVFQIAAAAAAAD9WoxdERrjMmBl9byyeUE1tIp8K2wDSt1Zq8OVKhKh2/vDwAAAAAAAAAAAAAAAIL7Aq/gL+XWx5MUWnXmhgxOIGaCAEkAAA=='
      const decoded = decodeNttFromRawVaa(vaa)
      expect(decoded).toBeDefined()
    })
  })

  describe('toNttOp', () => {
    it('should transform bare op to op with ntt payload', () => {
      const op = _test_whscanResponse('ntt-hydration-near_zec.json')

      const nttOp = toNttOp(op)
      expect(nttOp).toBeDefined()
      expect(nttOp.content.payload).toBeDefined()
      expect(nttOp.content.payload.nttManagerMessage).toBeDefined()
      expect(nttOp.content.payload.nttMessage).toBeDefined()
      expect(nttOp.content.payload.transceiverMessage).toBeDefined()
      expect(nttOp.content.standarizedProperties.fromChain).toBe(73)
      expect(nttOp.content.standarizedProperties.toChain).toBe(15)
    })

    it('should throw on op that is not ntt', () => {
      const op = _test_whscanResponse('ethereum-moonbeam_weth.json')
      expect(() => toNttOp(op)).toThrow()
    })
  })
})
