import assert from "node:assert/strict";
import { chooseRelevantCandidates } from "./property_rerank_service.ts";

const candidates = [
  { id: "inspection-1", kind: "inspection_reminder" as const, text: "Annual inspection reminder for unit 4B" },
  { id: "repair-1", kind: "maintenance" as const, text: "Leaking kitchen faucet reported in unit 4B" },
  { id: "lease-1", kind: "tenant_document" as const, text: "Signed lease for unit 4B" }
];

const result = chooseRelevantCandidates("leak", candidates, ["repair-1", "lease-1"]);
assert.deepEqual(result.map((candidate) => candidate.id), ["repair-1", "lease-1"]);
console.log("property rerank decision: maintenance result stays first");
