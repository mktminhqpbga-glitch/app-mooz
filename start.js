import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const children = [];
function launch(command, args, options = {}) {
  const child = spawn(command, args, { stdio: 'inherit', ...options });
  children.push(child);
  child.on('error', error => console.error('Không thể khởi động ứng dụng:', error.message));
  return child;
}
launch(process.execPath, ['server.js']);
const scraperDir = 'apps/meta-ads-scraper';
const next = `${scraperDir}/node_modules/next/dist/bin/next`;
if (existsSync(next)) {
  const mode = existsSync(join(scraperDir,'.next','BUILD_ID')) ? 'start' : 'dev';
  launch(process.execPath, ['node_modules/next/dist/bin/next', mode, '-H', '127.0.0.1', '-p', '3101'], { cwd: scraperDir });
} else {
  console.log('Chưa cài Meta Ads Scraper. Xem README để cài ứng dụng con.');
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { for (const child of children) child.kill(signal); });
