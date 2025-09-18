#!/usr/bin/env bash
# Remove all Git worktrees except the primary one (defaults to current worktree).
# Designed to clean up Codex agent worktrees created by bootstrap_codex_agents.sh.

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: cleanup_codex_worktrees.sh [options]

Options:
  -k, --keep <path>   Absolute path of the worktree to keep (default: current worktree)
  -n, --dry-run       Show actions without removing worktrees
  -f, --force         Force removal even if worktree has unmerged changes (passes --force)
  -h, --help          Show this help message
USAGE
}

keep_path=""
dry_run=false
force=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    -k|--keep)
      keep_path="$2"
      shift 2
      ;;
    -n|--dry-run)
      dry_run=true
      shift
      ;;
    -f|--force)
      force=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v git >/dev/null 2>&1; then
  printf 'git is required.\n' >&2
  exit 1
fi

repo_root=$(git rev-parse --show-toplevel 2>/dev/null || true)
if [[ -z "$repo_root" ]]; then
  printf 'Run this script inside a git worktree.\n' >&2
  exit 1
fi

if [[ -z "$keep_path" ]]; then
  keep_path="$repo_root"
fi

if ! command -v realpath >/dev/null 2>&1; then
  printf 'realpath is required.\n' >&2
  exit 1
fi

keep_path=$(realpath -m "$keep_path")

mapfile -t worktrees < <(git worktree list --porcelain | awk '/^worktree / {print $2}')
if [[ ${#worktrees[@]} -le 1 ]]; then
  printf 'Only one worktree detected; nothing to remove.\n'
  exit 0
fi

removed_any=false
for wt in "${worktrees[@]}"; do
  wt_real=$(realpath -m "$wt")
  if [[ "$wt_real" == "$keep_path" ]]; then
    printf 'Keeping worktree: %s\n' "$wt_real"
    continue
  fi

  removed_any=true
  printf 'Removing worktree: %s\n' "$wt_real"
  if $dry_run; then
    continue
  fi

  args=("$wt_real")
  if $force; then
    git worktree remove --force "${args[@]}"
  else
    git worktree remove "${args[@]}"
  fi

done

if ! $removed_any; then
  printf 'No extra worktrees to remove.\n'
fi
