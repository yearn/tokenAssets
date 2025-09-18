# Agent Workflow Template

The full documentation for OpenAI's Codex coding agents can be found at <codex-docs-path> (update with your local reference).

## Worktree-Based Collaboration Workflow

### Roles

- **Coordinating/Planning Agent** – runs the Codex MCP server, provisions task/review agents, manages integration branches, and keeps planning docs in sync.
- **Task Agents** – implement scoped changes inside their assigned worktrees, run the necessary validations, and update task documentation.
- **Review Agent(s)** – perform focused reviews from a clean worktree, verify validations, and gate merges.

### Placeholder Guide

| Placeholder | Description |
| --- | --- |
| `<repo-root>` | Absolute path to the repository root that hosts the `main` worktree |
| `<primary-worktree>` | Directory that tracks the default branch (commonly `main/`) |
| `<integration-branch>` | Branch that coordinates a wave of tasks |
| `<coordinator-worktree>` | Worktree path dedicated to coordination duties |
| `<task-branch>` | Branch dedicated to a specific task |
| `<task-worktree>` | Worktree path assigned to an individual task agent |
| `<review-worktree>` | Worktree path used by a review agent |
| `<task-tracker-path>` | Documentation file that records assignments and status |
| `<sandbox-mode>` | MCP sandbox mode (e.g., `workspace-write`) |
| `<approval-policy>` | MCP approval policy (e.g., `on-request`) |
| `<validation-commands>` | Placeholder for the project's validation scripts or commands |

### Coordinator Setup

1. **Create and prepare the integration branch** for the current wave of tasks:

    ```bash
    cd <repo-root>/<primary-worktree>
    git fetch --all --prune
    git checkout -b <integration-branch>
    git push -u origin <integration-branch>
    ```

2. **Create a dedicated coordinator worktree** on the integration branch to avoid conflicts with personal development work:

    ```bash
    git worktree add <coordinator-worktree> <integration-branch>
    cd <coordinator-worktree>
    ```

3. Launch a Codex MCP server session the coordinator can call:

    ```bash
    codex mcp --sandbox <sandbox-mode> --approval-policy <approval-policy>
    ```

    Use the MCP Inspector (or your preferred client) to confirm that the `codex` and `codex-reply` tools are available so new agents can be spawned on demand.

4. Create named worktrees for each task agent on their respective feature branches:

    ```bash
    git worktree add <task-worktree> <task-branch>
    ```

    Repeat for each task you plan to run in parallel. Keep the `<primary-worktree>` checked out on the default branch for syncing upstream or emergency fixes.

5. Record worktree paths, assigned agents, and their MCP `conversationId` values in `<task-tracker-path>` so everyone knows where to work.

6. Before assigning work, run `git fetch --all --prune` from `<primary-worktree>` to keep every worktree in sync with upstream.

### Starting Task Agents via MCP

The coordinating agent creates task-specific Codex sessions by calling the MCP `codex` tool. Provide a focused prompt, matching sandbox settings, and the worktree path you prepared above.

```bash
codex mcp call codex <<'JSON'
{
  "prompt": "You are the Task Agent responsible for <task-summary>. Work exclusively inside <task-worktree>, follow the task brief in <task-tracker-path>, and report progress back to the coordinator.",
  "sandbox": "<sandbox-mode>",
  "approval-policy": "<approval-policy>",
  "cwd": "<task-worktree>",
  "include-plan-tool": true
}
JSON
```

- The MCP server response includes a `conversationId`; store it in `<task-tracker-path>` next to the agent and worktree assignment so you can resume the conversation via the `codex-reply` tool.
- To follow up with an existing agent session, call `codex mcp call codex-reply` with the stored `conversationId` and your new prompt (e.g., status checks, escalations, or clarifications).

### Task Agent Flow

1. `cd` into the assigned `<task-worktree>`.
2. Pull the latest changes with `git pull --ff-only` to stay aligned with other agents working on the same branch.
3. Review the brief and related documentation referenced in `<task-tracker-path>`.
4. Implement the task, keeping scope limited to the brief; update relevant docs/checklists.
5. Run the validations required for the task (formatting, linting, unit/integration tests, builds). Replace `<validation-commands>` with your project's scripts.
6. Commit with a conventional message appropriate for the task.
7. Push upstream and document completion in `<task-tracker-path>`.

### Review Agent Flow

1. Create a dedicated review worktree on the branch being reviewed:

    ```bash
    git worktree add <review-worktree> <integration-branch-or-task-branch>
    ```

2. Pull the latest changes, run the validation suite, and review diffs (`git diff origin/<base-branch>...HEAD`).
3. Leave review notes in the task document, PR, or tracker, tagging follow-ups for task agents as needed.
4. Once approved, coordinate with the maintainer to merge the reviewed branch into `<integration-branch>` (or directly into the target branch, per plan).
5. Remove stale review worktrees with `git worktree remove <review-worktree>` after merge.

### General Tips

- Each worktree can only have one branch checked out; name folders clearly to make coordination easier.
- Always fetch/prune from `<primary-worktree>` so every worktree sees updated refs.
- Use `git worktree list` to audit active worktrees and remove unused ones to avoid stale state.
- Share scripts/configuration via the repository (not per-worktree) so validation commands behave consistently for all agents.

## Detailed Step-by-Step Agent Workflows

The sections below provide command-oriented references. Replace placeholders with your project-specific values before running the commands.

### Coordinating/Planning Agent Workflow

#### Initial Setup Phase

```bash
# 1. Navigate to the primary worktree
cd <repo-root>/<primary-worktree>

# 2. Ensure clean state and latest upstream
git fetch --all --prune
git checkout <default-branch>
git pull --ff-only

# 3. Create or update the integration branch
git checkout -b <integration-branch>  # omit -b if branch already exists
git push -u origin <integration-branch>

# 4. Create coordinator worktree on integration branch
git worktree add <coordinator-worktree> <integration-branch>
cd <coordinator-worktree>

# 5. Create task worktrees
git worktree add <task-worktree-A> <task-branch-A>
git worktree add <task-worktree-B> <task-branch-B>

# 6. Create or update the task tracker
touch <task-tracker-path>

# 7. Record worktree assignments in the tracker
# e.g., echo "- Coordinator: <coordinator-worktree> (<integration-branch>)" >> <task-tracker-path>

# 8. Commit and push tracker updates as needed
git add <task-tracker-path>
git commit -m "chore: update task assignments"
git push
```

#### Ongoing Coordination

```bash
# Monitor worktree status
git worktree list

# Sync all worktrees with upstream
git fetch --all --prune

# Review task completion status
git log --oneline --graph --all

# Update task assignments
$EDITOR <task-tracker-path>
git add <task-tracker-path>
git commit -m "chore: update task assignments"
git push
```

### Task Agent Workflow

#### Initial Assignment

```bash
# 1. Navigate to assigned worktree
cd <task-worktree>

# 2. Ensure latest state
git fetch --all --prune
git pull --ff-only

# 3. Verify current branch and status
git status
git branch -v

# 4. Review task documentation
cat <task-tracker-path>
```

#### Implementation Phase

```bash
# 1. Implement changes according to the task brief
# (Edit the relevant files)

# 2. Run project validations
<validation-commands>

# 3. Optionally run local smoke tests or start dev servers as required by the task
<optional-local-test-commands>

# 4. Stage and review changes
git add <paths>
git diff --staged
```

#### Completion Phase

```bash
# 1. Commit with conventional message
git commit -m "<type>: <concise summary>"

# 2. Push to upstream
git push

# 3. Update task tracker (checklist, notes, links)
# e.g., echo "- [x] <task-name> completed" >> <task-tracker-path>

git add <task-tracker-path>
git commit -m "chore: update task tracker"
git push

# 4. Notify the coordinator via MCP or your team channel
```

### Review Agent Workflow

#### Setup Review Environment

```bash
# 1. Navigate to the primary worktree
cd <repo-root>/<primary-worktree>

# 2. Create fresh review worktree
git fetch --all --prune
git worktree add <review-worktree> <branch-under-review>

# 3. Navigate to review environment
cd <review-worktree>

# 4. Ensure latest state
git pull --ff-only
```

#### Review Process

```bash
# 1. Run the validation suite required for the branch
<validation-commands>

# 2. Review code changes
git diff origin/<base-branch>...HEAD
git log --oneline origin/<base-branch>..HEAD

# 3. Check for conflicts or issues
git merge-base origin/<base-branch> HEAD
git diff --name-only origin/<base-branch>...HEAD

# 4. Perform any domain-specific file checks (update commands as needed)
<domain-specific-checks>
```

#### Approval & Cleanup

```bash
# 1. Document review results in the tracker or PR notes
# e.g., echo "## Review Results - <branch-under-review>" >> <task-tracker-path>

# 2. Approve for merge when criteria are met
git add <task-tracker-path>
git commit -m "chore: document review results"
git push

# 3. Navigate back to primary worktree
cd <repo-root>/<primary-worktree>

# 4. Merge the reviewed branch into the integration branch or target branch
git checkout <integration-branch-or-target>
git pull --ff-only
git merge --no-ff <branch-under-review>
git push

# 5. Clean up review worktree
git worktree remove <review-worktree>

# 6. Optional: remove feature branch when no longer needed
git branch -d <branch-under-review>
git push origin --delete <branch-under-review>
```

## Quick Reference Commands

### Worktree Management

```bash
# List all worktrees
git worktree list

# Add new worktree
git worktree add <path> <branch>

# Remove worktree
git worktree remove <path>

# Prune stale worktree references
git worktree prune
```

### Validation Checklist

Document the commands your project relies on for validation so every agent runs the same checks.

```bash
# Example placeholders — replace with project-specific scripts
<format-command>
<lint-command>
<test-command>
<build-command>
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
