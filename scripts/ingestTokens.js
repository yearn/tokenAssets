// Usage: node scripts/ingestTokens.js <path-to-json>
// Example: node scripts/ingestTokens.js ./scripts/tokensToInjest.json

const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.error('Usage: node scripts/ingestTokens.js <path-to-json>');
  process.exit(1);
}

const jsonPath = process.argv[2];
const tokensRoot = path.join(__dirname, '..', 'tokens');

function validateAndMapImages(srcDir, assetName) {
  const files = fs.readdirSync(srcDir);
  const assetLower = assetName.toLowerCase();
  const svg = files.find(f => f.toLowerCase() === `${assetLower}.svg`);
  const png32 = files.find(f => f.toLowerCase() === `${assetLower}-32.png`);
  const png128 = files.find(f => f.toLowerCase() === `${assetLower}-128.png`);
  if (!svg || !png32 || !png128) {
    throw new Error(`Image folder must contain files named: ${assetName}.svg, ${assetName}-32.png, ${assetName}-128.png. Found: ${files.join(', ')}`);
  }
  return {
    svg,
    png32,
    png128
  };
}

function copyAndRenameImages(srcDir, destDir, imageMap) {
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
  let data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  // Support both array and single object
  if (!Array.isArray(data)) {
    data = [data];
  }
  data.forEach(entry => {
    const { chainId, address, assetFolder } = entry;
    if (!chainId || !address || !assetFolder) {
      console.warn('Missing chainId, address, or assetFolder in entry:', entry);
      return;
    }
    const imagesFolder = path.isAbsolute(assetFolder)
      ? assetFolder
      : path.join(__dirname, assetFolder);
    if (!fs.existsSync(imagesFolder)) {
      console.error('Images folder not found:', imagesFolder);
      return;
    }
    let imageMap;
    try {
      imageMap = validateAndMapImages(imagesFolder, entry.symbol);
    } catch (e) {
      console.error(e.message);
      return;
    }
    const destDir = path.join(tokensRoot, String(chainId), address.toLowerCase());
    copyAndRenameImages(imagesFolder, destDir, imageMap);
    console.log(`Copied and renamed images to ${destDir}`);
  });
}

main();
