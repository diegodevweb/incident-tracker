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

* Docker (local development)
* Cloud-ready architecture (AWS)

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

Header `x-api-key: <webhook key of the client>`. The incident is created for the client that owns the key, always with status `OPEN` and source `WEBHOOK`; sending `clientId`, `source` or `status` in the body returns 400.

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

`GET /incidents/error-logs` and `GET /incidents/error-log/:id` use the same header and only return logs of the key's client.

### Webhook keys (admin only)

Each client gets its own keys. Only a SHA-256 hash is stored; the full key is shown once, in the creation response. To rotate a key, create a new one, update the integration and revoke the old one.

* **POST** `/clients/:clientId/webhook-keys` with `{ "name": "ERP produção" }`: creates a key and returns it in `key`
* **GET** `/clients/:clientId/webhook-keys`: lists the keys (prefix, name, creation, last use, revocation), never the key itself
* **DELETE** `/clients/:clientId/webhook-keys/:keyId`: revokes the key

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

---

## Cloud Architecture

The system is designed for deployment in cloud environments using AWS:

* **EC2** → Application hosting
* **RDS** → Managed relational database
* **S3** → File storage (attachments, screenshots)
* **Lambda** → Background processing and scheduled tasks

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
* Full AWS deployment

---

## Author

Developed by Diego Rodrigues 
