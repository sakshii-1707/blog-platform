Microservices Blogging Platform
==============================

This repository contains a microservices-based blogging platform with independently deployable services for Users, Posts, and Comments, orchestrated via an API Gateway. Each service owns its data in a dedicated MongoDB instance. The system demonstrates bounded contexts, JWT authentication, resilience patterns, observability, and versioned APIs.

Architecture
------------
- API Gateway (Node.js/Express): single entry, routing, CORS, JWT validation, rate limiting, logging.
- User Service (Node.js/Express, MongoDB): auth (register/login), profiles, JWT issuance.
- Post Service (Node.js/Express, MongoDB): CRUD posts, pagination, ownership.
- Comment Service (Node.js/Express, MongoDB): CRUD comments, pagination, linked to posts.
- Frontend (React + Vite): Login/register, feed, post editor, comments, profiles. Consumes Gateway only.

Key Features
------------
- Versioned APIs: `/api/v1/...` with deprecation headers.
- Service discovery via Docker Compose DNS.
- Health endpoints: `/health`.
- Data ownership: no cross-service DB access.
- Inter-service REST with timeouts/retries, correlation IDs.
- Resilience: circuit breaker, backoff, bulkheads.
- Security: validation, size limits, sanitization, simple role checks.
- Observability: structured logs, tracing propagation, metrics endpoints.

Quick Start
-----------
1) Prerequisites: Docker Desktop 4.x+, Node 18+ (optional for local dev).

2) Environment:
Create `.env` in the repo root:
```
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...your dev key...\n-----END PRIVATE KEY-----
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...your dev key...\n-----END PUBLIC KEY-----
```

3) Build & Run:
```
docker compose build
docker compose up
```

4) Access:
- Gateway: http://localhost:8080
- Frontend: http://localhost:5173
- User Mongo: localhost:27018, Post Mongo: 27019, Comment Mongo: 27020

5) Smoke:
- Health: `GET /health`
- Register: `POST /api/v1/auth/register`
- Login: `POST /api/v1/auth/login`

Development
-----------
- Each service has its own `package.json` with scripts.
- Use `docker compose up --build service-name` to rebuild individual services.
- Logs are structured JSON (pino).

Notes
-----
- This is a reference implementation for local orchestration. For production, add TLS, secret management, hardened configs, and production-ready monitoring.


