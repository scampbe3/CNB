import fs from 'node:fs/promises';
import path from 'node:path';
import { root, out, published } from './lib.mjs';
const patch = await fs.readFile(path.join(out, 'sheet-patch.json'), 'utf8');
const script = await fs.readFile(path.join(root, 'scripts/phase1a/sheet-apply.gs'), 'utf8');
await fs.writeFile(path.join(out, 'sheet-apply-packaged.gs'),
  `const CNB_PHASE1A_PATCH = ${patch.trim()};\nconst CNB_PHASE1A_PUBLISHED = ${JSON.stringify(published)};\n\n${script}`);
