import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dimensionsOfPng } from './util';
import { openPrWithFiles, getUserLogin } from './github';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from .env.local (preferred) or .env in app/image-tools
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envDefaultPath = path.join(__dirname, '..', '.env');
dotenv.config({ path: fs.existsSync(envLocalPath) ? envLocalPath : envDefaultPath });

const app = express();
const port = Number(process.env.PORT || 5174);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const repoRoot = path.resolve(__dirname, '../../..');
const tokensRoot = path.join(repoRoot, 'tokens');
const chainsRoot = path.join(repoRoot, 'chains');
const stagingRoot = path.join(repoRoot, 'scripts', 'token-images-to-ingest');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'image-tools-api' });
});

app.get('/api/auth/github/callback', async (req, res) => {
  try {
    const code = req.query.code as string | undefined;
    const state = (req.query.state as string | undefined) || '';
    if (!code) return res.status(400).json({ error: 'Missing code' });
    const clientId = process.env.GITHUB_CLIENT_ID || process.env.VITE_GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) return res.status(500).json({ error: 'Missing GitHub OAuth env vars' });

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    if (!tokenRes.ok) return res.status(502).send(await tokenRes.text());
    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    const accessToken = tokenJson.access_token;
    if (!accessToken) return res.status(502).json({ error: 'No access_token in response' });

    const appBase = process.env.APP_BASE_URL || 'http://localhost:5173';
    const redirect = new URL('/auth/github/success', appBase);
    redirect.searchParams.set('token', accessToken);
    redirect.searchParams.set('state', state);
    res.redirect(redirect.toString());
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'OAuth callback failed' });
  }
});

app.post(
  '/api/upload',
  upload.fields([
    { name: 'svg', maxCount: 1 },
    { name: 'png32', maxCount: 1 },
    { name: 'png128', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const auth = req.header('authorization') || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!token) return res.status(401).json({ error: 'Missing GitHub token' });

      const target = String(req.body.target || 'token');
      const chainId = String(req.body.chainId || '').trim();
      const address = String(req.body.address || '').trim();
      const symbol = String(req.body.symbol || '').trim();

      if (!chainId) return res.status(400).json({ error: 'chainId required' });
      if (target === 'token' && (!address || !symbol)) return res.status(400).json({ error: 'address and symbol required' });
      if (target === 'chain' && !symbol) return res.status(400).json({ error: 'symbol required' });

      const files = req.files as Record<string, Express.Multer.File[]>;
      const svg = files?.svg?.[0];
      const png32 = files?.png32?.[0];
      const png128 = files?.png128?.[0];
      if (!svg || !png32 || !png128) return res.status(400).json({ error: 'svg, png32, png128 required' });

      if (!svg.mimetype.includes('svg')) return res.status(400).json({ error: 'svg must be image/svg+xml' });
      if (png32.mimetype !== 'image/png' || png128.mimetype !== 'image/png') return res.status(400).json({ error: 'pngs must be image/png' });
      const d32 = dimensionsOfPng(png32.buffer);
      const d128 = dimensionsOfPng(png128.buffer);
      if (!d32 || d32.width !== 32 || d32.height !== 32) return res.status(400).json({ error: 'png32 must be 32x32' });
      if (!d128 || d128.width !== 128 || d128.height !== 128) return res.status(400).json({ error: 'png128 must be 128x128' });

      const slug = [Date.now(), chainId, target === 'token' ? address : symbol].join('-');
      const stagingDir = path.join(stagingRoot, slug);
      ensureDir(stagingDir);

      // Save staging copies named per ingestion script conventions
      fs.writeFileSync(path.join(stagingDir, `${symbol}.svg`), svg.buffer);
      fs.writeFileSync(path.join(stagingDir, `${symbol}-32.png`), png32.buffer);
      fs.writeFileSync(path.join(stagingDir, `${symbol}-128.png`), png128.buffer);

      // Copy to final destination immediately (mirrors ingestTokens.ts behavior)
      if (target === 'token') {
        const destDir = path.join(tokensRoot, String(chainId), address.toLowerCase());
        ensureDir(destDir);
        fs.writeFileSync(path.join(destDir, 'logo.svg'), svg.buffer);
        fs.writeFileSync(path.join(destDir, 'logo-32.png'), png32.buffer);
        fs.writeFileSync(path.join(destDir, 'logo-128.png'), png128.buffer);
      } else {
        const destDir = path.join(chainsRoot, String(chainId));
        ensureDir(destDir);
        fs.writeFileSync(path.join(destDir, 'logo.svg'), svg.buffer);
        fs.writeFileSync(path.join(destDir, 'logo-32.png'), png32.buffer);
        fs.writeFileSync(path.join(destDir, 'logo-128.png'), png128.buffer);
      }

      // Prepare files for PR commit
      const owner = process.env.REPO_OWNER || 'yearn';
      const repo = process.env.REPO_NAME || 'tokenAssets';
      const login = await getUserLogin(token).catch(() => 'user');
      const branchName = `${login}-image-tools-${chainId}${target === 'token' ? `-${address.toLowerCase()}` : ''}-${Date.now()}`;

      const filesForPr: Array<{ path: string; contentBase64: string }> = [];
      if (target === 'token') {
        const base = path.join(tokensRoot, String(chainId), address.toLowerCase());
        filesForPr.push(
          { path: path.posix.join('tokens', String(chainId), address.toLowerCase(), 'logo.svg'), contentBase64: fs.readFileSync(path.join(base, 'logo.svg')).toString('base64') },
          { path: path.posix.join('tokens', String(chainId), address.toLowerCase(), 'logo-32.png'), contentBase64: fs.readFileSync(path.join(base, 'logo-32.png')).toString('base64') },
          { path: path.posix.join('tokens', String(chainId), address.toLowerCase(), 'logo-128.png'), contentBase64: fs.readFileSync(path.join(base, 'logo-128.png')).toString('base64') }
        );
      } else {
        const base = path.join(chainsRoot, String(chainId));
        filesForPr.push(
          { path: path.posix.join('chains', String(chainId), 'logo.svg'), contentBase64: fs.readFileSync(path.join(base, 'logo.svg')).toString('base64') },
          { path: path.posix.join('chains', String(chainId), 'logo-32.png'), contentBase64: fs.readFileSync(path.join(base, 'logo-32.png')).toString('base64') },
          { path: path.posix.join('chains', String(chainId), 'logo-128.png'), contentBase64: fs.readFileSync(path.join(base, 'logo-128.png')).toString('base64') }
        );
      }

      const title = target === 'token'
        ? `feat: add ${symbol} assets on ${chainId}`
        : `feat: add chain assets on ${chainId}`;
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:5174';
      const sampleUrls = target === 'token'
        ? [
            `/api/token/${chainId}/${address.toLowerCase()}/logo-32.png`,
            `/api/token/${chainId}/${address.toLowerCase()}/logo-128.png`,
          ]
        : [
            `/api/chain/${chainId}/logo-32.png`,
            `/api/chain/${chainId}/logo-128.png`,
          ];
      const prBody = [
        `Chain: ${chainId}${target === 'token' ? `\nAddress: ${address.toLowerCase()}\nSymbol: ${symbol}` : ''}`,
        '',
        'Sample URLs:',
        ...sampleUrls.map((u) => `- ${u}`),
      ].join('\n');

      const prUrl = await openPrWithFiles({
        token,
        owner,
        repo,
        branchName,
        commitMessage: title,
        prTitle: title,
        prBody,
        files: filesForPr,
      });

      res.json({ ok: true, prUrl, slug });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Upload failed' });
    }
  }
);

app.listen(port, () => {
  console.log(`[image-tools] API listening on http://localhost:${port}`);
});
