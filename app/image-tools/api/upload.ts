export const config = { runtime: 'edge' };

import { openPrWithFilesForkAware, getUserLogin } from './github';

function isPng(bytes: Uint8Array): boolean {
  return (
    bytes.length > 24 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function readUInt32BE(arr: Uint8Array, offset: number): number {
  return (
    ((arr[offset] << 24) >>> 0) +
    ((arr[offset + 1] << 16) >>> 0) +
    ((arr[offset + 2] << 8) >>> 0) +
    (arr[offset + 3] >>> 0)
  );
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (!isPng(bytes)) return null;
  // PNG IHDR: width/height at offsets 16 and 20
  const width = readUInt32BE(bytes, 16);
  const height = readUInt32BE(bytes, 20);
  if (!width || !height) return null;
  return { width, height };
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...sub);
  }
  // btoa is available in Edge runtime
  return btoa(binary);
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
      const addresses = addressesRaw.map(a => String(a || '').trim()).filter(Boolean);
      if (!addresses.length) {
        return new Response(JSON.stringify({ error: 'At least one address required for token uploads' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      for (let i = 0; i < addresses.length; i++) {
        const addr = addresses[i];
        const localChainId = String(form.get(`chainId_${i}`) || globalChainId || '').trim();
        if (!localChainId) return new Response(JSON.stringify({ error: `Missing chainId for token index ${i}` }), { status: 400, headers: { 'Content-Type': 'application/json' } });

        const svgF = form.get(`svg_${i}`) as File | null;
        const png32F = form.get(`png32_${i}`) as File | null;
        const png128F = form.get(`png128_${i}`) as File | null;
        if (!svgF) return new Response(JSON.stringify({ error: `svg_${i} required` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        if (!svgF.type.includes('svg')) return new Response(JSON.stringify({ error: `svg_${i} must be image/svg+xml` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        if (!png32F || !png128F) return new Response(JSON.stringify({ error: `png32_${i} and png128_${i} required` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        if (!png32F.type.includes('png') || !png128F.type.includes('png')) return new Response(JSON.stringify({ error: `png32_${i} and png128_${i} must be image/png` }), { status: 400, headers: { 'Content-Type': 'application/json' } });

        const svgBytes = new Uint8Array(await svgF.arrayBuffer());
        const png32Bytes = new Uint8Array(await png32F.arrayBuffer());
        const png128Bytes = new Uint8Array(await png128F.arrayBuffer());

        const d32 = pngDimensions(png32Bytes);
        const d128 = pngDimensions(png128Bytes);
        if (!d32 || d32.width !== 32 || d32.height !== 32) return new Response(JSON.stringify({ error: `png32_${i} must be 32x32` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        if (!d128 || d128.width !== 128 || d128.height !== 128) return new Response(JSON.stringify({ error: `png128_${i} must be 128x128` }), { status: 400, headers: { 'Content-Type': 'application/json' } });

        const addrLower = addr.toLowerCase();
        prFiles.push(
          { path: ['tokens', String(localChainId), addrLower, 'logo.svg'].join('/'), contentBase64: toBase64(svgBytes) },
          { path: ['tokens', String(localChainId), addrLower, 'logo-32.png'].join('/'), contentBase64: toBase64(png32Bytes) },
          { path: ['tokens', String(localChainId), addrLower, 'logo-128.png'].join('/'), contentBase64: toBase64(png128Bytes) },
        );
      }
    } else {
      // Chain asset mode
      if (!globalChainId) return new Response(JSON.stringify({ error: 'chainId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      const svgF = form.get('svg') as File | null;
      const png32F = form.get('png32') as File | null;
      const png128F = form.get('png128') as File | null;
      if (!svgF) return new Response(JSON.stringify({ error: 'svg required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      if (!svgF.type.includes('svg')) return new Response(JSON.stringify({ error: 'svg must be image/svg+xml' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      if (!png32F || !png128F) return new Response(JSON.stringify({ error: 'png32 and png128 required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      if (!png32F.type.includes('png') || !png128F.type.includes('png')) return new Response(JSON.stringify({ error: 'png32 and png128 must be image/png' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

      const svgBytes = new Uint8Array(await svgF.arrayBuffer());
      const png32Bytes = new Uint8Array(await png32F.arrayBuffer());
      const png128Bytes = new Uint8Array(await png128F.arrayBuffer());

      const d32 = pngDimensions(png32Bytes);
      const d128 = pngDimensions(png128Bytes);
      if (!d32 || d32.width !== 32 || d32.height !== 32) return new Response(JSON.stringify({ error: 'png32 must be 32x32' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      if (!d128 || d128.width !== 128 || d128.height !== 128) return new Response(JSON.stringify({ error: 'png128 must be 128x128' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

      prFiles.push(
        { path: ['chains', String(globalChainId), 'logo.svg'].join('/'), contentBase64: toBase64(svgBytes) },
        { path: ['chains', String(globalChainId), 'logo-32.png'].join('/'), contentBase64: toBase64(png32Bytes) },
        { path: ['chains', String(globalChainId), 'logo-128.png'].join('/'), contentBase64: toBase64(png128Bytes) },
      );
    }

    const login = await getUserLogin(token).catch(() => 'user');
    const branchName = `${login}-image-tools-${target}-${Date.now()}`;

    // Build default PR title/body if not provided
    let prTitle = prTitleOverride;
    let prBody = prBodyOverride;
    if (!prTitle || !prBody) {
      if (target === 'token') {
        const addressesForBody = (form.getAll('address') as string[]).map(a => a?.toLowerCase?.() || a).filter(Boolean);
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
    return new Response(JSON.stringify({ error: e?.message || 'Upload failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
