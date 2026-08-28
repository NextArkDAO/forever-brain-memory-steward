const REQUIRED_ASSERTION_FIELDS = ["id", "subject", "predicate", "value", "recorded_at", "source_type"];

export function validateContinuityPackage(input) {
  const errors = [];
  if (!input || typeof input !== "object") return { valid: false, errors: ["Package must be an object."] };
  if (input.synthetic !== true) errors.push("Only packages explicitly marked synthetic are accepted.");
  if (!input.package_id || !input.companion?.display_name) errors.push("Package identity is incomplete.");
  if (!Array.isArray(input.assertions) || input.assertions.length === 0) {
    errors.push("At least one assertion is required.");
  } else {
    const ids = new Set();
    for (const assertion of input.assertions) {
      for (const field of REQUIRED_ASSERTION_FIELDS) {
        if (assertion[field] === undefined || assertion[field] === "") errors.push(`Assertion ${assertion.id || "unknown"} is missing ${field}.`);
      }
      if (ids.has(assertion.id)) errors.push(`Duplicate assertion id: ${assertion.id}.`);
      ids.add(assertion.id);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function inventoryContinuityPackage(input) {
  return {
    assertion_count: input.assertions.length,
    relation_count: input.relations?.length || 0,
    source_count: new Set(input.assertions.map((item) => item.source_type)).size,
    predicates: [...new Set(input.assertions.map((item) => item.predicate))].sort(),
  };
}

export function detectContinuityFindings(input) {
  const groups = new Map();
  const supersededIds = new Set((input.relations || []).filter((relation) => relation.type === "supersedes").map((relation) => relation.target_assertion_id));
  for (const assertion of input.assertions) {
    if (supersededIds.has(assertion.id)) continue;
    const key = `${assertion.subject}::${assertion.predicate}`;
    groups.set(key, [...(groups.get(key) || []), assertion]);
  }
  const findings = [];
  for (const assertions of groups.values()) {
    const values = new Set(assertions.map((item) => canonicalize(item.value)));
    if (values.size <= 1) continue;
    const ordered = [...assertions].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    findings.push({
      id: `finding-${ordered.map((item) => item.id).join("-")}`,
      type: "contradiction",
      severity: "owner_review",
      subject: ordered[0].subject,
      predicate: ordered[0].predicate,
      assertion_ids: ordered.map((item) => item.id),
      options: ordered.map((item) => ({ assertion_id: item.id, label: item.display_value || String(item.value), value: item.value, recorded_at: item.recorded_at, source_type: item.source_type })),
      explanation: "Two active records disagree. The Steward will preserve both and ask which value is current.",
    });
  }
  return findings;
}

export function createCorrectionProposal(input, finding, selectedAssertionId) {
  const selected = input.assertions.find((item) => item.id === selectedAssertionId);
  if (!selected || !finding.assertion_ids.includes(selectedAssertionId)) throw new Error("The selected assertion is not part of this finding.");
  return {
    id: `proposal-${finding.id}`,
    finding_id: finding.id,
    action: "append_correction",
    status: "awaiting_approval",
    subject: finding.subject,
    predicate: finding.predicate,
    selected_value: selected.value,
    selected_label: selected.display_value || String(selected.value),
    evidence_assertion_ids: [...finding.assertion_ids],
    preserves_source_assertions: true,
  };
}

export function applyApprovedCorrection(input, proposal, approval) {
  if (approval?.approved !== true || approval.proposal_id !== proposal.id) throw new Error("An explicit approval bound to this proposal is required.");
  const assertionId = `ast-${String(input.assertions.length + 1).padStart(3, "0")}`;
  const recordedAt = approval.recorded_at;
  const newAssertion = { id: assertionId, subject: proposal.subject, predicate: proposal.predicate, value: proposal.selected_value, display_value: proposal.selected_label, recorded_at: recordedAt, source_type: "owner_approved_correction", source_ref: approval.id, state: "current" };
  const relations = proposal.evidence_assertion_ids.map((targetId, index) => ({ id: `rel-${assertionId}-${index + 1}`, type: "supersedes", source_assertion_id: assertionId, target_assertion_id: targetId, recorded_at: recordedAt }));
  return {
    ...structuredClone(input),
    assertions: [...input.assertions, newAssertion],
    relations: [...(input.relations || []), ...relations],
    approvals: [...(input.approvals || []), approval],
    receipts: [...(input.receipts || []), { id: `receipt-${assertionId}`, action: "append_correction", outcome: "completed", proposal_id: proposal.id, approval_id: approval.id, created_assertion_id: assertionId, preserved_assertion_ids: [...proposal.evidence_assertion_ids], recorded_at: recordedAt }],
  };
}

export async function buildVerifiedExport(input) {
  const payload = { format: "forever-continuity", format_version: "0.1.0", exported_at: new Date().toISOString(), continuity: structuredClone(input) };
  const payloadHash = await sha256(canonicalize(payload));
  return { payload, manifest: { algorithm: "SHA-256", payload_hash: payloadHash, assertion_count: input.assertions.length, relation_count: input.relations?.length || 0, source_records_preserved: true } };
}

export async function verifyExport(envelope) {
  const actualHash = await sha256(canonicalize(envelope.payload));
  return { valid: actualHash === envelope.manifest.payload_hash, expected_hash: envelope.manifest.payload_hash, actual_hash: actualHash };
}

export function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

async function sha256(value) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
