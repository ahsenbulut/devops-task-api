# devops-task-api

A small Task REST API built with Node.js, TypeScript and Express. The application itself is
deliberately simple: it is the workload for an **end-to-end DevOps CI/CD case**, where the focus is
on code quality gates, testing, security scanning, containerization and GitOps-based delivery to
Kubernetes.

## Tech stack

| Area            | Tools                                                      |
| --------------- | ---------------------------------------------------------- |
| Runtime         | Node.js 22 (see `.nvmrc`), TypeScript (strict), ES modules |
| Web framework   | Express 5                                                  |
| Code quality    | ESLint (typescript-eslint, type-aware), Prettier, `tsc`    |
| Testing         | Vitest, Supertest, V8 coverage (text, LCOV, JSON summary)  |
| Package manager | npm (`package-lock.json` committed, `npm ci` supported)    |

No database or external service is required.

## Project structure

```text
src/
├── app.ts                 # Express app factory (no port binding, used by tests)
├── server.ts              # Process entrypoint: listen, graceful shutdown
├── config.ts              # Environment-based configuration
├── logger.ts              # Structured JSON logging to stdout/stderr
├── errors.ts              # HttpError, ValidationError, NotFoundError
├── models/task.ts         # Task types and limits
├── store/task-store.ts    # In-memory storage (Map)
├── services/task-service.ts  # Validation and business logic
├── routes/                # HTTP routing (health, tasks)
└── middleware/            # Request logging, 404 and error handlers
tests/
├── unit/                  # Service, config and logger tests
└── integration/           # HTTP tests via Supertest against createApp()
```

Responsibilities are layered: **routes** translate HTTP to service calls, the **service** validates
input and applies business rules, and the **store** only keeps data. Errors thrown anywhere are
mapped to JSON responses with the correct status code by a single error handler.

## Getting started

```bash
npm ci              # clean, reproducible install from package-lock.json
npm run dev         # start with hot reload (tsx watch)

npm run build       # clean dist/ and compile to it
npm start           # run the compiled app
```

### Configuration

| Variable              | Default | Description                                             |
| --------------------- | ------- | ------------------------------------------------------- |
| `PORT`                | `3000`  | HTTP port                                               |
| `LOG_LEVEL`           | `info`  | `debug`, `info`, `warn`, `error` or `silent`            |
| `SHUTDOWN_TIMEOUT_MS` | `10000` | Max time to drain connections on SIGTERM before exiting |

Logs are written as one JSON object per line: `debug`/`info` to **stdout**, `warn`/`error` to
**stderr**.

## API

All responses are JSON. Errors use the shape `{ "error": { "message": "...", "details": [...] } }`.

| Method | Path             | Description                      | Success | Errors |
| ------ | ---------------- | -------------------------------- | ------- | ------ |
| GET    | `/health/live`   | Liveness: the process is running | 200     | –      |
| GET    | `/health/ready`  | Readiness: can accept traffic    | 200     | 503    |
| GET    | `/api/tasks`     | List tasks                       | 200     | –      |
| GET    | `/api/tasks/:id` | Get a task by id                 | 200     | 404    |
| POST   | `/api/tasks`     | Create a task                    | 201     | 400    |

**Health semantics:** liveness has no dependency checks, so it only fails if the process is truly
stuck. Readiness returns `503` once a shutdown signal is received, so traffic stops being routed to
an instance that is draining.

**Task payload (`POST /api/tasks`):**

| Field         | Type    | Rules                               |
| ------------- | ------- | ----------------------------------- |
| `title`       | string  | required, trimmed, 1–200 characters |
| `description` | string  | optional, max 1000 characters       |
| `completed`   | boolean | optional, defaults to `false`       |

Unknown fields are rejected.

### Example requests

```bash
curl -s localhost:3000/health/live
# {"status":"ok"}

curl -s -X POST localhost:3000/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Set up CI pipeline","description":"GitHub Actions"}'
# 201 {"data":{"id":"6f1c...","title":"Set up CI pipeline","description":"GitHub Actions","completed":false,"createdAt":"..."}}

curl -s localhost:3000/api/tasks
# {"data":[...],"count":1}

curl -s localhost:3000/api/tasks/6f1c...
# {"data":{...}}

curl -s -X POST localhost:3000/api/tasks -H 'Content-Type: application/json' -d '{"title":""}'
# 400 {"error":{"message":"Validation failed","details":["title must not be empty"]}}

curl -s localhost:3000/api/tasks/unknown
# 404 {"error":{"message":"Task with id 'unknown' not found"}}
```

## Quality checks and tests

```bash
npm run lint           # ESLint (type-aware rules, fails on warnings)
npm run format:check   # Prettier check (format:write to fix)
npm run typecheck      # tsc --noEmit over src, tests and config
npm test               # Vitest unit + integration tests
npm run test:coverage  # tests + coverage report
```

Tests never open a network port: `createApp()` returns the Express app and Supertest drives it
in-process. Every test builds a fresh app/store, so tests are independent of each other and of
execution order.

Coverage is written to `coverage/`; `coverage/lcov.info` is the file SonarQube Cloud will consume.
The build fails if line or branch coverage drops below **80%**. `src/server.ts` (process bootstrap
and signal handling) is excluded from coverage because it is not imported by tests.

## In-memory storage limitations

Tasks are stored in a `Map` inside the Node.js process. This is intentional for this case, but it
has consequences that matter for deployment:

- **Data is lost on restart.** Every pod restart, rollout or crash starts with an empty list.
- **Data is not shared between replicas.** With more than one replica behind a Kubernetes
  Service, a task created via pod A is invisible to pod B, so `GET /api/tasks/:id` may return
  `404` for a task that was just created, depending on which pod serves the request.
- Memory is unbounded; there is no eviction.

Apart from this data, the application is stateless (configuration via environment variables, logs
to stdout/stderr, no local files), so it can be scaled and replaced freely once storage is moved to
an external database. Persisting tasks is out of scope: **this case evaluates the CI/CD mechanism,
not data durability.**

## Planned CI/CD (next stages)

Not implemented yet; this repository currently contains only the application and its tests.

```text
GitHub → GitHub Actions CI
  ├─ lint, format check, typecheck, tests + coverage → SonarQube Cloud
  ├─ security: Gitleaks (secrets), npm audit (dependencies)
  ├─ Docker multi-stage build (Buildx + BuildKit cache)
  ├─ Trivy image scan (+ SBOM / provenance)
  └─ push to Docker Hub
→ update image tag in the GitOps repository (Kustomize)
→ Argo CD syncs → Kubernetes (Docker Desktop, kind, single node)
```

The app is already shaped for this: configurable port, liveness/readiness endpoints for probes,
graceful SIGTERM handling for rolling updates, and LCOV output for SonarQube.
