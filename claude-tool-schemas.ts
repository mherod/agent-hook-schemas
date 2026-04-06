import { z } from "zod";
import { JsonObjectSchema, OptionalBooleanField, OptionalNumberField } from "./common.ts";

// ---------------------------------------------------------------------------
// Tool inputs (PreToolUse / PermissionRequest / PostToolUse*)
// ---------------------------------------------------------------------------

export const BashToolInputSchema = z.object({
  command: z.string(),
  description: z.string().optional(),
  timeout: OptionalNumberField,
  run_in_background: OptionalBooleanField,
});
export type BashToolInput = z.infer<typeof BashToolInputSchema>;

/** Response from the `Bash` built-in tool. */
export const BashToolResponseSchema = z
  .object({
    stdout: z.string(),
    stderr: z.string(),
    interrupted: OptionalBooleanField,
    isImage: OptionalBooleanField,
    noOutputExpected: OptionalBooleanField,
  })
  .loose();
export type BashToolResponse = z.infer<typeof BashToolResponseSchema>;

export const WriteToolInputSchema = z.object({
  file_path: z.string(),
  content: z.string(),
});
export type WriteToolInput = z.infer<typeof WriteToolInputSchema>;

export const EditToolInputSchema = z.object({
  file_path: z.string(),
  old_string: z.string(),
  new_string: z.string(),
  replace_all: OptionalBooleanField,
});
export type EditToolInput = z.infer<typeof EditToolInputSchema>;

/** Response from `Edit` when the file was modified. */
export const EditToolResponseSchema = z
  .object({
    filePath: z.string(),
    oldString: z.string(),
    newString: z.string(),
  })
  .loose();
export type EditToolResponse = z.infer<typeof EditToolResponseSchema>;

export const ReadToolInputSchema = z.object({
  file_path: z.string(),
  offset: OptionalNumberField,
  limit: OptionalNumberField,
});
export type ReadToolInput = z.infer<typeof ReadToolInputSchema>;

/** File content returned by `Read`. */
export const ReadToolResponseTextSchema = z
  .object({
    type: z.literal("text"),
    file: z
      .object({
        filePath: z.string(),
        content: z.string(),
        numLines: OptionalNumberField,
        startLine: OptionalNumberField,
        totalLines: OptionalNumberField,
      })
      .loose(),
  })
  .loose();
export type ReadToolResponseText = z.infer<typeof ReadToolResponseTextSchema>;

/** Response when `Read` detects the file hasn't changed since last read. */
export const ReadToolResponseUnchangedSchema = z
  .object({
    type: z.literal("file_unchanged"),
    file: z.object({ filePath: z.string() }).loose(),
  })
  .loose();
export type ReadToolResponseUnchanged = z.infer<typeof ReadToolResponseUnchangedSchema>;

/** Discriminated response from the `Read` built-in tool. */
export const ReadToolResponseSchema = z.discriminatedUnion("type", [
  ReadToolResponseTextSchema,
  ReadToolResponseUnchangedSchema,
]);
export type ReadToolResponse = z.infer<typeof ReadToolResponseSchema>;

export const GlobToolInputSchema = z.object({
  pattern: z.string(),
  path: z.string().optional(),
});
export type GlobToolInput = z.infer<typeof GlobToolInputSchema>;

export const GrepToolInputSchema = z.object({
  pattern: z.string(),
  path: z.string().optional(),
  glob: z.string().optional(),
  output_mode: z.enum(["content", "files_with_matches", "count"]).optional(),
  "-i": OptionalBooleanField,
  multiline: OptionalBooleanField,
});
export type GrepToolInput = z.infer<typeof GrepToolInputSchema>;

/** Response from the `Grep` built-in tool. */
export const GrepToolResponseSchema = z
  .object({
    mode: z.string().optional(),
    numFiles: OptionalNumberField,
    filenames: z.array(z.string()).optional(),
    content: z.string().optional(),
    numLines: OptionalNumberField,
  })
  .loose();
export type GrepToolResponse = z.infer<typeof GrepToolResponseSchema>;

export const WebFetchToolInputSchema = z.object({
  url: z.string(),
  prompt: z.string(),
});
export type WebFetchToolInput = z.infer<typeof WebFetchToolInputSchema>;

export const WebSearchToolInputSchema = z.object({
  query: z.string(),
  allowed_domains: z.array(z.string()).optional(),
  blocked_domains: z.array(z.string()).optional(),
});
export type WebSearchToolInput = z.infer<typeof WebSearchToolInputSchema>;

/** A single search result link returned inside {@link WebSearchToolResponseSchema}. */
export const WebSearchResultLinkSchema = z
  .object({
    title: z.string(),
    url: z.string(),
  })
  .loose();
export type WebSearchResultLink = z.infer<typeof WebSearchResultLinkSchema>;

/** Structured search result block containing links (first element of the `results` tuple). */
export const WebSearchResultBlockSchema = z
  .object({
    tool_use_id: z.string().optional(),
    content: z.array(WebSearchResultLinkSchema),
  })
  .loose();
export type WebSearchResultBlock = z.infer<typeof WebSearchResultBlockSchema>;

/**
 * Response from the `WebSearch` built-in tool.
 *
 * `results` is a heterogeneous array: structured result blocks and AI-generated
 * summary strings interleaved. Use {@link WebSearchResultBlockSchema} to narrow
 * individual elements.
 */
export const WebSearchToolResponseSchema = z
  .object({
    query: z.string(),
    results: z.array(z.union([WebSearchResultBlockSchema, z.string()])),
    durationSeconds: OptionalNumberField,
  })
  .loose();
export type WebSearchToolResponse = z.infer<typeof WebSearchToolResponseSchema>;

// ---------------------------------------------------------------------------
// ToolSearch tool input / response
// ---------------------------------------------------------------------------

/** Tool input for the `ToolSearch` built-in tool (deferred tool lookup). */
export const ToolSearchToolInputSchema = z
  .object({
    query: z.string(),
    max_results: OptionalNumberField,
  })
  .loose();
export type ToolSearchToolInput = z.infer<typeof ToolSearchToolInputSchema>;

/** Response from the `ToolSearch` built-in tool. */
export const ToolSearchToolResponseSchema = z
  .object({
    matches: z.array(z.string()),
    query: z.string(),
    total_deferred_tools: OptionalNumberField,
  })
  .loose();
export type ToolSearchToolResponse = z.infer<typeof ToolSearchToolResponseSchema>;

export const AgentToolInputSchema = z.object({
  prompt: z.string(),
  description: z.string().optional(),
  subagent_type: z.string(),
  model: z.string().optional(),
});
export type AgentToolInput = z.infer<typeof AgentToolInputSchema>;

export const AskUserQuestionOptionSchema = z.object({
  label: z.string(),
});
export type AskUserQuestionOption = z.infer<typeof AskUserQuestionOptionSchema>;

export const AskUserQuestionItemSchema = z.object({
  question: z.string(),
  header: z.string(),
  options: z.array(AskUserQuestionOptionSchema),
  multiSelect: OptionalBooleanField,
});
export type AskUserQuestionItem = z.infer<typeof AskUserQuestionItemSchema>;

export const AskUserQuestionToolInputSchema = z.object({
  questions: z.array(AskUserQuestionItemSchema),
  answers: z.record(z.string(), z.string()).optional(),
});
export type AskUserQuestionToolInput = z.infer<typeof AskUserQuestionToolInputSchema>;

/** Unknown or MCP tools: keep structured fields loose. */
export const GenericToolInputSchema = JsonObjectSchema;
export type GenericToolInput = z.infer<typeof GenericToolInputSchema>;
