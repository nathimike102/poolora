const fs = require('fs');

const filePath = 'frontend/src/services/index.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Remove the invalid authService export
content = content.replace(/export \{ authService \} from '\.\/authService';\n/, '');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed authService export');
