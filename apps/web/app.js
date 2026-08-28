const stages = ["import", "inspect", "clarify", "approve", "apply", "verify"];
const state = { stage: "import", runId: null, continuity: null, inventory: null, finding: null, collaboration: null, proposal: null, selectedAssertionId: null, envelope: null };
const elements = {
  actionTitle: document.querySelector("#action-title"), actionCopy: document.querySelector("#action-copy"), primaryAction: document.querySelector("#primary-action"),
  runSummary: document.querySelector("#run-summary"), runState: document.querySelector("#run-state"), evidenceList: document.querySelector("#evidence-list"),
  recordCount: document.querySelector("#record-count"), decisionPanel: document.querySelector("#decision-panel"), findingStatus: document.querySelector("#finding-status"),
  receiptTitle: document.querySelector("#receipt-title"), receiptPreserved: document.querySelector("#receipt-preserved"), receiptAssertions: document.querySelector("#receipt-assertions"),
  receiptRelations: document.querySelector("#receipt-relations"), receiptHash: document.querySelector("#receipt-hash")
};
const agentStatus = document.querySelector("#agent-status");

elements.primaryAction.addEventListener("click", handlePrimaryAction);
checkRuntime();
render();

async function handlePrimaryAction() {
  try {
    if (state.stage === "import") await importCase();
    else if (state.stage === "inspect") await inspectCase();
    else if (state.stage === "clarify") await prepareProposal();
    else if (state.stage === "approve") recordApproval();
    else if (state.stage === "apply") await applyAndExport();
    else downloadExport();
  } catch (error) {
    elements.runState.textContent = "Stopped safely";
    elements.actionCopy.textContent = error.message;
  }
}

async function importCase() {
  hydrate(await api("/api/runs", { method: "POST" }));
  render();
}

async function inspectCase() {
  hydrate(await api(`/api/runs/${state.runId}/inspect`, { method: "POST" }));
  render();
}

async function prepareProposal() {
  if (!state.selectedAssertionId) throw new Error("Choose the value that should be current before continuing.");
  hydrate(await api(`/api/runs/${state.runId}/propose`, { method: "POST", body: JSON.stringify({ selected_assertion_id: state.selectedAssertionId }) }));
  render();
}

function recordApproval() {
  if (!document.querySelector("#approval-checkbox")?.checked) throw new Error("Explicit owner approval is required before any correction is applied.");
  state.stage = "apply";
  render();
}

async function applyAndExport() {
  hydrate(await api(`/api/runs/${state.runId}/apply`, { method: "POST", body: JSON.stringify({ approved: true }) }));
  render();
}

async function checkRuntime() {
  try {
    const status = await api("/api/status");
    agentStatus.textContent = status.cloud_ready ? `${status.runtime.model} / Firestore` : "Synthetic local mode";
  } catch { agentStatus.textContent = "Agent path unavailable"; }
}

async function api(path, options = {}) {
  const response = await fetch(path, { headers: { "content-type": "application/json" }, ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "The Steward stopped safely.");
  return body;
}

function hydrate(run) {
  state.runId = run.id;
  state.stage = run.stage;
  state.continuity = run.continuity;
  state.inventory = run.inventory;
  state.finding = run.finding || null;
  state.collaboration = run.collaboration || null;
  state.proposal = run.proposal || null;
  state.envelope = run.envelope || null;
}

function downloadExport() {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([JSON.stringify(state.envelope, null, 2)], { type: "application/json" }));
  link.download = "aster-continuity-verified.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function render() { renderStages(); renderAction(); renderEvidence(); renderDecision(); renderReceipt(); }

function renderStages() {
  const currentIndex = stages.indexOf(state.stage);
  document.querySelectorAll("#stage-list li").forEach((item, index) => {
    item.classList.toggle("active", index === currentIndex);
    item.classList.toggle("complete", index < currentIndex);
  });
}

function renderAction() {
  const copy = {
    import: ["Import a continuity package", "The demonstration uses a clearly labeled fictional companion.", "Load synthetic case", "Ready"],
    inspect: ["Inspect the evidence", "Inventory the records and detect unresolved continuity conflicts.", "Run inspection", "Package accepted"],
    clarify: ["Clarify the current truth", "The evidence disagrees, so the owner decides which value is current.", "Prepare proposal", "Owner input needed"],
    approve: ["Review the proposed correction", "Nothing changes until the proposal receives explicit approval.", "Approve proposal", "Approval required"],
    apply: ["Apply the approved correction", "Create a new assertion, preserve the originals, and verify the export.", "Apply and verify", "Approved"],
    verify: ["Verified continuity package", "The correction is append-only and the exported package matches its receipt.", "Download export", "Verified"]
  }[state.stage];
  [elements.actionTitle.textContent, elements.actionCopy.textContent, elements.primaryAction.textContent, elements.runState.textContent] = copy;
  elements.runSummary.textContent = state.continuity ? `${state.continuity.companion.display_name} / ${state.inventory.assertion_count} assertions / ${state.inventory.relation_count} relations` : "Load the fictional case to begin the stewardship run.";
}

function renderEvidence() {
  if (!state.continuity) return;
  const supersededIds = new Set(state.continuity.relations.filter((relation) => relation.type === "supersedes").map((relation) => relation.target_assertion_id));
  elements.evidenceList.className = "evidence-list";
  elements.evidenceList.innerHTML = state.continuity.assertions.map((assertion) => {
    const classes = ["evidence-row", supersededIds.has(assertion.id) ? "superseded" : "", assertion.source_type === "owner_approved_correction" ? "created" : ""].filter(Boolean).join(" ");
    return `<article class="${classes}"><span class="evidence-id">${escapeHtml(assertion.id)}</span><div class="evidence-value"><strong>${escapeHtml(assertion.display_value || assertion.value)}</strong><span>${escapeHtml(assertion.predicate)} / ${escapeHtml(assertion.source_type)}</span></div><time class="evidence-date">${formatDate(assertion.recorded_at)}</time></article>`;
  }).join("");
  elements.recordCount.textContent = `${state.continuity.assertions.length} records`;
}

function renderDecision() {
  if (!state.finding) {
    elements.decisionPanel.textContent = state.continuity ? "The package is ready for inspection." : "The Steward has not inspected the package yet.";
    elements.findingStatus.textContent = state.continuity ? "Ready" : "Waiting";
    return;
  }
  elements.decisionPanel.className = "decision-panel";
  elements.findingStatus.textContent = state.stage === "verify" ? "Resolved" : "Review required";
  const locked = stages.indexOf(state.stage) > 2;
  const choices = state.finding.options.map((option) => `<button type="button" class="choice ${state.selectedAssertionId === option.assertion_id ? "selected" : ""}" data-assertion-id="${escapeHtml(option.assertion_id)}" ${locked ? "disabled" : ""}><strong>${escapeHtml(option.label)}</strong><span>${escapeHtml(option.source_type)} / ${formatDate(option.recorded_at)}</span></button>`).join("");
  const proposal = state.proposal ? `<div class="proposal-details"><p>Current value: <strong>${escapeHtml(state.proposal.selected_label)}</strong></p><p>Action: append one correction and supersede ${state.proposal.evidence_assertion_ids.length} conflicting records.</p><p>Original records deleted: <strong>No</strong></p></div>${state.stage === "approve" ? `<label class="approval-check"><input id="approval-checkbox" type="checkbox" />I approve this exact append-only correction.</label>` : ""}` : "";
  const collaboration = state.collaboration || { headline: "Contradiction detected", explanation: state.finding.explanation, question: "How should Aster handle morning check-ins now?" };
  elements.decisionPanel.innerHTML = `<span class="finding-badge">Gemini collaboration</span><h3>${escapeHtml(collaboration.question)}</h3><p>${escapeHtml(collaboration.explanation)}</p><div class="choice-list">${choices}</div>${proposal}`;
  document.querySelectorAll(".choice:not([disabled])").forEach((button) => button.addEventListener("click", () => { state.selectedAssertionId = button.dataset.assertionId; renderDecision(); }));
}

function renderReceipt() {
  if (!state.envelope) return;
  elements.receiptTitle.textContent = "Export verified";
  elements.receiptPreserved.textContent = "YES";
  elements.receiptAssertions.textContent = state.envelope.manifest.assertion_count;
  elements.receiptRelations.textContent = state.envelope.manifest.relation_count;
  elements.receiptHash.textContent = state.envelope.manifest.payload_hash;
  elements.receiptHash.title = state.envelope.manifest.payload_hash;
}

function formatDate(value) { return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)); }
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
