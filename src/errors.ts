import { FastifyReply } from 'fastify';
import { ZodError } from 'zod';

export class NotFound extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function errorHandler(error: any, _: any, reply: FastifyReply) {
  if (error instanceof NotFound) {
    reply.status(404).send(error.message);
  } else if (error instanceof ZodError) {
    reply.status(400).send(error.message);
  } else if (error instanceof ValidationError) {
    reply.status(400).send(error.message);
  } else {
    // to parent handler
    reply.send(error);
  }
}