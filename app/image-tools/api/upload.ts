export const config = { runtime: 'nodejs' };

import sharp from 'sharp';
import { dimensionsOfPng } from './util';
import { openPrWithFilesForkAware, getUserLogin } from './github';

type FilePart = File | null | undefined;

function asBool(v: unknown): boolean {
  const s = String(v ?? '').toLowerCase();
  return s === '1' || s === 'true' || s === 'on' || s === 'yes';
}

async function fileToBuffer(f: FilePart): Promise<Buffer | null> {
  if (!f) return null;
  const ab = await f.arrayBuffer();
  return Buffer.from(ab);
}

async function genFromSvg(svgBuf: Buffer): Promise<{ b32: Buffer; b128: Buffer }> {
  const b32 = await sharp(svgBuf, { density: 300 })
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  const b128 = await sharp(svgBuf, { density: 300 })
    .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return { b32, b128 };
}

export default async function (req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  try {
    const auth = req.headers.get('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return new Response(JSON.stringify({ error: 'Missing GitHub token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });

    const form = await req.formData();
    const target = String(form.get('target') || 'token');
    const globalChainId = String(form.get('chainId') || '').trim();
    const prTitleOverride = String(form.get('prTitle') || '').trim();
    const prBodyOverride = String(form.get('prBody') || '').trim();

    const prFiles: Array<{ path: string; contentBase64: string }> = [];

    const owner = (process.env.REPO_OWNER as string) || 'yearn';
    const repo = (process.env.REPO_NAME as string) || 'tokenAssets';

    if (target === 'token') {
      const addressesRaw = form.getAll('address') as string[];
      const addresses: string[] = addressesRaw
        .map((a) => String(a || '').trim())
        .filter(Boolean);
      if (!addresses.length) {
        return new Response(JSON.stringify({ error: 'At least one address required for token uploads' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      for (let i = 0; i < addresses.length; i++) {
        const addr = addresses[i];
        const localChainId = String(form.get(`chainId_${i}`) || globalChainId || '').trim();
        if (!localChainId) {
          return new Response(JSON.stringify({ error: `Missing chainId for token index ${i}` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const svgF = form.get(`svg_${i}`) as File | null;
        if (!svgF) {
          return new Response(JSON.stringify({ error: `svg_${i} required` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }
        if (!svgF.type.includes('svg')) {
          return new Response(JSON.stringify({ error: `svg_${i} must be image/svg+xml` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        const genPng = asBool(form.get(`genPng_${i}`) ?? false);

        const svgBuf = await fileToBuffer(svgF);
        if (!svgBuf) return new Response(JSON.stringify({ error: `Invalid svg_${i}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });

        let png32buf = await fileToBuffer(form.get(`png32_${i}`) as File | null);
        let png128buf = await fileToBuffer(form.get(`png128_${i}`) as File | null);

        if (genPng) {
          const g = await genFromSvg(svgBuf);
          png32buf = g.b32;
          png128buf = g.b128;
        }

        if (!png32buf || !png128buf) {
          return new Response(
            JSON.stringify({ error: `png32_${i} and png128_${i} required unless genPng=true` }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const d32 = dimensionsOfPng(png32buf);
        const d128 = dimensionsOfPng(png128buf);
        if (!d32 || d32.width !== 32 || d32.height !== 32)
          return new Response(JSON.stringify({ error: `png32_${i} must be 32x32` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        if (!d128 || d128.width !== 128 || d128.height !== 128)
          return new Response(JSON.stringify({ error: `png128_${i} must be 128x128` }), { status: 400, headers: { 'Content-Type': 'application/json' } });

        const addrLower = addr.toLowerCase();
        prFiles.push(
          { path: ['tokens', String(localChainId), addrLower, 'logo.svg'].join('/'), contentBase64: svgBuf.toString('base64') },
          { path: ['tokens', String(localChainId), addrLower, 'logo-32.png'].join('/'), contentBase64: png32buf.toString('base64') },
          { path: ['tokens', String(localChainId), addrLower, 'logo-128.png'].join('/'), contentBase64: png128buf.toString('base64') },
        );
      }
    } else {
      // Chain asset mode
      const svg = (form.get('svg') as File) || null;
      if (!svg) return new Response(JSON.stringify({ error: 'svg required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      if (!svg.type.includes('svg')) return new Response(JSON.stringify({ error: 'svg must be image/svg+xml' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

      const svgBuf = await fileToBuffer(svg);
      if (!svgBuf) return new Response(JSON.stringify({ error: 'Invalid svg' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

      const genPng = asBool(form.get('genPng') ?? false);
      let png32buf = await fileToBuffer((form.get('png32') as File) || null);
      let png128buf = await fileToBuffer((form.get('png128') as File) || null);
      if (genPng) {
        const g = await genFromSvg(svgBuf);
        png32buf = g.b32;
        png128buf = g.b128;
      }
      if (!png32buf || !png128buf)
        return new Response(JSON.stringify({ error: 'png32 and png128 required unless genPng=true' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

      const d32 = dimensionsOfPng(png32buf);
      const d128 = dimensionsOfPng(png128buf);
      if (!d32 || d32.width !== 32 || d32.height !== 32)
        return new Response(JSON.stringify({ error: 'png32 must be 32x32' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      if (!d128 || d128.width !== 128 || d128.height !== 128)
        return new Response(JSON.stringify({ error: 'png128 must be 128x128' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

      if (!globalChainId)
        return new Response(JSON.stringify({ error: 'chainId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

      prFiles.push(
        { path: ['chains', String(globalChainId), 'logo.svg'].join('/'), contentBase64: svgBuf.toString('base64') },
        { path: ['chains', String(globalChainId), 'logo-32.png'].join('/'), contentBase64: png32buf.toString('base64') },
        { path: ['chains', String(globalChainId), 'logo-128.png'].join('/'), contentBase64: png128buf.toString('base64') },
      );
    }

    const login = await getUserLogin(token).catch(() => 'user');
    const branchName = `${login}-image-tools-${target}-${Date.now()}`;

    // Build default PR title/body if not provided
    let prTitle = prTitleOverride;
    let prBody = prBodyOverride;

    if (!prTitle || !prBody) {
      if (target === 'token') {
        const addressesForBody = (form.getAll('address') as string[])
          .map((a) => a?.toLowerCase?.() || a)
          .filter(Boolean);
        const chainsForBody: string[] = addressesForBody.map((_, i) => String(form.get(`chainId_${i}`) || globalChainId || ''));
        const uniqueChains = Array.from(new Set(chainsForBody.filter(Boolean)));
        prTitle ||= `feat: add token assets (${addressesForBody.length})`;
        const directoryLocations = addressesForBody.flatMap((addr: string, i: number) => [
          `/token/${chainsForBody[i]}/${addr}/logo.svg`,
          `/token/${chainsForBody[i]}/${addr}/logo-32.png`,
          `/token/${chainsForBody[i]}/${addr}/logo-128.png`,
        ]);
        prBody ||= [
          `Chains: ${uniqueChains.join(', ')}`,
          `Addresses: ${addressesForBody.join(', ')}`,
          '',
          'Uploaded locations:',
          ...directoryLocations.map((u) => `- ${u}`),
        ].join('\n');
      } else {
        prTitle ||= `feat: add chain assets on ${globalChainId}`;
        const directoryLocations = [`/chain/${globalChainId}/logo.svg`, `/chain/${globalChainId}/logo-32.png`, `/chain/${globalChainId}/logo-128.png`];
        prBody ||= [`Chain: ${globalChainId}`, '', 'Uploaded locations:', ...directoryLocations.map((u) => `- ${u}`)].join('\n');
      }
    }

    const prUrl = await openPrWithFilesForkAware({
      token,
      baseOwner: owner,
      baseRepo: repo,
      branchName,
      commitMessage: prTitle,
      prTitle,
      prBody,
      files: prFiles,
    });

    return new Response(JSON.stringify({ ok: true, prUrl }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('[image-tools] Upload failed', e?.stack || e);
    return new Response(JSON.stringify({ error: e?.message || 'Upload failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

