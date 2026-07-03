# AI Meeting Skill

English | [中文](README.zh-CN.md)

`ai-meeting` is a portable `SKILL.md`-based agent skill for structured multi-agent meetings. It helps Codex, Claude Code, and other CLI-capable agents review plans, product ideas, technical designs, implementation proposals, and risky decisions across multiple roles.

The skill runs a local orchestrator that:

- creates a meeting ledger under `meetings/<id>/`
- injects the brief and controlled materials into each agent prompt
- preserves provider session IDs when available
- runs independent analysis and cross-questioning rounds
- writes a final Markdown decision report with provenance

## Status

- Primary providers: Codex and Claude Code.
- Experimental providers: Qoder, OpenCode, Cursor, Gemini, and Hermes are included as opt-in adapters. The project does not block other agent tools by brand; any CLI agent can participate once its provider adapter reports usable auth, prompt transport, session handling, and permission boundaries through `doctor`.
- Skill folder/name: `ai-meeting`.
- Display name: `AI Meeting`.

## Install

### Option A: Ask Your Agent To Install It

Copy this into Codex:

```text
Install the ai-meeting skill from this GitHub repository:
https://github.com/bin1874/ai-meeting-skill
```

### Option B: Install In Claude Code As A Plugin

In Claude Code, run:

```text
/plugin marketplace add bin1874/ai-meeting-skill
/plugin install ai-meeting@ai-meeting-skill
```

The marketplace points to the repository's `ai-meeting/` skill folder.

### Option C: Ask Claude Code To Install It

Copy this into Claude Code:

```text
Install the ai-meeting skill from this GitHub repository:
https://github.com/bin1874/ai-meeting-skill
```

If your agent supports installing skills directly from a GitHub URL, the only input it needs is:

```text
https://github.com/bin1874/ai-meeting-skill
```

### Option D: Manual Install

Clone the repository:

```bash
git clone git@github.com:bin1874/ai-meeting-skill.git
cd ai-meeting-skill
```

Install for Codex:

```bash
mkdir -p ~/.codex/skills
ln -s "$(pwd)/ai-meeting" ~/.codex/skills/ai-meeting
```

Install for Claude Code:

```bash
mkdir -p ~/.claude/skills
ln -s "$(pwd)/ai-meeting" ~/.claude/skills/ai-meeting
```

If your host does not support symlinked skills, copy the folder instead:

```bash
cp -R ai-meeting ~/.codex/skills/ai-meeting
# or
cp -R ai-meeting ~/.claude/skills/ai-meeting
```

Check available providers:

```bash
node ai-meeting/scripts/ai-meeting.mjs doctor --json
```

## How To Use The Skill In Chat

After installation, ask your host agent to use the skill:

```text
Use the ai-meeting skill to organize Codex and Claude to review this feature plan. Run two rounds and produce a final decision report.
```

You can also ask for a specific agent set:

```text
Use ai-meeting with builder:codex, critic:claude, architect:codex. Evaluate whether we should ship this design.
```

## Copyable CLI Examples

See [docs/example-final-report.md](docs/example-final-report.md) for a shortened final report example.

### Example 1: Quick Product Decision Review

```bash
cat > /tmp/ai-meeting-brief.md <<'EOF'
# Decision
Should we add team workspaces to the app in the next release?

# Context
- Users currently share one personal workspace.
- Enterprise prospects ask for shared projects and role-based access.
- The team has two weeks before feature freeze.

# Evaluation Criteria
- Real user value
- Implementation cost
- Security and permission risk
- Whether a smaller MVP exists
EOF

MEETING_DIR=$(node ai-meeting/scripts/ai-meeting.mjs create \
  --topic "Team workspaces release decision" \
  --brief-file /tmp/ai-meeting-brief.md \
  --agents builder:codex,critic:claude,architect:codex \
  | tee /tmp/ai-meeting-create.json \
  | node -e 'let s=""; process.stdin.on("data", d => s += d); process.stdin.on("end", () => console.log(JSON.parse(s).meetingDir));')

node ai-meeting/scripts/ai-meeting.mjs round --meeting-dir "$MEETING_DIR" --round 1
node ai-meeting/scripts/ai-meeting.mjs round --meeting-dir "$MEETING_DIR" --round 2
node ai-meeting/scripts/ai-meeting.mjs synthesize --meeting-dir "$MEETING_DIR"
```

Open the final report:

```bash
sed -n '1,220p' "$MEETING_DIR/synthesis/final.md"
```

### Example 2: Review A Development Document With Materials

```bash
cat > /tmp/ai-meeting-brief.md <<'EOF'
# Decision
Review the proposed API redesign and decide whether it is ready for implementation.

# What To Focus On
- Developer experience
- Backward compatibility
- Migration risk
- Test coverage
- Simpler alternatives
EOF

mkdir -p /tmp/ai-meeting-materials
cat > /tmp/ai-meeting-materials/api-redesign.md <<'EOF'
# API Redesign

Replace the old `/v1/tasks` response envelope with a flatter `/v2/tasks` shape.
Support both versions for one release. Add migration warnings to SDKs.
EOF

cat > /tmp/ai-meeting-materials/migration-plan.md <<'EOF'
# Migration Plan

1. Ship `/v2/tasks` behind a beta flag.
2. Add SDK compatibility helpers.
3. Deprecate `/v1/tasks` after telemetry shows 90% migration.
EOF

MEETING_DIR=$(node ai-meeting/scripts/ai-meeting.mjs create \
  --topic "API redesign readiness review" \
  --brief-file /tmp/ai-meeting-brief.md \
  --material README.md \
  --material /tmp/ai-meeting-materials/api-redesign.md \
  --material /tmp/ai-meeting-materials/migration-plan.md \
  --agents builder:codex,critic:claude,user-advocate:codex,architect:claude \
  | tee /tmp/ai-meeting-create.json \
  | node -e 'let s=""; process.stdin.on("data", d => s += d); process.stdin.on("end", () => console.log(JSON.parse(s).meetingDir));')

node ai-meeting/scripts/ai-meeting.mjs round --meeting-dir "$MEETING_DIR" --round 1
node ai-meeting/scripts/ai-meeting.mjs round --meeting-dir "$MEETING_DIR" --round 2
node ai-meeting/scripts/ai-meeting.mjs synthesize --meeting-dir "$MEETING_DIR"
```

Materials are copied into the meeting directory and injected into prompts as untrusted data blocks. Large materials are marked with `truncatedForPrompt=true`; the final report must treat that as an evidence gap.

### Example 3: Preview Prompts Before Spending Tokens

```bash
cat > /tmp/ai-meeting-brief.md <<'EOF'
# Decision
Should we refactor the background job system now or defer it?

# Criteria
- Reliability improvement
- Risk of regressions
- Amount of code churn
- Operational impact
EOF

MEETING_DIR=$(node ai-meeting/scripts/ai-meeting.mjs create \
  --topic "Background job refactor decision" \
  --brief-file /tmp/ai-meeting-brief.md \
  --material README.md \
  --agents builder:codex,critic:claude,security-reliability:codex \
  | tee /tmp/ai-meeting-create.json \
  | node -e 'let s=""; process.stdin.on("data", d => s += d); process.stdin.on("end", () => console.log(JSON.parse(s).meetingDir));')

node ai-meeting/scripts/ai-meeting.mjs round \
  --meeting-dir "$MEETING_DIR" \
  --round 1 \
  --dry-run

sed -n '1,220p' "$MEETING_DIR/dry-run/round-1/builder.codex.prompt.md"
```

`--dry-run` writes preview prompts under `dry-run/` and does not mutate official round state.

### Example 4: Continue A Meeting With A Third Round

```bash
node ai-meeting/scripts/ai-meeting.mjs round --meeting-dir "$MEETING_DIR" --round 1
node ai-meeting/scripts/ai-meeting.mjs round --meeting-dir "$MEETING_DIR" --round 2

# Add one more cross-questioning round if the first two rounds expose unresolved disagreement.
node ai-meeting/scripts/ai-meeting.mjs round --meeting-dir "$MEETING_DIR" --round 3 --max-rounds 5

node ai-meeting/scripts/ai-meeting.mjs synthesize --meeting-dir "$MEETING_DIR"
```

### Example 5: Use Claude As The Final Judge

```bash
node ai-meeting/scripts/ai-meeting.mjs synthesize \
  --meeting-dir "$MEETING_DIR" \
  --provider claude
```

## Output Layout

```txt
meetings/<id>/
  brief.md
  materials/
  state.json
  workspaces/
  rounds/
  synthesis/
    round-1-summary.md
    round-2-summary.md
    final.md
```

If synthesis returns an invalid report, the orchestrator writes `synthesis/final.draft.md`, records missing sections in `state.json`, and does not write official `final.md`.

## Safety Model

- Child agents cannot recursively run `ai-meeting`.
- Codex defaults to read-only sandbox configuration.
- Claude Code defaults to `--safe-mode` and no tools.
- Child agent cwd is an agent-scoped isolated workspace under the meeting directory, not the project root.
- Briefs, materials, peer outputs, and model outputs are treated as untrusted data.
- `state.json` is written atomically.
- Official artifacts are written with owner-only `0600` file permissions.
- Session IDs are redacted in stdout and omitted from final report provenance.
- Provider availability is decided by each adapter's `doctor` checks. New agent tools are welcome through provider adapters, but adapters must report auth, prompt transport, session handling, and permission boundaries honestly.

## Test

```bash
node --check ai-meeting/scripts/ai-meeting.mjs
node --test tests/ai-meeting.test.mjs
python3 /home/ben/.codex/skills/.system/skill-creator/scripts/quick_validate.py ai-meeting
node ai-meeting/scripts/ai-meeting.mjs doctor --json
```

## License

MIT
