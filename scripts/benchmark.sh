#!/usr/bin/env bash

set -e

URL="http://localhost:8080/logs/aggregate?since=2026-08-05T00:00:00Z&until=2026-08-12T00:00:00Z&bucket=1h&group_by=service"

COUNT=100

echo "Running ${COUNT} requests..."

for i in $(seq 1 "$COUNT"); do
  curl -s -o /dev/null \
    -w "%{time_total}\n" \
    "$URL"
done > /tmp/log_benchmark_times.txt

echo
echo "Benchmark complete."
echo "Results saved to /tmp/log_benchmark_times.txt"

python3 - <<'PY'
import statistics

with open("/tmp/log_benchmark_times.txt") as f:
    values = sorted(float(x.strip()) for x in f if x.strip())

def percentile(values, p):
    index = int((len(values) - 1) * p)
    return values[index]

print(f"count: {len(values)}")
print(f"min:   {min(values):.4f}s")
print(f"mean:  {statistics.mean(values):.4f}s")
print(f"p50:   {percentile(values, 0.50):.4f}s")
print(f"p95:   {percentile(values, 0.95):.4f}s")
print(f"p99:   {percentile(values, 0.99):.4f}s")
print(f"max:   {max(values):.4f}s")
PY