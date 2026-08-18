const BASE_URL = "http://localhost:8080";

const DURATION_SECONDS = 10;

const scenarios = [
  { batchSize: 300, concurrency: 10 },
  { batchSize: 500, concurrency: 10 },
  { batchSize: 1000, concurrency: 10 },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createBatch(batchSize) {
  return {
    logs: Array.from({ length: batchSize }, () => ({
      timestamp: new Date().toISOString(),
      level: "info",
      service: "batch-benchmark",
      message: "benchmark log",
      attributes: {
        region: "eu-west",
        retries: 0,
      },
    })),
  };
}

async function sendBatch(batch) {
  const start = performance.now();

  try {
    const response = await fetch(`${BASE_URL}/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });

    const elapsed = (performance.now() - start) / 1000;

    const text = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        accepted: 0,
        elapsed,
        error: `HTTP ${response.status}: ${text.slice(0, 100)}`,
      };
    }

    const body = JSON.parse(text);

    return {
      ok: true,
      accepted: Number(body.accepted ?? 0),
      elapsed,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      accepted: 0,
      elapsed: (performance.now() - start) / 1000,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runScenario(batchSize, concurrency) {
  const batch = createBatch(batchSize);

  let accepted = 0;
  let failed = 0;
  const latencies = [];

  const endTime = Date.now() + DURATION_SECONDS * 1000;

  async function worker() {
    while (Date.now() < endTime) {
      const result = await sendBatch(batch);

      accepted += result.accepted;
      latencies.push(result.elapsed);

      if (!result.ok) {
        failed++;
      }
    }
  }

  const started = Date.now();

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const elapsed = (Date.now() - started) / 1000;

  latencies.sort((a, b) => a - b);

  const percentile = (p) => {
    if (latencies.length === 0) {
      return 0;
    }

    const index = Math.min(
      latencies.length - 1,
      Math.floor((latencies.length - 1) * p),
    );

    return latencies[index];
  };

  console.log(`\nBatch=${batchSize}, concurrency=${concurrency}`);

  console.log(`accepted: ${accepted}`);

  console.log(`failed: ${failed}`);

  console.log(`logs/sec: ${(accepted / elapsed).toFixed(0)}`);

  console.log(`p50: ${percentile(0.5).toFixed(3)}s`);

  console.log(`p95: ${percentile(0.95).toFixed(3)}s`);

  console.log(`p99: ${percentile(0.99).toFixed(3)}s`);
}

async function main() {
  const health = await fetch(`${BASE_URL}/health`);

  if (!health.ok) {
    throw new Error(`Health check failed: ${health.status}`);
  }

  for (const scenario of scenarios) {
    await runScenario(scenario.batchSize, scenario.concurrency);

    await sleep(2000);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
