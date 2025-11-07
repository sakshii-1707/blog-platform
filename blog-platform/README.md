# Blog Platform Microservices

This project is a microservices-based blogging platform composed of independently deployable User, Post, and Comment services, an API Gateway, and a React Frontend—all orchestrated with Docker Compose.

## Stack
- Node.js (Express)
- MongoDB
- Docker Compose
- React (Frontend)

## Services
- user-service: User registration/auth, JWT auth.
- post-service: Create/read/edit posts.
- comment-service: Comments for posts.
- api-gateway: Entry point, routing, auth, rate limiting, and logging.
- frontend: React app (login, post feed, create/edit posts, comments, profiles).

## Local Development

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- (Optional) Node.js for direct code editing/test

### Getting Started
1. Clone the repo and open a terminal at the project root.
2. Build and start all services:
   ```
   docker-compose up --build
   ```
3. Access:
   - Frontend: http://localhost:3000
   - API Gateway: http://localhost:8080/api/v1/...
   - Services: exposed on internal network

### Notes
- Each service owns its own database (MongoDB).
- Services communicate via REST.
- API docs (OpenAPI/Swagger) at `/api/v1/docs` for each service (where implemented).

---

For service-specific setup, code, and details, see READMEs in each sub-directory.
