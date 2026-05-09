const fs = require('fs');
const path = require('path');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.isFile()) processFile(full);
  }
}

function processFile(filePath) {
  if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.js') && !filePath.endsWith('.jsx')) return;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('\\n')) {
    const fixed = content.replace(/\\n/g, '\n');
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log('Fixed:', filePath);
  }
}

const srcDir = path.join(__dirname, '..', 'src');
if (!fs.existsSync(srcDir)) {
  console.error('src directory not found at', srcDir);
  process.exit(1);
}
walk(srcDir);
console.log('Done.');
