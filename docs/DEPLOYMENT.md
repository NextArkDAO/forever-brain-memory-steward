# Google Cloud Deployment

## Prerequisites

- A Google Cloud project with billing enabled.
- Vertex AI, Firestore, Cloud Run, Cloud Build, and Artifact Registry enabled.
- Firestore in Native mode.
- Google Cloud CLI authenticated with permission to deploy Cloud Run services.

## Configure

Use Application Default Credentials locally. Do not create or commit a service-account key.

```powershell
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

## Deploy

Deploy from the repository root with the Google-managed service identity and bounded scaling:

```powershell
gcloud run deploy memory-steward `
  --source . `
  --region us-central1 `
  --allow-unauthenticated `
  --max-instances 1 `
  --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-3.5-flash-lite,FIRESTORE_DATABASE='(default)'
```

Cloud Run supplies `PORT` automatically. Grant the runtime service account only the Vertex AI and Firestore permissions required by the demonstration.

## Verify

1. Open `/api/status` and confirm the Google collaborator and Firestore persistence are active.
2. Open the root URL and run the fictional case through import, inspection, clarification, approval, correction, and verification.
3. Confirm the original records remain present and the exported receipt verifies.
4. Confirm the service contains no plaintext secret environment variables.
