# AI Meeting Skill

[English](README.md) | 中文

`ai-meeting` 是一个基于 `SKILL.md` 的可移植 Agent Skill，用来组织结构化的多 AI Agent 会议。它适合让 Codex、Claude Code 以及其他 CLI Agent 一起评审产品方案、技术设计、实现计划、商业决策和高风险改动。

这个 skill 会运行本地 orchestrator：

- 在 `meetings/<id>/` 下创建会议账本
- 把 brief 和受控材料注入各个 Agent prompt
- 在 provider 支持时保存并续接 session ID
- 执行独立分析和交叉质询
- 输出带 Provenance 的 Markdown 最终决策报告

## 当前状态

- 主要 provider：Codex 和 Claude Code。
- 已支持的显式 provider：qoderclicn（Qoder CLI CN）。
- 实验 provider：Qoder、OpenCode、Cursor、Gemini、Hermes 已作为可选 adapter 接入。项目不按品牌预设封禁其它 Agent 工具；任何 CLI Agent 只要 provider adapter 能通过 `doctor` 如实报告认证、prompt 传输、会话处理和权限边界，就可以参与会议。
- Skill 文件夹/名称：`ai-meeting`。
- 展示名：`AI Meeting`。

## 安装

### 方式 A：让 Agent 根据仓库地址安装

复制下面这段给 Codex：

```text
请从这个 GitHub 仓库安装 ai-meeting skill：
https://github.com/bin1874/ai-meeting-skill
```

### 方式 B：在 Claude Code 里作为 Plugin 安装

在 Claude Code 里执行：

```text
/plugin marketplace add bin1874/ai-meeting-skill
/plugin install ai-meeting@ai-meeting-skill
```

这个 marketplace 会指向仓库里的 `ai-meeting/` skill 文件夹。

### 方式 C：让 Claude Code 根据仓库地址安装

复制下面这段给 Claude Code：

```text
请从这个 GitHub 仓库安装 ai-meeting skill：
https://github.com/bin1874/ai-meeting-skill
```

如果你的 Agent 支持直接通过 GitHub URL 安装 skill，只需要给它这个地址：

```text
https://github.com/bin1874/ai-meeting-skill
```

### 方式 D：手动安装

克隆仓库：

```bash
git clone git@github.com:bin1874/ai-meeting-skill.git
cd ai-meeting-skill
```

安装到 Codex：

```bash
mkdir -p ~/.codex/skills
ln -s "$(pwd)/ai-meeting" ~/.codex/skills/ai-meeting
```

安装到 Claude Code：

```bash
mkdir -p ~/.claude/skills
ln -s "$(pwd)/ai-meeting" ~/.claude/skills/ai-meeting
```

如果你的 host 不支持 symlink，可以直接复制：

```bash
cp -R ai-meeting ~/.codex/skills/ai-meeting
# 或者
cp -R ai-meeting ~/.claude/skills/ai-meeting
```

检查 provider 可用性：

```bash
node ai-meeting/scripts/ai-meeting.mjs doctor --json
```

## 在对话里使用 Skill

安装后，可以直接要求 host agent 使用这个 skill：

```text
使用 ai-meeting skill，组织 Codex 和 Claude 评审这个功能方案。跑两轮讨论，然后输出最终决策报告。
```

也可以指定 Agent 组合：

```text
使用 ai-meeting，参会 Agent 是 builder:codex, critic:claude, architect:codex。评估这个设计是否应该上线。
```

也可以显式加入 qoderclicn：

```text
使用 ai-meeting，参会 Agent 是 builder:codex, critic:claude, architect:qoderclicn。评估这个设计是否应该上线。
```

## 可直接复制的 CLI 示例

可以先看一个简化版最终报告示例：[docs/example-final-report.md](docs/example-final-report.md)。

### 示例 1：快速产品决策评审

```bash
cat > /tmp/ai-meeting-brief.md <<'EOF'
# 决策问题
下一版是否要加入 team workspaces？

# 背景
- 当前用户只有个人 workspace。
- 企业客户希望有共享项目和基于角色的权限。
- 距离 feature freeze 还有两周。

# 评审标准
- 真实用户价值
- 实现成本
- 安全与权限风险
- 是否存在更小的 MVP
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

查看最终报告：

```bash
sed -n '1,220p' "$MEETING_DIR/synthesis/final.md"
```

### 示例 2：评审开发文档和补充材料

```bash
cat > /tmp/ai-meeting-brief.md <<'EOF'
# 决策问题
评审 API redesign 是否已经可以进入实现阶段。

# 重点关注
- 开发者体验
- 向后兼容
- 迁移风险
- 测试覆盖
- 是否有更简单的替代方案
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

`--material` 会把材料复制进会议目录，并作为非可信 data block 注入 prompt。大文件会标记为 `truncatedForPrompt=true`，最终报告必须把这种截断列入证据缺口。

### 示例 3：先预览 Prompt，避免浪费 Token

```bash
cat > /tmp/ai-meeting-brief.md <<'EOF'
# 决策问题
现在是否应该重构 background job system，还是推迟？

# 评审标准
- 稳定性收益
- 回归风险
- 代码改动量
- 运维影响
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

`--dry-run` 只会把预览 prompt 写到 `dry-run/`，不会修改正式 round state。

### 示例 4：追加第三轮讨论

```bash
node ai-meeting/scripts/ai-meeting.mjs round --meeting-dir "$MEETING_DIR" --round 1
node ai-meeting/scripts/ai-meeting.mjs round --meeting-dir "$MEETING_DIR" --round 2

# 如果前两轮暴露出关键分歧，可以追加一轮交叉质询。
node ai-meeting/scripts/ai-meeting.mjs round --meeting-dir "$MEETING_DIR" --round 3 --max-rounds 5

node ai-meeting/scripts/ai-meeting.mjs synthesize --meeting-dir "$MEETING_DIR"
```

### 示例 5：使用 Claude 作为最终 Judge

```bash
node ai-meeting/scripts/ai-meeting.mjs synthesize \
  --meeting-dir "$MEETING_DIR" \
  --provider claude
```

## 输出目录

```txt
meetings/<id>/
  brief.md
  materials/
  state.json
  rounds/
  synthesis/
    round-1-summary.md
    round-2-summary.md
    final.md
```

如果 synthesis 返回的报告缺少必需章节，orchestrator 会写 `synthesis/final.draft.md`，在 `state.json` 记录缺失章节，并且不写正式 `final.md`。

## 安全模型

- 子 Agent 不能递归运行 `ai-meeting`。
- Codex 默认使用 read-only sandbox 配置。
- Claude Code 默认使用 `--safe-mode` 且不启用工具。
- qoderclicn 默认不启用工具，使用空 MCP 配置，并只加载 user setting。
- 子 Agent cwd 是按 meeting path 派生的外部 cache 隔离 workspace，不是项目根目录，也不是会议目录。
- 创建会议会重置该 meeting path 对应的外部 child workspace cache，避免复用旧 provider cwd 状态。
- brief、materials、其他 Agent 输出和模型输出都视为非可信数据。
- `state.json` 原子写入。
- 正式 artifacts 使用 owner-only `0600` 权限写入。
- session ID 在 stdout 中脱敏，并且不会进入最终报告 Provenance。
- Provider 是否可用由各自 adapter 的 `doctor` 检查决定。欢迎通过 provider adapter 接入新的 Agent 工具，但 adapter 必须如实报告认证、prompt 传输、会话处理和权限边界。

## 测试

```bash
node --check ai-meeting/scripts/ai-meeting.mjs
node --test tests/ai-meeting.test.mjs
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-creator/scripts/quick_validate.py" ai-meeting
node ai-meeting/scripts/ai-meeting.mjs doctor --json
```

## License

MIT
