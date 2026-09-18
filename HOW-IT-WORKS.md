# How It Works

`codex-search-opencode` adapts the Codex standalone web-search protocol to the OpenCode V2 plugin API. A platform-neutral provider handles the protocol; a small adapter registers it with OpenCode.

## Components

| Module | Responsibility |
| --- | --- |
| `src/codex-provider.ts` | Loads Codex credentials, sends requests, handles retries, cancellation, and HTTP failures. |
| `src/commands.ts` | Validates and serializes multi-step research commands. |
| `src/normalize.ts` | Normalizes endpoint output into stable results. |
| `src/output.ts` | Formats results, citations, sources, and OSC 8 terminal links. |
| `src/websearch-provider.ts` | Maps normalized responses to the V2 websearch provider result shape. |
| `src/opencode-tools.ts` | Defines the `codex_web` description, JSON Schema, and status text. |
| `src/index.ts` | Registers the `codex` websearch provider and the `codex_web` tool. |
| `index.ts` | Directory entrypoint the V2 loader resolves; re-exports `src/index.ts`. |

## Registration

A V2 plugin default-exports `Plugin.define({ id, setup })`. `setup` registers two things:

```ts
await ctx.websearch.transform((editor) => {
  editor.add({ id: "codex", name: "Codex (ChatGPT)", execute })
  if (editor.default.get() === undefined) editor.default.set("codex")
})

await ctx.tool.transform((editor) => {
  editor.add({ name: "codex_web", description, input, execute })
})
```

- The websearch provider routes OpenCode's native `websearch` tool to the Codex backend. It becomes the default only when the user has not selected one.
- Multi-step research cannot be expressed as a websearch provider, so it stays a dedicated tool.

## Single-query flow

```text
OpenCode model
  -> websearch({ query })
  -> codex websearch provider
  -> POST /backend-api/codex/alpha/search
  -> WebSearch.Result[]
```

## Research flow

```text
OpenCode model
  -> codex_web({ search_query | open | find | click, response_length })
  -> validateWebRunCommand()
  -> session-scoped CodexWebSearchProvider.execute()
  -> POST /backend-api/codex/alpha/search
  -> normalized response and citations
```

Each OpenCode session gets its own provider so sequential `search_query`, `open`, `find`, and `click` calls keep their reference IDs without leaking state into other sessions. The websearch provider uses one shared ID because V2 passes it no session.

## Request format

```json
{
  "id": "opencode_<session-id>",
  "model": "gpt-4o",
  "commands": {
    "search_query": [{ "q": "OpenAI Codex GitHub repository" }],
    "response_length": "medium"
  }
}
```

The `model` field selects the search backend contract. It is not an OpenCode agent inference request.

## Credentials and cancellation

At execution time the provider checks `CODEX_ACCESS_TOKEN`, then `~/.codex/auth.json`. A missing credential returns an actionable authentication error.

The websearch provider receives an `AbortSignal` and forwards it to `fetch`, together with a 15-second timeout. The V2 tool context does not expose an abort signal, so the `codex_web` path relies on the timeout alone.

Transient 502, 503, and 504 responses are retried twice with incremental delays. Authentication, rate-limit, and other HTTP failures become typed errors.

## Output and citations

Endpoint output can contain private Codex citation markers and reference IDs. `src/output.ts` maps result references to numbered citations and renders URLs with OSC 8 hyperlinks for compatible terminals. If the endpoint produces prose without a Sources block, the formatter appends up to ten retrieved sources.

When only structured results are returned, the formatter produces a readable numbered list. The websearch provider instead returns structured `{ url, title, content }` results, and OpenCode formats them for the model.

## Test strategy

`pnpm test` covers command validation, response normalization, provider result mapping, and status text. The live retrieval path needs Codex credentials, so an end-to-end check is manual: call `websearch` and `codex_web` once after installation.
