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

The step-by-step guide below covers everything from the DNS to updates and rollbacks.

### Deploy guide

All commands run from the repository root on the server, and are written out in full so they can be pasted as they are.

**What you need**

* A Linux server (a VPS) with Docker Engine and the compose plugin ([install guide](https://docs.docker.com/engine/install/)), SSH by key, and ports 22 (SSH), 80 and 443 reachable (443 also over UDP, for HTTP/3). Docker publishes ports around `ufw`, which is fine here because the only published ports are Caddy's 80 and 443
* A domain whose DNS you control
* A Cloudflare account with R2 enabled (it asks for a payment method, even to use the free tier)

**1. Point the DNS**

Create an `A` record (and an `AAAA` one if the server has IPv6) for the domain you will use, pointing to the server. If the DNS is on Cloudflare, keep the record **DNS only** (grey cloud): Caddy assumes the browser connects straight to it, and behind Cloudflare's proxy every visitor would share one IP in the login rate limit. Wait until the name resolves to the server before the first start, because Caddy asks Let's Encrypt for the certificate as soon as it starts, and repeated failed attempts are rate limited.

**2. Create the storage bucket (R2)**

1. In the Cloudflare dashboard, create an R2 bucket and leave public access off. Attachments are served through short-lived signed URLs, and no CORS rule is needed because they are plain links
2. Create an R2 API token with the **Object Read & Write** permission, limited to that bucket. Copy the Access Key ID and the Secret Access Key (the secret is shown once) and the account's S3 endpoint, `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
3. Optional, if you want to keep database backups in R2: use a separate bucket with its own token (the backups hold every user's data and should not share credentials with the application)

**3. Configure**

```bash
git clone https://github.com/diegodevweb/incident-tracker.git && cd incident-tracker
cp .env.production.example .env && chmod 600 .env
```

Fill in `.env` (the file says how to generate each secret): `DOMAIN`, `ACME_EMAIL`, the two MySQL passwords (`openssl rand -hex 24`), `JWT_SECRET` (`openssl rand -base64 48`) and the `STORAGE_*` values from the R2 step (`STORAGE_REGION` stays `auto`). Avoid `$` in values. `docker compose -f docker-compose.prod.yml config --quiet` refuses to continue and names the variable when a required one is empty.

**4. First start**

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

The first build takes a few minutes. Afterwards `mysql`, `api` and `web` should be `healthy`, `caddy` should be up, and `migrate` should have exited with code 0 (it applies the database migrations and is not meant to keep running). Look for `certificate obtained successfully` in `docker compose -f docker-compose.prod.yml logs caddy`.

**5. Create the first admin**

```bash
docker compose -f docker-compose.prod.yml run --rm api node dist/cli/run-create-admin --name "Your Name" --email you@company.com
```

It asks for the password in the terminal (see [Creating admins](#creating-admins)). Then open `https://<your domain>/login` and sign in.

**6. Set up the clients**

1. On **Clientes**, create each client company and add its users. Each user gets a temporary password, shown once, that must be changed at the first login
2. Open the company page and, under **Integrações**, create a webhook key. It is shown once; store it where the integration is configured
3. Point each integration at `POST https://<your domain>/incidents/error-logs`, sending the key in the `x-api-key` header and no `companyId`, `source` or `status` in the body (see [Create Error Log](#create-error-log)). Integrations that used the old global key stop working until this is done

**7. Check that it works**

* The certificate is valid and `http://` redirects to `https://`
* You can sign in, open an incident with a PNG attachment and see the attachment
* The webhook answers `201` with a company key and `401` without it
* `https://<your domain>/health` shows the panel's "not found" page: the API itself is not reachable from the internet, only the three webhook routes are

#### Day to day

**Status and logs.** `docker compose -f docker-compose.prod.yml ps` shows the state, and `docker compose -f docker-compose.prod.yml logs -f --tail=100 api` follows a service (`web`, `caddy` and `mysql` work the same way). Docker keeps three 10 MB log files per service.

**Backup.** Run this before every update and copy the file off the server:

```bash
docker compose -f docker-compose.prod.yml exec -T mysql sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysqldump -uroot --single-transaction --routines "$MYSQL_DATABASE"' | gzip > backup-$(date +%F).sql.gz
```

It covers the whole database, and it does not hold the R2 bucket, which is separate. The compose does not schedule backups yet, so run it by hand or schedule it yourself. A backup you have never restored is a hope, not a backup: try the restore below on another machine now and then.

**Restore.** Data created after the backup is lost, because the dump replaces the tables:

```bash
docker compose -f docker-compose.prod.yml stop api web
gunzip -c backup-2026-01-31.sql.gz | docker compose -f docker-compose.prod.yml exec -T mysql sh -c 'MYSQL_PWD=$MYSQL_ROOT_PASSWORD mysql -uroot "$MYSQL_DATABASE"'
docker compose -f docker-compose.prod.yml up -d
```

On a new server, bring up only the database first (`docker compose -f docker-compose.prod.yml up -d mysql`), restore with the second command, then run `up -d --build` for the rest. The migrations are in the backup, so `migrate` finds nothing left to apply.

**Update.** New migrations are applied automatically, so take a backup first. Keep the running images as `previous` only while the running version is one you trust, then build and restart:

```bash
git pull --ff-only
for s in api web migrate; do docker tag incident-tracker-prod-$s incident-tracker-prod-$s:previous; done
docker compose -f docker-compose.prod.yml build --pull
docker compose -f docker-compose.prod.yml up -d
```

The API and the panel are down for a few seconds while they are recreated. Then check `ps`, the logs and a sign-in. `--pull` refreshes the base images of the API and the panel so they get their security fixes; do it now and then even without a new version. The `mysql` and `caddy` images are not built here: `docker compose -f docker-compose.prod.yml pull` fetches newer ones and `up -d` applies them (back up first, since a MySQL update runs on start).

**Roll back.** Put the previous images back and restart without building:

```bash
for s in api web migrate; do docker tag incident-tracker-prod-$s:previous incident-tracker-prod-$s:latest; done
docker compose -f docker-compose.prod.yml up -d --no-build
```

Migrations only move forward. If the failed version applied a new one, the old code may not work with the new tables: restore the backup taken before the update (see above) or fix forward. Without the `previous` images, check out the earlier commit with `git checkout <commit>` and run `up -d --build`.

**Secrets.**

* `JWT_SECRET`: change it in `.env` and run `up -d`; everyone has to sign in again
* `STORAGE_*`: change them in `.env`, run `up -d`, and revoke the old token in Cloudflare
* `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD`: the MySQL image only reads them to create an empty database, so editing `.env` later changes nothing by itself. Change the password inside MySQL first (`ALTER USER 'incident'@'%' IDENTIFIED BY '...'`, run through `docker compose -f docker-compose.prod.yml exec mysql mysql -uroot -p`), then update `.env` and run `up -d`
* Webhook keys: revoke and recreate them on the company page

**Careful with.** `docker compose -f docker-compose.prod.yml down -v` deletes the database and the certificates; plain `down` keeps them. The panel sends `Strict-Transport-Security` with `includeSubDomains`, so once a browser has visited the domain, none of its subdomains works without HTTPS.

**Troubleshooting**

| Symptom | What to check |
|---|---|
| Browser shows a certificate error, or Caddy logs a failed challenge | The DNS record resolves to this server, ports 80 and 443 are open, and `DOMAIN` in `.env` is spelled exactly like the record |
| `502`/`503` from the site | `docker compose -f docker-compose.prod.yml ps`: `web` and `api` must be `healthy`; read their logs |
| `api` restarts in a loop | Its logs name the cause. Storage errors mean a wrong `STORAGE_ENDPOINT`, bucket name or keys (the bucket must exist; the API only creates it if the token is allowed to) |
| `migrate` exits with an error | Its logs show the migration or the database error. A password that no longer matches the database (see Secrets) shows up here |
| Logins are refused with `429` for everyone | The panel is not seeing client IPs: the DNS is proxied by Cloudflare, or another proxy sits in front of Caddy |
| Webhook answers `401` | The key is wrong, was revoked, or the company is disabled; keys are created on the company page |

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
* Scheduled database backups

---

## Author

Developed by Diego Rodrigues 
