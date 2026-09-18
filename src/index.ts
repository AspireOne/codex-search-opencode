import { Plugin } from "@opencode/plugin";
import { CodexWebSearchProvider } from "./codex-provider";
import { validateWebRunCommand } from "./commands";
import { formatWebResponseText } from "./output";
import {
  CODEX_WEB_DESCRIPTION,
  CODEX_WEB_INPUT_SCHEMA,
  CODEX_WEB_TOOL_NAME,
  WEBSEARCH_PROVIDER_ID,
  WEBSEARCH_PROVIDER_NAME,
  describeCommandStatus,
  errorMessage,
} from "./opencode-tools";
import { toWebSearchResults } from "./websearch-provider";

export default Plugin.define({
  id: "codex-search",
  async setup(ctx) {
    // One provider per OpenCode session keeps Codex research state
    // (search -> open -> find -> click) isolated between sessions.
    const providers = new Map<string, CodexWebSearchProvider>();
    const resolveProvider = (sessionId: string): CodexWebSearchProvider => {
      const existing = providers.get(sessionId);
      if (existing) return existing;

      const provider = new CodexWebSearchProvider({ sessionId: `opencode_${sessionId}` });
      providers.set(sessionId, provider);
      return provider;
    };

    // Power the native websearch tool with the Codex standalone search backend.
    const websearchProvider = new CodexWebSearchProvider({ sessionId: "opencode_websearch" });
    await ctx.websearch.transform((editor) => {
      editor.add({
        id: WEBSEARCH_PROVIDER_ID,
        name: WEBSEARCH_PROVIDER_NAME,
        async execute({ query }, { signal }) {
          const response = await websearchProvider.search({ query }, signal);
          return toWebSearchResults(response);
        },
      });
      // Do not override an explicit provider selection.
      if (editor.default.get() === undefined) {
        editor.default.set(WEBSEARCH_PROVIDER_ID);
      }
    });

    // Multi-step research is not expressible as a websearch provider, so it
    // stays a dedicated tool.
    await ctx.tool.transform((editor) => {
      editor.add({
        name: CODEX_WEB_TOOL_NAME,
        description: CODEX_WEB_DESCRIPTION,
        input: CODEX_WEB_INPUT_SCHEMA,
        async execute(input, context) {
          const command = validateWebRunCommand(input);
          await context.progress({ title: describeCommandStatus(command), metadata: { command } });
          try {
            const response = await resolveProvider(context.sessionID).execute(command);
            return {
              content: formatWebResponseText(response),
              metadata: { command, resultCount: response.results.length, results: response.results },
            };
          } catch (error) {
            return {
              content: `Web execution failed: ${errorMessage(error)}`,
              metadata: { error: errorMessage(error) },
            };
          }
        },
      });
    });
  },
});
