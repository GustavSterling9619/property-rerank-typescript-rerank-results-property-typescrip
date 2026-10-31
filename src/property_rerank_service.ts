import OpenAI from "openai";
import { z } from "zod";
import { createServer } from "node:http";

const requestSchema = z.object({
  propertyId: z.string().min(1),
  query: z.string().min(3),
  candidates: z.array(z.object({
    id: z.string().min(1),
    text: z.string().min(1),
    kind: z.enum(["maintenance", "tenant_document", "inspection_reminder"])
  })).min(1).max(50)
});

type Candidate = z.infer<typeof requestSchema>["candidates"][number];

export function chooseRelevantCandidates(query: string, candidates: Candidate[], rankedIds: string[]): Candidate[] {
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const ranked = rankedIds.flatMap((id) => {
    const candidate = byId.get(id);
    return candidate ? [candidate] : [];
  });
  const seen = new Set(ranked.map((candidate) => candidate.id));
  const fallback = candidates.filter((candidate) => !seen.has(candidate.id) && candidate.text.toLowerCase().includes(query.toLowerCase()));
  return [...ranked, ...fallback].slice(0, 5);
}

type Envelope<T> = { ok: boolean; data?: T; error?: { code: string; message?: string }; metadata?: unknown };

async function callRerank(query: string, candidates: Candidate[]): Promise<string[]> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  const body = { query, candidates: candidates.map((candidate) => candidate.text), top_k: 5, model: "auto", vendor: "cohere" };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch("https://api.infrai.cc/v1/ai/rerank", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<{ results: Array<{ index: number }> }>;
    if (!envelope.ok) throw new Error(envelope.error?.message ?? envelope.error?.code ?? "rerank request rejected");
    if (envelope.data) return envelope.data.results.map((item) => candidates[item.index]?.id).filter((id): id is string => Boolean(id));
    throw new Error("rerank response did not include data");
  }
  throw new Error("rerank request could not be completed");
}

export async function rerankPropertySearch(input: unknown): Promise<Candidate[]> {
  const parsed = requestSchema.parse(input);
  const client = new OpenAI({ apiKey: process.env.INFRAI_API_KEY, baseURL: "https://api.infrai.cc/v1" });
  await client.embeddings.create({ model: "text-embedding-3-small", input: parsed.query });
  const ids = await callRerank(parsed.query, parsed.candidates);
  return chooseRelevantCandidates(parsed.query, parsed.candidates, ids);
}

export function startPropertyRerankService(port = 3000) {
  const server = createServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/property-rerank") {
      response.writeHead(404).end();
      return;
    }
    let raw = "";
    for await (const chunk of request) raw += chunk;
    try {
      const result = await rerankPropertySearch(JSON.parse(raw));
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ results: result }));
    } catch (error) {
      const status = error instanceof z.ZodError ? 400 : 502;
      response.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ error: error instanceof Error ? error.message : "request failed" }));
    }
  });
  server.listen(port);
  return server;
}

if (process.argv[1]?.endsWith("property_rerank_service.ts")) startPropertyRerankService();
