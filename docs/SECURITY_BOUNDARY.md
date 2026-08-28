# Security And Privacy Boundary

## Allowed Inputs

- Original fictional companion identities and owner profiles.
- Synthetic memories, preferences, corrections, summaries, and receipts.
- Public documentation and properly licensed dependencies.
- Machine-local or Google-managed credentials that remain outside Git.

## Forbidden Inputs

- Real companion identity, memory, conversation, journal, task, voice, or configuration data.
- Customer, household, financial, health, tax, marketplace, wallet, or transaction data.
- Internal communications, private repository content, workstation files, or production runtime state.
- API keys, service-account files, session tokens, recovery material, or other credentials.

## Authority Boundary

- Automated analysis operates only on the bundled fictional fixture.
- Gemini may explain ambiguity but cannot apply a correction.
- Proposals cite the evidence they would affect.
- Durable changes require explicit owner approval bound to the exact proposal.
- Approved corrections are append-only; original records remain intact.
- Invalid input, malformed model output, missing approval, and failed verification stop safely.

## Public Service Boundary

- The public API does not accept arbitrary memory uploads.
- Request bodies are size-limited.
- The model result must match a bounded schema and length contract.
- Firestore stores only synthetic demonstration state.
- Cloud Run uses a service identity instead of a repository or browser API key.
- The public demonstration exposes no administrative, shell, deployment, or repository capability.
