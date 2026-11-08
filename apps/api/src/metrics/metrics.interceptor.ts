import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, finalize } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    if (request.path === '/api/metrics') return next.handle();

    const startedAt = performance.now();
    return next.handle().pipe(
      finalize(() => {
        this.metrics.record(request.method, response.statusCode, performance.now() - startedAt);
      }),
    );
  }
}
