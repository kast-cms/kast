-- Renames agent_sessions to agent_tool_calls.
--
-- The table always held one row per MCP tool invocation, never per connection:
-- logToolCall() writes a row after each call and synthesises `startedAt` by
-- subtracting the measured duration from now. Calling it a session implied a
-- lifecycle that the stateless Streamable HTTP transport does not have.
--
-- Written as a rename rather than the drop-and-recreate Prisma diffs to, because
-- these rows are the per-token agent history operators audit after an incident.

ALTER TABLE "agent_sessions" RENAME TO "agent_tool_calls";
ALTER TABLE "agent_tool_calls" RENAME CONSTRAINT "agent_sessions_pkey" TO "agent_tool_calls_pkey";
ALTER TABLE "agent_tool_calls"
  RENAME CONSTRAINT "agent_sessions_agentTokenId_fkey" TO "agent_tool_calls_agentTokenId_fkey";
ALTER INDEX "agent_sessions_agentTokenId_idx" RENAME TO "agent_tool_calls_agentTokenId_idx";

-- `toolsUsed` was a JSON array that only ever received a single-element list.
-- Collapse it to the scalar it always was, keeping the recorded tool name.
ALTER TABLE "agent_tool_calls" ADD COLUMN "toolName" TEXT;
UPDATE "agent_tool_calls" SET "toolName" = COALESCE("toolsUsed" ->> 0, 'unknown');
ALTER TABLE "agent_tool_calls" ALTER COLUMN "toolName" SET NOT NULL;
ALTER TABLE "agent_tool_calls" DROP COLUMN "toolsUsed";
