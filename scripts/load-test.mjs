const BASE_URL = "http://localhost:8080";

const DURATION_SECONDS = 30;
const BATCH_SIZE = 300;
const REQUESTS_PER_SECOND = 50;

const aggregationTimes = [];

let accepted = 0;
let rejected = 0;
let failedRequests = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildLog() {
  return {
    timestamp: new Date().toISOString(),
    level: "info",
    service: "load-test",
    message: "synthetic load test log",
    attributes: {
      region: "eu-west",
      retries: 0,
    },
  };
}

const batch = {
  logs: Array.from(
    { length: BATCH_SIZE },
    buildLog,
  ),
};

async function sendBatch() {
  try {
    const response = await fetch(`${BASE_URL}/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });

    const body = await response.json();

    if (!response.ok) {
      failedRequests++;
      return;
    }

    accepted += Number(body.accepted ?? 0);
    rejected += Array.isArray(body.rejected)
      ? body.rejected.length
      : 0;
  } catch (error) {
    failedRequests++;
  }
}

async function runAggregation() {
  const start = performance.now();

  try {
    const response = await fetch(
      `${BASE_URL}/logs/aggregate?since=2026-08-05T00:00:00Z&until=2026-08-16T00:00:00Z&bucket=1h&group_by=service`,
    );

    if (!response.ok) {
      failedRequests++;
    }
  } catch (error) {
    failedRequests++;
  }

  aggregationTimes.push(
    (performance.now() - start) / 1000,
  );
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort(
    (a, b) => a - b,
  );

  const index = Math.min(
    sorted.length - 1,
    Math.floor(
      (sorted.length - 1) * p,
    ),
  );

  return sorted[index];
}

async function main() {
  console.log("Starting load test...");
  console.log(`Duration: ${DURATION_SECONDS}s`);
  console.log(
    `Target ingestion: ${
      BATCH_SIZE * REQUESTS_PER_SECOND
    } logs/sec`,
  );
  console.log(
    `Batch size: ${BATCH_SIZE}`,
  );

  const startTime = Date.now();

  for (
    let second = 0;
    second < DURATION_SECONDS;
    second++
  ) {
    const secondStart = Date.now();

    const requests = Array.from(
      { length: REQUESTS_PER_SECOND },
      () => sendBatch(),
    );

    const aggregationRequest =
      runAggregation();

    await Promise.all([
      ...requests,
      aggregationRequest,
    ]);

    const elapsed =
      Date.now() - secondStart;

    const remaining =
      1000 - elapsed;

    if (remaining > 0) {
      await sleep(remaining);
    }
  }

  const elapsedSeconds =
    (Date.now() - startTime) / 1000;

  const totalSubmitted =
    accepted + rejected;

  console.log("\nLoad test complete.");
  console.log(
    `Elapsed: ${elapsedSeconds.toFixed(2)}s`,
  );
  console.log(
    `Accepted: ${accepted}`,
  );
  console.log(
    `Rejected: ${rejected}`,
  );
  console.log(
    `Failed requests: ${failedRequests}`,
  );
  console.log(
    `Submitted logs: ${totalSubmitted}`,
  );
  console.log(
    `Observed ingestion rate: ${(
      totalSubmitted / elapsedSeconds
    ).toFixed(0)} logs/sec`,
  );

  console.log("\nAggregation latency:");
  console.log(
    `p50: ${percentile(
      aggregationTimes,
      0.50,
    ).toFixed(4)}s`,
  );
  console.log(
    `p95: ${percentile(
      aggregationTimes,
      0.95,
    ).toFixed(4)}s`,
  );
  console.log(
    `p99: ${percentile(
      aggregationTimes,
      0.99,
    ).toFixed(4)}s`,
  );
  console.log(
    `max: ${Math.max(
      ...aggregationTimes,
    ).toFixed(4)}s`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
