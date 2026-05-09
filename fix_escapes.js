const fs = require('fs');
const path = require('path');

const files = [
  'frontend/src/services/index.ts',
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Fix escaped newlines
    content = content.replace(/\\n/g, '\n');
    
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${file}`);
  } catch (err) {
    console.error(`Error fixing ${file}:`, err.message);
  }
});
