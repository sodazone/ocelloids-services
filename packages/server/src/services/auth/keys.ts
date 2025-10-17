import { createPrivateKey, createPublicKey, KeyObject } from 'node:crypto'

import { safeDestr } from 'destr'

type KeyPair = {
  prv?: KeyObject
  pub: KeyObject
}

function importFromPEM(keyData: string): KeyPair {
  if (keyData.startsWith('-----BEGIN PRIVATE KEY-----')) {
    return { prv: createPrivateKey(keyData), pub: createPublicKey(keyData) }
  } else if (keyData.startsWith('-----BEGIN PUBLIC KEY-----')) {
    return { pub: createPublicKey(keyData) }
  } else {
    throw new Error('malformed key file')
  }
}

function importFromJWK(keyFile: string): KeyPair {
  const jwkJson = safeDestr<Record<string, any>>(keyFile)
  const pub = createPublicKey({ key: jwkJson, format: 'jwk' })

  let prv: KeyObject | undefined

  if (jwkJson.d) {
    prv = createPrivateKey({ key: jwkJson, format: 'jwk' })
  }

  return { prv, pub }
}

/**
 * Import EdDSA keys from a file.
 */
export function importKeys(keyData: string) {
  try {
    const data = keyData.trim()
    let pair: KeyPair

    if (data.startsWith('-----BEGIN')) {
      pair = importFromPEM(data)
    } else {
      pair = importFromJWK(data)
    }

    if (pair.prv) {
      return {
        public: pair.pub.export({ type: 'spki', format: 'pem' }),
        private: pair.prv.export({ type: 'pkcs8', format: 'pem' }),
      }
    } else {
      return {
        public: pair.pub.export({ type: 'spki', format: 'pem' }),
      }
    }
  } catch (error) {
    throw new Error('Fatal: Error while importing keys', { cause: error })
  }
}
