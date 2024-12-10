import { FastifyReply } from 'fastify'
import { ZodError } from 'zod'

export class NotFound extends Error {
  statusCode = 404

  constructor(message: string = 'not found') {
    super(message)
  }
}

export class ValidationError extends Error {
  statusCode = 400

  constructor(message: string = 'validation error') {
    super(message)
  }
}

export class AuthorizationError extends Error {
  statusCode = 401

  constructor(message: string = 'authorization error') {
    super(message)
  }
}

export function errorMessage(error: any) {
  return error instanceof Error ? error.message : String(error)
}

function jsonError(error: any) {
  return JSON.stringify({
    error: true,
    statusCode: error.statusCode,
    reason: errorMessage(error),
  })
}

export function errorHandler(error: any, _: any, reply: FastifyReply) {
  if (error.statusCode) {
    reply.status(error.statusCode).send(jsonError(error))
  } else if (error instanceof ZodError) {
    reply.status(400).send(jsonError(error))
  } else {
    // to parent handler
    reply.status(500).send(jsonError(error))
  }
}
