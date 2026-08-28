import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { DeterministicCollaborator, GeminiCollaborator } from "./collaborator.js";
import { FirestoreRunStore, MemoryRunStore } from "./store.js";
import { createStewardService, StewardError } from "./steward-service.js";

const root = normalize(join(fileURLToPath(new URL(".", import.meta.url)), "../../.."));
const webRoot = resolve(root, "apps/web");
const port = Number(process.env.PORT || 4173);
const fixture = JSON.parse(await readFile(join(root, "fixtures/synthetic/aster-continuity.json"), "utf8"));
const mimeTypes = { ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

const collaborator = await createCollaborator();
const store = await createStore();
const steward = createStewardService({ store, collaborator });

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === "/api/status" && request.method === "GET") {
      return sendJson(response, 200, {
        ok: true,
        synthetic_only: true,
        runtime: steward.runtime,
        cloud_ready: collaborator.mode === "google-genai" && store instanceof FirestoreRunStore,
      });
    }
    if (url.pathname === "/api/runs" && request.method === "POST") return sendJson(response, 201, await steward.start(fixture));
    const route = url.pathname.match(/^\/api\/runs\/([^/]+)\/(inspect|propose|apply)$/);
    if (route && request.method === "POST") {
      const body = await readJson(request);
      const [, runId, action] = route;
      if (action === "inspect") return sendJson(response, 200, await steward.inspect(runId));
      if (action === "propose") return sendJson(response, 200, await steward.propose(runId, body.selected_assertion_id));
      return sendJson(response, 200, await steward.apply(runId, body));
    }
    return serveStatic(url.pathname, response);
  } catch (error) {
    const status = error instanceof StewardError ? error.status : 500;
    sendJson(response, status, { error: status === 500 ? "The Steward stopped safely. Confirm service configuration and retry." : error.message });
  }
}).listen(port, "0.0.0.0", () => console.log(`Continuity Steward running on port ${port}`));

async function createCollaborator() {
  const { GoogleGenAI } = await import("@google/genai");
  if (process.env.GOOGLE_GENAI_USE_VERTEXAI === "true" && process.env.GOOGLE_CLOUD_PROJECT) {
    return new GeminiCollaborator(new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.GOOGLE_CLOUD_LOCATION || "global",
    }), process.env.GEMINI_MODEL || "gemini-3.5-flash");
  }
  if (process.env.GEMINI_API_KEY) {
    return new GeminiCollaborator(new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }), process.env.GEMINI_MODEL || "gemini-3.5-flash");
  }
  return new DeterministicCollaborator();
}

async function createStore() {
  if (!process.env.GOOGLE_CLOUD_PROJECT) return new MemoryRunStore();
  const { Firestore } = await import("@google-cloud/firestore");
  return new FirestoreRunStore(new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    databaseId: process.env.FIRESTORE_DATABASE || "(default)",
  }));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) throw new StewardError(413, "Request body is too large.");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new StewardError(400, "Request body must be valid JSON."); }
}

function serveStatic(pathname, response) {
  const requested = pathname === "/"
    ? "index.html"
    : pathname.startsWith("/apps/web/")
      ? pathname.slice("/apps/web/".length)
      : null;
  if (!requested) return sendJson(response, 404, { error: "Not found." });

  const filePath = resolve(webRoot, requested);
  if (!filePath.startsWith(`${webRoot}${sep}`) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    return sendJson(response, 404, { error: "Not found." });
  }
  response.writeHead(200, {
    ...securityHeaders(),
    "cache-control": "no-store",
    "content-type": mimeTypes[extname(filePath)] || "application/octet-stream",
  });
  createReadStream(filePath).pipe(response);
}

function sendJson(response, status, value) {
  response.writeHead(status, {
    ...securityHeaders(),
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

function securityHeaders() {
  return {
    "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };
}
