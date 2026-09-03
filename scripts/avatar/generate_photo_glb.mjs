#!/usr/bin/env node
/**
 * Credential-free photo -> animated face GLB build.
 *
 * This runner uses the MIT-licensed face-to-blendshape-3d project as the
 * generation engine. It drives the upstream browser pipeline with Chromium,
 * feeds the approved Neeraj master photo into it, and captures the generated
 * GLB. No avatar-provider credentials are required.
 */
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const ROOT = resolve(process.cwd());
const photo = resolve(process.argv[2] ?? 'assets_private/neeraj.jpg');
const output = resolve(process.argv[3] ?? 'public/avatar/neeraj-face.glb');
const work = resolve('.avatar-build/face-to-blendshape-3d');
const port = 4173;
const upstream = 'https://github.com/arturwyroslak/face-to-blendshape-3d.git';
const commit = '48cc0ea8de6a375e7bd1c574def325fa80fb748a';

function run(command, args, cwd = ROOT) {
  execFileSync(command, args, { cwd, stdio: 'inherit' });
}

if (!existsSync(photo)) throw new Error(`Missing identity photo: ${photo}`);
mkdirSync(resolve('.avatar-build'), { recursive: true });
if (!existsSync(work)) {
  run('git', ['clone', '--depth', '1', upstream, work]);
}
run('git', ['fetch', '--depth', '1', 'origin', commit], work);
run('git', ['checkout', '--detach', commit], work);
run('npm', ['install', '--no-audit', '--no-fund'], work);
run('npm', ['install', '--no-save', '--no-audit', '--no-fund', 'playwright@1.55.0'], work);
run('npx', ['playwright', 'install', '--with-deps', 'chromium'], work);

const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: work,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) { ready = true; break; }
    } catch {}
    await sleep(500);
  }
  if (!ready) throw new Error('Upstream face generator did not start');

  const script = `
    const { chromium } = require('playwright');
    (async () => {
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ acceptDownloads: true });
      page.on('console', msg => console.log('[browser]', msg.text()));
      await page.goto('http://127.0.0.1:${port}/', { waitUntil: 'networkidle', timeout: 120000 });
      await page.locator('#fileInput').setInputFiles(${JSON.stringify(photo)});
      await page.locator('#processBtn').click();
      await page.waitForFunction(() => document.body.innerText.includes('3D model with texture and morph targets generated!'), null, { timeout: 180000 });
      const download = await Promise.all([
        page.waitForEvent('download', { timeout: 60000 }),
        page.locator('#exportBtn').click()
      ]).then(([d]) => d);
      await download.saveAs(${JSON.stringify(output)});
      await browser.close();
    })().catch(err => { console.error(err); process.exit(1); });
  `;
  run(process.execPath, ['-e', script], work);
} finally {
  server.kill('SIGTERM');
}

if (!existsSync(output)) throw new Error(`Generator completed without creating ${output}`);
const stat = readdirSync(resolve(output, '..')).find(name => name === output.split(/[\\/]/).pop());
if (!stat) throw new Error(`Generated GLB is missing: ${output}`);
console.log(`Generated Neeraj photo-driven GLB: ${output}`);
