import { Injectable } from '@nestjs/common';

interface RequestMetrics {
  count: number;
  durationSeconds: number;
}

@Injectable()
export class MetricsService {
  private readonly allowedMethods = new Set([
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
    'HEAD',
  ]);
  private readonly requests = new Map<string, RequestMetrics>();

  record(method: string, statusCode: number, durationMs: number): void {
    const safeMethod = this.allowedMethods.has(method) ? method : 'OTHER';
    const safeStatus =
      Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599 ? statusCode : 500;
    const key = `${safeMethod},${safeStatus}`;
    const current = this.requests.get(key) ?? { count: 0, durationSeconds: 0 };
    current.count += 1;
    current.durationSeconds += Math.max(durationMs, 0) / 1000;
    this.requests.set(key, current);
  }

  render(): string {
    const lines = [
      '# HELP process_uptime_seconds Process uptime in seconds.',
      '# TYPE process_uptime_seconds gauge',
      `process_uptime_seconds ${process.uptime()}`,
      '# HELP process_resident_memory_bytes Resident memory size in bytes.',
      '# TYPE process_resident_memory_bytes gauge',
      `process_resident_memory_bytes ${process.memoryUsage().rss}`,
      '# HELP http_requests_total Completed HTTP requests.',
      '# TYPE http_requests_total counter',
      '# HELP http_request_duration_seconds_sum Total duration of completed HTTP requests.',
      '# TYPE http_request_duration_seconds_sum counter',
    ];

    for (const [key, metrics] of this.requests) {
      const [method, status] = key.split(',');
      const labels = `{method="${method}",status="${status}"}`;
      lines.push(`http_requests_total${labels} ${metrics.count}`);
      lines.push(`http_request_duration_seconds_sum${labels} ${metrics.durationSeconds}`);
    }

    return `${lines.join('\n')}\n`;
  }
}
