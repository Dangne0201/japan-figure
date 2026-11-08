import { MetricsService } from '../src/metrics/metrics.service';

describe('MetricsService', () => {
  it('records bounded request labels and exports Prometheus text format', () => {
    const metrics = new MetricsService();
    metrics.record('GET', 200, 125);
    metrics.record('GET', 200, 75);
    metrics.record('UNBOUNDED METHOD', 999, 20);

    const output = metrics.render();

    expect(output).toContain('http_requests_total{method="GET",status="200"} 2');
    expect(output).toContain('http_request_duration_seconds_sum{method="GET",status="200"} 0.2');
    expect(output).toContain('http_requests_total{method="OTHER",status="500"} 1');
    expect(output).toContain('process_resident_memory_bytes');
  });
});
