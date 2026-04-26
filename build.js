#!/usr/bin/env node
/**
 * build.js — converts markdown sources from English & Urdu branches into
 * a bilingual static site structured as:
 *
 *   /
 *   ├── index.html        (language picker — untouched by this script)
 *   ├── en/*.html
 *   ├── ur/*.html
 *   └── .nojekyll
 *
 * Usage:
 *   1. Clone the english branch into ./sources/english/
 *   2. Clone the urdu branch into ./sources/urdu/
 *   3. `npm install` then `node build.js`
 *
 * Re-run anytime the source .md files change.
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = __dirname;
const SOURCES = {
    en: path.join(ROOT, 'sources', 'english'),
    ur: path.join(ROOT, 'sources', 'urdu'),
};
const OUTPUTS = {
    en: path.join(ROOT, 'en'),
    ur: path.join(ROOT, 'ur'),
};

// Files we never want to convert (branch metadata, not content)
// Note: README.md IS processed — its content becomes index.html
const EXCLUDE = new Set(['CONTRIBUTING.md']);

// Human-readable titles for known slugs. Add more as needed.
const TITLES = {
    en: {
        'questions-001-050': 'Questions 1–50',
        'questions-051-100': 'Questions 51–100',
        'questions-101-150': 'Questions 101–150',
        'questions-151-200': 'Questions 151–200',
        'questions-201-250': 'Questions 201–250',
        'questions-251-300': 'Questions 251–300',
        'baden-wuerttemberg': 'Baden-Württemberg',
        'bayern': 'Bavaria (Bayern)',
        'berlin': 'Berlin',
        'brandenburg': 'Brandenburg',
        'bremen': 'Bremen',
        'hamburg': 'Hamburg',
        'hessen': 'Hesse (Hessen)',
        'mecklenburg-vorpommern': 'Mecklenburg-Vorpommern',
        'niedersachsen': 'Lower Saxony (Niedersachsen)',
        'nordrhein-westfalen': 'North Rhine-Westphalia',
        'rheinland-pfalz': 'Rhineland-Palatinate',
        'saarland': 'Saarland',
        'sachsen': 'Saxony (Sachsen)',
        'sachsen-anhalt': 'Saxony-Anhalt',
        'schleswig-holstein': 'Schleswig-Holstein',
        'thueringen': 'Thuringia (Thüringen)',
    },
    ur: {
        'questions-001-050': 'سوالات 1–50',
        'questions-051-100': 'سوالات 51–100',
        'questions-101-150': 'سوالات 101–150',
        'questions-151-200': 'سوالات 151–200',
        'questions-201-250': 'سوالات 201–250',
        'questions-251-300': 'سوالات 251–300',
        'baden-wuerttemberg': 'باڈن ورٹمبرگ',
        'bayern': 'باویریا',
        'berlin': 'برلن',
        'brandenburg': 'برانڈنبرگ',
        'bremen': 'بریمن',
        'hamburg': 'ہیمبرگ',
        'hessen': 'ہیسن',
        'mecklenburg-vorpommern': 'میکلنبرگ-فورپومرن',
        'niedersachsen': 'نیڈرزاخسن',
        'nordrhein-westfalen': 'نارڈرائن ویسٹ فالن',
        'rheinland-pfalz': 'رائن لینڈ-فالز',
        'saarland': 'زارلینڈ',
        'sachsen': 'زاخسن',
        'sachsen-anhalt': 'زاخسن-انہالٹ',
        'schleswig-holstein': 'شلیسوگ-ہولسٹائن',
        'thueringen': 'تھیورنگن',
    },
};

const UI = {
    en: {
        siteTitle: 'German Citizenship Test',
        home: 'Home',
        switchTo: 'اردو',
        back: '← Back to home',
        changeLang: '← Change language',
        backToTop: 'Back to top',
        pickerHint: 'Change language',
        questionsHeading: 'Questions',
        statesHeading: 'Federal state questions',
        tagline: 'All 300 questions for the Einbürgerungstest',
        sourceOnGithub: 'View on GitHub',
        footerTagline: '🇩🇪 German Citizenship Test — with English & Urdu',
        footerSubtag: 'Prepare for the Einbürgerungstest / Leben in Deutschland',
        bamfCatalog: 'BAMF Question Catalog ↗',
        bamfTestCenter: 'BAMF Test Center ↗',
        starLabel: '⭐ Star on GitHub',
        supportBtn: '☕ Support',
        lastUpdated: 'Last updated',
        navPrev: '← Previous',
        navNext: 'Next →',
        navJump: 'Jump to:',
        navQuestions: 'Questions',
        navStates: 'States',
        privacyLink: 'Privacy & Impressum',
    },
    ur: {
        siteTitle: 'جرمن شہریت کا امتحان',
        home: 'ہوم',
        switchTo: 'English',
        back: 'ہوم پر واپس →',
        changeLang: 'زبان تبدیل کریں →',
        backToTop: 'اوپر جائیں',
        pickerHint: 'زبان تبدیل کریں',
        questionsHeading: 'سوالات',
        statesHeading: 'ریاستی سوالات',
        tagline: 'انبیورگرونگس ٹیسٹ کے تمام 300 سوالات',
        sourceOnGithub: 'GitHub پر دیکھیں',
        footerTagline: '🇩🇪 جرمن شہریت کا امتحان — انگریزی اور اردو کے ساتھ',
        footerSubtag: 'انبیورگرونگس ٹیسٹ / لیبن اِن ڈوئچ لینڈ کی تیاری',
        bamfCatalog: 'BAMF سوالات ↗',
        bamfTestCenter: 'BAMF ٹیسٹ سینٹر ↗',
        starLabel: '⭐ GitHub پر اسٹار کریں',
        supportBtn: '☕ عطیہ',
        lastUpdated: 'آخری اپڈیٹ',
        navPrev: 'پچھلا →',
        navNext: '← اگلا',
        navJump: 'جائیں:',
        navQuestions: 'سوالات',
        navStates: 'ریاستیں',
        privacyLink: 'پرائیویسی و اظہاریہ',
    },
};

const GITHUB_URL = 'https://github.com/abdullahbutt/german-citizenship-test-english-urdu';
const PAYPAL_URL = 'https://paypal.me/abdullahbuttde';
const BAMF_CATALOG_URL = 'https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/gesamtfragenkatalog-lebenindeutschland.html';
const BAMF_TEST_CENTER_URL = 'https://oet.bamf.de/ords/oetut/f?p=514:1::::::';
const BUILD_DATE = new Date().toISOString().slice(0, 10);
const SITE_BASE_URL = 'https://abdullahbutt.github.io/german-citizenship-test-english-urdu';
const OG_IMAGE_URL = `${SITE_BASE_URL}/og-image.png`;
const CLOUDFLARE_ANALYTICS_TOKEN = 'd435b2572b82459cb083e37f7c734b75';

// Canonical ordering for navigation (prev/next + jump menu).
// Question sets in numeric order; states alphabetical.
const ORDERED_QUESTIONS = [
    'questions-001-050',
    'questions-051-100',
    'questions-101-150',
    'questions-151-200',
    'questions-201-250',
    'questions-251-300',
];
const ORDERED_STATES = [
    'baden-wuerttemberg',
    'bayern',
    'berlin',
    'brandenburg',
    'bremen',
    'hamburg',
    'hessen',
    'mecklenburg-vorpommern',
    'niedersachsen',
    'nordrhein-westfalen',
    'rheinland-pfalz',
    'saarland',
    'sachsen',
    'sachsen-anhalt',
    'schleswig-holstein',
    'thueringen',
];
const ORDERED_ALL = [...ORDERED_QUESTIONS, ...ORDERED_STATES];

// ---------- Navigation pager ----------
function renderNavPager({ lang, slug }) {
    const ui = UI[lang];
    const titles = TITLES[lang];

    const optgroup = (label, items) =>
        `<optgroup label="${escapeHtml(label)}">${
            items.map(s =>
                `<option value="./${s}.html"${s === slug ? ' selected' : ''}>${escapeHtml(titles[s] || s)}</option>`
            ).join('')
        }</optgroup>`;

    const jumpSelect =
        `<div class="pager-jump">
            <select onchange="if(this.value)window.location.href=this.value" aria-label="${escapeHtml(ui.navJump)}">
                <option value="">${escapeHtml(ui.navJump)}</option>
                ${optgroup(ui.navQuestions, ORDERED_QUESTIONS)}
                ${optgroup(ui.navStates, ORDERED_STATES)}
            </select>
        </div>`;

    // Index page: jump-only variant, no prev/next arrows (no sequence applies)
    if (slug === 'index') {
        return `
        <nav class="nav-pager nav-pager--jump-only" aria-label="Quick jump">
            ${jumpSelect}
        </nav>`;
    }

    const idx = ORDERED_ALL.indexOf(slug);
    if (idx === -1) return '';

    const prev = idx > 0 ? ORDERED_ALL[idx - 1] : null;
    const next = idx < ORDERED_ALL.length - 1 ? ORDERED_ALL[idx + 1] : null;

    const prevBtn = prev
        ? `<a class="pager-btn" href="./${prev}.html" rel="prev">${escapeHtml(ui.navPrev)} ${escapeHtml(titles[prev] || prev)}</a>`
        : `<span class="pager-btn disabled">${escapeHtml(ui.navPrev)}</span>`;
    const nextBtn = next
        ? `<a class="pager-btn" href="./${next}.html" rel="next">${escapeHtml(titles[next] || next)} ${escapeHtml(ui.navNext)}</a>`
        : `<span class="pager-btn disabled">${escapeHtml(ui.navNext)}</span>`;

    return `
        <nav class="nav-pager" aria-label="Page navigation">
            ${prevBtn}
            ${jumpSelect}
            ${nextBtn}
        </nav>`;
}

// ---------- HTML template ----------
function renderPage({ lang, title, bodyHtml, slug }) {
    const dir = lang === 'ur' ? 'rtl' : 'ltr';
    const ui = UI[lang];
    const otherLang = lang === 'en' ? 'ur' : 'en';
    const urduFont = lang === 'ur'
        ? `<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap" rel="stylesheet">`
        : '';
    const bodyFont = lang === 'ur'
        ? `font-family: 'Noto Nastaliq Urdu', 'Inter', serif; line-height: 2;`
        : `font-family: 'Inter', system-ui, -apple-system, sans-serif; line-height: 1.7;`;

    return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} · ${ui.siteTitle}</title>
    <meta name="description" content="${escapeHtml(ui.tagline)} — ${escapeHtml(title)}. ${lang === 'en' ? 'Free German citizenship test prep with English & Urdu translations.' : 'انگریزی اور اردو ترجمے کے ساتھ مفت جرمن شہریت کے امتحان کی تیاری۔'}">

    <!-- Open Graph -->
    <meta property="og:type" content="article">
    <meta property="og:url" content="${SITE_BASE_URL}/${lang}/${slug}.html">
    <meta property="og:title" content="${escapeHtml(title)} · ${escapeHtml(ui.siteTitle)}">
    <meta property="og:description" content="${escapeHtml(ui.tagline)}">
    <meta property="og:image" content="${OG_IMAGE_URL}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'ur_PK'}">
    <meta property="og:site_name" content="${escapeHtml(ui.siteTitle)}">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(title)} · ${escapeHtml(ui.siteTitle)}">
    <meta name="twitter:description" content="${escapeHtml(ui.tagline)}">
    <meta name="twitter:image" content="${OG_IMAGE_URL}">

    <!-- PWA -->
    <link rel="manifest" href="../manifest.webmanifest">
    <meta name="theme-color" content="#1d4ed8">
    <meta name="application-name" content="DE Test">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="DE Test">
    <link rel="apple-touch-icon" href="../icons/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="../icons/favicon-32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="../icons/favicon-16.png">
    <link rel="shortcut icon" href="../favicon.ico">

    <script>
        // Anti-flash: apply saved theme before any paint happens
        (function () {
            try {
                var t = localStorage.getItem('theme');
                if (t === 'dark' || t === 'light') {
                    document.documentElement.setAttribute('data-bs-theme', t);
                }
            } catch (e) {}
        })();
    </script>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet">
    ${urduFont}
    <style>
        :root {
            --page-bg: #f5f7fb;
            --page-text: #1f2937;
            --muted-text: #475569;
            --card-bg: #ffffff;
            --card-shadow: 0 0.5rem 1.5rem rgba(15, 23, 42, 0.08);
            --primary: #1d4ed8;
            --primary-hover: #1e40af;
            --border: #e5e7eb;
            --table-stripe: #f8fafc;
            --table-hover: #eaf3ff;
        }
        [data-bs-theme="dark"] {
            --page-bg: #0b1121;
            --page-text: #e2e8f0;
            --muted-text: #94a3b8;
            --card-bg: #111827;
            --card-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.45);
            --primary: #3b82f6;
            --primary-hover: #2563eb;
            --border: #1f2937;
            --table-stripe: #172033;
            --table-hover: #1f2a44;
        }
        body {
            background: var(--page-bg);
            color: var(--page-text);
            ${bodyFont}
        }
        .site-nav {
            background: var(--card-bg);
            border-bottom: 1px solid var(--border);
            padding: 0.75rem 1rem;
            position: sticky;
            top: 0;
            z-index: 1030;
        }
        .site-nav .brand {
            font-weight: 800;
            color: var(--page-text);
            text-decoration: none;
        }
        .nav-actions { display: flex; gap: 0.5rem; align-items: center; }
        .nav-actions .btn-lang, .nav-actions .btn-theme {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--page-text);
            border-radius: 999px;
            padding: 0.35rem 0.9rem;
            font-size: 0.875rem;
            text-decoration: none;
            cursor: pointer;
        }
        .nav-actions .btn-lang:hover, .nav-actions .btn-theme:hover {
            background: var(--primary);
            color: #fff;
            border-color: var(--primary);
        }
        main {
            max-width: 960px;
            margin: 2rem auto;
            padding: 0 1rem;
        }
        .content-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 1rem;
            box-shadow: var(--card-shadow);
            padding: clamp(1.25rem, 3vw, 2.5rem);
        }
        h1, h2, h3, h4 {
            color: var(--page-text);
            font-weight: 700;
        }
        h1 { margin-bottom: 1.25rem; }
        h2 { margin-top: 2rem; margin-bottom: 1rem; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0 1.5rem;
            background: var(--card-bg);
        }
        table th, table td {
            padding: 0.75rem 1rem;
            border: 1px solid var(--border);
            vertical-align: top;
        }
        table th {
            background: var(--primary);
            color: #fff;
            text-align: ${dir === 'rtl' ? 'right' : 'left'};
        }
        table tr:nth-child(even) td { background: var(--table-stripe); }
        table tr:hover td { background: var(--table-hover); }
        code {
            background: var(--table-stripe);
            padding: 0.15rem 0.4rem;
            border-radius: 0.25rem;
            color: var(--primary);
        }
        a { color: var(--primary); }
        a:hover { color: var(--primary-hover); }
        blockquote {
            border-${dir === 'rtl' ? 'right' : 'left'}: 4px solid var(--primary);
            margin: 1rem 0;
            padding: 0.5rem 1rem;
            background: var(--table-stripe);
            color: var(--muted-text);
        }
        footer {
            margin-top: 3rem;
            padding: 1.75rem 1rem 1.5rem;
            background: var(--card-bg);
            border-top: 1px solid var(--border);
            color: var(--muted-text);
            font-size: 0.9rem;
        }
        footer .foot-row {
            max-width: 960px;
            margin: 0 auto;
            padding: 0 1rem;
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            align-items: center;
            justify-content: space-between;
        }
        footer .foot-brand .title {
            font-weight: 600;
            color: var(--page-text);
            margin-bottom: 0.15rem;
        }
        footer .foot-brand .sub {
            font-size: 0.85rem;
        }
        footer .foot-links {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            justify-content: ${dir === 'rtl' ? 'flex-start' : 'flex-end'};
        }
        footer .btn-foot {
            display: inline-block;
            padding: 0.35rem 0.85rem;
            border-radius: 0.4rem;
            border: 1px solid var(--border);
            color: var(--muted-text);
            text-decoration: none;
            font-size: 0.85rem;
            background: transparent;
        }
        footer .btn-foot:hover {
            background: var(--primary);
            color: #fff;
            border-color: var(--primary);
        }
        footer .foot-meta {
            max-width: 960px;
            margin: 1rem auto 0;
            padding: 0 1rem;
            text-align: center;
            font-size: 0.8rem;
            color: var(--muted-text);
        }
        @media (max-width: 600px) {
            footer .foot-row { flex-direction: column; text-align: center; gap: 0.75rem; }
            footer .foot-links { justify-content: center; }
        }
        footer a { text-decoration: none; }
        .nav-pager {
            display: flex;
            flex-wrap: wrap;
            gap: 0.6rem;
            align-items: center;
            justify-content: space-between;
            margin: 1.25rem 0;
            padding: 0.85rem 1rem;
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 0.65rem;
        }
        .nav-pager .pager-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            padding: 0.5rem 0.9rem;
            background: transparent;
            color: var(--page-text);
            border: 1px solid var(--border);
            border-radius: 0.45rem;
            text-decoration: none;
            font-size: 0.9rem;
            font-weight: 500;
            transition: background 0.15s ease, border-color 0.15s ease;
        }
        .nav-pager .pager-btn:hover:not(.disabled) {
            background: var(--primary);
            color: #fff;
            border-color: var(--primary);
        }
        .nav-pager .pager-btn.disabled {
            opacity: 0.4;
            pointer-events: none;
            cursor: not-allowed;
        }
        .nav-pager .pager-jump {
            flex: 1 1 200px;
            min-width: 0;
        }
        .nav-pager--jump-only .pager-jump {
            flex: 1 1 auto;
            width: 100%;
        }
        .nav-pager .pager-jump select {
            width: 100%;
            padding: 0.5rem 0.75rem;
            background: var(--card-bg);
            color: var(--page-text);
            border: 1px solid var(--border);
            border-radius: 0.45rem;
            font-size: 0.9rem;
            font-family: inherit;
            cursor: pointer;
        }
        .nav-pager .pager-jump select:focus {
            outline: 2px solid var(--primary);
            outline-offset: 1px;
        }
        @media (max-width: 600px) {
            .nav-pager { gap: 0.5rem; }
            .nav-pager .pager-btn { font-size: 0.85rem; padding: 0.45rem 0.7rem; }
        }
        .back-to-top {
            position: fixed;
            bottom: 1.5rem;
            ${dir === 'rtl' ? 'left' : 'right'}: 1.5rem;
            width: 3.25rem;
            height: 3.25rem;
            border-radius: 50%;
            background: var(--primary);
            color: #fff;
            border: 2px solid var(--card-bg);
            font-size: 1.5rem;
            font-weight: 700;
            box-shadow: 0 0.5rem 1.25rem rgba(0, 0, 0, 0.35);
            cursor: pointer;
            opacity: 0;
            pointer-events: none;
            transform: translateY(0.5rem);
            transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s ease;
            z-index: 1050;
            display: flex;
            align-items: center;
            justify-content: center;
            line-height: 1;
        }
        .back-to-top.visible {
            opacity: 1;
            pointer-events: auto;
            transform: translateY(0);
        }
        .back-to-top:hover { background: var(--primary-hover); }
    </style>
</head>
<body>
    <nav class="site-nav">
        <div class="container-fluid d-flex justify-content-between align-items-center">
            <a class="brand" href="./index.html">${escapeHtml(ui.siteTitle)}</a>
            <div class="nav-actions">
                <a class="btn-lang" href="../${otherLang}/${slug}.html" title="${escapeHtml(ui.pickerHint)}">${escapeHtml(ui.switchTo)}</a>
                <button class="btn-theme" id="themeToggle" aria-label="Toggle theme">🌓</button>
            </div>
        </div>
    </nav>

    <main>
        <p><a href="${slug === 'index' ? '../index.html?stay' : './index.html'}">${escapeHtml(slug === 'index' ? ui.changeLang : ui.back)}</a></p>
        ${renderNavPager({ lang, slug })}
        <article class="content-card">
            ${bodyHtml}
        </article>
        ${renderNavPager({ lang, slug })}
    </main>

    <footer>
        <div class="foot-row">
            <div class="foot-brand">
                <div class="title">${escapeHtml(ui.footerTagline)}</div>
                <div class="sub">${escapeHtml(ui.footerSubtag)}</div>
            </div>
            <div class="foot-links">
                <a class="btn-foot" href="${BAMF_CATALOG_URL}" target="_blank" rel="noopener">${escapeHtml(ui.bamfCatalog)}</a>
                <a class="btn-foot" href="${BAMF_TEST_CENTER_URL}" target="_blank" rel="noopener">${escapeHtml(ui.bamfTestCenter)}</a>
                <a class="btn-foot" href="${GITHUB_URL}" target="_blank" rel="noopener">${escapeHtml(ui.starLabel)}</a>
                <a class="btn-foot" href="${PAYPAL_URL}" target="_blank" rel="noopener">${escapeHtml(ui.supportBtn)}</a>
                <a class="btn-foot" href="../privacy.html">${escapeHtml(ui.privacyLink)}</a>
            </div>
        </div>
        <div class="foot-meta">${escapeHtml(ui.lastUpdated)}: ${BUILD_DATE}</div>
    </footer>

    <button class="back-to-top" id="backToTop" aria-label="${escapeHtml(ui.backToTop)}" title="${escapeHtml(ui.backToTop)}">↑</button>

    <script>
        // Theme already applied by inline script in <head> — this handles the toggle click
        const root = document.documentElement;
        document.getElementById('themeToggle').addEventListener('click', () => {
            const next = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-bs-theme', next);
            try { localStorage.setItem('theme', next); } catch (e) {}
        });

        // Back-to-top button — appears once user scrolls a bit
        const btt = document.getElementById('backToTop');
        const toggleBtt = () => btt.classList.toggle('visible', window.scrollY > 120);
        window.addEventListener('scroll', toggleBtt, { passive: true });
        toggleBtt();
        btt.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        // Register PWA service worker — enables offline study mode
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('../sw.js').catch(() => {});
            });
        }
    </script>

    <!-- Cloudflare Web Analytics (privacy-friendly, no cookies, GDPR-compliant) -->
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${CLOUDFLARE_ANALYTICS_TOKEN}"}'></script>
</body>
</html>`;
}

// ---------- Per-language index page ----------
function renderIndex({ lang, slugs }) {
    const ui = UI[lang];
    const titles = TITLES[lang];
    const questionSlugs = slugs.filter(s => s.startsWith('questions-')).sort();
    const stateSlugs = slugs.filter(s => !s.startsWith('questions-')).sort();

    const listItems = arr => arr.map(s => {
        const t = titles[s] || s;
        return `<li><a href="./${s}.html">${escapeHtml(t)}</a></li>`;
    }).join('\n        ');

    const body = `
        <h1>${escapeHtml(ui.siteTitle)}</h1>
        <p class="lead" style="color: var(--muted-text);">${escapeHtml(ui.tagline)}</p>

        <h2>${escapeHtml(ui.questionsHeading)}</h2>
        <ul>
        ${listItems(questionSlugs)}
        </ul>

        <h2>${escapeHtml(ui.statesHeading)}</h2>
        <ul>
        ${listItems(stateSlugs)}
        </ul>
    `;

    return renderPage({ lang, title: ui.siteTitle, bodyHtml: body, slug: 'index' });
}

// ---------- Helpers ----------
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function slugFromFile(filename) {
    return filename.replace(/\.md$/i, '');
}

// ---------- Main ----------
function buildLang(lang) {
    const srcDir = SOURCES[lang];
    const outDir = OUTPUTS[lang];

    if (!fs.existsSync(srcDir)) {
        console.error(`✗ Source missing for ${lang}: ${srcDir}`);
        console.error(`  Clone the ${lang === 'en' ? 'english' : 'urdu'} branch there first.`);
        process.exit(1);
    }

    ensureDir(outDir);

    const mdFiles = fs.readdirSync(srcDir)
        .filter(f => f.endsWith('.md') && !EXCLUDE.has(f));

    const slugs = [];
    let readmeHtml = null;

    for (const file of mdFiles) {
        const slug = slugFromFile(file);
        const isReadme = /^README$/i.test(slug);
        const md = fs.readFileSync(path.join(srcDir, file), 'utf8');
        // Ensure a blank line before `---` separators so they render as
        // horizontal rules, not as setext-style h2 underlines.
        const preprocessed = md.replace(/([^\n])\n---\s*$/gm, '$1\n\n---');
        let bodyHtml = marked.parse(preprocessed);

        // Rewrite internal .md links for the static site:
        //   README.md   → index.html  (per-language home)
        //   anything.md → anything.html
        bodyHtml = bodyHtml.replace(
            /href="(?!https?:\/\/|mailto:|#)([^"#]+)\.md(#[^"]*)?"/g,
            (match, name, anchor) => {
                const target = /^README$/i.test(name) ? 'index' : name;
                return `href="${target}.html${anchor || ''}"`;
            }
        );

        // Rewrite GitHub "blob" links to local site paths:
        //   .../blob/english/questions-001-050.md → ./questions-001-050.html (same lang)
        //                                       or → ../en/... (cross lang)
        //   .../blob/urdu/README.md              → ../ur/index.html   etc.
        bodyHtml = bodyHtml.replace(
            /href="https?:\/\/github\.com\/[^/]+\/[^/"]+\/blob\/(english|urdu)\/([^"#]+)\.md(#[^"]*)?"/g,
            (match, branch, name, anchor) => {
                const branchCode = branch === 'english' ? 'en' : 'ur';
                const target = /^README$/i.test(name) ? 'index' : name;
                const path = branchCode === lang
                    ? `./${target}.html`
                    : `../${branchCode}/${target}.html`;
                return `href="${path}${anchor || ''}"`;
            }
        );

        if (isReadme) {
            // Strip the "Support This Project" section from the README — our footer
            // adds its own support CTA on every page, so we avoid duplication here.
            bodyHtml = bodyHtml.replace(/<h2[^>]*>[^<]*Support[^<]*<\/h2>[\s\S]*$/i, '');
            // README content becomes the index page body — don't emit README.html
            readmeHtml = bodyHtml;
            continue;
        }

        const title = (TITLES[lang][slug]) || slug;
        const html = renderPage({ lang, title, bodyHtml, slug });
        fs.writeFileSync(path.join(outDir, `${slug}.html`), html);
        slugs.push(slug);
        console.log(`  ✓ ${lang}/${slug}.html`);
    }

    // Per-language index: prefer README content, fall back to auto-generated list
    const indexHtml = readmeHtml
        ? renderPage({ lang, title: UI[lang].siteTitle, bodyHtml: readmeHtml, slug: 'index' })
        : renderIndex({ lang, slugs });
    fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml);
    console.log(`  ✓ ${lang}/index.html`);
}

function main() {
    console.log('Building bilingual site...\n');
    for (const lang of ['en', 'ur']) {
        console.log(`[${lang}]`);
        buildLang(lang);
    }
    // Make sure GitHub Pages doesn't treat this as Jekyll
    fs.writeFileSync(path.join(ROOT, '.nojekyll'), '');
    console.log('\n✓ .nojekyll written');
    console.log('\nDone. Commit and push the `html` branch, then enable GitHub Pages.');
}

main();
