# Agent Workflow Documentation

The full documentation for OpenAI's Codex coding agents can be found at `/home/ross/code/codex/docs`

## Worktree-Based Collaboration Workflow

### Roles

- **Coordinating/Planning Agent** – runs the Codex MCP server, spins up task/review agents, sets up integration branches, and keeps the tracker up to date.
- **Task Agents** – implement scoped changes inside their assigned worktrees, run validations, and update task docs.
- **Review Agent(s)** – perform focused reviews from a clean worktree, verify validations, and gate merges.

### Coordinator Setup

1. Launch a Codex MCP server session the coordinator can call (`codex mcp --sandbox workspace-write --approval-policy on-request`). Confirm the `codex` and `codex-reply` tools are listed (e.g., via the MCP Inspector) so new agents can be spawned on demand.
2. Pick/prepare the integration branch (e.g., `wave-1/shared-utilities`) and push it upstream.
3. Create named worktrees for each active branch:
    - `git worktree add ../wave1-shared-utils task/shared-utilities-alignment`
    - `git worktree add ../wave1-devex task/developer-experience-upgrades`
    - Keep the main worktree in `main/` for syncing upstream or emergency fixes.
4. For each agent you need, call the MCP `codex` tool with a task-specific prompt and configuration (see “Starting Task Agents via MCP”) to create new Codex agent sessions. Record the returned `conversationId` in the assignments tracker so you can resume or follow up.
5. Record worktree paths, assigned agents, and their MCP `conversationId` in `docs/tasks/improvement-review-tracker.md` so everyone knows where to work.
6. Before assignments, run `git fetch --all --prune` from the main repo to keep every worktree in sync.

### Starting Task Agents via MCP

The coordinating agent creates task-specific Codex sessions by calling the MCP `codex` tool. Provide a focused prompt, matching sandbox settings, and the worktree path you prepared above.

```bash
# Example: spawn a task agent for the shared utilities worktree
codex mcp call codex <<'JSON'
{
  "prompt": "You are the Task Agent responsible for the shared utilities alignment effort. Work exclusively inside /home/ross/code/yearn/tokenAssets-project/wave1-shared-utils, follow the task brief in docs/tasks/improvement-review-tracker.md, and report progress back to the coordinator.",
  "sandbox": "workspace-write",
  "approval-policy": "on-request",
  "cwd": "/home/ross/code/yearn/tokenAssets-project/wave1-shared-utils",
  "include-plan-tool": true
}
JSON
```

- The MCP server response includes a `conversationId`; store it in the tracker next to the agent and worktree assignment so you can resume via the `codex-reply` tool.
- To follow up with an existing agent session, call `codex mcp call codex-reply` with the stored `conversationId` and your new prompt (e.g., status checks, escalations, or clarifications).

### Task Agent Flow

1. `cd` into the assigned worktree (e.g., `../wave1-shared-utils`).
2. Pull latest changes with `git pull --ff-only` to stay aligned with other agents on the same branch.
3. Implement the task, keeping scope limited to the brief; update relevant docs/checklists there.
4. Run required validations (typecheck, build, tests) from the same directory.
5. Commit with a conventional message (e.g., `chore: align shared utilities`).
6. Push upstream and note completion in the task document and tracker.

### Review Agent Flow

1. Create a dedicated review worktree: `git worktree add ../review-wave1-shared-utils task/shared-utilities-alignment`.
2. Pull latest, run the validation suite, and review diffs (`git diff origin/main...HEAD`).
3. Leave review notes in the task doc or PR, tagging follow-ups for task agents.
4. Once approved, coordinate with the maintainer to merge the shared branch into the integration branch (or directly into `improvement-review-implementation`, per plan).
5. Remove stale review worktrees with `git worktree remove ../review-wave1-shared-utils` after merge.

### General Tips

- Each worktree can only have one branch checked out; name folders clearly (`../wave1-shared-utils`, `../review-wave1-shared-utils`, etc.).
- Always fetch/prune from the main repo directory (`tokenAssets-project/main/`) so every worktree sees updated refs.
- Use `git worktree list` to audit active worktrees; remove unused ones to avoid stale state.
- Share scripts/configs via the repo (not per-worktree) so validation commands behave consistently.

## Detailed Step-by-Step Agent Workflows

### Coordinating/Planning Agent Workflow

#### Initial Setup Phase

```bash
# 1. Navigate to main repo
cd /home/ross/code/yearn/tokenAssets-project/main

# 2. Ensure clean state and latest upstream
git fetch --all --prune
git checkout main
git pull --ff-only

# 3. Create integration branch for the wave
git checkout -b wave-1/shared-utilities
git push -u origin wave-1/shared-utilities

# 4. Create worktrees for task agents
git worktree add ../wave1-shared-utils wave-1/shared-utilities
git worktree add ../wave1-devex task/developer-experience-upgrades

# 5. Create task tracker document
mkdir -p docs/tasks
touch docs/tasks/improvement-review-tracker.md

# 6. Record worktree assignments in tracker
echo "# Wave 1 Task Assignments" >> docs/tasks/improvement-review-tracker.md
echo "- Agent A: ../wave1-shared-utils (wave-1/shared-utilities)" >> docs/tasks/improvement-review-tracker.md
echo "- Agent B: ../wave1-devex (task/developer-experience-upgrades)" >> docs/tasks/improvement-review-tracker.md

# 7. Commit and push tracker
git add docs/tasks/improvement-review-tracker.md
git commit -m "chore: initialize wave 1 task assignments"
git push
```

#### Ongoing Coordination

```bash
# Monitor worktree status
git worktree list

# Sync all worktrees with upstream
git fetch --all --prune

# Check task completion status
git log --oneline --graph --all

# Update task assignments as needed
vim docs/tasks/improvement-review-tracker.md
git add docs/tasks/improvement-review-tracker.md
git commit -m "chore: update task assignments"
git push
```

### Task Agent Workflow

#### Initial Assignment

```bash
# 1. Navigate to assigned worktree
cd /home/ross/code/yearn/tokenAssets-project/wave1-shared-utils

# 2. Ensure latest state
git fetch --all --prune
git pull --ff-only

# 3. Verify current branch and status
git status
git branch -v

# 4. Review task assignment
cat docs/tasks/improvement-review-tracker.md
```

#### Implementation Phase

```bash
# 1. Make changes according to task brief
# (Edit files as needed)

# 2. Run validations from worktree directory
yarn format:check
yarn --cwd _config/nodeAPI lint
yarn --cwd _config/nodeAPI build

# For image-tools changes (if applicable):
cd app/image-tools
bun build
cd ../..

# 3. Test locally
yarn --cwd _config/nodeAPI dev &
# Test endpoints manually
curl http://localhost:3000/api/token/1/0x...
kill %1  # Stop dev server

# 4. Stage and review changes
git add .
git diff --staged
```

#### Completion Phase

```bash
# 1. Commit with conventional message
git commit -m "chore: align shared utilities with new standards"

# 2. Push to upstream
git push

# 3. Update task tracker
echo "- [x] Shared utilities alignment completed" >> docs/tasks/improvement-review-tracker.md
git add docs/tasks/improvement-review-tracker.md
git commit -m "chore: mark shared utilities task complete"
git push

# 4. Notify coordinator
echo "Task completed in $(pwd), ready for review"
```

### Review Agent Workflow

#### Setup Review Environment

```bash
# 1. Navigate to main repo
cd /home/ross/code/yearn/tokenAssets-project/main

# 2. Create fresh review worktree
git fetch --all --prune
git worktree add ../review-wave1-shared-utils wave-1/shared-utilities

# 3. Navigate to review environment
cd ../review-wave1-shared-utils

# 4. Ensure latest state
git pull --ff-only
```

#### Review Process

```bash
# 1. Run full validation suite
yarn format:check
yarn --cwd _config/nodeAPI lint
yarn --cwd _config/nodeAPI build

# For image-tools validation:
cd app/image-tools
bun build
vercel dev &
# Test upload functionality
curl -X POST http://localhost:3000/api/erc20-name -d '{"address":"0x...", "chainId":1}'
kill %1
cd ../..

# 2. Review code changes
git diff origin/main...HEAD
git log --oneline origin/main..HEAD

# 3. Check for conflicts or issues
git merge-base origin/main HEAD
git diff --name-only origin/main...HEAD

# 4. Verify asset structure (if applicable)
find tokens/ -name "logo*.png" | head -10
find tokens/ -name "logo.svg" | head -10
```

#### Approval & Cleanup

```bash
# 1. Document review results
echo "## Review Results - Wave 1 Shared Utils" >> docs/tasks/improvement-review-tracker.md
echo "- ✅ Code quality: PASS" >> docs/tasks/improvement-review-tracker.md
echo "- ✅ Validation suite: PASS" >> docs/tasks/improvement-review-tracker.md
echo "- ✅ No conflicts with main: PASS" >> docs/tasks/improvement-review-tracker.md

# 2. Approve for merge (if passed)
git add docs/tasks/improvement-review-tracker.md
git commit -m "chore: approve wave1 shared utilities for merge"
git push

# 3. Navigate back to main for merge coordination
cd ../main

# 4. Merge the reviewed branch
git checkout main
git pull --ff-only
git merge --no-ff wave-1/shared-utilities
git push

# 5. Clean up review worktree
git worktree remove ../review-wave1-shared-utils

# 6. Optional: Clean up feature branch
git branch -d wave-1/shared-utilities
git push origin --delete wave-1/shared-utilities
```

## Quick Reference Commands

### Worktree Management

```bash
# List all worktrees
git worktree list

# Add new worktree
git worktree add ../worktree-name branch-name

# Remove worktree
git worktree remove ../worktree-name

# Prune stale worktree references
git worktree prune
```

### Common Validations

```bash
# Format check
yarn format:check

# API validation
yarn --cwd _config/nodeAPI lint
yarn --cwd _config/nodeAPI build

# Image tools validation
cd app/image-tools && bun build && cd ../..

# Local API testing
yarn --cwd _config/nodeAPI dev
```

### Branch Management

```bash
# Sync with upstream
git fetch --all --prune

# Fast-forward pull
git pull --ff-only

# Check branch status
git status
git branch -v

# View commit history
git log --oneline --graph
```
