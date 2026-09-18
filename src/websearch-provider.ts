import type { SearchResponse } from "./normalize";

/**
 * Result shape expected by the OpenCode V2 websearch provider registry
 * (`WebSearch.Result`). Declared structurally so the adapter does not depend on
 * SDK-internal types.
 */
export interface CodexWebSearchResult {
  url: string;
  title?: string;
  content?: string;
  time: { published?: number };
}

/**
 * Map a normalized Codex search response onto websearch provider results.
 * Codex results without a URL cannot be represented, so they are dropped.
 */
export function toWebSearchResults(response: SearchResponse): CodexWebSearchResult[] {
  return response.results.flatMap((result) => {
    if (!result.url) return [];

    const mapped: CodexWebSearchResult = { url: result.url, time: {} };
    if (result.title) mapped.title = result.title;
    if (result.snippet) mapped.content = result.snippet;
    return [mapped];
  });
}
