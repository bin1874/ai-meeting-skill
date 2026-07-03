# AI Meeting Skill

`ai-meeting` is a portable `SKILL.md`-based agent skill for running structured multi-agent review meetings on plans, product ideas, technical designs, business decisions, and implementation proposals.

The v1 target is practical decision quality: get several AI agents to analyze the same proposal from different roles, challenge each other across rounds, preserve provider session IDs when available, and produce a Markdown decision report with provenance.

## Current Status

- Primary providers: Codex and Claude Code.
- Experimental providers: Qoder, OpenCode, Cursor, Gemini, and Hermes are registered for `doctor` and adapter testing, but they are blocked from real `round`/`synthesize` use until auth, permission isolation, and current-version smoke validation pass.
- Future provider slots: other CLI-capable agents.
- Main skill entry: `ai-meeting/SKILL.md`.
- Orchestrator script: `ai-meeting/scripts/ai-meeting.mjs`.
- Provider registry: `ai-meeting/scripts/providers/`.
- Tests: `tests/ai-meeting.test.mjs`.
- Codex can use `ai-meeting/agents/openai.yaml` as UI metadata. Claude Code can ignore that file and use the skill folder directly.

## Project Layout

```txt
ai-meeting/
  SKILL.md
  agents/openai.yaml
  references/
    output-template.md
    prompt-templates.md
    provider-adapters.md
    state-schema.md
  scripts/
    ai-meeting.mjs
    providers/
      registry.mjs
      shared.mjs
      codex.mjs
      claude.mjs
      qoder.mjs
      opencode.mjs
      cursor.mjs
      gemini.mjs
      hermes.mjs
tests/
  ai-meeting.test.mjs
```

## Installation

Install for Codex by copying or symlinking the skill folder into your Codex skills directory:

```bash
mkdir -p ~/.codex/skills
ln -s "$(pwd)/ai-meeting" ~/.codex/skills/ai-meeting
```

Install for Claude Code by copying or symlinking the same skill folder into your Claude skills directory:

```bash
mkdir -p ~/.claude/skills
ln -s "$(pwd)/ai-meeting" ~/.claude/skills/ai-meeting
```

After installation, ask the host agent to use the `ai-meeting` skill for a multi-agent meeting, or invoke the skill directly if your host supports direct skill commands.

## Quick Start

Check provider availability:

```bash
node ai-meeting/scripts/ai-meeting.mjs doctor --json
```

Check strict readiness for default providers:

```bash
node ai-meeting/scripts/ai-meeting.mjs doctor --json --strict
```

`doctor --strict` is a release-gate isolation check, not the normal usability check. It fails when default providers have unverified auth, prompt transport, tool isolation, cwd/config/sandbox boundaries, smoke status, or network certainty. A strict failure does not automatically mean ordinary meetings are unusable; inspect `doctor --json` provider availability and the strict failure list separately.

Create a meeting:

```bash
node ai-meeting/scripts/ai-meeting.mjs create \
  --topic "Should we build this feature?" \
  --brief-file path/to/brief.md \
  --material docs/design.md \
  --material README.md
```

`--brief-file` rejects obvious secret paths and likely secret content by default. Use `--allow-sensitive-materials` only when you explicitly accept that the material will be injected into provider prompts and written to local meeting artifacts.

Use `--brief-file` for the decision goal and review criteria. Use repeatable `--material` inputs for the actual documents, code excerpts, specs, diffs, or test outputs the agents should evaluate. Materials are copied into `meetings/<id>/materials/`, recorded with byte size and SHA-256, and injected into prompts as separate untrusted data blocks.

Large materials are copied in full to `materials/`, but provider prompts include only the per-block prompt budget. `create` returns warnings when materials are truncated or globally large; prompts, state, and final provenance also mark `truncatedForPrompt=true`. Treat those reports as partial-context reviews unless the missing portions are validated another way.

Preview round prompts without calling providers or mutating official state:

```bash
node ai-meeting/scripts/ai-meeting.mjs round \
  --meeting-dir meetings/<id> \
  --round 1 \
  --dry-run
```

Run a real round:

```bash
node ai-meeting/scripts/ai-meeting.mjs round \
  --meeting-dir meetings/<id> \
  --round 1
```

Synthesize the final decision report:

```bash
node ai-meeting/scripts/ai-meeting.mjs synthesize \
  --meeting-dir meetings/<id>
```

The final report is written to:

```txt
meetings/<id>/synthesis/final.md
```

If the judge returns a report that is missing required sections, the orchestrator writes `meetings/<id>/synthesis/final.draft.md`, records the missing sections in `state.json`, and does not write the official `final.md`.

## Safety Model

The orchestrator treats all meeting materials and agent outputs as untrusted data.

Key v1 safeguards:

- Child agents run with `AI_MEETING_ACTIVE=1`; the script refuses recursive invocation.
- Codex runs with read-only sandbox configuration.
- Claude Code runs with `--safe-mode` and no tools by default.
- Qoder adapter tests enforce stdin prompt transport, an isolated cwd, `--tools ""`, empty MCP config, and `--strict-mcp-config`; it remains experimental and unavailable while auth or current-version smoke validation is missing.
- OpenCode adapter tests enforce JSON event parsing, isolated cwd, no fallback to a default agent, and an explicit `ai-meeting-readonly` agent check; it remains experimental and unavailable until the read-only agent and smoke validation pass.
- Cursor adapter tests enforce stdin prompt transport, `--mode ask`, `--sandbox enabled`, isolated `--workspace`, no `--force`/`--yolo`, and stream-json parsing; it remains experimental and unavailable until auth and smoke validation pass.
- Gemini adapter tests enforce stdin prompt transport, UUID `--session-id`/`--resume`, `--approval-mode plan`, `--sandbox`, no `--yolo`, and stream-json parsing; it remains experimental and unavailable until auth/tier and smoke validation pass.
- Hermes adapter tests enforce stdin prompt transport, no `--oneshot`, no `--yolo`, `--ignore-user-config`, `--ignore-rules`, text output sanitization, and stateless behavior; it remains experimental and unavailable until auth/provider config, toolset isolation, and output format smoke validation pass.
- Each child agent gets a stable isolated workspace under `workspaces/<agent>.<provider>/`; this preserves provider resume semantics while avoiding the project root and meeting root as cwd.
- Brief and controlled materials are injected through prompt data fences. Agents do not freely read the project root.
- Controlled materials are copied into `materials/` and tracked in state/provenance with path, byte size, SHA-256, and prompt truncation status.
- `--dry-run` writes only under `dry-run/` and does not update `state.json`.
- `state.json` is atomically written and path fields are checked against directory escape.
- Official meeting artifacts are written with owner-only `0600` file permissions.
- Provider success with empty output is recorded as failed.
- Provider resume failure is retried once as a fresh session using the self-contained prompt, then recorded as recovered or failed.
- Synthesis appends trusted provenance, validates required final report sections, and only then writes `synthesis/final.md`; invalid judge output is preserved as `synthesis/final.draft.md`.
- Session IDs are redacted in stdout and omitted from final report provenance.

Codex network isolation is reported as `unverified` because read-only sandboxing does not prove network state.

## Testing

Run all local checks:

```bash
node --check ai-meeting/scripts/ai-meeting.mjs
node --test tests/ai-meeting.test.mjs
python3 /home/ben/.codex/skills/.system/skill-creator/scripts/quick_validate.py ai-meeting
node ai-meeting/scripts/ai-meeting.mjs doctor --json
```

The test suite covers dry-run isolation, owner-only artifact permissions, controlled material copying/injection/provenance, truncation warnings, path escape rejection, duplicate role rejection, recursion refusal, missing option values, budget limits, sensitive brief/material rejection, stable Claude workspaces, resume recovery, stateless Claude output handling, Qoder/OpenCode/Cursor/Gemini/Hermes adapter behavior, session-id poisoning protection, provider fail-fast gates, strict doctor readiness, final section validation, final draft preservation, final provenance replacement, empty output failure, and prompt fence behavior.

## Reference Files

- Provider adapter design: `ai-meeting/references/provider-adapters.md`
- State schema: `ai-meeting/references/state-schema.md`
- Prompt templates: `ai-meeting/references/prompt-templates.md`
- Output template: `ai-meeting/references/output-template.md`

## License

MIT
