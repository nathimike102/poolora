const fs = require('fs');

const filePath = 'frontend/src/utils/errorHandler.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Fix escaped newlines
content = content.replace(/\\n/g, '\n');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed errorHandler.ts');
