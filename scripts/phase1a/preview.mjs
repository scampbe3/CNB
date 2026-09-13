import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { root, out } from './lib.mjs';
import { pages } from './content.mjs';

export async function startPreview(port = 4178) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><html lang="en"><title>C+B Phase 1A Preview</title><h1>C+B Phase 1A Preview</h1><p>Local staged content. Live website and Sheet have not been changed.</p><ul>' + pages.map(p => `<li><a href="/preview/${p.key}">${p.key}</a></li>`).join('') + '</ul></html>');
        return;
      }
      if (url.pathname.startsWith('/preview/')) {
        const key = url.pathname.slice('/preview/'.length);
        if (!pages.some(p => p.key === key)) throw new Error('Unknown preview');
        const source = url.searchParams.has('fallback') ? `data/cnb-${key}.json` : `data/cnb-${key}-content-table.csv`;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>C+B ${key} preview</title><link rel="stylesheet" href="/css/cnb-homepage.css"></head><body><div data-cnb-home-root data-cnb-page="${key}" data-cnb-assets="/" data-cnb-src="/${source}"></div><script>window.CNB_HOME_FALLBACK_URL='/data/cnb-${key}.json';</script><script src="/js/cnb-homepage.js"></script></body></html>`);
        return;
      }
      if (!/^\/(?:assets|css|js|data)\//.test(url.pathname)) throw new Error('Forbidden');
      const requested = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (!requested.startsWith(path.resolve(root) + path.sep) || /[/\\]\.git[/\\]/.test(requested)) throw new Error('Forbidden');
      const types = { '.json': 'application/json', '.csv': 'text/csv', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf' };
      res.setHeader('Content-Type', types[path.extname(requested).toLowerCase()] || 'application/octet-stream');
      res.end(await fs.readFile(requested));
    } catch (error) { res.writeHead(404); res.end('Not found'); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server;
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.join(root, 'scripts/phase1a/preview.mjs')) {
  await startPreview();
  console.log('Local preview: http://127.0.0.1:4178');
}
