// In-memory request duration tracking for Prometheus

interface RouteDuration {
  count: number;
  sumMs: number;
  buckets: Record<string, number>; // threshold in ms -> count
}

const BUCKETS = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000];
const routeMetrics = new Map<string, RouteDuration>();

export function recordRequestDuration(route: string, durationMs: number) {
  let m = routeMetrics.get(route);
  if (!m) {
    m = { count: 0, sumMs: 0, buckets: {} };
    for (const b of BUCKETS) m.buckets[String(b)] = 0;
    m.buckets["+Inf"] = 0;
    routeMetrics.set(route, m);
  }

  m.count++;
  m.sumMs += durationMs;
  for (const b of BUCKETS) {
    if (durationMs <= b) m.buckets[String(b)]++;
  }
  m.buckets["+Inf"]++;
}

export function getRequestDurationMetrics(): string {
  const lines: string[] = [
    "# HELP sanbao_request_duration_ms Request duration in milliseconds",
    "# TYPE sanbao_request_duration_ms histogram",
  ];

  for (const [route, m] of routeMetrics) {
    for (const b of BUCKETS) {
      lines.push(`sanbao_request_duration_ms_bucket{route="${route}",le="${b}"} ${m.buckets[String(b)]}`);
    }
    lines.push(`sanbao_request_duration_ms_bucket{route="${route}",le="+Inf"} ${m.buckets["+Inf"]}`);
    lines.push(`sanbao_request_duration_ms_sum{route="${route}"} ${m.sumMs}`);
    lines.push(`sanbao_request_duration_ms_count{route="${route}"} ${m.count}`);
  }

  return lines.join("\n");
}
