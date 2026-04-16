import { copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const distDir = 'dist';
const indexPath = join(distDir, 'index.html');

if (existsSync(indexPath)) {
  copyFileSync(indexPath, join(distDir, '404.html'));
  writeFileSync(join(distDir, '.nojekyll'), '');
}
