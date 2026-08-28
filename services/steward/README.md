# Memory Steward Service

The Cloud Run service responsible for inventory, classification, detection, clarification, proposal preparation, approved application, export, and verification.

Gemini 3.5 Flash-Lite handles bounded language reasoning through the Google GenAI SDK. Deterministic tools own schemas, authority checks, append-only relations, hashes, and export verification.

The working deterministic contract lives in `packages/contracts/src/continuity.js`. The service must call that contract rather than reimplementing approval, mutation, or verification rules inside a model prompt.

The language collaborator can explain a finding and draft one focused owner clarification. It cannot apply a correction directly.
