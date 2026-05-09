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
  // Remove a lone trailing double-quote if present at EOF
  if (content.endsWith('"') || content.endsWith('\"\n') || content.endsWith('\"\r\n')) {
    // Remove last quote and any trailing newline artifacts
    let fixed = content;
    // Trim only the final quote
    if (fixed.endsWith('\"')) fixed = fixed.slice(0, -1);
    if (fixed.endsWith('\r')) fixed = fixed.slice(0, -1);
    fs.writeFileSync(filePath, fixed, 'utf8');
    console.log('Stripped trailing quote:', filePath);
  }
}

const srcDir = path.join(__dirname, '..', 'src');
if (!fs.existsSync(srcDir)) {
  console.error('src directory not found at', srcDir);
  process.exit(1);
}
walk(srcDir);
console.log('Done.');
