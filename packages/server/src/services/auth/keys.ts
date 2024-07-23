import { KeyObject, createPrivateKey, createPublicKey } from 'node:crypto'
import fs from 'node:fs'
import { FastifyInstance } from 'fastify'

type KeyPair = {
  prv?: KeyObject
  pub: KeyObject
}

function importFromPEM(keyFile: string): KeyPair {
  if (keyFile.startsWith('-----BEGIN PRIVATE KEY-----')) {
    return { prv: createPrivateKey(keyFile), pub: createPublicKey(keyFile) }
  } else if (keyFile.startsWith('-----BEGIN PUBLIC KEY-----')) {
    return { pub: createPublicKey(keyFile) }
  } else {
    throw new Error('malformed key file')
  }
}

function importFromJWK(keyFile: string): KeyPair {
  const jwkJson = JSON.parse(keyFile) as Record<string, any>
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
export function importKeys(fastify: FastifyInstance, path: string) {
  try {
    const keyFile = fs.readFileSync(path, 'utf8')
    let pair: KeyPair

    fastify.log.info('[auth] Importing keys from %s', path)

    if (keyFile.startsWith('-----BEGIN')) {
      pair = importFromPEM(keyFile)
    } else {
      pair = importFromJWK(keyFile)
    }

    if (pair.prv) {
      fastify.log.info('[auth] Key pair imported')

      return {
        public: pair.pub.export({ type: 'spki', format: 'pem' }),
        private: pair.prv.export({ type: 'pkcs8', format: 'pem' }),
      }
    } else {
      fastify.log.info('[auth] Public key imported')
      fastify.log.info('[auth] No private key, signing is disabled')

      return {
        public: pair.pub.export({ type: 'spki', format: 'pem' }),
      }
    }
  } catch (error) {
    throw new Error('Fatal: Error while importing keys', { cause: error })
  }
}
