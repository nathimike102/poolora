const fs = require('fs');
const fp = 'src/utils/errorHandler.ts';
let content = fs.readFileSync(fp, 'utf8');
const startToken = 'export interface ApiErrorResponse {';
const endToken = '\n\n// ─── Error Handler';
const start = content.indexOf(startToken);
if (start === -1) {
  console.error('start token not found');
  process.exit(1);
}
const end = content.indexOf(endToken, start);
if (end === -1) {
  console.error('end token not found');
  process.exit(1);
}
const before = content.slice(0, start);
const after = content.slice(end);
const replacement = `export interface ApiErrorResponse {
  status: string;
  code: number;
  message?: string;
  data?: {
    message?: string;
    details?: any;
  };
}

export interface ProcessedError {
  message: string;
  code: number;
  isRetryable: boolean;
  originalError?: any;
  details?: any;
}
`;
const newContent = before + replacement + after;
fs.writeFileSync(fp, newContent, 'utf8');
console.log('Repaired', fp);
