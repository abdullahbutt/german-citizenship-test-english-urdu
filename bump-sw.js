#!/usr/bin/env node
/**
 * bump-sw.js
 *
 * Re-stamps sw.js with a fresh BUILD_ID, forcing every visitor's browser
 * to treat the cache as stale and fetch new content — without touching
 * any other file (no HTML regeneration, no quiz-data.json rewrite).
 *
 * Use this when you just want to force-refresh cached clients (e.g. after
 * fixing a bug you already deployed, or on a schedule) and don't have any
 * actual content changes to rebuild.
 *
 * For real content changes, still use `npm run build` as normal — this
 * script is only for the narrow "just bump the cache" case.
 *
 * Usage: node bump-sw.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const BUILD_ID = new Date().toISOString().replace(/[:.]/g, '-');

function bumpServiceWorker() {
    const srcPath = path.join(ROOT, 'sw.template.js');
    const outPath = path.join(ROOT, 'sw.js');

    if (!fs.existsSync(srcPath)) {
        console.error(`✗ sw.template.js not found at ${srcPath} — cannot safely re-stamp.`);
        console.error(`  (Re-stamping sw.js directly, without the template, risks double-stamping`);
        console.error(`  if it was already stamped and the __BUILD_ID__ placeholder is gone.)`);
        process.exit(1);
    }

    const source = fs.readFileSync(srcPath, 'utf8');
    if (!source.includes('__BUILD_ID__')) {
        console.error(`✗ sw.template.js doesn't contain the __BUILD_ID__ placeholder — aborting.`);
        process.exit(1);
    }

    const stamped = source.replace(/__BUILD_ID__/g, BUILD_ID);
    fs.writeFileSync(outPath, stamped);
    console.log(`✓ sw.js re-stamped with build ID: ${BUILD_ID}`);
    console.log(`  (only sw.js was touched — no other files were regenerated)`);
}

bumpServiceWorker();
