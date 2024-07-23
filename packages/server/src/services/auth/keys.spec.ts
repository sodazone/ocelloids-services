import { importKeys } from './keys.js'

describe('import keys', () => {
  it('should fail on malformed file', () => {
    expect(() => {
      importKeys('blah')
    }).toThrow()
  })

  it('should fail on malformed PEM', () => {
    expect(() => {
      importKeys('-----BEGIN BLAH')
    }).toThrow()
  })

  it('should fail on malformed JWK', () => {
    expect(() => {
      importKeys(`
  {
    "use":"sig",
    "kty":"OKP",
    "kid":"y27ec-ZpjEcWSAbGz6zt_08nWkJ18Db21vLKlwkLxSY=",
    "crv":"Ed25519",
    "alg":"EdDSA"
  }
      `)
    }).toThrow()
  })

  it('should import in JWK format', () => {
    const keys = importKeys(`
  {
    "use":"sig",
    "kty":"OKP",
    "kid":"y27ec-ZpjEcWSAbGz6zt_08nWkJ18Db21vLKlwkLxSY=",
    "crv":"Ed25519",
    "alg":"EdDSA",
    "d": "OrUxD8lEjqIu7Rhi_Wo590NOTMNGYM3kMlETMSimFZc",
    "x": "O6ljryhfUImIYY05ZsbEehfKE-YXu3e_FSV0CqZr-9s"
  }
      `)

    expect(keys.public).toBeDefined()
    expect(keys.private).toBeDefined()
  })

  it('should import public key in JWK format', () => {
    const keys = importKeys(`
  {
    "use":"sig",
    "kty":"OKP",
    "kid":"y27ec-ZpjEcWSAbGz6zt_08nWkJ18Db21vLKlwkLxSY=",
    "crv":"Ed25519",
    "alg":"EdDSA",
    "x": "O6ljryhfUImIYY05ZsbEehfKE-YXu3e_FSV0CqZr-9s"
  }
      `)

    expect(keys.public).toBeDefined()
    expect(keys.private).toBeUndefined()
  })

  it('should import in PEM format', () => {
    const keys = importKeys(`
-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIP1Kdh0YszeAopPgvK+k4gC6OIGnYhjf1n3Pib0ipKhR
-----END PRIVATE KEY-----
      `)

    expect(keys.public).toBeDefined()
    expect(keys.private).toBeDefined()
  })

  it('should import public key in PEM format', () => {
    const keys = importKeys(`
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAH4E3i4d0XTL2rqLdE7j1n6Xa2MZ6ApyPGNmpnjLPd8Y=
-----END PUBLIC KEY-----
      `)

    expect(keys.public).toBeDefined()
    expect(keys.private).toBeUndefined()
  })
})
