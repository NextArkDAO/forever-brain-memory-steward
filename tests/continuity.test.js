import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { applyApprovedCorrection, buildVerifiedExport, createCorrectionProposal, detectContinuityFindings, validateContinuityPackage, verifyExport } from "../packages/contracts/src/continuity.js";

const fixtureUrl = new URL("../fixtures/synthetic/aster-continuity.json", import.meta.url);
async function loadFixture() { return JSON.parse(await readFile(fixtureUrl, "utf8")); }

test("accepts the labeled synthetic demonstration package", async () => {
  assert.deepEqual(validateContinuityPackage(await loadFixture()), { valid: true, errors: [] });
});

test("rejects an unlabeled package before analysis", async () => {
  const fixture = await loadFixture();
  fixture.synthetic = false;
  const result = validateContinuityPackage(fixture);
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /synthetic/);
});

test("detects the unresolved morning check-in contradiction", async () => {
  const findings = detectContinuityFindings(await loadFixture());
  assert.equal(findings.length, 1);
  assert.deepEqual(findings[0].assertion_ids, ["ast-001", "ast-002"]);
});

test("blocks correction without approval bound to the proposal", async () => {
  const fixture = await loadFixture();
  const finding = detectContinuityFindings(fixture)[0];
  const proposal = createCorrectionProposal(fixture, finding, "ast-002");
  assert.throws(() => applyApprovedCorrection(fixture, proposal, { approved: false }), /explicit approval/);
  assert.equal(fixture.assertions.length, 3);
});

test("applies an approved correction without deleting source assertions", async () => {
  const fixture = await loadFixture();
  const finding = detectContinuityFindings(fixture)[0];
  const proposal = createCorrectionProposal(fixture, finding, "ast-002");
  const corrected = applyApprovedCorrection(fixture, proposal, { id: "approval-001", proposal_id: proposal.id, approved: true, approved_by: "synthetic-owner", recorded_at: "2026-08-08T18:00:00.000Z" });
  assert.equal(fixture.assertions.length, 3);
  assert.equal(corrected.assertions.length, 4);
  assert.equal(corrected.relations.length, 2);
  assert.deepEqual(corrected.assertions.slice(0, 3).map((item) => item.id), ["ast-001", "ast-002", "ast-003"]);
  assert.equal(detectContinuityFindings(corrected).length, 0);
});

test("verifies an unchanged export and rejects payload tampering", async () => {
  const envelope = await buildVerifiedExport(await loadFixture());
  assert.equal((await verifyExport(envelope)).valid, true);
  envelope.payload.continuity.assertions[0].value = "tampered";
  assert.equal((await verifyExport(envelope)).valid, false);
});
