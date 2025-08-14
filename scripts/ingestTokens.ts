import fs from 'fs';
import path from 'path';

/**
 * Usage: npm run ingest -- <path-to-json>
 * Or:   ts-node scripts/ingestTokens.ts ./scripts/tokensToInjest.json
 * JSON spec entries: { chainId: number, symbol: string, address: string, assetFolder: string }
 * Each assetFolder must contain: SYMBOL.svg, SYMBOL-32.png, SYMBOL-128.png (case-insensitive).
 */

interface IngestSpecEntry {
  chainId: number;
  symbol: string;
  address: string;
  assetFolder: string; // relative to scripts/ by default
}

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: ts-node scripts/ingestTokens.ts <path-to-json>');
  process.exit(1);
}

const jsonPath = args[0];
const tokensRoot = path.join(__dirname, '..', 'tokens');

function validateAndMapImages(srcDir: string, assetName: string) {
  const files = fs.readdirSync(srcDir);
  const assetLower = assetName.toLowerCase();
  const svg = files.find(f => f.toLowerCase() === `${assetLower}.svg`);
  const png32 = files.find(f => f.toLowerCase() === `${assetLower}-32.png`);
  const png128 = files.find(f => f.toLowerCase() === `${assetLower}-128.png`);
  if (!svg || !png32 || !png128) {
    throw new Error(`Image folder must contain files named: ${assetName}.svg, ${assetName}-32.png, ${assetName}-128.png. Found: ${files.join(', ')}`);
  }
  return { svg, png32, png128 };
}

function copyAndRenameImages(srcDir: string, destDir: string, imageMap: { svg: string; png32: string; png128: string }) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(path.join(srcDir, imageMap.svg), path.join(destDir, 'logo.svg'));
  fs.copyFileSync(path.join(srcDir, imageMap.png32), path.join(destDir, 'logo-32.png'));
  fs.copyFileSync(path.join(srcDir, imageMap.png128), path.join(destDir, 'logo-128.png'));
}

function main() {
  if (!fs.existsSync(jsonPath)) {
    console.error('JSON file not found:', jsonPath);
    process.exit(1);
  }
  let data: IngestSpecEntry[] | IngestSpecEntry = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const entries: IngestSpecEntry[] = Array.isArray(data) ? data : [data];

  for (const entry of entries) {
    const { chainId, address, assetFolder, symbol } = entry;
    if (!chainId || !address || !assetFolder || !symbol) {
      console.warn('Missing chainId, address, symbol, or assetFolder in entry:', entry);
      continue;
    }
    const imagesFolder = path.isAbsolute(assetFolder)
      ? assetFolder
      : path.join(__dirname, assetFolder);
    if (!fs.existsSync(imagesFolder)) {
      console.error('Images folder not found:', imagesFolder);
      continue;
    }
    let imageMap;
    try {
      imageMap = validateAndMapImages(imagesFolder, symbol);
    } catch (e: any) {
      console.error(e.message);
      continue;
    }
    const destDir = path.join(tokensRoot, String(chainId), address.toLowerCase());
    copyAndRenameImages(imagesFolder, destDir, imageMap);
    console.log(`Copied and renamed images to ${destDir}`);
  }
}

main();
