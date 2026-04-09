import { subtle } from 'node:crypto'

const algHmac256 = { name: 'HMAC', hash: 'SHA-256' }
const encoder = new TextEncoder()

function toBuffer(data: string | Buffer) {
  return Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8')
}

async function sign(secret: string, data: string | Buffer, algorithm = algHmac256) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), algorithm, false, ['sign'])
  const buf = toBuffer(data)
  const input = new Uint8Array(buf.length)
  input.set(buf)
  const signature = Buffer.from(await subtle.sign(algorithm, key, input))

  return signature.toString('base64')
}

async function verify(secret: string, signature: string, data: string | Buffer, algorithm = algHmac256) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), algorithm, false, ['verify'])
  const signatureBytes = Buffer.from(signature, 'base64')
  const buf = toBuffer(data)
  const input = new Uint8Array(buf.length)
  input.set(buf)

  return await subtle.verify(algorithm, key, signatureBytes, input)
}

export const hmac256 = {
  sign,
  verify,
}
