const BASE_URL = "http://localhost:8080";

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth() {
  const maxAttempts = 30;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}/health`);

      if (response.ok) {
        return;
      }
    } catch {
      // Application may still be starting.
    }

    await sleep(1000);
  }

  throw new Error("Application did not become healthy within 30 seconds");
}

async function request(path, options = {}) {
  try {
    const response = await fetch(`${BASE_URL}${path}`, options);

    const text = await response.text();

    let body;

    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }

    return {
      status: response.status,
      body,
    };
  } catch (error) {
    throw new Error(
      `Request failed for ${path}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`FAIL: ${message}`);
  }

  console.log(`PASS: ${message}`);
}

async function main() {
  console.log("Waiting for application health...");
  await waitForHealth();

  console.log("Running API smoke tests...\n");

  // 2. Valid ingestion
  const ingest = await request("/logs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      logs: [
        {
          timestamp: new Date().toISOString(),
          level: "info",
          service: "smoke-test",
          message: "Smoke test log",
          attributes: {
            region: "eu-west",
            user_id: "smoke-user",
          },
        },
      ],
    }),
  });

  assert(ingest.status === 200, "POST /logs accepts a valid batch");

  assert(ingest.body.accepted === 1, "POST /logs accepts one valid log");

  // 3. Invalid entry + valid entry
  const mixed = await request("/logs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      logs: [
        {
          timestamp: new Date().toISOString(),
          level: "critical",
          service: "smoke-test",
          message: "Should reject",
        },
        {
          timestamp: new Date().toISOString(),
          level: "info",
          service: "smoke-test",
          message: "Should accept",
        },
      ],
    }),
  });

  assert(mixed.status === 200, "POST /logs supports partial batch acceptance");

  assert(mixed.body.accepted === 1, "Partial batch accepted count is correct");

  assert(
    Array.isArray(mixed.body.rejected) &&
      mixed.body.rejected.length === 1 &&
      mixed.body.rejected[0].index === 0,
    "Rejected entry contains its array index",
  );

  // 4. GET /logs
  const logs = await request("/logs?service=smoke-test&limit=2");

  assert(logs.status === 200, "GET /logs returns 200");

  assert(Array.isArray(logs.body.logs), "GET /logs returns a logs array");

  assert(
    Object.prototype.hasOwnProperty.call(logs.body, "next_cursor"),
    "GET /logs returns next_cursor",
  );

  // 5. Invalid limit
  const invalidLimit = await request("/logs?limit=0");

  assert(invalidLimit.status === 400, "Invalid limit returns 400");

  assert(
    typeof invalidLimit.body.error === "string",
    "Invalid limit returns an error object",
  );

  // 6. Invalid level
  const invalidLevel = await request("/logs?level=critical");

  assert(invalidLevel.status === 400, "Unsupported level returns 400");

  // 7. Invalid cursor
  const invalidCursor = await request("/logs?cursor=not-a-valid-cursor");

  assert(invalidCursor.status === 400, "Invalid cursor returns 400");

  // 8. Malformed JSON
  const malformed = await request("/logs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: '{"logs":[',
  });

  assert(malformed.status === 400, "Malformed JSON returns 400");

  // 9. Aggregation
  const aggregate = await request(
    "/logs/aggregate?since=2026-08-01T00:00:00Z&until=2026-08-20T00:00:00Z&bucket=1d",
  );

  assert(aggregate.status === 200, "GET /logs/aggregate returns 200");

  assert(Array.isArray(aggregate.body.buckets), "Aggregation returns buckets");

  // 10. Aggregation grouping
  const grouped = await request(
    "/logs/aggregate?since=2026-08-01T00:00:00Z&until=2026-08-20T00:00:00Z&bucket=1d&group_by=service",
  );

  assert(grouped.status === 200, "Aggregation supports group_by=service");

  console.log("\nAll API smoke tests passed.");
}

main().catch((error) => {
  console.error("\nSmoke tests failed.");
  console.error(error);
  process.exit(1);
});
