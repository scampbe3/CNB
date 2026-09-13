import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { root, out, columns, csv, readJson, writeJson, rowKey, rendererParser } from './lib.mjs';
import { pages, downloads, dinnerDir } from './content.mjs';

const require = createRequire(import.meta.url);
const sharp = require(process.env.CNB_SHARP || 'D:/CNB/phase1a-tools/node_modules/sharp');
const originals = process.env.CNB_FINALS || 'D:/CNB/docs/finals';
const baseline = await readJson(path.join(out, 'baseline.json'));
const convert = await rendererParser();
const manifest = [];
const cachedManifest = await readJson(path.join(out, 'image-manifest.json')).catch(() => []);
const patch = { workbook: baseline.workbook, basedOn: baseline.capturedAt, tabs: [] };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
await fs.mkdir(path.join(root, 'assets/images/phase1a'), { recursive: true });
await fs.mkdir(path.join(out, 'proposed'), { recursive: true });

async function prepareImage(page, section, field, definition, previous) {
  const original = path.join(originals, definition.source);
  const meta = await sharp(original).metadata();
  let width, height;
  if (previous) {
    if (!previous.startsWith('assets/images/')) throw new Error(`Review external image slot: ${previous}`);
    const old = await sharp(path.join(root, previous)).metadata();
    width = old.width; height = old.height;
  } else {
    const m = meta.autoOrient || meta;
    const scale = Math.min(1, 1600 / Math.max(m.width, m.height));
    width = Math.round(m.width * scale); height = Math.round(m.height * scale);
  }
  let relative = `assets/images/phase1a/${slug(page)}-${slug(section)}-${slug(field)}.webp`;
  let dest = path.join(root, relative);
  const fit = definition.fit || 'contain';
  const sourceHash = crypto.createHash('sha256').update(await fs.readFile(original)).digest('hex');
  const cached = cachedManifest.find(m => (m.output === relative || m.output === relative.replace('.webp', '.avif')) && m.width === width && m.height === height && m.fit === fit && m.sourceHash === sourceHash);
  if (cached && cached.bytes <= (cached.output.endsWith('.avif') ? 1500000 : 900000)) {
    const bytes = await fs.readFile(path.join(root, cached.output)).catch(() => null);
    if (bytes && crypto.createHash('sha256').update(bytes).digest('hex') === cached.sha256) {
      manifest.push({ ...cached, section });
      return cached.output;
    }
  }
  let result;
  // No stretching: preserve the complete source for mismatched slots, except chosen hero crops.
  for (const quality of [78, 72, 66, 60]) {
    result = await sharp(original).rotate().resize({ width, height, fit,
      position: fit === 'cover' ? sharp.strategy.attention : 'centre',
      background: '#f5f1e8' }).webp({ quality, effort: 5 }).toBuffer();
    if (result.length <= 650000) break;
  }
  let webDetailMax = null;
  if (result.length > 900000) {
    // Large legacy canvases need web-scale detail, not print-scale camera noise.
    // Resample detail first, then return to the exact original slot dimensions.
    webDetailMax = 1800;
    const webSource = await sharp(original).rotate().resize({ width: webDetailMax, height: webDetailMax,
      fit: 'inside', withoutEnlargement: true }).toBuffer();
    result = await sharp(webSource).resize({ width, height, fit,
      position: fit === 'cover' ? sharp.strategy.attention : 'centre', background: '#f5f1e8' })
      .webp({ quality: 66, effort: 6 }).toBuffer();
  }
  if (result.length > 900000) {
    result = await sharp(result).avif({ quality: 48, effort: 4 }).toBuffer();
    relative = relative.replace('.webp', '.avif');
    dest = path.join(root, relative);
  }
  await fs.writeFile(dest, result);
  const check = await sharp(dest).metadata();
  if (check.width !== width || check.height !== height) throw new Error(`Image dimensions changed: ${relative}`);
  manifest.push({ page, section, field, source: definition.source, replaced: previous || null,
    output: relative, width, height, fit, sourceHash, webDetailMax, sourceBytes: (await fs.stat(original)).size,
    bytes: result.length, sha256: crypto.createHash('sha256').update(result).digest('hex') });
  return relative;
}

for (const spec of pages) {
  const tab = baseline.tabs.find(t => t.key === spec.key);
  const rows = structuredClone(tab?.rows || []);
  const originalRows = new Map(rows.map(r => [rowKey(r), structuredClone(r)]));
  if (originalRows.size !== rows.length) throw new Error(`Duplicate row identities in ${spec.key}`);
  const newBase = { page: spec.key, header: structuredClone(baseline.tabs[0].base.header),
    footer: structuredClone(baseline.tabs[0].base.footer), sections: [{ id: 'hero', type: 'hero', theme: 'light' }] };
  const base = structuredClone(tab?.base || newBase);
  const find = (name, field) => rows.find(r => r.section === name && r.field === field);
  const set = (name, field, value = '', link = '', notes = '') => {
    const row = find(name, field);
    const update = { section: name, field, value: String(value), link, notes };
    if (row) Object.assign(row, update); else rows.push(update);
  };
  const controlFields = /^(Show Section\?|Display Order|Content Mode|Section Layout|Section Theme|List Style)$/i;
  for (const sec of spec.sections) {
    const name = sec.custom ? slug(sec.name) : sec.name;
    const oldImages = new Map(rows.filter(r => r.section === name && /^Image\s*\d*$/i.test(r.field)).map(r => [r.field, r.value]));
    // Retain A/B identity, row order, controls and editor notes. Only clear superseded copy cells.
    for (const r of rows.filter(r => r.section === name)) {
      if (!controlFields.test(r.field) && !/^Editor Note/.test(r.field)) r.value = r.link = r.notes = '';
    }
    set(name, 'Display Order', sec.order);
    set(name, 'Show Section?', 'Yes');
    set(name, 'Content Mode', 'Flexible');
    if (sec.custom) {
      set(name, 'Section Layout', sec.layout);
      set(name, 'Section Theme', 'paper');
      set(name, 'List Style', 'Card Stack');
    }
    for (const field of ['title', 'note', 'eyebrow', 'subhead']) {
      if (sec[field] !== undefined) set(name, field[0].toUpperCase() + field.slice(1), sec[field]);
    }
    (sec.body || []).forEach((text, i) => set(name, `${sec.custom ? 'Paragraph' : 'Body'} ${i + 1}`, text));
    (sec.list || []).forEach((text, i) => set(name, `${sec.custom ? 'List Item' : 'List'} ${i + 1}`, text));
    (sec.ctas || []).forEach((c, i) => set(name, `${sec.custom ? 'Button' : 'CTA'} ${i + 1}`, c.label, c.href, c.variant));
    if (sec.quote) set(name, 'Quote 1', sec.quote, '', sec.attribution);
    if (sec.image) {
      const field = oldImages.has('Image') ? 'Image' : (oldImages.keys().next().value || 'Image');
      set(name, field, await prepareImage(spec.key, name, field, sec.image, oldImages.get(field)), '', sec.image.alt);
    }
    if (sec.galleryFolder) {
      const alreadyUsed = new Set(spec.sections.flatMap(s => s.image ? [s.image.source] : []));
      const files = (await fs.readdir(path.join(originals, sec.galleryFolder)))
        .filter(f => /\.(jpe?g|png|webp)$/i.test(f) && !alreadyUsed.has(sec.galleryFolder + f))
        .sort().slice(sec.galleryPart * 3, (sec.galleryPart + 1) * 3);
      let i = 0;
      for (const file of files) {
        if (alreadyUsed.has(sec.galleryFolder + file)) continue;
        const field = `Image ${++i}`;
        set(name, field, await prepareImage(spec.key, name, field,
          { source: sec.galleryFolder + file }, null), '', 'Moments from The Blind Dinner');
      }
    }
  }
  for (const name of spec.hide || []) set(name, 'Show Section?', 'No');
  const changes = [], additions = [];
  for (const r of rows) {
    const before = originalRows.get(rowKey(r));
    if (!before) additions.push(r);
    else for (const column of columns.slice(2)) {
      if (r[column] !== before[column]) changes.push({ section: r.section, field: r.field, column,
        before: before[column], after: r[column] });
    }
  }
  patch.tabs.push({ key: spec.key, tab: tab?.tab || spec.key, gid: tab?.gid || null,
    create: !tab, changes, additions });
  const merged = convert(base, rows, true);
  for (const section of merged.sections) {
    if ('_cmsEnabled' in section) section.enabled = section._cmsEnabled;
    if ('_cmsDisplayOrder' in section) section.displayOrder = section._cmsDisplayOrder;
    delete section._cmsEnabled; delete section._cmsDisplayOrder;
  }
  merged.version = '2026-09-12-phase1a-content';
  await writeJson(path.join(root, `data/cnb-${spec.key}.json`), merged);
  await writeJson(path.join(out, `proposed/${spec.key}.json`), rows);
  await fs.writeFile(path.join(root, `data/cnb-${spec.key}-content-table.csv`), csv(rows));
  await fs.writeFile(path.join(root, `data/google-sheet-upload/${tab?.tab || spec.key}.csv`), csv(rows));
  if (spec.key === 'homepage') await writeJson(path.join(root, 'data/cnb-homepage-content-table.json'), { columns, rows });
  console.log(`${spec.key}: ${changes.length} changed cells, ${additions.length} appended rows`);
}
await fs.mkdir(path.join(root, 'assets/docs/phase1a'), { recursive: true });
for (const [source, dest] of downloads) {
  await fs.copyFile(path.join(originals, source), path.join(root, 'assets/docs/phase1a', dest));
}
for (const stale of cachedManifest.filter(old => !manifest.some(current => current.output === old.output))) {
  const stalePath = path.resolve(root, stale.output);
  const generatedDirectory = path.resolve(root, 'assets/images/phase1a') + path.sep;
  if (!stalePath.startsWith(generatedDirectory)) throw new Error('Refusing to prune outside generated image directory');
  await fs.unlink(stalePath).catch(error => { if (error.code !== 'ENOENT') throw error; });
}
await writeJson(path.join(out, 'image-manifest.json'), manifest);
await writeJson(path.join(out, 'sheet-patch.json'), patch);
console.log('Staged content only. No live Sheet, Squarespace, or main-branch edits.');
