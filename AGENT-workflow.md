# Agent Workflow Guide

This document provides a comprehensive guide for agentic systems working with Git worktrees in the tokenAssets repository.

## Worktree-Based Collaboration Workflow

### Roles

- **Coordinating/Planning Agent** – sets up integration branches, allocates tasks, and keeps the tracker up to date.
- **Task Agents** – implement scoped changes inside their assigned worktrees, run validations, and update task docs.
- **Review Agent(s)** – perform focused reviews from a clean worktree, verify validations, and gate merges.

### Coordinator Setup

1. Pick/prepare the integration branch (e.g., `wave-1/shared-utilities`) and push it upstream.
2. Create named worktrees for each active branch:
    - `git worktree add ../wave1 task/shared-utilities-alignment`
    - `git worktree add ../wave1-devex task/developer-experience-upgrades`
    - Keep a root worktree on `main` for syncing upstream or emergency fixes.
3. Record worktree paths plus assigned agents in `docs/tasks/improvement-review-tracker.md` so everyone knows where to work.
4. Before assignments, run `git fetch --all --prune` from the main repo to keep every worktree in sync.

### Task Agent Flow

1. `cd` into the assigned worktree (e.g., `../wave1`).
2. Pull latest changes with `git pull --ff-only` to stay aligned with other agents on the same branch.
3. Implement the task, keeping scope limited to the brief; update relevant docs/checklists there.
4. Run required validations (typecheck, build, tests) from the same directory.
5. Commit with a conventional message (e.g., `chore: align shared utilities`).
6. Push upstream and note completion in the task document and tracker.

### Review Agent Flow

1. Create a dedicated review worktree: `git worktree add ../wave1-review task/shared-utilities-alignment`.
2. Pull latest, run the validation suite, and review diffs (`git diff origin/main...HEAD`).
3. Leave review notes in the task doc or PR, tagging follow-ups for task agents.
4. Once approved, coordinate with the maintainer to merge the shared branch into the integration branch (or directly into `improvement-review-implementation`, per plan).
5. Remove stale review worktrees with `git worktree remove ../wave1-review` after merge.

### General Tips

- Each worktree can only have one branch checked out; name folders clearly (`../waveX`, `../waveX-review`, etc.).
- Always fetch/prune from the main repo directory (`tokenAssets/`) so every worktree sees updated refs.
- Use `git worktree list` to audit active worktrees; remove unused ones to avoid stale state.
- Share scripts/configs via the repo (not per-worktree) so validation commands behave consistently.

## Step-by-Step Workflows

### Coordinating/Planning Agent Workflow

#### Initial Setup Phase

1. **Assess Current State**

    ```bash
    cd /home/ross/code/yearn/tokenAssets
    git status
    git branch -a
    git worktree list
    ```

2. **Create Integration Branches**

    ```bash
    # Create and push integration branches for each wave
    git checkout main
    git pull origin main
    git checkout -b wave-1/shared-utilities
    git push -u origin wave-1/shared-utilities

    git checkout -b wave-2/api-improvements
    git push -u origin wave-2/api-improvements
    ```

3. **Set Up Worktrees for Task Agents**

    ```bash
    # Create worktrees for each task branch
    git worktree add ../wave1-utilities task/shared-utilities-alignment
    git worktree add ../wave1-devex task/developer-experience-upgrades
    git worktree add ../wave2-api task/api-erc20-enhancements
    git worktree add ../wave2-upload task/api-upload-hardening
    ```

4. **Create Task Documentation**

    ```bash
    # Ensure docs directory exists
    mkdir -p docs/tasks

    # Create tracker file
    touch docs/tasks/improvement-review-tracker.md
    ```

5. **Record Worktree Assignments**

    ```bash
    # Update tracker with worktree assignments
    echo "# Worktree Assignments" > docs/tasks/improvement-review-tracker.md
    echo "- ../wave1-utilities: task/shared-utilities-alignment (Agent-TaskA)" >> docs/tasks/improvement-review-tracker.md
    echo "- ../wave1-devex: task/developer-experience-upgrades (Agent-TaskB)" >> docs/tasks/improvement-review-tracker.md
    echo "- ../wave2-api: task/api-erc20-enhancements (Agent-TaskC)" >> docs/tasks/improvement-review-tracker.md
    ```

6. **Sync All Worktrees**

    ```bash
    git fetch --all --prune
    ```

#### Ongoing Coordination

1. **Monitor Progress**

    ```bash
    # Check all worktree status
    git worktree list

    # Check for updates from task agents
    git fetch --all --prune
    for branch in task/shared-utilities-alignment task/developer-experience-upgrades; do
      echo "=== $branch ==="
      git log --oneline origin/$branch ^origin/main
    done
    ```

2. **Update Task Assignments**

    ```bash
    # Update tracker as tasks complete
    vim docs/tasks/improvement-review-tracker.md
    git add docs/tasks/improvement-review-tracker.md
    git commit -m "chore: update task progress"
    git push
    ```

### Task Agent Workflow

#### Initial Assignment

1. **Navigate to Assigned Worktree**

    ```bash
    cd ../wave1-utilities  # or assigned worktree path
    pwd  # verify location
    git status  # verify branch
    ```

2. **Sync with Latest Changes**

    ```bash
    git pull --ff-only
    ```

3. **Verify Environment**

    ```bash
    # Check if this is image-tools work
    if [ -d "app/image-tools" ]; then
      cd app/image-tools
      bun install  # ensure dependencies
    fi
    ```

#### Implementation Phase

1. **Implement Changes**

    ```bash
    # Example: Create shared utilities
    mkdir -p src/shared
    touch src/shared/evm.ts
    touch src/shared/image.ts

    # Make actual changes to files
    # (Implementation details depend on specific task)
    ```

2. **Run Validations**

    ```bash
    # For image-tools tasks
    cd app/image-tools
    bun run lint
    bun run build
    bun run test  # if tests exist

    # For root-level tasks
    cd ../../
    yarn format:check
    yarn --cwd _config/nodeAPI build  # if API changes
    ```

3. **Update Documentation**

    ```bash
    # Update task checklist
    vim docs/tasks/[task-name].md
    # Mark completed items, add notes
    ```

#### Completion Phase

1. **Commit Changes**

    ```bash
    git add .
    git commit -m "feat: implement shared EVM utilities

    - Add isEvmAddress validation
    - Add decodeAbiString helper
    - Export getRpcUrl function
    - Update task checklist"
    ```

2. **Push to Upstream**

    ```bash
    git push origin task/shared-utilities-alignment
    ```

3. **Update Tracker**

    ```bash
    # Update main tracker from root worktree
    cd /home/ross/code/yearn/tokenAssets
    vim docs/tasks/improvement-review-tracker.md
    # Mark task as complete
    git add docs/tasks/improvement-review-tracker.md
    git commit -m "chore: mark shared-utilities task complete"
    git push
    ```

### Review Agent Workflow

#### Setup Review Environment

1. **Create Review Worktree**

    ```bash
    cd /home/ross/code/yearn/tokenAssets
    git fetch --all --prune
    git worktree add ../review-utilities task/shared-utilities-alignment
    cd ../review-utilities
    ```

2. **Verify Branch State**

    ```bash
    git status
    git log --oneline -10
    git diff origin/main...HEAD --stat
    ```

#### Review Process

1. **Run Full Validation Suite**

    ```bash
    # Root level validations
    yarn format:check

    # Image tools validations (if applicable)
    cd app/image-tools
    bun install
    bun run lint
    bun run build
    bun run test

    # API validations (if applicable)
    cd ../../_config/nodeAPI
    yarn install
    yarn build
    yarn lint
    ```

2. **Review Code Changes**

    ```bash
    cd ../../  # back to root

    # Review specific files changed
    git diff origin/main...HEAD --name-only

    # Detailed review of changes
    git diff origin/main...HEAD

    # Review commit history
    git log --oneline origin/main..HEAD
    ```

3. **Test Functionality**

    ```bash
    # Test image tools if changed
    cd app/image-tools
    vercel dev &  # start dev server
    # Test endpoints manually or with curl

    # Test API if changed
    cd ../../_config/nodeAPI
    yarn dev &  # start dev server
    # Test token endpoints
    ```

#### Review Documentation

1. **Check Task Completion**

    ```bash
    # Review task documentation
    cat docs/tasks/[task-name].md

    # Verify all checklist items addressed
    # Check for proper documentation updates
    ```

2. **Leave Review Notes**

    ```bash
    # Create review notes file
    echo "# Review Notes for task/shared-utilities-alignment" > REVIEW-NOTES.md
    echo "" >> REVIEW-NOTES.md
    echo "## Validation Results" >> REVIEW-NOTES.md
    echo "- [x] Lint: PASSED" >> REVIEW-NOTES.md
    echo "- [x] Build: PASSED" >> REVIEW-NOTES.md
    echo "- [x] Format: PASSED" >> REVIEW-NOTES.md
    echo "" >> REVIEW-NOTES.md
    echo "## Code Review" >> REVIEW-NOTES.md
    echo "- EVM utilities properly exported" >> REVIEW-NOTES.md
    echo "- Type definitions included" >> REVIEW-NOTES.md
    echo "" >> REVIEW-NOTES.md
    echo "## Status: APPROVED" >> REVIEW-NOTES.md
    ```

#### Approval & Cleanup

1. **Approve & Merge Preparation**

    ```bash
    # If approved, prepare for merge
    git checkout main
    git pull origin main
    git merge --no-ff task/shared-utilities-alignment
    git push origin main
    ```

2. **Clean Up Review Worktree**

    ```bash
    cd /home/ross/code/yearn/tokenAssets
    git worktree remove ../review-utilities
    ```

3. **Update Tracker**

    ```bash
    vim docs/tasks/improvement-review-tracker.md
    # Mark as reviewed and merged
    git add docs/tasks/improvement-review-tracker.md
    git commit -m "chore: mark shared-utilities reviewed and merged"
    git push
    ```

## Common Commands Reference

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

### Sync Operations

```bash
# Sync from main repo (run from tokenAssets/)
git fetch --all --prune

# Update worktree (run from worktree)
git pull --ff-only

# Push changes
git push origin <branch-name>
```

### Validation Commands

```bash
# Root level
yarn format:check
yarn format  # to fix

# Image tools
cd app/image-tools
bun run lint
bun run build
bun run preview

# Node API
cd _config/nodeAPI
yarn build
yarn lint
```

## Troubleshooting

### Worktree Issues

- **Branch already checked out**: Use `git worktree list` to find where
- **Stale worktree references**: Run `git worktree prune`
- **Permission issues**: Ensure proper file permissions in worktree directories

### Sync Issues

- **Merge conflicts**: Use `git pull --rebase` if fast-forward fails
- **Outdated references**: Run `git fetch --all --prune` from main repo
- **Branch not found**: Ensure branch exists on origin with `git branch -r`

### Validation Failures

- **Lint errors**: Run `bun run lint --fix` or `yarn format`
- **Build failures**: Check for TypeScript errors or missing dependencies
- **Test failures**: Review test output and fix failing tests before commit
