const BASE_URL = "http://localhost:8080";

const DURATION_SECONDS = 10;
const BATCH_SIZE = 300;
const REQUESTS_PER_SECOND = 50;
const INTERVAL_MS = 1000 / REQUESTS_PER_SECOND;

const batch = {
  logs: Array.from({ length: BATCH_SIZE }, () => ({
    timestamp: new Date().toISOString(),
    level: "info",
    service: "load-test",
    message: "synthetic load test log",
    attributes: {
      region: "eu-west",
      retries: 0,
    },
  })),
};

const inFlight = [];

let accepted = 0;
let rejected = 0;
let failed = 0;

const requestTimes = [];

async function sendBatch() {
  const start = performance.now();

  try {
    const response = await fetch(`${BASE_URL}/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });

    const text = await response.text();

    requestTimes.push((performance.now() - start) / 1000);

    if (!response.ok) {
      failed++;
      console.error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
      return;
    }

    const body = JSON.parse(text);

    accepted += Number(body.accepted ?? 0);

    rejected += Array.isArray(body.rejected) ? body.rejected.length : 0;
  } catch (error) {
    failed++;

    console.error(
      "Fetch error:",
      error instanceof Error ? error.message : error,
    );
  }
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);

  const index = Math.min(
    sorted.length - 1,
    Math.floor((sorted.length - 1) * p),
  );

  return sorted[index];
}

async function main() {
  const totalRequests = DURATION_SECONDS * REQUESTS_PER_SECOND;

  console.log(`Target: ${BATCH_SIZE * REQUESTS_PER_SECOND} logs/sec`);

  console.log(`Requests to launch: ${totalRequests}`);

  const start = Date.now();

  for (let i = 0; i < totalRequests; i++) {
    inFlight.push(sendBatch());

    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }

  console.log(`All ${totalRequests} requests launched.`);

  console.log("Waiting for in-flight requests...");

  await Promise.all(inFlight);

  const elapsed = (Date.now() - start) / 1000;

  const completedRequests = accepted / BATCH_SIZE;

  console.log("\nComplete");
  console.log(`Elapsed: ${elapsed.toFixed(2)}s`);
  console.log(`Completed batches: ${completedRequests}`);
  console.log(`Accepted: ${accepted}`);
  console.log(`Rejected: ${rejected}`);
  console.log(`Failed: ${failed}`);

  console.log(`Accepted logs/sec: ${(accepted / elapsed).toFixed(0)}`);

  console.log("\nPOST /logs latency:");
  console.log(`p50: ${percentile(requestTimes, 0.5).toFixed(4)}s`);
  console.log(`p95: ${percentile(requestTimes, 0.95).toFixed(4)}s`);
  console.log(`p99: ${percentile(requestTimes, 0.99).toFixed(4)}s`);
  console.log(`max: ${Math.max(...requestTimes).toFixed(4)}s`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
