import { randomUUID } from 'node:crypto';
import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const suppliedId = request.header('x-request-id');
    const requestId =
      suppliedId && /^[a-zA-Z0-9._-]{1,100}$/.test(suppliedId) ? suppliedId : randomUUID();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    response.on('finish', () => {
      console.log(
        JSON.stringify({
          level: 'info',
          requestId,
          method: request.method,
          path: request.originalUrl,
          statusCode: response.statusCode,
          timestamp: new Date().toISOString(),
        }),
      );
    });
    next();
  }
}
