#!/usr/bin/env node
// Usage: node ../../tools/check-site.mjs <site dir> (a site's pnpm check runs it after the build)
// Checks that a site has the files, routes and policy pages needed to launch, that no
// TODO placeholders remain in user-facing copy, and that it imports no other site.
// Adapted from shipwords' check-site: this site ships Traditional Chinese in production,
// so there is no "zh must not leak into the build" rule here — Chinese IS the product.
// Launch gates (placeholder url / support email) only warn in P0; run with
// YUELAO_LAUNCH_CHECK=1 to turn them into failures before launch.
import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_FILES = ['README.md', 'DESIGN.md', 'site.config.ts', 'wrangler.jsonc', 'src/server.ts'];
const REQUIRED_ROUTES = [
  'src/routes/sitemap[.]xml.ts',
  'src/routes/robots[.]txt.ts',
  'src/routes/llms[.]txt.ts',
  'src/routes/api/webhooks/stripe.ts',
];
// Policy pages: required by payment providers and for complaints. Text lives in messages/legal.
const LEGAL_PAGES = ['privacy', 'terms', 'refunds', 'dmca'];
const LEGAL_FILE = 'src/site/legal.tsx';

function walk(dir, files = [], pattern = /\.(ts|tsx)$/) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files, pattern);
    else if (pattern.test(entry.name)) files.push(full);
  }
  return files;
}

function checkLegal(dir) {
  const problems = [];
  const warnings = [];
  for (const page of LEGAL_PAGES) {
    if (!fs.existsSync(path.join(dir, `src/routes/${page}.tsx`)))
      problems.push(`Missing policy page src/routes/${page}.tsx`);
  }
  if (!fs.existsSync(path.join(dir, LEGAL_FILE))) {
    return { problems: [...problems, `Missing ${LEGAL_FILE} (SUPPORT_EMAIL)`], warnings };
  }
  // No TODO placeholders in user-facing copy.
  for (const block of ['legal', 'common', 'home']) {
    for (const locale of ['zh-Hant', 'zh-Hans']) {
      const file = path.join(dir, 'messages', block, `${locale}.json`);
      if (fs.existsSync(file) && fs.readFileSync(file, 'utf8').includes('TODO')) {
        problems.push(`messages/${block}/${locale}.json still has TODO placeholders`);
      }
    }
  }
  // Launch gates: placeholder contact email / url. Warn now, fail with YUELAO_LAUNCH_CHECK=1.
  const config = fs.readFileSync(path.join(dir, 'site.config.ts'), 'utf8');
  if (config.includes('support@example.com'))
    warnings.push('site.config.ts supportEmail is still a placeholder');
  if (config.includes('example.com')) warnings.push('site.config.ts url is still example.com');
  return { problems, warnings };
}

export function checkSite(dir) {
  const problems = [];
  const warnings = [];
  for (const file of REQUIRED_FILES) {
    if (!fs.existsSync(path.join(dir, file))) problems.push(`Missing ${file}`);
  }
  for (const route of REQUIRED_ROUTES) {
    if (!fs.existsSync(path.join(dir, route))) problems.push(`Missing route ${route}`);
  }
  if (fs.existsSync(path.join(dir, 'wrangler.jsonc'))) {
    const wrangler = fs.readFileSync(path.join(dir, 'wrangler.jsonc'), 'utf8');
    if (wrangler.includes('ai-site-template')) problems.push('wrangler.jsonc still has the template name');
    if (wrangler.includes('d1_databases') || wrangler.includes('r2_buckets')) {
      problems.push('wrangler.jsonc still has D1/R2 bindings (this is the Supabase edition)');
    }
  }
  const legal = checkLegal(dir);
  problems.push(...legal.problems);
  warnings.push(...legal.warnings);
  for (const file of fs.existsSync(path.join(dir, 'src')) ? walk(path.join(dir, 'src')) : []) {
    const source = fs.readFileSync(file, 'utf8');
    if (/from ['"](\.\.\/)+(sites|templates)\//.test(source) || /@yuelao\/(site|template)-/.test(source)) {
      problems.push(`${path.relative(dir, file)} imports another site`);
    }
  }
  return { problems, warnings };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const dir = path.resolve(process.argv[2] ?? '.');
  const { problems, warnings } = checkSite(dir);
  for (const warning of warnings) console.warn(`warning: ${warning}`);
  if (process.env.YUELAO_LAUNCH_CHECK === '1' && warnings.length) {
    console.error('Launch check failed:');
    for (const warning of warnings) console.error(`- ${warning}`);
    process.exit(1);
  }
  if (problems.length) {
    console.error(`Site check failed (${dir}):`);
    for (const problem of problems) console.error(`- ${problem}`);
    process.exit(1);
  }
  console.log('Site check passed');
}
