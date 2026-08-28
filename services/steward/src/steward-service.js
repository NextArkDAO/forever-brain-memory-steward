import { randomUUID } from "node:crypto";
import { applyApprovedCorrection, buildVerifiedExport, createCorrectionProposal, detectContinuityFindings, inventoryContinuityPackage, validateContinuityPackage, verifyExport } from "../../../packages/contracts/src/continuity.js";

export function createStewardService({ store, collaborator, now = () => new Date().toISOString(), id = () => randomUUID() }) {
  async function requireRun(runId) {
    const run = await store.get(runId);
    if (!run) throw new StewardError(404, "Run not found.");
    return run;
  }

  return {
    runtime: { collaborator: collaborator.mode, model: collaborator.model, persistence: store.constructor.name },

    async start(continuity) {
      const validation = validateContinuityPackage(continuity);
      if (!validation.valid) throw new StewardError(400, validation.errors.join(" "));
      const run = {
        id: id(),
        stage: "inspect",
        created_at: now(),
        updated_at: now(),
        continuity: structuredClone(continuity),
        inventory: inventoryContinuityPackage(continuity),
      };
      await store.save(run);
      return publicRun(run);
    },

    async inspect(runId) {
      const run = await requireRun(runId);
      const finding = detectContinuityFindings(run.continuity)[0];
      if (!finding) throw new StewardError(409, "No reviewable finding was detected.");
      const cacheId = safeCacheId(finding.id);
      let collaboration = await store.getCollaboration(cacheId);
      const cached = Boolean(collaboration);
      if (!collaboration) {
        collaboration = validateCollaboration(await collaborator.explain({ finding }));
        await store.saveCollaboration(cacheId, collaboration);
      }
      collaboration = { ...collaboration, cached };
      Object.assign(run, { finding, collaboration, stage: "clarify", updated_at: now() });
      await store.save(run);
      return publicRun(run);
    },

    async propose(runId, selectedAssertionId) {
      const run = await requireRun(runId);
      if (!run.finding) throw new StewardError(409, "Inspect the evidence before proposing a correction.");
      const proposal = createCorrectionProposal(run.continuity, run.finding, selectedAssertionId);
      Object.assign(run, { proposal, stage: "approve", updated_at: now() });
      await store.save(run);
      return publicRun(run);
    },

    async apply(runId, approvalInput) {
      const run = await requireRun(runId);
      if (!run.proposal) throw new StewardError(409, "No proposal is awaiting approval.");
      const approval = {
        id: `approval-${id()}`,
        proposal_id: run.proposal.id,
        approved: approvalInput?.approved === true,
        approved_by: "demo-owner",
        recorded_at: now(),
      };
      const continuity = applyApprovedCorrection(run.continuity, run.proposal, approval);
      const envelope = await buildVerifiedExport(continuity);
      const verification = await verifyExport(envelope);
      if (!verification.valid) throw new StewardError(500, "Export verification failed.");
      Object.assign(run, {
        continuity,
        inventory: inventoryContinuityPackage(continuity),
        approval,
        envelope,
        verification,
        stage: "verify",
        updated_at: now(),
      });
      await store.save(run);
      return publicRun(run);
    },
  };
}

function validateCollaboration(value) {
  if (!value || typeof value !== "object") throw new StewardError(502, "The language collaborator returned an invalid response.");
  const limits = { headline: 90, explanation: 420, question: 180 };
  const result = {};
  for (const [field, limit] of Object.entries(limits)) {
    if (typeof value[field] !== "string" || value[field].trim() === "" || value[field].length > limit) {
      throw new StewardError(502, "The language collaborator returned an invalid response.");
    }
    result[field] = value[field].trim();
  }
  return result;
}

function safeCacheId(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 500);
}

export class StewardError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function publicRun(run) {
  return structuredClone(run);
}
