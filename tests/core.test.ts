import assert from "node:assert/strict";
import { test } from "node:test";
import { InvalidCommandError, validateWebRunCommand } from "../src/commands.ts";
import { normalizeSearchResponseBody } from "../src/normalize.ts";
import { describeCommandStatus } from "../src/opencode-tools.ts";
import { toWebSearchResults } from "../src/websearch-provider.ts";

test("validateWebRunCommand accepts a search command and trims values", () => {
  const command = validateWebRunCommand({
    search_query: [{ q: "  rust release  ", domains: [" doc.rust-lang.org ", ""] }],
  });

  assert.deepEqual(command, { search_query: [{ q: "rust release", domains: ["doc.rust-lang.org"] }] });
});

test("validateWebRunCommand rejects a command without operations", () => {
  assert.throws(() => validateWebRunCommand({ response_length: "short" }), InvalidCommandError);
});

test("validateWebRunCommand rejects malformed operations", () => {
  assert.throws(() => validateWebRunCommand({ click: [{ ref_id: "turn0search0", id: "1" }] }), InvalidCommandError);
  assert.throws(() => validateWebRunCommand({ find: [{ ref_id: "turn0search0" }] }), InvalidCommandError);
  assert.throws(() => validateWebRunCommand({ search_query: [{ q: "   " }] }), InvalidCommandError);
});

test("normalizeSearchResponseBody keeps usable results and drops empty ones", () => {
  const response = normalizeSearchResponseBody({
    output: "answer",
    results: [
      { url: "https://example.com", title: " Example ", snippet: " snippet " },
      { title: "   " },
      { ref_id: "turn0search1", url: "https://two.example" },
    ],
  });

  assert.equal(response.output, "answer");
  assert.equal(response.results.length, 2);
  assert.equal(response.results[0].url, "https://example.com");
  assert.equal(response.results[0].title, "Example");
  assert.equal(response.results[0].ref_id, undefined);
  assert.equal(response.results[1].ref_id, "turn0search1");
});

test("toWebSearchResults maps Codex results to the provider shape", () => {
  const results = toWebSearchResults({
    results: [
      { url: "https://a.example", title: "A", snippet: "alpha" },
      { ref_id: "turn0search1" },
      { url: "https://b.example" },
    ],
  });

  assert.deepEqual(results, [
    { url: "https://a.example", title: "A", content: "alpha", time: {} },
    { url: "https://b.example", time: {} },
  ]);
});

test("describeCommandStatus summarizes the command", () => {
  assert.match(
    describeCommandStatus({ search_query: [{ q: "x" }], open: [{ ref_id: "turn0search0" }] }),
    /^Searching "x"; Opening turn0search0\.\.\.$/,
  );
  assert.equal(describeCommandStatus({}), "Researching the web...");
});
