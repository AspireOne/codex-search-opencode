import type { SearchResponse, SearchResult } from "./normalize";

export function formatTerminalHyperlink(url: string, text: string): string {
  return url ? `\u001b]8;;${url}\u001b\\${text}\u001b]8;;\u001b\\` : text;
}

export function cleanCitationMarkers(text: string, results: SearchResult[] = []): string {
  if (!text) return "";

  const refs = new Map<string, { number: number; result: SearchResult }>();
  results.forEach((result, index) => {
    const ref = result.ref_id || result.refId;
    if (ref) refs.set(ref, { number: index + 1, result });
  });

  const withCitations = text.replace(
    /[\uE000-\uE2FF]?cite[\uE000-\uE2FF]?([^\uE000-\uE2FF\r\n]+)[\uE000-\uE2FF]?/gi,
    (_match, value) => formatCitation(value.trim(), refs),
  );

  return withCitations.replace(/\[(turn\d+[a-z0-9_,\s]*)\]/gi, (_match, value) => {
    return value
      .split(",")
      .map((ref: string) => formatCitation(ref.trim(), refs))
      .join(" ");
  });
}

export function formatWebResponseText(response: SearchResponse): string {
  if (response.output?.trim()) {
    return appendSources(cleanCitationMarkers(response.output.trim(), response.results), response.results);
  }
  if (response.results.length === 0) return "No output or structured web results returned.";

  const results = response.results.map((result, index) => formatResult(result, index + 1));
  return `Web Search Results:\n\n${results.join("\n\n")}`;
}

function formatCitation(ref: string, refs: Map<string, { number: number; result: SearchResult }>): string {
  if (ref.includes("†")) {
    const label = ref.split("†").slice(1).join("†").trim();
    return label ? `[${label}]` : "";
  }
  const entry = refs.get(ref);
  if (!entry) return ref ? `[${ref}]` : "";
  const label = `[${entry.number}]`;
  return entry.result.url ? formatTerminalHyperlink(entry.result.url, label) : label;
}

function appendSources(text: string, results: SearchResult[]): string {
  if (text.includes("Sources:") || results.length === 0) return text;
  const sources = results
    .filter((result): result is SearchResult & { url: string } => typeof result.url === "string" && result.url.length > 0)
    .slice(0, 10)
    .map((result, index) => `[${index + 1}] ${result.title || result.url} - ${formatTerminalHyperlink(result.url, result.url)}`);
  return sources.length === 0 ? text : `${text}\n\nSources:\n${sources.join("\n")}`;
}

function formatResult(result: SearchResult, number: number): string {
  const title = result.title || result.url || `Result ${number}`;
  const ref = result.ref_id ? `\n   Ref: [${number}] (${result.ref_id})` : "";
  const url = result.url ? `\n   URL: ${formatTerminalHyperlink(result.url, result.url)}` : "";
  const snippet = result.snippet ? `\n   ${cleanCitationMarkers(result.snippet)}` : "";
  return `[${number}] ${title}${ref}${url}${snippet}`;
}
