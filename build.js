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
const { generateQuizData } = require('./generate-quiz');

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
        randomBtn: '🎲 Random Question',
        printBtn: '🖨️ Print / Save PDF',
        reportBtn: '⚠️ Report an error',
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
        randomBtn: '🎲 بے ترتیب سوال',
        printBtn: '🖨️ پرنٹ / PDF محفوظ کریں',
        reportBtn: '⚠️ غلطی کی اطلاع دیں',
    },
};

const GITHUB_URL = 'https://github.com/abdullahbutt/german-citizenship-test-english-urdu';
const PAYPAL_URL = 'https://paypal.me/abdullahbuttde';
const BAMF_CATALOG_URL = 'https://www.bamf.de/SharedDocs/Anlagen/DE/Integration/Einbuergerung/gesamtfragenkatalog-lebenindeutschland.html';
const BAMF_TEST_CENTER_URL = 'https://oet.bamf.de/ords/oetut/f?p=514:1::::::';
const BUILD_DATE = new Date().toISOString().slice(0, 10);
const SITE_BASE_URL = 'https://abdullahbutt.github.io/german-citizenship-test-english-urdu';
const OG_IMAGE_URL = `${SITE_BASE_URL}/og-image.png`;
const OG_IMAGE_DARK_URL = `${SITE_BASE_URL}/og-image-dark.png`;
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
                <option value="../quiz.html">🎯 ${lang === 'ur' ? 'کوئز / مشق' : lang === 'de' ? 'Quiz / Üben' : 'Practice Quiz'}</option>
                ${optgroup(ui.navQuestions, ORDERED_QUESTIONS)}
                ${optgroup(ui.navStates, ORDERED_STATES)}
            </select>
        </div>`;

    // Index page: jump-only variant + random button
    if (slug === 'index') {
        return `
        <nav class="nav-pager nav-pager--jump-only" aria-label="Quick jump">
            ${jumpSelect}
            <button class="pager-btn" onclick="goRandom()" style="white-space:nowrap;">${escapeHtml(ui.randomBtn)}</button>
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
            <button class="pager-btn" onclick="goRandom()" style="white-space:nowrap;">${escapeHtml(ui.randomBtn)}</button>
            ${nextBtn}
        </nav>`;
}

// ---------- SEO helpers ----------

// Per-page meta description optimised for search snippets in all 3 languages.
const META_DESCS = {
    en: {
        'index':               'Free study guide for the German citizenship test (Einbürgerungstest / Leben in Deutschland). All 300+ official questions with English & Urdu translations, correct answers highlighted, and explanations for every question.',
        'questions-001-050':   'Einbürgerungstest questions 1–50 with English translations and explanations. Topics: democracy, fundamental rights, rule of law. Free prep guide.',
        'questions-051-100':   'Einbürgerungstest questions 51–100 with English translations. Topics: German history, Nazi era, East/West Germany. Free prep guide.',
        'questions-101-150':   'Einbürgerungstest questions 101–150 with English translations. Topics: German federal system, Bundesrat, Bundestag. Free prep guide.',
        'questions-151-200':   'Einbürgerungstest questions 151–200 with English translations. Topics: social welfare, health insurance, education. Free prep guide.',
        'questions-201-250':   'Einbürgerungstest questions 201–250 with English translations. Topics: culture, religion, society in Germany. Free prep guide.',
        'questions-251-300':   'Einbürgerungstest questions 251–300 with English translations. Topics: geography, economy, state-specific transition. Free prep guide.',
        'baden-wuerttemberg':  'State-specific Einbürgerungstest questions for Baden-Württemberg (questions 301–310) with English translations. Capital: Stuttgart.',
        'bayern':              'State-specific Einbürgerungstest questions for Bavaria (Bayern, questions 301–310) with English translations. Capital: Munich.',
        'berlin':              'State-specific Einbürgerungstest questions for Berlin (questions 301–310) with English translations. Berlin is Germany\'s capital and a city-state.',
        'brandenburg':         'State-specific Einbürgerungstest questions for Brandenburg (questions 301–310) with English translations. Capital: Potsdam.',
        'bremen':              'State-specific Einbürgerungstest questions for Bremen (questions 301–310) with English translations. Germany\'s smallest state by population.',
        'hamburg':             'State-specific Einbürgerungstest questions for Hamburg (questions 301–310) with English translations. Germany\'s second-largest city.',
        'hessen':              'State-specific Einbürgerungstest questions for Hesse (Hessen, questions 301–310) with English translations. Capital: Wiesbaden.',
        'mecklenburg-vorpommern': 'State-specific Einbürgerungstest questions for Mecklenburg-Vorpommern (questions 301–310) with English translations. Capital: Schwerin.',
        'niedersachsen':       'State-specific Einbürgerungstest questions for Lower Saxony (Niedersachsen, questions 301–310) with English translations. Capital: Hanover.',
        'nordrhein-westfalen': 'State-specific Einbürgerungstest questions for North Rhine-Westphalia (questions 301–310) with English translations. Capital: Düsseldorf.',
        'rheinland-pfalz':     'State-specific Einbürgerungstest questions for Rhineland-Palatinate (questions 301–310) with English translations. Capital: Mainz.',
        'saarland':            'State-specific Einbürgerungstest questions for Saarland (questions 301–310) with English translations. Capital: Saarbrücken.',
        'sachsen':             'State-specific Einbürgerungstest questions for Saxony (Sachsen, questions 301–310) with English translations. Capital: Dresden.',
        'sachsen-anhalt':      'State-specific Einbürgerungstest questions for Saxony-Anhalt (questions 301–310) with English translations. Capital: Magdeburg.',
        'schleswig-holstein':  'State-specific Einbürgerungstest questions for Schleswig-Holstein (questions 301–310) with English translations. Capital: Kiel.',
        'thueringen':          'State-specific Einbürgerungstest questions for Thuringia (Thüringen, questions 301–310) with English translations. Capital: Erfurt.',
    },
    ur: {
        'index':               'جرمن شہریت کے امتحان (Einbürgerungstest / Leben in Deutschland) کے لیے مفت گائیڈ۔ تمام 300 سرکاری سوالات اردو اور انگریزی ترجمے، درست جوابات، اور ہر سوال کی وضاحت کے ساتھ۔',
        'questions-001-050':   'Einbürgerungstest کے سوالات 1–50 اردو ترجمے اور وضاحت کے ساتھ۔ موضوعات: جمہوریت، بنیادی حقوق، قانون کی حکمرانی۔',
        'questions-051-100':   'Einbürgerungstest کے سوالات 51–100 اردو ترجمے کے ساتھ۔ موضوعات: جرمن تاریخ، نازی دور، مشرقی/مغربی جرمنی۔',
        'questions-101-150':   'Einbürgerungstest کے سوالات 101–150 اردو ترجمے کے ساتھ۔ موضوعات: جرمن وفاقی نظام، Bundesrat، Bundestag۔',
        'questions-151-200':   'Einbürgerungstest کے سوالات 151–200 اردو ترجمے کے ساتھ۔ موضوعات: سماجی فلاح، صحت، تعلیم۔',
        'questions-201-250':   'Einbürgerungstest کے سوالات 201–250 اردو ترجمے کے ساتھ۔ موضوعات: ثقافت، مذہب، جرمن معاشرہ۔',
        'questions-251-300':   'Einbürgerungstest کے سوالات 251–300 اردو ترجمے کے ساتھ۔ موضوعات: جغرافیہ، معیشت۔',
        'berlin':              'برلن کے لیے مخصوص Einbürgerungstest سوالات (301–310) اردو ترجمے کے ساتھ۔ دارالحکومت: برلن۔',
        'hessen':              'ہیسن کے لیے مخصوص Einbürgerungstest سوالات (301–310) اردو ترجمے کے ساتھ۔ دارالحکومت: وِسبادن۔',
        'hamburg':             'ہیمبرگ کے لیے مخصوص Einbürgerungstest سوالات (301–310) اردو ترجمے کے ساتھ۔',
        'nordrhein-westfalen': 'نارڈرائن ویسٹ فالن کے لیے مخصوص Einbürgerungstest سوالات (301–310) اردو ترجمے کے ساتھ۔ دارالحکومت: ڈوسلڈورف۔',
    },
    de: {
        'index':               'Kostenloser Lernführer für den Einbürgerungstest / Leben in Deutschland. Alle 300+ offiziellen Fragen mit Übersetzungen auf Englisch und Urdu, Antworten markiert und Erklärungen zu jeder Frage.',
        'questions-001-050':   'Einbürgerungstest Fragen 1–50 mit Erklärungen. Themen: Demokratie, Grundrechte, Rechtsstaat. Kostenlose Prüfungsvorbereitung mit englischer und Urdu-Übersetzung.',
        'questions-051-100':   'Einbürgerungstest Fragen 51–100. Themen: deutsche Geschichte, NS-Zeit, DDR und BRD. Kostenlose Prüfungsvorbereitung mit Übersetzungen.',
        'questions-101-150':   'Einbürgerungstest Fragen 101–150. Themen: Bundesrat, Bundestag, föderales System. Kostenlose Vorbereitung auf den Leben-in-Deutschland-Test.',
        'questions-151-200':   'Einbürgerungstest Fragen 151–200. Themen: Sozialversicherung, Krankenversicherung, Bildungssystem. Kostenlose Prüfungsvorbereitung.',
        'questions-201-250':   'Einbürgerungstest Fragen 201–250. Themen: Kultur, Religion, Gesellschaft in Deutschland. Kostenlose Vorbereitung mit englischer Übersetzung.',
        'questions-251-300':   'Einbürgerungstest Fragen 251–300. Themen: Geographie, Wirtschaft, Staatsbürgerschaftspflichten. Kostenlose Prüfungsvorbereitung.',
        'baden-wuerttemberg':  'Einbürgerungstest Fragen für Baden-Württemberg (Fragen 301–310). Landeshauptstadt Stuttgart. Kostenlose Vorbereitung mit englischer und Urdu-Übersetzung.',
        'bayern':              'Einbürgerungstest Fragen für Bayern (Fragen 301–310). Landeshauptstadt München. Kostenlose Vorbereitung auf den Leben-in-Deutschland-Test.',
        'berlin':              'Einbürgerungstest Fragen für Berlin (Fragen 301–310). Berlin ist Bundeshauptstadt und Stadtstaat zugleich. Kostenlose Prüfungsvorbereitung.',
        'brandenburg':         'Einbürgerungstest Fragen für Brandenburg (Fragen 301–310). Landeshauptstadt Potsdam. Kostenlose Vorbereitung mit Übersetzungen.',
        'bremen':              'Einbürgerungstest Fragen für Bremen (Fragen 301–310). Kleinstes Bundesland nach Einwohnerzahl. Kostenlose Prüfungsvorbereitung.',
        'hamburg':             'Einbürgerungstest Fragen für Hamburg (Fragen 301–310). Größter Hafen Deutschlands, Stadtstaat. Kostenlose Prüfungsvorbereitung.',
        'hessen':              'Einbürgerungstest Fragen für Hessen (Fragen 301–310). Landeshauptstadt Wiesbaden, Finanzmetropole Frankfurt. Kostenlose Prüfungsvorbereitung.',
        'mecklenburg-vorpommern': 'Einbürgerungstest Fragen für Mecklenburg-Vorpommern (Fragen 301–310). Landeshauptstadt Schwerin. Kostenlose Prüfungsvorbereitung.',
        'niedersachsen':       'Einbürgerungstest Fragen für Niedersachsen (Fragen 301–310). Landeshauptstadt Hannover. Zweitgrößtes Bundesland. Kostenlose Prüfungsvorbereitung.',
        'nordrhein-westfalen': 'Einbürgerungstest Fragen für Nordrhein-Westfalen (Fragen 301–310). Bevölkerungsreichstes Bundesland, Landeshauptstadt Düsseldorf. Kostenlose Vorbereitung.',
        'rheinland-pfalz':     'Einbürgerungstest Fragen für Rheinland-Pfalz (Fragen 301–310). Landeshauptstadt Mainz, bekannt für Weinanbau. Kostenlose Prüfungsvorbereitung.',
        'saarland':            'Einbürgerungstest Fragen für das Saarland (Fragen 301–310). Landeshauptstadt Saarbrücken, grenzt an Frankreich und Luxemburg. Kostenlose Vorbereitung.',
        'sachsen':             'Einbürgerungstest Fragen für Sachsen (Fragen 301–310). Landeshauptstadt Dresden. Bekannt für Barockarchitektur. Kostenlose Prüfungsvorbereitung.',
        'sachsen-anhalt':      'Einbürgerungstest Fragen für Sachsen-Anhalt (Fragen 301–310). Landeshauptstadt Magdeburg. Reformationsland Martin Luthers. Kostenlose Vorbereitung.',
        'schleswig-holstein':  'Einbürgerungstest Fragen für Schleswig-Holstein (Fragen 301–310). Landeshauptstadt Kiel, zwischen Nord- und Ostsee. Kostenlose Prüfungsvorbereitung.',
        'thueringen':          'Einbürgerungstest Fragen für Thüringen (Fragen 301–310). Landeshauptstadt Erfurt. Grünes Herz Deutschlands, Heimat von Goethe und Schiller. Kostenlose Vorbereitung.',
    },
};

// State intro paragraphs — shown above the question table on each state page.
// Provides context for visitors and unique text content for SEO.
const STATE_INTROS = {
    'baden-wuerttemberg': {
        en: 'Baden-Württemberg is located in the southwest of Germany, bordering France and Switzerland. Its capital is <strong>Stuttgart</strong>, home to the Landtag (state parliament). The state is known as an industrial powerhouse — headquarters of Mercedes-Benz, Porsche, Bosch, and SAP are all here. The Black Forest (Schwarzwald) and Lake Constance (Bodensee) are among its most famous natural landmarks. The head of government holds the title of <strong>Ministerpräsident/in</strong>.',
        ur: 'باڈن ورٹمبرگ جنوب مغربی جرمنی میں واقع ہے اور فرانس و سوئٹزرلینڈ سے ملتا ہے۔ اس کا دارالحکومت <strong>اسٹوٹگارٹ</strong> ہے جہاں ریاستی پارلیمان (Landtag) موجود ہے۔ یہ ریاست صنعتی اعتبار سے بہت اہم ہے — Mercedes-Benz، Porsche، Bosch اور SAP کے صدر دفاتر یہاں ہیں۔ سیاہ جنگل (Schwarzwald) اور باڈن سی (Bodensee) مشہور قدرتی مقامات ہیں۔ حکومت کا سربراہ <strong>Ministerpräsident/in</strong> کہلاتا ہے۔',
        de: 'Baden-Württemberg liegt im Südwesten Deutschlands und grenzt an Frankreich und die Schweiz. Die Landeshauptstadt ist <strong>Stuttgart</strong>, Sitz des Landtags. Das Land ist bekannt für seine Industrie — hier haben Mercedes-Benz, Porsche, Bosch und SAP ihren Hauptsitz. Der Schwarzwald und der Bodensee gehören zu den bekanntesten Naturlandschaften. Das Staatsoberhaupt trägt den Titel <strong>Ministerpräsident/in</strong>.',
    },
    'bayern': {
        en: 'Bavaria (Bayern) is the largest German state by area, located in the southeast and bordering Austria and the Czech Republic. The capital is <strong>Munich (München)</strong>, home to the Bayerischer Landtag. Bavaria is known for the Alps, Oktoberfest, BMW, and a strong tradition of arts and culture. The head of government is the <strong>Ministerpräsident/in</strong>. Bavaria has its own strong regional identity and the Bavarian dialect is widely spoken.',
        ur: 'باویریا (Bayern) رقبے کے لحاظ سے جرمنی کی سب سے بڑی ریاست ہے، جنوب مشرق میں واقع ہے اور آسٹریا و چیک ریپبلک سے ملتی ہے۔ دارالحکومت <strong>میونخ (München)</strong> ہے جہاں Bayerischer Landtag قائم ہے۔ باویریا آلپس پہاڑوں، Oktoberfest، BMW اور فنون و ثقافت کے لیے مشہور ہے۔ سربراہ حکومت کا عہدہ <strong>Ministerpräsident/in</strong> ہے۔ باویریا کی اپنی مضبوط علاقائی شناخت اور زبان (Bavarian) ہے۔',
        de: 'Bayern ist das flächenmäßig größte Bundesland Deutschlands im Südosten, das an Österreich und Tschechien grenzt. Die Landeshauptstadt ist <strong>München</strong>, Sitz des Bayerischen Landtags. Bayern ist bekannt für die Alpen, das Oktoberfest, BMW und eine starke Kulturlandschaft. Das Staatsoberhaupt ist der <strong>Ministerpräsident/in</strong>. Bayern pflegt eine ausgeprägte regionale Identität.',
    },
    'berlin': {
        en: 'Berlin is Germany\'s <strong>capital city</strong> and simultaneously a federal state (city-state). Its parliament is called the <strong>Abgeordnetenhaus</strong> and the head of government is the <strong>Regierender Bürgermeister/in</strong>. Berlin was divided by the Berlin Wall from 1961 until 1989. After reunification in 1990 it became the capital of reunified Germany. It is home to the Bundestag, Brandenburg Gate, and numerous world-class museums and cultural institutions.',
        ur: 'برلن جرمنی کا <strong>دارالحکومت</strong> اور بیک وقت ایک وفاقی ریاست (شہری ریاست) بھی ہے۔ اس کی پارلیمان <strong>Abgeordnetenhaus</strong> کہلاتی ہے اور حکومت کا سربراہ <strong>Regierender Bürgermeister/in</strong> ہوتا ہے۔ برلن 1961 سے 1989 تک دیوارِ برلن سے تقسیم رہا۔ 1990 میں جرمنی کے اتحاد کے بعد یہ متحدہ جرمنی کا دارالحکومت بنا۔ یہاں Bundestag، برانڈنبرگ گیٹ اور عالمی سطح کے عجائب گھر موجود ہیں۔',
        de: 'Berlin ist gleichzeitig <strong>Bundeshauptstadt</strong> und Bundesland (Stadtstaat). Das Landesparlament heißt <strong>Abgeordnetenhaus</strong>, das Staatsoberhaupt ist der/die <strong>Regierende Bürgermeister/in</strong>. Von 1961 bis 1989 war Berlin durch die Berliner Mauer geteilt. Nach der Wiedervereinigung 1990 wurde es wieder Hauptstadt Gesamtdeutschlands. Hier befinden sich der Bundestag, das Brandenburger Tor und viele weltbekannte Museen.',
    },
    'brandenburg': {
        en: 'Brandenburg surrounds the city-state of Berlin and is located in northeastern Germany. Its capital is <strong>Potsdam</strong>, famous for the Sanssouci Palace (UNESCO World Heritage Site) and the <strong>Landtag</strong>. The state is characterised by vast forests, more than 3,000 lakes, and the Spreewald biosphere reserve. The head of government holds the title of <strong>Ministerpräsident/in</strong>. Brandenburg was part of East Germany (GDR) before reunification in 1990.',
        ur: 'برانڈنبرگ شہری ریاست برلن کو چاروں طرف سے گھیرے ہوئے ہے اور شمال مشرقی جرمنی میں واقع ہے۔ اس کا دارالحکومت <strong>پوٹسڈام</strong> ہے جو Sanssouci محل (یونیسکو عالمی ورثہ) اور <strong>Landtag</strong> کے لیے مشہور ہے۔ یہ ریاست وسیع جنگلات، 3000 سے زیادہ جھیلوں اور Spreewald کے لیے جانی جاتی ہے۔ حکومت کا سربراہ <strong>Ministerpräsident/in</strong> ہے۔ برانڈنبرگ 1990 کے اتحاد سے پہلے مشرقی جرمنی (GDR) کا حصہ تھا۔',
        de: 'Brandenburg umschließt den Stadtstaat Berlin und liegt in Nordostdeutschland. Die Landeshauptstadt ist <strong>Potsdam</strong>, bekannt für Schloss Sanssouci (UNESCO-Welterbe) und den <strong>Landtag</strong>. Das Land zeichnet sich durch weite Wälder, über 3.000 Seen und den Spreewald aus. Das Staatsoberhaupt trägt den Titel <strong>Ministerpräsident/in</strong>. Brandenburg gehörte vor der Wiedervereinigung 1990 zur DDR.',
    },
    'bremen': {
        en: 'Bremen is Germany\'s <strong>smallest state by population</strong> and consists of two cities: Bremen and Bremerhaven. It is a city-state and one of the oldest trading cities in Germany. Its parliament is called the <strong>Bremische Bürgerschaft</strong> and the head of government is the <strong>Bürgermeister/in (Senatspräsident/in)</strong>. The port of Bremen and Bremerhaven handles a significant share of German foreign trade. The Bremen Town Musicians statue is one of Germany\'s most photographed sculptures.',
        ur: 'بریمن آبادی کے لحاظ سے جرمنی کی <strong>سب سے چھوٹی ریاست</strong> ہے اور دو شہروں پر مشتمل ہے: بریمن اور بریمرہافن۔ یہ ایک شہری ریاست اور جرمنی کے قدیم ترین تجارتی شہروں میں سے ایک ہے۔ اس کی پارلیمان <strong>Bremische Bürgerschaft</strong> کہلاتی ہے اور حکومت کا سربراہ <strong>Bürgermeister/in (Senatspräsident/in)</strong> ہوتا ہے۔ بریمن بندرگاہ جرمن تجارت میں اہم کردار ادا کرتی ہے۔',
        de: 'Bremen ist Deutschlands <strong>kleinstes Bundesland nach Einwohnerzahl</strong> und besteht aus zwei Städten: Bremen und Bremerhaven. Als Stadtstaat ist es eine der ältesten Handelsstädte Deutschlands. Das Landesparlament heißt <strong>Bremische Bürgerschaft</strong>, das Staatsoberhaupt ist der/die <strong>Bürgermeister/in (Senatspräsident/in)</strong>. Die Häfen Bremen und Bremerhaven wickeln bedeutende Teile des deutschen Außenhandels ab.',
    },
    'hamburg': {
        en: 'Hamburg is Germany\'s <strong>second-largest city</strong> and a city-state. It is home to Germany\'s largest port and is one of the most important trading hubs in Europe. Its parliament is called the <strong>Bürgerschaft</strong> and the head of government is the <strong>Erster Bürgermeister/in (Senatspräsident/in)</strong>. Hamburg has a rich maritime history and is known for the Speicherstadt warehouse district (UNESCO World Heritage Site), the Elbphilharmonie concert hall, and the Reeperbahn entertainment quarter.',
        ur: 'ہیمبرگ جرمنی کا <strong>دوسرا سب سے بڑا شہر</strong> اور ایک شہری ریاست ہے۔ یہ جرمنی کی سب سے بڑی بندرگاہ کا گھر ہے اور یورپ کے اہم ترین تجارتی مراکز میں سے ایک ہے۔ اس کی پارلیمان <strong>Bürgerschaft</strong> ہے اور حکومت کا سربراہ <strong>Erster Bürgermeister/in (Senatspräsident/in)</strong> ہے۔ Speicherstadt (یونیسکو ورثہ)، Elbphilharmonie اور Reeperbahn مشہور مقامات ہیں۔',
        de: 'Hamburg ist Deutschlands <strong>zweitgrößte Stadt</strong> und ein Stadtstaat. Es beherbergt den größten deutschen Hafen und ist eines der wichtigsten Handelszentren Europas. Das Landesparlament heißt <strong>Bürgerschaft</strong>, das Staatsoberhaupt ist der/die <strong>Erste Bürgermeister/in (Senatspräsident/in)</strong>. Die Speicherstadt (UNESCO-Welterbe), die Elbphilharmonie und die Reeperbahn sind bekannte Wahrzeichen.',
    },
    'hessen': {
        en: 'Hesse (Hessen) is located in central Germany. Its capital is <strong>Wiesbaden</strong>, seat of the <strong>Landtag</strong>, while Frankfurt am Main — though not the capital — is Germany\'s financial centre and home to the European Central Bank (ECB) and Frankfurt Stock Exchange (Deutsche Börse). The head of government holds the title of <strong>Ministerpräsident/in</strong>. Hesse is one of Germany\'s most economically important states and Frankfurt Airport is a major European hub.',
        ur: 'ہیسن وسطی جرمنی میں واقع ہے۔ اس کا دارالحکومت <strong>وِسبادن</strong> ہے جہاں <strong>Landtag</strong> قائم ہے، جبکہ فرینکفرٹ — جو دارالحکومت نہیں — جرمنی کا مالیاتی مرکز اور یورپی مرکزی بینک (ECB) اور Frankfurt Stock Exchange کا گھر ہے۔ سربراہ حکومت کا عہدہ <strong>Ministerpräsident/in</strong> ہے۔ ہیسن جرمنی کی اقتصادی اعتبار سے اہم ترین ریاستوں میں سے ایک ہے۔',
        de: 'Hessen liegt in Mitteldeutschland. Die Landeshauptstadt ist <strong>Wiesbaden</strong>, Sitz des <strong>Landtags</strong>. Frankfurt am Main — obwohl nicht Landeshauptstadt — ist Deutschlands Finanzzentrum und Sitz der Europäischen Zentralbank (EZB) und der Deutschen Börse. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>. Der Flughafen Frankfurt ist einer der wichtigsten Drehkreuze Europas.',
    },
    'mecklenburg-vorpommern': {
        en: 'Mecklenburg-Vorpommern is located in northeastern Germany along the Baltic Sea coast. Its capital is <strong>Schwerin</strong>, home to the <strong>Landtag</strong> and the beautiful Schwerin Palace. The state is characterised by its long coastline, thousands of lakes, and the islands of Rügen and Usedom — popular holiday destinations. The head of government holds the title of <strong>Ministerpräsident/in</strong>. Tourism and agriculture are among the key economic sectors.',
        ur: 'میکلنبرگ-فورپومرن شمال مشرقی جرمنی میں بالٹک سمندر کے ساحل پر واقع ہے۔ اس کا دارالحکومت <strong>شوَرین</strong> ہے جہاں <strong>Landtag</strong> اور خوبصورت Schwerin محل ہے۔ یہ ریاست لمبے ساحل، ہزاروں جھیلوں اور جزائر Rügen و Usedom کی وجہ سے مشہور ہے۔ حکومت کا سربراہ <strong>Ministerpräsident/in</strong> ہے۔ سیاحت اور زراعت اہم اقتصادی شعبے ہیں۔',
        de: 'Mecklenburg-Vorpommern liegt im Nordosten Deutschlands an der Ostseeküste. Die Landeshauptstadt ist <strong>Schwerin</strong>, Sitz des <strong>Landtags</strong> und des prächtigen Schweriner Schlosses. Das Land ist bekannt für seine lange Küstenlinie, tausende Seen und die Inseln Rügen und Usedom. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>. Tourismus und Landwirtschaft sind wichtige Wirtschaftszweige.',
    },
    'niedersachsen': {
        en: 'Lower Saxony (Niedersachsen) is Germany\'s <strong>second-largest state by area</strong>, located in northwestern Germany. Its capital is <strong>Hanover (Hannover)</strong>, seat of the <strong>Landtag</strong>. Volkswagen is headquartered in Wolfsburg, making the automotive industry central to the state\'s economy. Lower Saxony also has important agricultural land and North Sea coastline. The head of government is the <strong>Ministerpräsident/in</strong>. The Hanover Messe is the world\'s largest industrial trade fair.',
        ur: 'نیڈرزاخسن رقبے کے لحاظ سے جرمنی کی <strong>دوسری سب سے بڑی ریاست</strong> ہے اور شمال مغربی جرمنی میں واقع ہے۔ اس کا دارالحکومت <strong>ہینووَر (Hannover)</strong> ہے جہاں <strong>Landtag</strong> قائم ہے۔ Volkswagen کا صدر دفتر ولفسبرگ میں ہے جو آٹوموبائل صنعت کو مرکزی حیثیت دیتا ہے۔ ریاست کا شمالی سمندری ساحل اور زرعی اراضی بھی اہم ہیں۔ سربراہ حکومت <strong>Ministerpräsident/in</strong> ہے۔',
        de: 'Niedersachsen ist das <strong>flächenmäßig zweitgrößte Bundesland</strong> Deutschlands im Nordwesten. Die Landeshauptstadt ist <strong>Hannover</strong>, Sitz des <strong>Landtags</strong>. Volkswagen hat seinen Hauptsitz in Wolfsburg, was die Automobilindustrie zu einem zentralen Wirtschaftszweig macht. Das Land hat zudem bedeutende Landwirtschaftsflächen und Nordseeküste. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>.',
    },
    'nordrhein-westfalen': {
        en: 'North Rhine-Westphalia (Nordrhein-Westfalen) is Germany\'s <strong>most populous state</strong> with about 18 million inhabitants. Its capital is <strong>Düsseldorf</strong>, home to the <strong>Landtag</strong>. The Rhine-Ruhr metropolitan area is one of the largest urban agglomerations in Europe. Cologne (Köln), Bonn (former West German capital), Dortmund, and Essen are among its major cities. The head of government is the <strong>Ministerpräsident/in</strong>. The state has transitioned from heavy industry to a diverse, modern economy.',
        ur: 'نارڈرائن ویسٹ فالن جرمنی کی <strong>سب سے زیادہ آبادی والی ریاست</strong> ہے جس میں تقریباً 18 ملین افراد رہتے ہیں۔ اس کا دارالحکومت <strong>ڈوسلڈورف</strong> ہے جہاں <strong>Landtag</strong> ہے۔ Rhine-Ruhr میگاسٹی یورپ کی بڑی شہری مجموعات میں سے ایک ہے۔ کولون، بون (سابق مغربی جرمن دارالحکومت)، ڈورٹمنڈ اور ایسن بڑے شہر ہیں۔ سربراہ حکومت <strong>Ministerpräsident/in</strong> ہے۔',
        de: 'Nordrhein-Westfalen ist Deutschlands <strong>bevölkerungsreichstes Bundesland</strong> mit rund 18 Millionen Einwohnern. Die Landeshauptstadt ist <strong>Düsseldorf</strong>, Sitz des <strong>Landtags</strong>. Die Metropolregion Rhein-Ruhr ist eine der größten städtischen Ballungsräume Europas. Köln, Bonn (ehemalige Hauptstadt der BRD), Dortmund und Essen sind bedeutende Städte. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>.',
    },
    'rheinland-pfalz': {
        en: 'Rhineland-Palatinate (Rheinland-Pfalz) is located in southwestern Germany. Its capital is <strong>Mainz</strong>, home to the <strong>Landtag</strong> and the famous Gutenberg Museum (Johannes Gutenberg invented movable-type printing here). The Rhine, Moselle, and Nahe rivers run through the state, creating renowned wine-growing regions — Rheinland-Pfalz produces more wine than any other German state. The head of government is the <strong>Ministerpräsident/in</strong>.',
        ur: 'رائن لینڈ-فالز جنوب مغربی جرمنی میں واقع ہے۔ اس کا دارالحکومت <strong>مائنز</strong> ہے جہاں <strong>Landtag</strong> اور مشہور گوٹنبرگ میوزیم ہے (یوہانس گوٹنبرگ نے یہیں حرکی طباعت ایجاد کی)۔ رائن، موزیل اور ناہے دریا اس ریاست سے گزرتے ہیں اور مشہور انگور کے باغات تشکیل دیتے ہیں — رائن لینڈ-فالز کسی بھی دوسری جرمن ریاست سے زیادہ شراب پیدا کرتی ہے۔ سربراہ حکومت <strong>Ministerpräsident/in</strong> ہے۔',
        de: 'Rheinland-Pfalz liegt im Südwesten Deutschlands. Die Landeshauptstadt ist <strong>Mainz</strong>, Sitz des <strong>Landtags</strong> und des berühmten Gutenberg-Museums (Johannes Gutenberg erfand hier den Buchdruck). Rhein, Mosel und Nahe prägen die Landschaft und schaffen renommierte Weinbaugebiete — kein anderes Bundesland produziert mehr Wein. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>.',
    },
    'saarland': {
        en: 'Saarland is Germany\'s <strong>smallest non-city-state</strong>, located in the far southwest and bordering both France and Luxembourg. Its capital is <strong>Saarbrücken</strong>, home to the <strong>Landtag</strong>. The state has a strong French cultural influence due to its border location and was under French administration after World War II before joining West Germany in 1957. Its economy has shifted from coal and steel to modern industries. The head of government is the <strong>Ministerpräsident/in</strong>.',
        ur: 'زارلینڈ جرمنی کی <strong>سب سے چھوٹی غیر شہری ریاست</strong> ہے جو انتہائی جنوب مغرب میں واقع ہے اور فرانس و لکسمبرگ دونوں سے ملتی ہے۔ اس کا دارالحکومت <strong>زاربروکن</strong> ہے جہاں <strong>Landtag</strong> ہے۔ سرحدی مقام کی وجہ سے اس پر فرانسیسی ثقافت کا گہرا اثر ہے۔ یہ دوسری جنگ عظیم کے بعد فرانسیسی انتظام میں رہا اور 1957 میں مغربی جرمنی میں شامل ہوا۔ سربراہ حکومت <strong>Ministerpräsident/in</strong> ہے۔',
        de: 'Das Saarland ist Deutschlands <strong>kleinstes Flächenland</strong> im äußersten Südwesten und grenzt an Frankreich und Luxemburg. Die Landeshauptstadt ist <strong>Saarbrücken</strong>, Sitz des <strong>Landtags</strong>. Die Grenznähe zu Frankreich prägt die Kultur stark. Nach dem Zweiten Weltkrieg stand das Saarland unter französischer Verwaltung und trat 1957 der Bundesrepublik bei. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>.',
    },
    'sachsen': {
        en: 'Saxony (Sachsen) is located in eastern Germany, bordering Poland and the Czech Republic. Its capital is <strong>Dresden</strong>, home to the <strong>Landtag</strong> and renowned for its Baroque architecture and world-class art collections (Zwinger, Semperoper). Leipzig is another major city, famous as the home of Bach and the site of the 1989 Monday demonstrations that helped bring down the Berlin Wall. The head of government is the <strong>Ministerpräsident/in</strong>.',
        ur: 'زاخسن مشرقی جرمنی میں واقع ہے اور پولینڈ و چیک ریپبلک سے ملتا ہے۔ اس کا دارالحکومت <strong>ڈریزڈن</strong> ہے جہاں <strong>Landtag</strong> اور بارک فن تعمیر و آرٹ کے عالمی مجموعے (Zwinger، Semperoper) موجود ہیں۔ لائپزگ ایک اور بڑا شہر ہے جو باخ کے گھر اور 1989 کے پیر کے جلوسوں کی وجہ سے مشہور ہے جنہوں نے برلن دیوار گرانے میں مدد کی۔ سربراہ حکومت <strong>Ministerpräsident/in</strong> ہے۔',
        de: 'Sachsen liegt in Ostdeutschland und grenzt an Polen und Tschechien. Die Landeshauptstadt ist <strong>Dresden</strong>, Sitz des <strong>Landtags</strong>, bekannt für Barockarchitektur und weltberühmte Kunstsammlungen (Zwinger, Semperoper). Leipzig ist eine weitere Großstadt, bekannt als Heimat von Bach und als Ort der Montagsdemonstrationen 1989. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>.',
    },
    'sachsen-anhalt': {
        en: 'Saxony-Anhalt (Sachsen-Anhalt) is located in central-eastern Germany. Its capital is <strong>Magdeburg</strong>, home to the <strong>Landtag</strong> and one of Germany\'s oldest cathedrals. The state is historically significant as the heartland of the Protestant Reformation — Martin Luther was born in Eisleben and posted his 95 Theses in Wittenberg, both in Sachsen-Anhalt. The Bauhaus art movement was also founded in Dessau. The head of government is the <strong>Ministerpräsident/in</strong>.',
        ur: 'زاخسن-انہالٹ وسطی مشرقی جرمنی میں واقع ہے۔ اس کا دارالحکومت <strong>ماگڈبرگ</strong> ہے جہاں <strong>Landtag</strong> اور جرمنی کے قدیم ترین گرجا گھروں میں سے ایک ہے۔ یہ ریاست پروٹسٹنٹ اصلاح کے مرکز کے طور پر تاریخی اہمیت رکھتی ہے — مارٹن لوتھر آئسلیبن میں پیدا ہوئے اور وِٹنبرگ میں اپنے 95 مقالے لگائے، دونوں جگہیں زاخسن-انہالٹ میں ہیں۔ Bauhaus فن تحریک بھی ڈیساؤ میں قائم ہوئی۔ سربراہ حکومت <strong>Ministerpräsident/in</strong> ہے۔',
        de: 'Sachsen-Anhalt liegt in Mitteldeutschland. Die Landeshauptstadt ist <strong>Magdeburg</strong>, Sitz des <strong>Landtags</strong> und Heimat eines der ältesten Dome Deutschlands. Das Land ist historisch bedeutsam als Kernland der Reformation — Martin Luther wurde in Eisleben geboren und schlug in Wittenberg seine 95 Thesen an. Das Bauhaus wurde in Dessau gegründet. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>.',
    },
    'schleswig-holstein': {
        en: 'Schleswig-Holstein is Germany\'s northernmost state, located between the North Sea and the Baltic Sea. Its capital is <strong>Kiel</strong>, home to the <strong>Landtag</strong> and one of Germany\'s major naval bases and the start of the Kiel Canal (Nord-Ostsee-Kanal), the world\'s busiest artificial waterway. The state borders Denmark to the north. Flensburg and Lübeck (a UNESCO World Heritage city and birthplace of Thomas Mann) are other important cities. The head of government is the <strong>Ministerpräsident/in</strong>.',
        ur: 'شلیسوگ-ہولسٹائن جرمنی کی سب سے شمالی ریاست ہے جو شمالی سمندر اور بالٹک سمندر کے درمیان واقع ہے۔ اس کا دارالحکومت <strong>کیل</strong> ہے جہاں <strong>Landtag</strong> اور Kiel نہر (Nord-Ostsee-Kanal) کا آغاز ہوتا ہے — دنیا کی مصروف ترین مصنوعی آبگزر۔ شمال میں ڈنمارک کی سرحد ہے۔ فلنسبرگ اور لوبیک (یونیسکو ورثہ) اہم شہر ہیں۔ سربراہ حکومت <strong>Ministerpräsident/in</strong> ہے۔',
        de: 'Schleswig-Holstein ist das nördlichste Bundesland Deutschlands, zwischen Nord- und Ostsee gelegen. Die Landeshauptstadt ist <strong>Kiel</strong>, Sitz des <strong>Landtags</strong> und Ausgangspunkt des Nord-Ostsee-Kanals, der meistbefahrenen künstlichen Wasserstraße der Welt. Im Norden grenzt das Land an Dänemark. Flensburg und Lübeck (UNESCO-Welterbe) sind weitere bedeutende Städte. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>.',
    },
    'thueringen': {
        en: 'Thuringia (Thüringen) is located in central Germany and is often called the <strong>"Green Heart of Germany"</strong> for its dense forests, including the Thuringian Forest (Thüringer Wald). Its capital is <strong>Erfurt</strong>, home to the <strong>Landtag</strong>. The state has exceptional cultural heritage — Weimar was the home of Goethe and Schiller, Eisenach is the birthplace of Johann Sebastian Bach, and Luther translated the New Testament in Wartburg Castle. The head of government is the <strong>Ministerpräsident/in</strong>.',
        ur: 'تھیورنگن وسطی جرمنی میں واقع ہے اور اپنے گھنے جنگلات کی وجہ سے <strong>"جرمنی کا سبز دل"</strong> کہلاتا ہے۔ اس کا دارالحکومت <strong>ایرفرٹ</strong> ہے جہاں <strong>Landtag</strong> قائم ہے۔ اس ریاست کا غیر معمولی ثقافتی ورثہ ہے — وائمار گوئٹے اور شِلر کا گھر تھا، ایزناخ یوہان سیباسٹین باخ کی جائے پیدائش ہے، اور لوتھر نے وارٹبرگ قلعے میں نئے عہد نامے کا ترجمہ کیا۔ سربراہ حکومت <strong>Ministerpräsident/in</strong> ہے۔',
        de: 'Thüringen liegt in Mitteldeutschland und wird wegen seiner dichten Wälder oft als <strong>„Grünes Herz Deutschlands"</strong> bezeichnet. Die Landeshauptstadt ist <strong>Erfurt</strong>, Sitz des <strong>Landtags</strong>. Das Land besitzt ein außergewöhnliches Kulturerbe — Weimar war die Heimat von Goethe und Schiller, Eisenach ist der Geburtsort Johann Sebastian Bachs, und Luther übersetzte das Neue Testament auf der Wartburg. Das Staatsoberhaupt ist der/die <strong>Ministerpräsident/in</strong>.',
    },
};

function buildMetaDesc(lang, title, slug) {
    const descs = META_DESCS[lang] || META_DESCS.en;
    if (descs[slug]) return descs[slug];
    // Fallback for state pages not in ur/de map
    const enDesc = META_DESCS.en[slug];
    if (lang === 'ur' && enDesc) {
        return `${title} — Einbürgerungstest کے ریاستی سوالات اردو ترجمے کے ساتھ۔ مفت تیاری گائیڈ۔`;
    }
    if (lang === 'de' && enDesc) {
        return `${title} — Einbürgerungstest Länderfragen mit Erklärungen. Kostenlose Prüfungsvorbereitung.`;
    }
    const tagline = (UI[lang] || UI.en).tagline;
    return `${tagline} — ${title}. ${lang === 'en' ? 'Free German citizenship test prep.' : lang === 'de' ? 'Kostenlose Prüfungsvorbereitung.' : 'مفت تیاری گائیڈ۔'}`;
}

// Extract FAQ structured data from generated HTML.
// Matches the actual rendered structure: h3 "Question N" → p with English question → table with ✅ → blockquote explanation.
function buildFaqSchema(bodyHtml, lang) {
    // Only generate FAQPage for question-set pages, not state or index pages
    if (!bodyHtml.includes('Question ') && !bodyHtml.includes('سوال ')) return '';
    const questions = [];

    // Split into per-question blocks at each h3
    const blocks = bodyHtml.split(/<h3[^>]*>/);
    for (const block of blocks) {
        if (questions.length >= 8) break; // cap at 8 to keep structured data lean

        // Find English question text from the paragraph (🇬🇧 English: ... part)
        const enMatch = block.match(/English:<\/strong>\s*([\s\S]*?)(?:<\/p>|<br>)/);
        if (!enMatch) continue;
        const questionText = enMatch[1].replace(/<[^>]+>/g, '').trim();
        if (!questionText) continue;

        // Find the correct answer — cell after ✅ cell contains <strong>answer</strong>
        // Pattern: <td>✅</td>\n<td><strong>ANSWER</strong></td>
        const correctMatch = block.match(/<td>✅<\/td>\s*<td><strong>([\s\S]*?)<\/strong><\/td>/);
        if (!correctMatch) continue;
        const correctAnswer = correctMatch[1].replace(/<[^>]+>/g, '').trim();

        // Find explanation from blockquote
        const explMatch = block.match(/<blockquote>\s*<p>([\s\S]*?)<\/p>/);
        const explanation = explMatch
            ? explMatch[1].replace(/<[^>]+>/g, '').replace(/📝\s*(?:Explanation:?\s*)?/g, '').trim()
            : correctAnswer;

        if (questionText && correctAnswer) {
            questions.push({ q: questionText, a: explanation || correctAnswer });
        }
    }
    if (questions.length === 0) return '';

    const faqItems = questions.map(q =>
        `{ "@type": "Question", "name": ${JSON.stringify(q.q)}, "acceptedAnswer": { "@type": "Answer", "text": ${JSON.stringify(q.a)} } }`
    ).join(',\n        ');

    return `
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        ${faqItems}
      ]
    }
    </script>`;
}

// ---------- Flag emoji → flag-icons CSS spans ----------
// Chrome on Windows deliberately omits country flag emojis (🇩🇪 🇬🇧 🇵🇰).
// We replace them with spans from the flag-icons library which works in all browsers.
const FLAG_SPANS = {
    '🇩🇪': '<span class="fi fi-de" role="img" aria-label="Germany" title="Germany"></span>',
    '🇬🇧': '<span class="fi fi-gb" role="img" aria-label="United Kingdom" title="UK"></span>',
    '🇵🇰': '<span class="fi fi-pk" role="img" aria-label="Pakistan" title="Pakistan"></span>',
};
function applyFlagIcons(html) {
    return html
        .replace(/🇩🇪/g, FLAG_SPANS['🇩🇪'])
        .replace(/🇬🇧/g, FLAG_SPANS['🇬🇧'])
        .replace(/🇵🇰/g, FLAG_SPANS['🇵🇰']);
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

    const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${slug === 'index' ? escapeHtml(ui.siteTitle) : `${escapeHtml(title)} · ${escapeHtml(ui.siteTitle)}`}</title>
    <meta name="description" content="${escapeHtml(buildMetaDesc(lang, title, slug))}">
    <meta name="description" lang="de" content="${escapeHtml(buildMetaDesc('de', TITLES.en[slug] || title, slug))}">
    <link rel="canonical" href="${SITE_BASE_URL}/${lang}/${slug}.html">

    <!-- hreflang: tell Google these are the same page in different languages -->
    <link rel="alternate" hreflang="en" href="${SITE_BASE_URL}/en/${slug}.html">
    <link rel="alternate" hreflang="ur" href="${SITE_BASE_URL}/ur/${slug}.html">
    <link rel="alternate" hreflang="x-default" href="${SITE_BASE_URL}/en/${slug}.html">

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

    <!-- Feature 13: dark-mode OG image variant for platforms that support it -->
    <meta media="(prefers-color-scheme: dark)" property="og:image" content="${OG_IMAGE_DARK_URL}">
    <meta media="(prefers-color-scheme: dark)" name="twitter:image" content="${OG_IMAGE_DARK_URL}">

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

    <!-- Structured Data: BreadcrumbList + WebPage -->
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BreadcrumbList",
          "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "${escapeHtml(ui.siteTitle)}", "item": "${SITE_BASE_URL}/" },
            { "@type": "ListItem", "position": 2, "name": "${escapeHtml(title)}", "item": "${SITE_BASE_URL}/${lang}/${slug}.html" }
          ]
        },
        {
          "@type": "WebPage",
          "@id": "${SITE_BASE_URL}/${lang}/${slug}.html",
          "url": "${SITE_BASE_URL}/${lang}/${slug}.html",
          "name": "${escapeHtml(title)} · ${escapeHtml(ui.siteTitle)}",
          "description": "${escapeHtml(buildMetaDesc(lang, title, slug))}",
          "inLanguage": "${lang === 'en' ? 'en-GB' : 'ur-PK'}",
          "isPartOf": { "@id": "${SITE_BASE_URL}/" },
          "publisher": {
            "@type": "Person",
            "name": "Abdullah Butt",
            "url": "${GITHUB_URL}"
          }
        }
      ]
    }
    </script>
    ${buildFaqSchema(bodyHtml, lang)}

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
    <link href="https://cdn.jsdelivr.net/npm/flag-icons@7.2.3/css/flag-icons.min.css" rel="stylesheet">
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
        /* Quiz button — solid accent so it stands out from the other nav items */
        .nav-actions .btn-quiz {
            background: var(--primary);
            color: #fff;
            border: 1px solid var(--primary);
            border-radius: 999px;
            padding: 0.35rem 0.9rem;
            font-size: 0.875rem;
            font-weight: 700;
            text-decoration: none;
            cursor: pointer;
        }
        .nav-actions .btn-quiz:hover {
            background: var(--primary-hover);
            border-color: var(--primary-hover);
            color: #fff;
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
        .table-wrap {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            margin: 1rem 0 1.5rem;
            border: 1px solid var(--border);
            border-radius: 0.5rem;
            background: var(--card-bg);
        }
        .table-wrap table {
            margin: 0;
            border: 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0 1.5rem;
            background: var(--card-bg);
            table-layout: auto;
        }
        table th, table td {
            padding: 0.75rem 1rem;
            border: 1px solid var(--border);
            vertical-align: top;
            overflow-wrap: anywhere;
            word-break: normal;
            hyphens: auto;
            min-width: 0;
        }
        table th {
            background: var(--primary);
            color: #fff;
            text-align: ${dir === 'rtl' ? 'right' : 'left'};
            white-space: nowrap;
        }
        table tr:nth-child(even) td { background: var(--table-stripe); }
        table tr:hover td { background: var(--table-hover); }

        /* On Urdu (RTL) pages, column 1 = ✅/○ (center),
           column 2 = German text (must stay LTR + left-aligned),
           column 3 = Urdu text (RTL, right-aligned via page direction).
           Without this fix, dir="rtl" on <html> makes the German column
           also right-aligned, which looks broken. */
        [dir="rtl"] table td:nth-child(2),
        [dir="rtl"] table th:nth-child(2) {
            direction: ltr;
            text-align: left;
        }
        [dir="rtl"] table td:nth-child(1),
        [dir="rtl"] table th:nth-child(1) {
            text-align: center;
        }

        @media (max-width: 720px) {
            .table-wrap table {
                min-width: 540px;
            }
            table th, table td {
                padding: 0.6rem 0.75rem;
                font-size: 0.92rem;
            }
        }
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

        /* Feature 9 — Report error button */
        .report-btn {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            margin-top: 2rem;
            padding: 0.45rem 0.9rem;
            font-size: 0.85rem;
            color: var(--muted-text);
            border: 1px solid var(--border);
            border-radius: 0.4rem;
            text-decoration: none;
            background: transparent;
        }
        .report-btn:hover {
            color: #dc2626;
            border-color: #dc2626;
        }

        /* Feature 8 — Print / Save as PDF styles */
        @media print {
            .site-nav, .nav-pager, .back-to-top, footer,
            .report-btn, #updateBanner, #installHint { display: none !important; }
            body { background: #fff; color: #000; font-size: 11pt; }
            .content-card {
                box-shadow: none;
                border: none;
                padding: 0;
            }
            main { max-width: 100%; margin: 0; padding: 0; }
            table th { background: #1d4ed8 !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            table tr:nth-child(even) td { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            a { color: #000; text-decoration: none; }
            a[href]::after { content: ''; } /* suppress URL printing */
            h1, h2, h3 { page-break-after: avoid; }
            table { page-break-inside: avoid; }
            .table-wrap { overflow: visible; }
        }
    </style>
</head>
<body>
    <nav class="site-nav">
        <div class="container-fluid d-flex justify-content-between align-items-center">
            <a class="brand" href="./index.html">${escapeHtml(ui.siteTitle)}</a>
            <div class="nav-actions">
                <a class="btn-quiz" href="../quiz.html" title="Practice Quiz">🎯 Quiz</a>
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
        ${slug !== 'index' ? `
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.75rem;">
            <a class="report-btn" href="${GITHUB_URL}/issues/new?title=${encodeURIComponent(`Correction: ${title}`)}&body=${encodeURIComponent(`**Page:** ${SITE_BASE_URL}/${lang}/${slug}.html\n\n**Issue:**\n\n`)}" target="_blank" rel="noopener">${escapeHtml(ui.reportBtn)}</a>
            <button class="report-btn" onclick="window.print()" style="cursor:pointer;border:1px solid var(--border);">${escapeHtml(ui.printBtn)}</button>
        </div>` : ''}
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
        // Feature 7 — Random question navigation
        window.goRandom = function() {
            const all = ${JSON.stringify(ORDERED_ALL)};
            const current = '${slug}';
            const choices = all.filter(s => s !== current);
            const pick = choices[Math.floor(Math.random() * choices.length)];
            window.location.href = './' + pick + '.html';
        };

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

        // Register PWA service worker — enables offline study mode + auto-update
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', async () => {
                try {
                    const reg = await navigator.serviceWorker.register('../sw.js');
                    // Force an immediate update check on every page load
                    reg.update().catch(() => {});
                    // Re-check periodically while page is open
                    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);

                    // When SW broadcasts that an update is live, show a banner
                    navigator.serviceWorker.addEventListener('message', (e) => {
                        if (e.data && e.data.type === 'SW_UPDATED') showUpdateBanner();
                    });

                    // Also detect updates the standard way (waiting worker)
                    reg.addEventListener('updatefound', () => {
                        const nw = reg.installing;
                        if (!nw) return;
                        nw.addEventListener('statechange', () => {
                            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                                // A new SW is installed alongside the active one
                                showUpdateBanner(nw);
                            }
                        });
                    });

                    // Auto-reload when the controlling SW changes (after user taps "Refresh")
                    let reloading = false;
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        if (reloading) return;
                        reloading = true;
                        window.location.reload();
                    });
                } catch (e) { /* SW unavailable, no problem */ }
            });

            function showUpdateBanner(waitingWorker) {
                if (document.getElementById('updateBanner')) return;
                const bar = document.createElement('div');
                bar.id = 'updateBanner';
                bar.setAttribute('role', 'status');
                bar.innerHTML = '🔄 New version available — <button id="updateBtn">Refresh</button>';
                bar.style.cssText = 'position:fixed;left:50%;bottom:1rem;transform:translateX(-50%);background:#1d4ed8;color:#fff;padding:0.6rem 1rem;border-radius:0.5rem;font-size:0.9rem;box-shadow:0 0.5rem 1.25rem rgba(0,0,0,0.3);z-index:1060;display:flex;gap:0.6rem;align-items:center';
                document.body.appendChild(bar);
                document.getElementById('updateBtn').style.cssText = 'background:#fff;color:#1d4ed8;border:0;padding:0.3rem 0.75rem;border-radius:0.35rem;font-weight:600;cursor:pointer;font-size:0.85rem';
                document.getElementById('updateBtn').addEventListener('click', () => {
                    if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
                    else window.location.reload();
                });
            }
        }
    </script>

    <!-- Cloudflare Web Analytics (privacy-friendly, no cookies, GDPR-compliant) -->
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "${CLOUDFLARE_ANALYTICS_TOKEN}"}'></script>
</body>
</html>`;
    // Replace flag emoji with flag-icons CSS spans (fixes Chrome on Windows)
    return applyFlagIcons(html);
}

// ---------- Per-language index page ----------
function renderIndex({ lang, slugs }) {
    const ui = UI[lang];
    const titles = TITLES[lang];
    const dir = lang === 'ur' ? 'rtl' : 'ltr';
    const isUr = lang === 'ur';

    // Question set cards — 6 sets with range labels
    const qSets = [
        { slug: 'questions-001-050', range: '1–50'   },
        { slug: 'questions-051-100', range: '51–100'  },
        { slug: 'questions-101-150', range: '101–150' },
        { slug: 'questions-151-200', range: '151–200' },
        { slug: 'questions-201-250', range: '201–250' },
        { slug: 'questions-251-300', range: '251–300' },
    ];

    // State slugs sorted
    const stateSlugs = ORDERED_STATES;

    // Intro text per language
    const intro = {
        en: 'The <strong>Einbürgerungstest</strong> (Leben in Deutschland test) is required for German Permanent Residence and Citizenship. The test is in German — use this free guide to study every official question with English translation and clear explanation.',
        ur: 'جرمن مستقل اقامت (Niederlassungserlaubnis) اور شہریت کے لیے <strong>Einbürgerungstest</strong> پاس کرنا ضروری ہے۔ یہ امتحان جرمن زبان میں ہوتا ہے — اس مفت گائیڈ میں ہر سرکاری سوال کا اردو ترجمہ اور آسان وضاحت موجود ہے۔',
    };

    const headings = {
        en: { qs: '📖 General Questions', states: '🗺️ State Questions', howLabel: '❓ How it works', howText: 'The test has <strong>33 questions</strong> — 30 from the general pool and 3 from your state. You need <strong>17 correct</strong> to pass. <a href="../quiz.html">Take the practice quiz →</a>', statsLabel: '' },
        ur: { qs: '📖 عمومی سوالات', states: '🗺️ ریاستی سوالات', howLabel: '❓ امتحان کیسے ہوتا ہے؟', howText: 'امتحان میں <strong>33 سوالات</strong> ہوتے ہیں — 30 عمومی اور 3 آپ کی ریاست کے۔ پاس کرنے کے لیے <strong>17 درست</strong> جوابات ضروری ہیں۔ <a href="../quiz.html">مشق کوئز دیں ←</a>' },
    };

    const h = headings[lang] || headings.en;

    // Stats bar
    const stats = lang === 'ur'
        ? `<div class="idx-stats"><span>📋 300+ سوالات</span><span>🗺️ 16 ریاستیں</span><span>✅ درست جوابات</span><span>💡 ہر سوال کی وضاحت</span></div>`
        : `<div class="idx-stats"><span>📋 300+ questions</span><span>🗺️ 16 Bundesländer</span><span>✅ Answers highlighted</span><span>💡 Explanation per question</span></div>`;

    // Question set cards
    const qCards = qSets.map(({ slug, range }) => {
        const label = isUr ? `سوالات ${range}` : `Questions ${range}`;
        return `<a class="idx-card" href="./${slug}.html">
            <span class="idx-card-icon">📝</span>
            <span class="idx-card-label">${label}</span>
        </a>`;
    }).join('');

    // State cards
    const stateCards = stateSlugs.map(slug => {
        const t = titles[slug] || slug;
        return `<a class="idx-card idx-card--state" href="./${slug}.html">
            <span class="idx-card-label">${escapeHtml(t)}</span>
        </a>`;
    }).join('');

    // Quiz CTA
    const quizCta = lang === 'ur'
        ? `<a class="idx-quiz-cta" href="../quiz.html">🎯 مشق کوئز شروع کریں — اصل Einbürgerungstest کی طرح</a>`
        : `<a class="idx-quiz-cta" href="../quiz.html">🎯 Start Practice Quiz — simulates the real Einbürgerungstest</a>`;

    const body = `
        <style>
        .idx-intro {
            background: color-mix(in srgb, var(--primary) 7%, var(--card-bg));
            border: 1px solid color-mix(in srgb, var(--primary) 20%, var(--border));
            border-radius: .75rem;
            padding: 1.1rem 1.25rem;
            font-size: .97rem;
            line-height: 1.7;
            margin-bottom: 1.25rem;
        }
        .idx-stats {
            display: flex;
            flex-wrap: wrap;
            gap: .4rem .9rem;
            font-size: .85rem;
            color: var(--muted-text);
            margin-bottom: 1.5rem;
        }
        .idx-how {
            background: color-mix(in srgb, var(--success, #059669) 8%, var(--card-bg));
            border: 1px solid color-mix(in srgb, var(--success, #059669) 20%, var(--border));
            border-radius: .75rem;
            padding: 1rem 1.25rem;
            font-size: .92rem;
            line-height: 1.7;
            margin-bottom: 1.75rem;
        }
        .idx-how strong { color: var(--page-text); }
        .idx-how a { color: var(--primary); font-weight: 600; }
        .idx-section-title {
            font-size: 1.1rem;
            font-weight: 700;
            margin: 1.75rem 0 .75rem;
        }
        .idx-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(145px, 1fr));
            gap: .55rem;
            margin-bottom: .5rem;
        }
        .idx-grid--states {
            grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
        }
        .idx-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: .3rem;
            padding: .85rem .6rem;
            background: var(--card-bg);
            border: 1.5px solid var(--border);
            border-radius: .65rem;
            text-decoration: none;
            color: var(--page-text);
            font-size: .88rem;
            font-weight: 600;
            text-align: center;
            transition: border-color .15s, background .15s, transform .1s;
            line-height: 1.4;
        }
        .idx-card:hover {
            border-color: var(--primary);
            background: color-mix(in srgb, var(--primary) 8%, var(--card-bg));
            transform: translateY(-1px);
            color: var(--page-text);
        }
        .idx-card-icon { font-size: 1.4rem; }
        .idx-card--state { flex-direction: row; justify-content: start; gap: .5rem; font-size: .85rem; padding: .7rem .85rem; }
        .idx-quiz-cta {
            display: block;
            margin: 1.75rem 0 .5rem;
            padding: 1rem 1.25rem;
            background: var(--primary);
            color: #fff;
            font-weight: 700;
            font-size: 1rem;
            text-align: center;
            border-radius: .75rem;
            text-decoration: none;
            transition: background .15s;
        }
        .idx-quiz-cta:hover { background: var(--primary-hover, #1e40af); color: #fff; }
        @media (max-width: 480px) {
            .idx-grid { grid-template-columns: 1fr 1fr; }
            .idx-grid--states { grid-template-columns: 1fr 1fr; }
        }
        </style>

        <h1 style="margin-bottom:.75rem;">${escapeHtml(ui.siteTitle)}</h1>

        <div class="idx-intro">${intro[lang] || intro.en}</div>

        ${stats}

        <div class="idx-how"><strong>${escapeHtml(h.howLabel)}</strong><br>${h.howText}</div>

        ${quizCta}

        <p class="idx-section-title">${escapeHtml(h.qs)}</p>
        <div class="idx-grid">${qCards}</div>

        <p class="idx-section-title">${escapeHtml(h.states)}</p>
        <div class="idx-grid idx-grid--states">${stateCards}</div>
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
        bodyHtml = bodyHtml.replace(
            /<table([^>]*)>([\s\S]*?)<\/table>/g,
            '<div class="table-wrap"><table$1>$2</table></div>'
        );
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

        // Inject state intro paragraph above the question content for state pages
        const isStatePage = ORDERED_STATES.includes(slug);
        if (isStatePage && STATE_INTROS[slug]) {
            const intro = STATE_INTROS[slug][lang] || STATE_INTROS[slug].en;
            const dir = lang === 'ur' ? 'rtl' : 'ltr';
            const fontStyle = lang === 'ur' ? "font-family:'Noto Nastaliq Urdu',serif;line-height:2.1;" : '';
            const introHtml = `<div class="state-intro" dir="${dir}" style="background:color-mix(in srgb,var(--primary) 7%,var(--card-bg));border:1px solid color-mix(in srgb,var(--primary) 20%,var(--border));border-radius:.75rem;padding:1rem 1.25rem;margin-bottom:1.5rem;font-size:.96rem;line-height:1.75;${fontStyle}">${intro}</div>`;
            bodyHtml = introHtml + bodyHtml;
        }

        const html = renderPage({ lang, title, bodyHtml, slug });
        fs.writeFileSync(path.join(outDir, `${slug}.html`), html);
        slugs.push(slug);
        console.log(`  ✓ ${lang}/${slug}.html`);
    }

    // Per-language index: always use the purpose-built renderIndex homepage.
    // We no longer use README.md content as the index — it was designed for
    // GitHub readers, not website visitors, and was inconsistent between languages.
    const indexHtml = renderIndex({ lang, slugs });
    fs.writeFileSync(path.join(outDir, 'index.html'), indexHtml);
    console.log(`  ✓ ${lang}/index.html`);
}

// Build a unique build ID — current ISO timestamp, sanitized for cache key use
const BUILD_ID = new Date().toISOString().replace(/[:.]/g, '-');

function stampServiceWorker() {
    const srcPath = path.join(ROOT, 'sw.template.js');
    const outPath = path.join(ROOT, 'sw.js');
    // If a template file exists, prefer that. Otherwise read sw.js itself
    // (which has __BUILD_ID__ as a placeholder) and stamp it.
    const source = fs.existsSync(srcPath)
        ? fs.readFileSync(srcPath, 'utf8')
        : fs.readFileSync(outPath, 'utf8');
    const stamped = source.replace(/__BUILD_ID__/g, BUILD_ID);
    fs.writeFileSync(outPath, stamped);
    console.log(`✓ sw.js stamped with build ID: ${BUILD_ID}`);
}

// ---------- Sitemap & robots.txt ----------
function buildSitemap() {
    const allSlugs = [...ORDERED_QUESTIONS, ...ORDERED_STATES];
    const today = BUILD_DATE;

    // Priority map: index and question sets are most important
    const priority = (slug) => {
        if (slug === 'index') return '1.0';
        if (slug.startsWith('questions-')) return '0.9';
        return '0.7'; // state pages
    };
    const changefreq = (slug) => slug.startsWith('questions-') ? 'monthly' : 'yearly';

    let urls = '';

    // Landing page
    urls += `
  <url>
    <loc>${SITE_BASE_URL}/</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_BASE_URL}/en/index.html"/>
    <xhtml:link rel="alternate" hreflang="ur" href="${SITE_BASE_URL}/ur/index.html"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_BASE_URL}/en/index.html"/>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>`;

    // Quiz page — high priority, it's a key feature page
    urls += `
  <url>
    <loc>${SITE_BASE_URL}/quiz.html</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.95</priority>
  </url>`;

    // Per-language index pages
    for (const lang of ['en', 'ur']) {
        urls += `
  <url>
    <loc>${SITE_BASE_URL}/${lang}/index.html</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_BASE_URL}/en/index.html"/>
    <xhtml:link rel="alternate" hreflang="ur" href="${SITE_BASE_URL}/ur/index.html"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_BASE_URL}/en/index.html"/>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.95</priority>
  </url>`;
    }

    // Content pages
    for (const slug of allSlugs) {
        const p = priority(slug);
        const cf = changefreq(slug);
        urls += `
  <url>
    <loc>${SITE_BASE_URL}/en/${slug}.html</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_BASE_URL}/en/${slug}.html"/>
    <xhtml:link rel="alternate" hreflang="ur" href="${SITE_BASE_URL}/ur/${slug}.html"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_BASE_URL}/en/${slug}.html"/>
    <lastmod>${today}</lastmod>
    <changefreq>${cf}</changefreq>
    <priority>${p}</priority>
  </url>
  <url>
    <loc>${SITE_BASE_URL}/ur/${slug}.html</loc>
    <xhtml:link rel="alternate" hreflang="en" href="${SITE_BASE_URL}/en/${slug}.html"/>
    <xhtml:link rel="alternate" hreflang="ur" href="${SITE_BASE_URL}/ur/${slug}.html"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE_BASE_URL}/en/${slug}.html"/>
    <lastmod>${today}</lastmod>
    <changefreq>${cf}</changefreq>
    <priority>${p}</priority>
  </url>`;
    }

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;

    fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);
    console.log('✓ sitemap.xml written');

    // robots.txt
    const robots = `User-agent: *
Allow: /

Sitemap: ${SITE_BASE_URL}/sitemap.xml
`;
    fs.writeFileSync(path.join(ROOT, 'robots.txt'), robots);
    console.log('✓ robots.txt written');
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
    buildSitemap();
    generateQuizData();
    stampServiceWorker();
    console.log('\nDone. Commit and push the `html` branch, then enable GitHub Pages.');
}

main();
