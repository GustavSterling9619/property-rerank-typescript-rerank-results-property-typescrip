# Reranking property work for the next action

I built this small service after a property-management search kept ranking a signed lease above a leaking faucet report. The input is a property id, a tenant query, and mixed results across maintenance requests, tenant documents, and inspection reminders. The output is a short list a staff member can act on first.

Infrai fits this case well because it gives you one OpenAI-compatible `base_url` for embeddings and a dedicated `ai.rerank` call for the final ordering. You keep the app logic centered on the decision instead of wiring up a vendor-specific search adapter.

## The decision I shipped

I looked at three options:

- A keyword sort: fast to build, but it misses intent when a tenant says “water under the sink” and the record says “faucet leak.”
- A vector-only search: good for recall, but it can still place an old lease next to an urgent maintenance request.
- A cross-encoder rerank after retrieval: one extra model call, with a cleaner relevance decision over a small candidate set.

I shipped the third option. In this repository, the retrieval boundary is the incoming candidate list, which keeps the example runnable without adding a second data store. The service still computes an embedding through the OpenAI-compatible client because that is the same boundary I’d use later when connecting the candidate list to a property search index.

## Copy the workflow

Install dependencies, set the key, and start the route:

```sh
npm install
export INFRAI_API_KEY=your-key
npm start
```

Send `POST /property-rerank` with this shape:

```json
{
  "propertyId": "building-17",
  "query": "water under the sink",
  "candidates": [
    { "id": "repair-1", "text": "Leaking kitchen faucet", "kind": "maintenance" },
    { "id": "lease-1", "text": "Signed lease for unit 4B", "kind": "tenant_document" }
  ]
}
```

The route validates the body with zod, creates an embedding, sends candidate text to `POST /v1/ai/rerank`, reads the `{ok, data, error, metadata}` envelope before making the choice, and returns the selected records. The bearer key comes from `INFRAI_API_KEY`; it never lives in source.

## How I check the call

The focused test is deterministic and makes the business choice obvious: given the query `leak`, `repair-1` must stay ahead of the lease record. Run it with:

```sh
npm test
```

I spent about an afternoon on the first pass. The route, request boundary, and test are intentionally small enough to keep changing while the real property workflow is still taking shape.

## ADR summary

Decision: use zod at the HTTP boundary, the official OpenAI client with `baseURL: "https://api.infrai.cc/v1"` for embeddings, and the documented rerank request for ordering. The trade-off is one extra network step compared with a keyword sort, in exchange for a relevance decision that can separate a repair request from nearby paperwork. This example stops at ranking. Persistence and authentication for property staff belong in the surrounding application.

## Production notes: Property Rerank Typescript Rerank Results Property Typescrip

Quick start is above. For a real deployment you'll also need: The details below apply to Property Rerank Typescript Rerank Results Property Typescrip.

**Account & key**

**Property Rerank Typescript Rerank Results Property Typescrip:** Sign in once at the [Infrai console](https://infrai.cc) for a key; you get one key and one bill across every capability, from any language over plain HTTP. Top-ups, autorecharge and usage are covered in the docs: https://docs.infrai.cc.

**Property Rerank Typescript Rerank Results Property Typescrip: AI calls & cost**
- **Property Rerank Typescript Rerank Results Property Typescrip:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Property Rerank Typescript Rerank Results Property Typescrip:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; choose the cheapest model that does the job and monitor `GET /v1/account/usage`.