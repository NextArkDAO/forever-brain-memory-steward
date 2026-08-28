# Forever Brain: Memory Steward

Memory Steward is a public-safe agentic application built for the 2026 All Things Agentic Hackathon. It helps an owner keep a long-running AI companion's memory clear without silently deleting evidence or allowing a language model to rewrite history.

## Live Project

- [Hosted application](https://memory-steward-736783846061.us-central1.run.app/)
- [Three-minute demonstration](https://youtu.be/FGiswy8WZwQ)
- Track: **Collaborative Partner**

## What It Does

1. Loads a clearly labeled fictional continuity package.
2. Inventories memories, relationships, and supporting evidence.
3. Detects contradictions with deterministic rules.
4. Uses Gemini 3.5 Flash-Lite only for a bounded plain-language explanation.
5. Asks the owner one focused question when judgment is required.
6. Blocks every durable correction until the owner explicitly approves it.
7. Adds the correction without deleting the original records.
8. Exports the result with a SHA-256 verification receipt.

The model interprets language. Deterministic code owns authority, schema validation, correction rules, provenance, and export verification.

## Google Technology

- Gemini 3.5 Flash-Lite through Vertex AI
- Google GenAI SDK for JavaScript
- Google Cloud Run
- Firestore

The public service runs on Cloud Run, uses Firestore for bounded synthetic workflow state, and authenticates to Vertex AI with its Google-managed service identity. No application API key is stored in this repository.

## Run Locally

Requirements: Node.js 22 or newer.

```powershell
npm ci
npm test
npm start
```

Open `http://127.0.0.1:4173`.

Without Google Cloud variables, the application runs in deterministic local mode with an in-memory store. This mode exercises the complete authority and evidence path without making a model call.

## Run With Google Cloud

Use Application Default Credentials locally or a Cloud Run service identity in production. Set only the non-secret configuration values needed for your environment:

```text
GOOGLE_GENAI_USE_VERTEXAI=true
GOOGLE_CLOUD_PROJECT=<your-project-id>
GOOGLE_CLOUD_LOCATION=global
GEMINI_MODEL=gemini-3.5-flash-lite
FIRESTORE_DATABASE=(default)
```

Never commit credentials. See [Deployment](docs/DEPLOYMENT.md) for the reproducible Cloud Run path.

## Verification

```powershell
npm test
```

The suite covers synthetic-package validation, contradiction detection, owner-approval binding, append-only correction, complete workflow execution, Gemini contract failure, bounded response configuration, and export-tamper detection.

## Architecture And Safety

- [Architecture](docs/ARCHITECTURE.md)
- [Security boundary](docs/SECURITY_BOUNDARY.md)
- [Pre-existing work disclosure](docs/PREEXISTING_WORK_DISCLOSURE.md)
- [Public release audit](docs/PUBLIC_RELEASE_AUDIT.md)

## Data Boundary

Every included fixture is original, fictional, and visibly labeled synthetic. This repository contains no customer data, personal memory, production companion data, credentials, internal communications, private repository content, or live-system adapters.

## Ownership

Built by DemonFox Collectibles LLC d/b/a NextArk. Product decisions, acceptance, and submission authority remain human-owned. AI coding tools assisted with implementation, documentation, testing, and media preparation.
