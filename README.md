# Log Ingestion and Query Service

A high-volume structured log ingestion and query service built with TypeScript, Express, PostgreSQL, and Drizzle ORM.

The service accepts structured log batches, validates each entry independently, stores logs in PostgreSQL, supports flexible filtering and cursor-based pagination, aggregates logs into time buckets, and automatically removes expired data according to a configurable retention policy.

## Architecture

```text
Client
  |
  v
Express API
  |
  +--> /health
  |
  +--> POST /logs
  |      |
  |      +--> per-entry validation
  |      +--> batch insertion
  |
  +--> GET /logs
  |      |
  |      +--> filters
  |      +--> cursor pagination
  |
  +--> GET /logs/aggregate
  |      |
  |      +--> filters
  |      +--> time buckets
  |      +--> grouping
  |
  +--> retention service
         |
         v
      PostgreSQL
```

PostgreSQL is the source of truth for both reads and writes.

## Tech Stack

- Node.js 22
- TypeScript
- Express 5
- PostgreSQL 17
- Drizzle ORM
- Vitest
- Docker Compose
- `pg_trgm` for substring message search

## Project Structure

```text
src/
├── controllers/
├── database/
│   ├── migrations/
│   ├── aggregateLogs.ts
│   ├── index.ts
│   ├── logs.ts
│   ├── queryLogs.ts
│   └── schema.ts
├── middleware/
├── routes/
├── services/
│   ├── logsService.ts
│   └── retentionService.ts
├── utils/
├── validators/
├── index.ts
└── server.ts

scripts/
├── benchmark.sh
├── batch-benchmark.mjs
├── ingestion-test.mjs
├── load-test.mjs
└── load-test.sh

tests/
└── logValidator.test.ts

.github/
└── workflows/
    └── ci.yml
```

## Running the Project

The required configuration is built directly into `docker-compose.yml`.

No `.env.docker` file or manual database setup is required.

### Start the full system

```bash
docker compose up --build
```

The application listens on:

```text
http://localhost:8080
```

PostgreSQL is exposed locally on:

```text
localhost:5433
```

### Health check

```bash
curl http://localhost:8080/health
```

Example response:

```json
{
  "status": "ok",
  "service": "log-ingestion-service"
}
```

The application performs database migrations before starting the HTTP server and checks the database connection before returning healthy.

### Local development

Install dependencies:

```bash
npm install
```

Run in development mode:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Run production build:

```bash
npm start
```

Run migrations manually:

```bash
npm run migrate
```

Generate migrations:

```bash
npm run generate
```

## API

## GET /health

Returns HTTP 200 when the service is ready and the database connection is available.

If the database connection is unavailable, the endpoint returns HTTP 503.

---

## POST /logs

Accepts a batch of structured logs.

A batch containing a single log is valid.

### Request

```json
{
  "logs": [
    {
      "timestamp": "2026-07-20T14:32:01.123Z",
      "level": "error",
      "service": "checkout",
      "message": "payment declined",
      "attributes": {
        "user_id": "42",
        "region": "eu-west",
        "retries": 3
      }
    }
  ]
}
```

### Validation

Each entry is validated independently.

#### timestamp

- Required
- Must be a valid ISO 8601 timestamp
- Cannot be more than five minutes in the future

#### level

Allowed values:

```text
debug
info
warn
error
```

#### service

- Required
- Must be a non-empty string

#### message

- Required
- Must be a non-empty string

#### attributes

Optional JSON object.

Supported values:

- strings
- numbers
- booleans

Nested objects and arrays are rejected.

### Partial batch behavior

An invalid entry does not invalidate the entire batch.

Example:

```json
{
  "accepted": 1,
  "rejected": [
    {
      "index": 0,
      "reason": "invalid level: 'critical'"
    }
  ]
}
```

HTTP 200 is returned when at least one entry is accepted.

HTTP 400 is returned when:

- all entries are rejected
- the JSON body is malformed
- the top-level request structure is invalid
- the request body is too large

The JSON body limit is configured to 2 MB.

---

## GET /logs

Returns logs sorted by timestamp descending.

The ordering is deterministic by using:

```text
timestamp DESC, id DESC
```

### Supported filters

```text
service
level
since
until
attr.<key>
q
limit
cursor
```

Examples:

```bash
curl "http://localhost:8080/logs?service=auth"

curl "http://localhost:8080/logs?level=error"

curl "http://localhost:8080/logs?since=2026-08-01T00:00:00Z"

curl "http://localhost:8080/logs?until=2026-08-10T00:00:00Z"

curl "http://localhost:8080/logs?attr.user_id=42"

curl "http://localhost:8080/logs?q=payment"

curl "http://localhost:8080/logs?service=auth&level=info"
```

Filters can be combined.

### Pagination

The endpoint uses cursor-based pagination.

Example:

```json
{
  "logs": [
    {
      "id": "any-unique-id",
      "timestamp": "2026-07-20T14:32:01.123Z",
      "level": "error",
      "service": "checkout",
      "message": "payment declined",
      "attributes": {
        "user_id": "42"
      }
    }
  ],
  "next_cursor": "opaque-cursor"
}
```

`next_cursor` is `null` when no more results are available.

The cursor is treated as opaque by clients.

The supported `limit` range is:

```text
1-100
```

### Invalid parameters

Invalid parameters return HTTP 400:

```json
{
  "error": "description"
}
```

Examples include:

- invalid timestamps
- `until` earlier than `since`
- unsupported levels
- invalid limits
- invalid cursors

---

## GET /logs/aggregate

Returns time-bucketed log counts.

Supported filters:

- `service`
- `level`
- `attr.<key>`
- `q`

Aggregation parameters include:

- `since`
- `until`
- `bucket`
- `group_by`

Supported buckets:

```text
1m
5m
1h
1d
```

Supported grouping dimensions:

```text
service
level
```

### Example

```bash
curl "http://localhost:8080/logs/aggregate?since=2026-08-01T00:00:00Z&until=2026-08-10T00:00:00Z&bucket=1h"
```

Example response:

```json
{
  "buckets": [
    {
      "start": "2026-08-09 15:00:00+00",
      "group": null,
      "count": 3
    }
  ]
}
```

With grouping:

```bash
curl "http://localhost:8080/logs/aggregate?since=2026-08-01T00:00:00Z&until=2026-08-10T00:00:00Z&bucket=1h&group_by=service"
```

Example:

```json
{
  "buckets": [
    {
      "start": "2026-08-09 15:00:00+00",
      "group": "auth",
      "count": 2
    },
    {
      "start": "2026-08-09 15:00:00+00",
      "group": "payment",
      "count": 1
    }
  ]
}
```

Results are ordered by bucket start time ascending.

Invalid aggregation parameters return HTTP 400 using the same error structure as `GET /logs`.

---

## Retention

Logs are retained for a configurable number of days.

Configuration:

```text
RETENTION_DAYS
```

Default:

```text
30
```

Expired logs are deleted in batches of 5,000 rows.

Retention runs:

1. once during application startup
2. automatically every hour

A manual administrative trigger is also available:

```text
POST /admin/retention/run
```

Example:

```bash
curl -X POST http://localhost:8080/admin/retention/run
```

Response:

```json
{
  "deleted": 20
}
```

The manual endpoint is primarily intended for operational testing and demonstration.

## Database Schema

The main `logs` table contains:

| Column       | Type        | Description               |
| ------------ | ----------- | ------------------------- |
| `id`         | UUID        | Primary key               |
| `timestamp`  | timestamptz | Event timestamp           |
| `level`      | text        | Log level                 |
| `service`    | text        | Service name              |
| `message`    | text        | Log message               |
| `attributes` | jsonb       | Arbitrary flat attributes |
| `created_at` | timestamptz | Ingestion timestamp       |

## Attribute Storage Strategy

Attributes are stored as PostgreSQL `JSONB`.

Example:

```json
{
  "user_id": "42",
  "region": "eu-west",
  "retries": 3
}
```

JSONB was chosen because the project requires arbitrary key/value attributes whose keys are not known in advance.

A GIN index supports containment-based attribute queries:

```sql
attributes @> '{"region":"eu-west"}'
```

The ingestion validator guarantees that attributes remain flat and contain only supported scalar values.

## Index Design

The current indexes are:

```text
timestamp_idx
service_timestamp_idx
level_timestamp_idx
attributes_idx
message_trgm_idx
```

### timestamp_idx

Supports time-range filtering and timestamp-ordered queries.

### service_timestamp_idx

Supports queries that combine service filtering with time constraints and ordering.

### level_timestamp_idx

Supports level + time filtering.

### attributes_idx

GIN index on JSONB attributes.

Used for attribute containment queries.

### message_trgm_idx

GIN trigram index using the PostgreSQL `pg_trgm` extension.

Used for substring searches such as:

```sql
message ILIKE '%payment%'
```

## Performance and Load Testing

The project was tested locally under the required resource limits.

### Container limits

Application:

```text
0.5 CPU
256 MB RAM
```

PostgreSQL:

```text
1 CPU
1 GB RAM
```

PostgreSQL JIT was disabled during testing because it introduced substantial overhead for the tested workloads.

### Dataset

The local database was populated with more than one million log records.

During testing, the dataset grew beyond:

```text
1,000,000 rows
```

### Baseline ingestion results

Using batched insertion with the current schema and indexes, observed ingestion throughput was approximately:

```text
1,200-1,500 logs/sec
```

The service successfully handled the completed benchmark runs without application crashes in the final stable configuration. Some earlier high-concurrency experiments produced failed requests and increased latency; these results were used to identify database write contention and tuning limits.

### Batch-size experiments

Observed local results:

| Batch size | Concurrency | Observed throughput |
| ---------- | ----------: | ------------------: |
| 300        |          10 |       ~464 logs/sec |
| 500        |          10 |     ~1,217 logs/sec |
| 1000       |          10 |     ~1,239 logs/sec |

The 1000-log batch required increasing the JSON request limit from Express's default approximately 100 KB to 2 MB.

### Aggregation baseline

For a dataset of more than one million records, local aggregation performance without simultaneous heavy ingestion was measured below one second in the tested workload.

A representative local measurement was approximately:

```text
Execution Time: ~0.47 sec
```

In another aggregation workload:

```text
Execution Time: ~0.68 sec
```

### Concurrent ingestion and aggregation

Under sustained ingestion, aggregation latency degraded significantly because PostgreSQL was handling concurrent writes and reads with the configured indexes.

This identified PostgreSQL write throughput and index maintenance as the main observed bottlenecks in the current implementation.

### Message search

The `pg_trgm` index significantly improves substring candidate lookup compared with scanning all records, but very common search terms can still require substantial heap reads and sorting.

For example, a highly frequent term such as `payment` caused multi-second queries on the large local dataset.

This is documented as a known workload limitation rather than hidden from evaluation.

## Resource Usage

During local testing, the containers remained within the required limits.

The application process remained below the 256 MB memory limit.

PostgreSQL remained below the configured 1 GB memory limit.

The main bottleneck observed during load testing was database write contention rather than application CPU or application memory exhaustion.

## Optimizations Applied

The following optimizations were implemented and measured:

- composite `(service, timestamp)` index
- composite `(level, timestamp)` index
- GIN JSONB attribute index
- PostgreSQL `pg_trgm` message index
- disabled PostgreSQL JIT for the container workload
- cursor-based pagination
- batched ingestion
- configurable JSON request body limit
- automatic retention in batches
- application request logging disabled by default during benchmarks
- PostgreSQL connection pool explicitly configured

Several alternative ingestion approaches were experimentally tested. A concurrent `COPY FROM STDIN` implementation was rejected because the tested concurrent implementation caused PostgreSQL connection protocol synchronization errors. The stable batched insert implementation was retained.

## Testing

### Unit tests

Run:

```bash
npm test -- --run
```

Current validator test coverage includes:

- valid log acceptance
- invalid level rejection
- required timestamp validation
- required service validation
- required message validation

### API smoke tests

Run:

```bash
node scripts/smoke-test.mjs
```

The smoke test verifies:

- `/health`
- valid ingestion
- partial batch acceptance
- rejected entry indexes
- `GET /logs`
- cursor response
- invalid limits
- invalid levels
- invalid cursors
- malformed JSON
- aggregation
- grouped aggregation

## Continuous Integration

GitHub Actions performs:

1. dependency installation
2. TypeScript build
3. unit tests
4. Docker Compose startup
5. health verification
6. API smoke tests
7. Docker cleanup

CI workflow:

```text
.github/workflows/ci.yml
```

## Optional Features

No optional authentication, API keys, multi-tenancy, or rate limiting are enabled.

The default Docker Compose configuration provides the plain unauthenticated core service required by the load generator.

## Known Limitations

1. The current local ingestion implementation did not reach the target of 15,000 logs/sec under the tested local workload and resource limits.
2. High write concurrency can create database contention and increase query latency.
3. Very common substring searches can remain expensive even with the trigram index because many rows may match.
4. The current implementation prioritizes correctness, predictable behavior, and PostgreSQL as the source of truth over more aggressive ingestion architectures such as asynchronous durable queues or pre-aggregated rollups.

## Demo Checklist

Recommended demonstration flow:

```text
1. docker compose up
2. GET /health
3. POST /logs
4. GET /logs with filters
5. cursor pagination
6. GET /logs/aggregate
7. retention trigger
8. EXPLAIN ANALYZE for important queries
9. explain schema and indexes
10. show CI / tests
```

## License

This project was created as a technical final project for evaluation purposes.
