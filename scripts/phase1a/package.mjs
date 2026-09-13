import fs from 'node:fs/promises';
import path from 'node:path';
import { root, out } from './lib.mjs';
const script = await fs.readFile(path.join(root, 'scripts/phase1a/sheet-apply.gs'), 'utf8');
await fs.writeFile(path.join(out, 'sheet-apply-packaged.gs'), script);
