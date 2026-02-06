---
name: create-token-assets
description: create token icon assets and open a PR to the tokenAssets repo
---

## Activation Criteria
Use this skill when:
- Adding a new token icon to the tokenAssets repo
- User says "/create-token-assets"

## Prerequisites

- **rsvg-convert** (from `librsvg2-bin` / `librsvg`) for SVG-to-PNG conversion
- **GitHub MCP server** configured

## Target Repository

- **Owner:** yearn
- **Repo:** tokenAssets
- **Structure:** `tokens/{chainId}/{address}/logo.svg`, `logo-32.png`, `logo-128.png`

## Supported Chains

| Chain ID | Name |
|----------|------|
| 1 | Ethereum |
| 10 | Optimism |
| 100 | Gnosis Chain |
| 137 | Polygon |
| 146 | Sonic |
| 250 | Fantom |
| 8453 | Base |
| 42161 | Arbitrum |
| 80094 | Berachain |
| 747474 | Katana |

## Public RPCs (for ERC-20 name lookup)

| Chain ID | RPC |
|----------|-----|
| 1 | https://eth.llamarpc.com |
| 10 | https://mainnet.optimism.io |
| 100 | https://rpc.gnosischain.com |
| 137 | https://polygon-rpc.com |
| 146 | https://rpc.soniclabs.com |
| 250 | https://1rpc.io/ftm |
| 8453 | https://mainnet.base.org |
| 42161 | https://arb1.arbitrum.io/rpc |
| 80094 | https://rpc.berachain.com |
| 747474 | https://rpc.katana.network |

## Workflow

### 1. Check for rsvg-convert

Run `which rsvg-convert`. If not found, use `AskUserQuestion` to ask:
> rsvg-convert is not installed. It's needed to generate PNG files from SVG. Install it now?

If yes, install:
- **Debian/Ubuntu:** `sudo apt-get install -y librsvg2-bin`
- **macOS:** `brew install librsvg`

If no, stop and explain it's required.

### 2. Gather inputs

Use `AskUserQuestion` to collect:

**Question 1 — Chain and address:**
> Which chain and token address? (e.g. "1 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")

Parse the response into `chainId` and `address`. Validate:
- `chainId` is a number from the supported chains table
- `address` matches `0x[a-fA-F0-9]{40}`

**Question 2 — SVG source:**
> Where is the SVG icon? Provide a file path, URL, or a directory to search.

Handle the three cases:
- **Direct file path** (e.g. `~/icons/token.svg`) — use it directly
- **URL** (starts with `http`) — download with `curl -sL`
- **Directory / vague path** (e.g. `../governance-apps`) — use `Glob` with patterns like `**/*.svg`, `**/*logo*`, `**/*icon*` to find SVG candidates. If multiple matches, use `AskUserQuestion` to let the user pick.

### 3. Fetch token name

Fetch the ERC-20 `name()` using the public RPC for the chain:

```bash
curl -s -X POST <RPC_URL> \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"<ADDRESS>","data":"0x06fdde03"},"latest"],"id":1}'
```

The response `result` is ABI-encoded. Decode:
1. Strip `0x` prefix
2. Skip first 64 hex chars (offset pointer)
3. Read next 64 hex chars as uint256 (string length in bytes)
4. Read that many bytes (x2 hex chars) as UTF-8

If the RPC call fails, use `AskUserQuestion` to ask the user for the token name.

### 4. Verify no duplicate

Check if `tokens/{chainId}/{address_lowercase}/` already exists in this repo.
If it does, warn the user and ask whether to overwrite or abort.

### 5. Generate assets

Lowercase the address. Create the target directory:
```bash
mkdir -p tokens/{chainId}/{address}/
```

Copy (or download) the SVG into place:
```bash
cp <source.svg> tokens/{chainId}/{address}/logo.svg
```

Generate PNGs:
```bash
rsvg-convert -w 32 -h 32 tokens/{chainId}/{address}/logo.svg -o tokens/{chainId}/{address}/logo-32.png
rsvg-convert -w 128 -h 128 tokens/{chainId}/{address}/logo.svg -o tokens/{chainId}/{address}/logo-128.png
```

### 6. Create branch, commit, push, open PR

Ensure you're on a clean state off `main`:
```bash
git checkout main
git pull
```

Create a branch using the token name (sanitized to kebab-case, lowercase, alphanumeric + hyphens):
```bash
git checkout -b add-<token-name-kebab>-<chainId>
```

Stage and commit:
```bash
git add tokens/{chainId}/{address}/
git commit -m "Add <token name> icon on chain <chainId>"
```

Push and create PR using GitHub MCP tools:
- Push the branch with `git push -u origin <branch>`
- Use `mcp github create_pull_request` with:
  - **title:** `Add <token name> icon on chain <chainId>`
  - **body:** summary with chain ID, address, and file paths
  - **base:** `main`
  - **head:** the branch name

Report the PR URL to the user.

### 7. Clean up

Switch back to main:
```bash
git checkout main
```
