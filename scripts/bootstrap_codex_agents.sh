#!/usr/bin/env bash
# Bootstrap Codex agent worktrees and (optionally) start the MCP coordinator server.
#
# This script follows the workflow documented in AGENTS-workflow.md. It ensures
# an integration branch exists, prepares a coordinator worktree, creates task
# worktrees for all active project-hardening tasks, and can launch the Codex MCP
# server inside a tmux session for long-lived coordination.

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: bootstrap_codex_agents.sh [options]

Options:
  -i, --integration <branch>     Integration branch name (default: project-hardening)
  -d, --default-branch <branch>  Default branch to branch from (default: main)
  -w, --worktree-root <path>     Base directory for new worktrees (default: .. relative to repo)
  -c, --coordinator-path <path>  Explicit path for the coordinator worktree (default: <worktree-root>/coordinator-<integration>)
  -s, --start-server             Launch codex MCP in a tmux session after worktrees are prepared
      --session-name <name>      Tmux session name for the coordinator (default: codex-coordinator)
      --sandbox <mode>           MCP sandbox mode (default: workspace-write)
      --approval-policy <policy> MCP approval policy (default: on-request)
      --sync-remotes             Fetch/prune remotes and track branches (default: disabled)
      --skip-fetch               Alias for disabling remote fetch (default behaviour)
  -h, --help                     Show this help text

This script is idempotent: existing branches/worktrees are detected and reused.
USAGE
}

log() { printf '\n[%s] %s\n' "$(date '+%H:%M:%S')" "$1"; }
log_inline() { printf '[%s] %s' "$(date '+%H:%M:%S')" "$1"; }
warn() { printf '\n[%s] WARNING: %s\n' "$(date '+%H:%M:%S')" "$1" >&2; }
err() { printf '\n[%s] ERROR: %s\n' "$(date '+%H:%M:%S')" "$1" >&2; }

integration_branch="project-hardening"
default_branch="main"
worktree_root=".."
coordinator_path=""
start_server=false
session_name="codex-coordinator"
sandbox_mode="workspace-write"
approval_policy="on-request"
sync_remotes=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -i|--integration)
      integration_branch="$2"
      shift 2
      ;;
    -d|--default-branch)
      default_branch="$2"
      shift 2
      ;;
    -w|--worktree-root)
      worktree_root="$2"
      shift 2
      ;;
    -c|--coordinator-path)
      coordinator_path="$2"
      shift 2
      ;;
    -s|--start-server)
      start_server=true
      shift
      ;;
    --session-name)
      session_name="$2"
      shift 2
      ;;
    --sandbox)
      sandbox_mode="$2"
      shift 2
      ;;
    --approval-policy)
      approval_policy="$2"
      shift 2
      ;;
    --sync-remotes)
      sync_remotes=true
      shift
      ;;
    --skip-fetch)
      sync_remotes=false
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      err "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if ! command -v git >/dev/null 2>&1; then
  err "git is required."
  exit 1
fi

repo_root=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [[ -z "$repo_root" ]]; then
  err "Run this script from inside a git repository."
  exit 1
fi

cd "$repo_root"

if ! command -v realpath >/dev/null 2>&1; then
  err "realpath is required by this script."
  exit 1
fi

if [[ "$worktree_root" != /* ]]; then
  worktree_root="$repo_root/$worktree_root"
fi
worktree_root=$(realpath -m "$worktree_root")
mkdir -p "$worktree_root"

if [[ -z "$coordinator_path" ]]; then
  sanitized=${integration_branch//\//-}
  coordinator_path="$worktree_root/coordinator-$sanitized"
fi
if [[ "$coordinator_path" != /* ]]; then
  coordinator_path="$repo_root/$coordinator_path"
fi
coordinator_path=$(realpath -m "$coordinator_path")

log "Repository root: $repo_root"
log "Worktree root:   $worktree_root"
log "Integration:     $integration_branch (default: $default_branch)"

if $sync_remotes; then
  log "Fetching latest refs..."
  if ! git fetch --all --prune; then
    warn "Failed to fetch remotes; continuing with local refs."
  fi
fi

ensure_local_branch() {
  local branch="$1"
  local source="$2"

  if git show-ref --verify --quiet "refs/heads/$branch"; then
    return 0
  fi

  if $sync_remotes && git ls-remote --exit-code origin "$branch" >/dev/null 2>&1; then
    git branch --track "$branch" "origin/$branch"
  else
    git branch "$branch" "$source"
  fi
}

# Ensure the default branch exists locally.
if ! git show-ref --verify --quiet "refs/heads/$default_branch"; then
  if $sync_remotes && git ls-remote --exit-code origin "$default_branch" >/dev/null 2>&1; then
    git branch --track "$default_branch" "origin/$default_branch"
  else
    err "Default branch '$default_branch' is missing locally. Create it or specify --default-branch."
    exit 1
  fi
fi

default_ref="$default_branch"

# Ensure integration branch exists locally.
ensure_local_branch "$integration_branch" "$default_ref"

# Prepare coordinator worktree
log "Ensuring coordinator worktree at $coordinator_path"
if git worktree list --porcelain | grep -q "^worktree $coordinator_path$"; then
  log "Coordinator worktree already exists."
else
  if [[ -e "$coordinator_path" && ! -d "$coordinator_path" ]]; then
    err "Coordinator path $coordinator_path exists and is not a directory."
    exit 1
  fi
  if [[ -d "$coordinator_path" && -n "$(ls -A "$coordinator_path" 2>/dev/null)" ]]; then
    warn "Coordinator path $coordinator_path already exists with contents; skipping worktree creation."
  else
    git worktree add "$coordinator_path" "$integration_branch"
    log "Created coordinator worktree at $coordinator_path"
  fi
fi

# Helper to slugify filenames into branch/worktree names.
to_slug() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g' | sed -E 's/^-+|-+$//g'
}

created_worktrees=()
active_task_docs=()
while IFS= read -r -d '' doc; do
  active_task_docs+=("$doc")
  filename=$(basename "$doc" .md)
  feature=$(basename "$(dirname "$doc")")
  slug=$(to_slug "$filename")
  branch="task/$slug"
  worktree_path="$worktree_root/task-$slug"

  log "\nProcessing task doc: ${doc#$repo_root/}"
  log "Derived branch:   $branch"
  log "Desired worktree: $worktree_path"

  ensure_local_branch "$branch" "$integration_branch"

  existing_branch_path=$(git worktree list --porcelain | awk -v b="refs/heads/$branch" '
    $1 == "worktree" {wt=$2}
    $1 == "branch" && $2 == b {print wt}' )

  if [[ -n "$existing_branch_path" ]]; then
    log "Branch $branch already checked out at $existing_branch_path"
    continue
  fi

  if [[ -e "$worktree_path" && ! -d "$worktree_path" ]]; then
    warn "Worktree path $worktree_path exists and is not a directory; skipping."
    continue
  fi
  if [[ -d "$worktree_path" && -n "$(ls -A "$worktree_path" 2>/dev/null)" ]]; then
    warn "Worktree path $worktree_path already exists with files; skipping creation."
    continue
  fi

  output=$(git worktree add "$worktree_path" "$branch" 2>&1) || {
    if [[ "$output" == *"already checked out at"* ]]; then
      warn "$output"
    else
      printf '%s\n' "$output" >&2
      exit 1
    fi
  }
  printf '%s\n' "$output"
  created_worktrees+=("$worktree_path -> $branch")
done < <(find "$repo_root/app/image-tools/docs/project-hardening/tasks/active" -mindepth 2 -maxdepth 2 -name '*.md' -print0 | sort -z)

if [[ ${#active_task_docs[@]} -eq 0 ]]; then
  warn "No active task documents found under docs/project-hardening/tasks/active."
fi

if $start_server; then
  if ! command -v tmux >/dev/null 2>&1; then
    err "tmux is required to start the MCP server session."
    exit 1
  fi
  if ! command -v codex >/dev/null 2>&1; then
    err "codex CLI is required to launch the MCP server."
    exit 1
  fi

  if tmux has-session -t "$session_name" 2>/dev/null; then
    warn "tmux session '$session_name' already exists; skipping server launch."
  else
    launch_cmd=$(printf 'cd %q && codex --sandbox %q --ask-for-approval %q mcp serve' "$coordinator_path" "$sandbox_mode" "$approval_policy")
    tmux new-session -d -s "$session_name" "$launch_cmd"
    log "Started Codex MCP server in tmux session '$session_name' (cd $coordinator_path)."
    log "Attach with: tmux attach -t $session_name"
  fi
fi

log "\nSummary"
log "Coordinator worktree: $coordinator_path"
if [[ ${#active_task_docs[@]} -gt 0 ]]; then
  log "Active task documents processed: ${#active_task_docs[@]}"
fi
if [[ ${#created_worktrees[@]} -gt 0 ]]; then
  log "New worktrees created:"
  printf '  - %s\n' "${created_worktrees[@]}"
else
  log "No new task worktrees were created (existing worktrees reused or skipped)."
fi

log "Review tracker: app/image-tools/docs/project-hardening/review-tracker.md"
log "Next steps:"
printf '  1. Update the review tracker with assigned agents and conversation IDs.\n'
printf '  2. For each worktree, run needed validations before coding.\n'
if ! $start_server; then
  printf '  3. Launch the Codex MCP server manually when ready (see AGENTS-workflow.md for command).\n'
fi
