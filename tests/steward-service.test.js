import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DeterministicCollaborator, GeminiCollaborator } from "../services/steward/src/collaborator.js";
import { MemoryRunStore } from "../services/steward/src/store.js";
import { createStewardService } from "../services/steward/src/steward-service.js";

const fixtureUrl = new URL("../fixtures/synthetic/aster-continuity.json", import.meta.url);
async function loadFixture() { return JSON.parse(await readFile(fixtureUrl, "utf8")); }

function buildService() {
  let nextId = 0;
  return createStewardService({
    store: new MemoryRunStore(),
    collaborator: new DeterministicCollaborator(),
    now: () => "2026-08-24T20:00:00.000Z",
    id: () => `fixture-${++nextId}`,
  });
}

test("runs the complete server-side synthetic stewardship workflow", async () => {
  const service = buildService();
  const started = await service.start(await loadFixture());
  const inspected = await service.inspect(started.id);
  const proposed = await service.propose(started.id, "ast-002");
  const completed = await service.apply(started.id, { approved: true });

  assert.equal(started.stage, "inspect");
  assert.equal(inspected.stage, "clarify");
  assert.match(inspected.collaboration.question, /morning check-in/i);
  assert.equal(proposed.stage, "approve");
  assert.equal(completed.stage, "verify");
  assert.equal(completed.continuity.assertions.length, 4);
  assert.equal(completed.envelope.manifest.source_records_preserved, true);
  assert.equal(completed.verification.valid, true);
});

test("server-side workflow refuses a consequential write without approval", async () => {
  const service = buildService();
  const started = await service.start(await loadFixture());
  await service.inspect(started.id);
  await service.propose(started.id, "ast-002");
  await assert.rejects(service.apply(started.id, { approved: false }), /explicit approval/i);
});

test("reuses the bounded collaboration for the same fictional finding", async () => {
  let calls = 0;
  const store = new MemoryRunStore();
  const collaborator = {
    mode: "test-collaborator",
    model: "fictional-model",
    async explain() {
      calls += 1;
      return { headline: "Conflict", explanation: "Two fictional records disagree.", question: "Which should be current?" };
    },
  };
  let nextId = 0;
  const service = createStewardService({ store, collaborator, id: () => `cache-${++nextId}` });
  const first = await service.start(await loadFixture());
  const second = await service.start(await loadFixture());
  assert.equal((await service.inspect(first.id)).collaboration.cached, false);
  assert.equal((await service.inspect(second.id)).collaboration.cached, true);
  assert.equal(calls, 1);
});

test("stops safely when the language collaborator breaks its contract", async () => {
  const collaborator = { mode: "test", model: "fictional", async explain() { return { question: "Missing required fields" }; } };
  const service = createStewardService({ store: new MemoryRunStore(), collaborator });
  const run = await service.start(await loadFixture());
  await assert.rejects(service.inspect(run.id), /invalid response/i);
});

test("gives Gemini enough bounded output room to finish the JSON contract", async () => {
  let request;
  const client = {
    models: {
      async generateContent(input) {
        request = input;
        return { text: JSON.stringify({ headline: "Conflict", explanation: "Two records disagree.", question: "Which is current?" }) };
      },
    },
  };
  const result = await new GeminiCollaborator(client).explain({
    finding: {
      type: "contradiction",
      options: [{ assertion_id: "ast-001", label: "Brief", source_type: "owner_statement", recorded_at: "2026-08-01T00:00:00Z" }],
    },
  });

  assert.equal(request.config.maxOutputTokens, 1024);
  assert.equal(request.config.responseMimeType, "application/json");
  assert.deepEqual(result, { headline: "Conflict", explanation: "Two records disagree.", question: "Which is current?" });
});
