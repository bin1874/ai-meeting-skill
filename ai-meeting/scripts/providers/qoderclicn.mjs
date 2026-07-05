import { randomUUID } from "node:crypto";

import {
  commandStatus,
  parseJsonLines,
  providerChildEnv,
  spawnWithInput
} from "./shared.mjs";

const REQUIRED_FLAGS = [
  "--print",
  "--output-format",
  "--resume",
  "--session-id",
  "--cwd",
  "--permission-mode",
  "--tools",
  "--mcp-config",
  "--strict-mcp-config",
  "--setting-sources"
];

const EMPTY_MCP_CONFIG = '{"mcpServers":{}}';

export const qoderCliCnProvider = {
  name: "qoderclicn",
  sessionKind: "sessionId",
  registryDefault: false,
  check() {
    const version = commandStatus("qoderclicn", ["--version"], { provider: "qoderclicn" });
    const help = commandStatus("qoderclicn", ["--help"], { provider: "qoderclicn" });
    const helpText = `${help.stdout}\n${help.stderr}`;
    const missingFlags = REQUIRED_FLAGS.filter((flag) => !helpText.includes(flag));
    const hasMcpIsolation = helpText.includes("--mcp-config") && helpText.includes("--strict-mcp-config");
    return {
      provider: "qoderclicn",
      available: version.available && help.available && missingFlags.length === 0,
      version: version.stdout || version.stderr,
      auth: "unknown",
      resume: helpText.includes("--resume") && helpText.includes("--session-id") ? "supported" : "unsupported",
      output: helpText.includes("--output-format") ? "stream-json" : "unverified",
      tools: helpText.includes("--tools") ? 'configured: --tools "" will be passed' : "unverified",
      cwdIsolation: helpText.includes("--cwd") ? "configured" : "unverified",
      configIsolation: hasMcpIsolation && helpText.includes("--setting-sources") ? "configured" : "unverified",
      sandbox: "unsupported",
      network: "unverified",
      promptTransport: "stdin",
      registryDefault: false,
      requiredFlagsOk: missingFlags.length === 0,
      smokeVerified: true,
      notes: missingFlags.length ? [`missing required flag(s): ${missingFlags.join(", ")}`] : []
    };
  },
  async startSession(input) {
    const sessionId = input.generatedSessionId ?? randomUUID();
    return runQoderCliCn({ ...input, sessionId, starting: true });
  },
  async continueSession(input) {
    return runQoderCliCn({ ...input, starting: false });
  }
};

async function runQoderCliCn(input) {
  const args = [
    "-p",
    "--output-format",
    "stream-json",
    "--cwd",
    input.cwd,
    "--permission-mode",
    "default",
    "--tools",
    "",
    "--mcp-config",
    EMPTY_MCP_CONFIG,
    "--strict-mcp-config",
    "--setting-sources",
    "user"
  ];
  if (input.model) args.push("--model", input.model);
  if (input.starting) {
    args.push("--session-id", input.sessionId);
  } else {
    args.push("--resume", input.sessionId);
  }

  const result = await spawnWithInput("qoderclicn", args, input.prompt, { cwd: input.cwd, env: providerChildEnv("qoderclicn"), timeoutMs: input.timeoutMs });
  const events = parseJsonLines(result.stdout);
  const finalMessage = extractQoderCliCnFinalMessage(events);
  const cliError = hasQoderCliCnError(events);
  const unparsedOutput = events.some((event) => event?.type === "unparsed");
  const hasModelOutput = finalMessage.trim() !== "";
  const status = result.code === 0 && !result.timedOut && !cliError && !unparsedOutput && hasModelOutput ? "completed" : "failed";
  const stderr = [
    result.stderr,
    unparsedOutput ? "qoderclicn returned non-JSON output; failing closed." : "",
    hasModelOutput ? "" : "qoderclicn returned no parseable model output."
  ].filter(Boolean).join("\n");
  return {
    provider: "qoderclicn",
    sessionId: extractQoderCliCnSessionId(events, input.sessionId),
    rawOutput: finalMessage,
    status,
    resumed: !input.starting,
    resumeFailed: !input.starting && status !== "completed",
    stderr,
    events
  };
}

function extractQoderCliCnSessionId(events, expectedSessionId) {
  for (const event of events) {
    const candidate = typeof event?.session_id === "string" && event.session_id
      ? event.session_id
      : typeof event?.sessionId === "string" && event.sessionId
        ? event.sessionId
        : null;
    if (candidate && candidate === expectedSessionId) return candidate;
  }
  return null;
}

function extractQoderCliCnFinalMessage(events) {
  let resultText = "";
  let assistantText = "";
  for (const event of events) {
    if (event.type === "result" && typeof event.result === "string") {
      resultText = event.result;
      continue;
    }
    if (event.type !== "assistant" || !Array.isArray(event.message?.content)) continue;
    for (const block of event.message.content) {
      if (block?.type === "text" && typeof block.text === "string") assistantText += block.text;
    }
  }
  return (resultText || assistantText).trim();
}

function hasQoderCliCnError(events) {
  return events.some((event) => event?.is_error === true || event?.error != null);
}
