# Repository Guidelines

This repo is where token logos for all yearn assets and chains are stored for use in our web apps. There is an app to upload images into the repo as well as some legacy APIs that generally can be ignored.

## Project Structure & Module Organization

There are multiple different apps and elements in this repo. Please read carefully below

- Source assets: `tokens/<chainId>/<address>/` with `logo.svg`, `logo-32.png`, `logo-128.png`.
- Chain assets: `chains/<chainId>/`
- Image Upload App: `app/image-tools/` contains a repo where users can upload token logos to the repo. It is wholly unrelated to anything in the `_config/` folder and when working on this app, you should ignore the \_config folder and its contents.
- Deprecated APIs: `_config/`, `_config/nodeAPI`, and `_config/goAPI` contain legacy code for APIs to serve the token logos that we do not actively use but still support for legacy applications. Generally they should be ignored unless explicitly requested to work on them.
- Automation: `scripts/` (e.g., `ingestTokens.js` and image inputs under `scripts/token-images-to-ingest/`).
- Root configs: `.editorconfig`, `.prettierrc`, `package.json`.

## Build, Test, and Development Commands

- Format (root): `yarn format` or `npm run format` — applies Prettier to the repo.
- Check format: `yarn format:check` — verifies formatting without writing.
- Next.js dev (API): `yarn --cwd _config/nodeAPI dev` — starts the local API for previewing assets.
- Next.js build: `yarn --cwd _config/nodeAPI build` — type-checks and builds the API bundle.
- Image tools dev: `bun dev` in `app/image-tools` (Vite on `http://localhost:5173`).
- Image tools serverless preview: `vercel dev` in `app/image-tools` (serves `/api/*`).
- Image tools build/preview: `bun build` then `bun preview` in `app/image-tools`.
- Ingest assets: `node scripts/ingestTokens.js ./scripts/tokensToInjest.json` — copies/renames prepared images into `tokens/`.

## Coding Style & Naming Conventions

- Indentation: tabs, width 4 (`.editorconfig`).
- Prettier: single quotes, semicolons, 120 col width.
- Asset files per token: `logo.svg`, `logo-32.png`, `logo-128.png`.
- Addresses: lowercase for EVM chains; case‑sensitive for Solana (`1151111081099710`).
- Directory names: numeric `chainId` (or `btcm`).

## Testing Guidelines

- No formal test suite. Validate by:
  - Running `yarn --cwd _config/nodeAPI dev` and fetching `/api/token/<chainId>/<address>/logo-32.png`.
  - Ensuring both PNG sizes exist and load; prefer PNG for production.
  - Running `yarn format:check` and `yarn --cwd _config/nodeAPI lint` when editing `_config/nodeAPI`.
- For `app/image-tools`, validate via `vercel dev`:
  - OAuth callback: `/api/auth/github/callback` returns to `/auth/github/success`.
  - ERC-20 name lookup: POST `/api/erc20-name` (Edge).
  - Upload + PR: POST `/api/upload` (Edge) and confirm the returned PR URL.

## Commit & Pull Request Guidelines

- Commit style: conventional prefixes preferred (`chore:`, `fix:`, etc.).
- PRs must include: change summary, sample asset URL(s), and chain/address context.
- For new tokens, show the exact path created (e.g., `tokens/1/0xabc.../`).
- Link related issues when applicable; add screenshots of rendered PNGs if helpful.

## Security & Configuration Tips

- Optimize SVGs (keep simple; large/complex SVGs hinder performance).
- Ensure PNGs are exactly 32×32 and 128×128.
- Do not commit secrets or binaries outside `tokens/` and `_config/` build outputs.

## Branching Guidance

Default to one shared integration branch per wave (e.g., `wave-1/shared-utilities`) so agents working the same wave commit directly together and stay aligned on helper contracts. Only spin up individual branches for isolated or risky spikes; otherwise per-agent branches cause avoidable rebases and drift.

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
3. Record worktree paths plus assigned agents in `docs/project-hardening/review-tracker.md` so everyone knows where to work.
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
