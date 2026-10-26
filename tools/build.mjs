// Copies the playable game into dist/ — the folder Capacitor wraps into the iOS and Android apps.
//   npm run build
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of ['index.html', 'styles.css', 'src', 'config', 'vendor', 'assets']) {
  cpSync(join(root, f), join(out, f), { recursive: true });
}
console.log('Built dist/');
