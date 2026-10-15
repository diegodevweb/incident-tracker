# Incident Tracker

Incident Tracker is a centralized platform for monitoring, managing, and analyzing application errors and customer-reported incidents.

It enables real-time ingestion of error logs from external systems and provides a structured workflow for tracking, investigating, and resolving issues, improving system reliability and operational visibility.

---

## Overview

Modern applications often rely on multiple systems and integrations, making it difficult to track failures and maintain visibility over incidents.

Incident Tracker solves this by:

* Centralizing error logs from different sources
* Allowing teams to manage incidents in a structured way
* Providing historical data for analysis and reporting
* Enabling better communication between technical teams and stakeholders

---

## Architecture

The platform is built using a modular and scalable backend architecture:

```
External Systems (Laravel, APIs)
            ↓
      Incident Tracker API (NestJS)
            ↓
        Prisma ORM
            ↓
         MySQL Database
```

---

## Tech Stack

### Backend

* NestJS
* Prisma ORM
* MySQL
* DTO validation with class-validator

### Infrastructure

* Docker (local development and production images)
* Caddy (HTTPS) in front of a single server, S3-compatible storage (Cloudflare R2 in production)

---

## Core Features

### Error Log Ingestion

* Receive error logs via API (`POST /incidents/error-logs`), authenticated by a per-client webhook key
* Structured storage of logs with metadata
* Support for multiple sources (systems, services, integrations)

---

### Incident Management

* Register and manage incidents linked to system errors
* Track status (open, in progress, resolved)
* Associate logs, metadata, and contextual information

---

### Data Structuring

Each error log includes:

* Message
* Severity level
* Environment (production, staging, etc.)
* Source system
* Timestamp
* Structured metadata (JSON)

---

### Observability

* Centralized visibility of system failures
* Foundation for dashboards and reporting
* Historical tracking of incidents

---

## API Example

### Create Error Log

**POST** `/incidents/error-logs`

Header `x-api-key: <webhook key of the company>`. The incident is created for the client company that owns the key, always with status `OPEN` and source `WEBHOOK`; sending `companyId`, `source` or `status` in the body returns 400.

```json
{
  "title": "NFe rejeitada",
  "description": "Rejeição na autorização da nota",
  "message": "cStat 696",
  "level": "WARNING",
  "priority": "ERROR",
  "environment": "production",
  "occurredAt": "2026-04-24T16:21:53.000Z",
  "metadata": {
    "cStat": "696",
    "xMotivo": "Rejeição exemplo"
  }
}
```

`GET /incidents/error-logs` and `GET /incidents/error-log/:id` use the same header and only return logs of the key's company.

### Webhook keys (admin only)

Each client company gets its own keys, managed on the company page (**Integrações**) or through the API. Only a SHA-256 hash is stored; the full key is shown once, in the creation response. To rotate a key, create a new one, update the integration and revoke the old one.

* **POST** `/companies/:companyId/webhook-keys` with `{ "name": "ERP produção" }`: creates a key and returns it in `key`
* **GET** `/companies/:companyId/webhook-keys`: lists the keys (prefix, name, creation, last use, revocation), never the key itself
* **DELETE** `/companies/:companyId/webhook-keys/:keyId`: revokes the key

Keys of a disabled company stop working until the company is enabled again.

### Client companies and accounts

A client is a company with any number of users. Every user of a company sees all of its incidents (opened by any of them or by the webhook), and each incident shows who opened it. Admins manage companies and their users on the **Clientes** page (or the API below). There is no self sign-up, and admins are not created through the panel (see [Creating admins](#creating-admins)).

* **POST** `/companies` with `{ "name", "cnpj"? }`: creates a company. The CNPJ is optional, unique, accepted with or without punctuation and validated by its check digits, numeric or alphanumeric
* **GET** `/companies?page=&pageSize=&q=&status=active|disabled`: lists companies (search by name or CNPJ) with their user count and open incidents
* **GET** `/companies/:id` and **PATCH** `/companies/:id`: read or change name and CNPJ (`"cnpj": null` removes it)
* **POST** `/companies/:id/disable` and `/enable`: none of its users can log in, their sessions end and its webhook keys stop working. Companies are disabled, never deleted
* **GET** `/companies/:id/users` and **POST** `/companies/:id/users` with `{ "name", "email" }`: lists users, or creates one with a random temporary password returned once in `temporaryPassword`
* **PATCH** `/companies/:id/users/:userId`: changes name or e-mail
* **POST** `/companies/:id/users/:userId/password-reset`: issues a new temporary password and ends the user's sessions
* **POST** `/companies/:id/users/:userId/disable` and `/enable`: a disabled user cannot log in and loses its sessions. Users are disabled, never deleted

An admin opening an incident must send `companyId`; a client user always opens it in their own company.

With a temporary password, the only things a user can do are read `GET /account`, change the password at `POST /account/password` (current and new password; the new one follows `src/auth/password-policy.ts`) and log out. Changing the password ends the user's other sessions. `PATCH /account` changes the user's own name.

### Creating admins

The panel only creates client users, and the development seed never runs with `NODE_ENV=production`, so a new production database has no users at all. Admins, the first one included, are created with a command that talks straight to the database (`DATABASE_URL` is required) and runs from the built code:

```bash
node dist/cli/run-create-admin --name "Your Name" --email you@company.com
```

During development, after `npm run build`, the same thing is `npm run create-admin -- --name ... --email ...`.

* The password is asked in the terminal (hidden, twice) and must follow `src/auth/password-policy.ts`. Without a terminal, such as in a deploy script, set `CREATE_ADMIN_PASSWORD` in the environment of that one command and do not save it in `.env`. `--password` is refused on purpose, so the password never ends up in the shell history or the process list
* Missing `--name` or `--email` are asked in the terminal too
* The admin chooses the password, so there is no forced change at the first login
* An e-mail that already exists is refused and the existing user is left untouched

### Health check

**GET** `/health` answers `200 {"status":"ok"}` when the database responds and `503 {"status":"error"}` when it does not. It needs no token and is not rate limited, so container and proxy health checks can poll it. Storage is not checked: without it only attachments fail.

---

## Running Locally

### 1. Start services

```bash
docker compose up -d
```

### 2. Install dependencies

```bash
cd backend
npm install
```

### 3. Run migrations

```bash
npx prisma migrate dev
```

### 4. Start application

```bash
npm run start:dev
```

### 5. Tests

```bash
npm test
```

Unit tests need no database. The e2e suite (`npm run test:e2e`) boots the whole API against a real MySQL and S3 and writes to the database, so it refuses to run unless the database name contains `e2e` or `test`. Create one (e.g. `incident_tracker_e2e`, as root in the compose MySQL), point `DATABASE_URL` to it, run `npx prisma migrate deploy` and then `npm run test:e2e`. The other variables come from `backend/.env`.

### Continuous integration

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`:

* **Backend:** lint, type check (tests included), unit tests and build
* **Backend e2e:** applies every migration from scratch on MySQL 8, checks that the migrations match `schema.prisma`, then runs the e2e suite with SeaweedFS as S3
* **Frontend:** lint and production build

---

## Deployment

Production runs on a single server with Docker Compose (`docker-compose.prod.yml`):

```
Internet ──► Caddy (HTTPS, ports 80/443) ──► web (Next.js panel) ──► api (NestJS) ──► MySQL
                         │                                              │
                         └── only the 3 webhook routes ────────────────►┘      └──► S3-compatible storage
```

* Caddy is the only service with published ports. It gets the certificate for `DOMAIN` automatically and sends just `POST /incidents/error-logs`, `GET /incidents/error-logs` and `GET /incidents/error-log/:id` to the API (they are authenticated by webhook keys); everything else goes to the panel, which talks to the API over the internal network. Caddy also overwrites `X-Real-IP`, which the login rate limit depends on
* MySQL sits on a network without internet access. The API and the panel run as an unprivileged user, with a read-only root filesystem and no extra capabilities
* The migrations (`prisma migrate deploy`) run by themselves, in a one-off container, before the API starts
* Files go to an S3-compatible bucket you create beforehand (Cloudflare R2 in production); the API does not run a storage server of its own
* The login rate limit lives in the API's memory, so run a single API instance

To bring it up, copy `.env.production.example` to `.env`, fill it in (the file lists how to generate each secret), point the DNS of `DOMAIN` to the server and run:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml run --rm api node dist/cli/run-create-admin --name "Your Name" --email you@company.com
```

The second command creates the first admin (see [Creating admins](#creating-admins)); the new image of an update is built the same way as the first. Back up the database before updating, because new migrations are applied automatically. Build with `--pull` now and then so the base images get their security fixes, and keep the `caddy_data` volume: it holds the certificates, which Let's Encrypt limits per domain.

---

## Use Cases

* Centralized error tracking for distributed systems
* Incident management for production environments
* Monitoring integrations with external services
* Supporting operational workflows for development teams

---

## Roadmap

* Dashboard with filters and metrics
* Customer ticket system
* File uploads and attachments
* Notifications and alerts
* Authentication and authorization
* Background job processing (queues)
* Automated backups and a deployment guide

---

## Author

Developed by Diego Rodrigues 
