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
        supportHeading: '☕ Support This Project',
        supportText: 'This project is completely free and open source. If it helped you pass your test, you can optionally buy me a coffee — no obligation at all!',
        donateLabel: 'Donate via PayPal',
        starLabel: '⭐ Star on GitHub',
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
        supportHeading: '☕ اس پروجیکٹ کی مدد کریں',
        supportText: 'یہ پروجیکٹ مکمل طور پر مفت اور اوپن سورس ہے۔ اگر اس نے آپ کو امتحان پاس کرنے میں مدد کی، تو آپ مجھے ایک کافی خرید سکتے ہیں — کوئی ذمہ داری نہیں!',
        donateLabel: 'PayPal کے ذریعے عطیہ',
        starLabel: '⭐ GitHub پر اسٹار کریں',
    },
};

const GITHUB_URL = 'https://github.com/abdullahbutt/german-citizenship-test-english-urdu';
const PAYPAL_URL = 'https://paypal.me/abdullahbuttde';

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
            padding: 2.5rem 1rem 2rem;
            background: var(--card-bg);
            border-top: 1px solid var(--border);
            color: var(--muted-text);
            font-size: 0.95rem;
        }
        footer .support-box {
            max-width: 640px;
            margin: 0 auto 1.5rem;
            padding: 1.5rem;
            background: linear-gradient(135deg, #fef3c7, #fde68a);
            border: 1px solid #f59e0b;
            border-radius: 0.75rem;
            text-align: center;
            color: #1f2937;
        }
        [data-bs-theme="dark"] footer .support-box {
            background: linear-gradient(135deg, #78350f, #92400e);
            border-color: #b45309;
            color: #fef3c7;
        }
        footer .support-box h3 {
            margin-top: 0;
            margin-bottom: 0.5rem;
            font-size: 1.15rem;
            font-weight: 700;
        }
        footer .support-box p {
            margin-bottom: 1rem;
            font-size: 0.95rem;
        }
        footer .btn-pill {
            display: inline-block;
            padding: 0.5rem 1.25rem;
            border-radius: 999px;
            font-weight: 600;
            text-decoration: none;
            margin: 0.25rem;
            border: 1px solid transparent;
            font-size: 0.9rem;
        }
        footer .btn-paypal {
            background: #0070ba;
            color: #fff;
        }
        footer .btn-paypal:hover { background: #005a96; color: #fff; }
        footer .btn-github {
            background: transparent;
            color: var(--page-text);
            border-color: var(--border);
        }
        footer .btn-github:hover {
            background: var(--page-text);
            color: var(--page-bg);
        }
        footer a { text-decoration: none; }
        .back-to-top {
            position: fixed;
            bottom: 1.5rem;
            ${dir === 'rtl' ? 'left' : 'right'}: 1.5rem;
            width: 3rem;
            height: 3rem;
            border-radius: 50%;
            background: var(--primary);
            color: #fff;
            border: 0;
            font-size: 1.25rem;
            box-shadow: 0 0.25rem 0.75rem rgba(0, 0, 0, 0.2);
            cursor: pointer;
            opacity: 0;
            pointer-events: none;
            transform: translateY(0.5rem);
            transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s ease;
            z-index: 1040;
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
        <article class="content-card">
            ${bodyHtml}
        </article>
    </main>

    <footer>
        <div class="support-box">
            <h3>${escapeHtml(ui.supportHeading)}</h3>
            <p>${escapeHtml(ui.supportText)}</p>
            <a class="btn-pill btn-paypal" href="${PAYPAL_URL}" target="_blank" rel="noopener">${escapeHtml(ui.donateLabel)}</a>
            <a class="btn-pill btn-github" href="${GITHUB_URL}" target="_blank" rel="noopener">${escapeHtml(ui.starLabel)}</a>
        </div>
    </footer>

    <button class="back-to-top" id="backToTop" aria-label="${escapeHtml(ui.backToTop)}" title="${escapeHtml(ui.backToTop)}">↑</button>

    <script>
        const root = document.documentElement;
        try {
            const saved = localStorage.getItem('theme');
            if (saved) root.setAttribute('data-bs-theme', saved);
        } catch (e) {}
        document.getElementById('themeToggle').addEventListener('click', () => {
            const next = root.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-bs-theme', next);
            try { localStorage.setItem('theme', next); } catch (e) {}
        });

        // Back-to-top button
        const btt = document.getElementById('backToTop');
        const toggleBtt = () => btt.classList.toggle('visible', window.scrollY > 300);
        window.addEventListener('scroll', toggleBtt, { passive: true });
        toggleBtt();
        btt.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    </script>
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
