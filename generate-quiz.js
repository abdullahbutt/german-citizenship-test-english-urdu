#!/usr/bin/env node
/**
 * generate-quiz.js
 * Parses all English + Urdu markdown question files and produces quiz-data.json.
 * Called automatically by build.js main().
 *
 * Output: quiz-data.json at project root.
 * Structure:
 *   { version, general: [...], states: { slug: { name_*, questions: [...] } } }
 */

'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT       = __dirname;
const SRC_EN     = path.join(ROOT, 'sources', 'english');
const SRC_UR     = path.join(ROOT, 'sources', 'urdu');

// ─── Markdown parser ─────────────────────────────────────────────────────────

/**
 * Parse questions from a markdown file.
 * Returns: [{ id, de, translated, options: [{de,translated}], correct, explanation }]
 *   `translated` is English or Urdu depending on which file is parsed.
 */
function parseMd(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const questions = [];

    // Split on question headers so each block starts with "### Question N" or "### سوال N"
    const rawBlocks = content.split(/(?=###\s+(?:Question|سوال)\s+\d+)/);

    for (const block of rawBlocks) {
        // Question number
        const numM = block.match(/###\s+(?:Question|سوال)\s+(\d+)/);
        if (!numM) continue;
        const id = parseInt(numM[1], 10);

        // German text (line after 🇩🇪)
        const deM = block.match(/\*\*🇩🇪(?:\s*Deutsch:)?\*\*\s*([^\n]+)/);
        const de = deM ? deM[1].trim() : '';

        // Translated text (line after 🇬🇧 or 🇵🇰)
        const trM = block.match(/\*\*(?:🇬🇧|🇵🇰)(?:[^*]*)?\*\*\s*([^\n]+)/);
        const translated = trM ? trM[1].trim() : '';

        // Table rows: | ○/✅ | **option** | **option** |
        const options  = [];
        let correct = -1;
        // Match rows that have ○ or ✅ as first cell
        const rowRe = /^\|\s*(✅|○)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/gm;
        let rm;
        while ((rm = rowRe.exec(block)) !== null) {
            const isCorrect = rm[1] === '✅';
            const c1 = rm[2].trim().replace(/^\*+|\*+$/g, '').trim(); // strip bold markers
            const c2 = rm[3].trim().replace(/^\*+|\*+$/g, '').trim();
            if (isCorrect) correct = options.length;
            options.push({ de: c1, translated: c2 });
        }

        // Must have at least 2 options and a correct answer
        if (options.length < 2 || correct === -1) continue;

        // Explanation from blockquote
        const explM = block.match(/^>\s*\*\*📝(?:[^*]*)?\*\*\s*([\s\S]*?)(?=\n---|###|$)/m);
        const explanation = explM
            ? explM[1].replace(/^>\s*/gm, '').replace(/\*\*/g, '').trim()
            : '';

        questions.push({ id, de, translated, options, correct, explanation });
    }

    return questions;
}

// ─── General questions (merge en + ur by id) ─────────────────────────────────

function buildGeneral() {
    const files = [
        'questions-001-050.md',
        'questions-051-100.md',
        'questions-101-150.md',
        'questions-151-200.md',
        'questions-201-250.md',
        'questions-251-300.md',
    ];

    const allEn = [];
    const allUr = [];

    for (const f of files) {
        allEn.push(...parseMd(path.join(SRC_EN, f)));
        allUr.push(...parseMd(path.join(SRC_UR, f)));
    }

    const urMap = new Map(allUr.map(q => [q.id, q]));

    const merged = allEn
        .map(enQ => {
            const urQ = urMap.get(enQ.id);
            return {
                id:             enQ.id,
                de:             enQ.de,
                en:             enQ.translated,
                ur:             urQ ? urQ.translated : enQ.translated,
                options:        enQ.options.map((opt, i) => ({
                    de: opt.de,
                    en: opt.translated,
                    ur: urQ ? (urQ.options[i]?.translated || opt.translated) : opt.translated,
                })),
                correct:        enQ.correct,
                exp_en:         enQ.explanation,
                exp_ur:         urQ ? urQ.explanation : enQ.explanation,
            };
        })
        .sort((a, b) => a.id - b.id);

    console.log(`  parsed ${merged.length} general questions`);
    return merged;
}

// ─── State questions (hardcoded MCQ with real distractors) ───────────────────
// Image-based questions (301 coat of arms, 302/304 map) and variable answers
// (305 current minister) cannot be reliably served as text MCQ, so we provide
// 3 reliable text-based questions per state that fully match the real test topics.

const STATE_CAPITALS = {
    'baden-wuerttemberg': { de: 'Stuttgart',   en: 'Stuttgart',          ur: 'اسٹوٹگارٹ'   },
    'bayern':             { de: 'München',      en: 'Munich (München)',   ur: 'میونخ'         },
    'berlin':             { de: 'Berlin',       en: 'Berlin (city-state)',ur: 'برلن'          },
    'brandenburg':        { de: 'Potsdam',      en: 'Potsdam',           ur: 'پوٹسڈام'       },
    'bremen':             { de: 'Bremen',       en: 'Bremen (city-state)',ur: 'بریمن'         },
    'hamburg':            { de: 'Hamburg',      en: 'Hamburg (city-state)',ur: 'ہیمبرگ'      },
    'hessen':             { de: 'Wiesbaden',    en: 'Wiesbaden',         ur: 'وِسبادن'       },
    'mecklenburg-vorpommern': { de: 'Schwerin', en: 'Schwerin',          ur: 'شوَرین'        },
    'niedersachsen':      { de: 'Hannover',     en: 'Hanover (Hannover)',ur: 'ہینووَر'       },
    'nordrhein-westfalen':{ de: 'Düsseldorf',   en: 'Düsseldorf',        ur: 'ڈوسلڈورف'     },
    'rheinland-pfalz':    { de: 'Mainz',        en: 'Mainz',             ur: 'مائنز'         },
    'saarland':           { de: 'Saarbrücken',  en: 'Saarbrücken',       ur: 'زاربروکن'      },
    'sachsen':            { de: 'Dresden',      en: 'Dresden',           ur: 'ڈریزڈن'        },
    'sachsen-anhalt':     { de: 'Magdeburg',    en: 'Magdeburg',         ur: 'ماگڈبرگ'       },
    'schleswig-holstein': { de: 'Kiel',         en: 'Kiel',              ur: 'کیل'           },
    'thueringen':         { de: 'Erfurt',       en: 'Erfurt',            ur: 'ایرفرٹ'        },
};

// Parliament names (Q303-area: type of parliament)
const PARLIAMENTS = {
    'berlin':       { de: 'Abgeordnetenhaus', en: 'Abgeordnetenhaus (House of Representatives)', ur: 'ابجیارڈنیٹنہاؤس' },
    'bremen':       { de: 'Bremische Bürgerschaft', en: 'Bremische Bürgerschaft', ur: 'بریمش بورگرشافٹ' },
    'hamburg':      { de: 'Bürgerschaft', en: 'Bürgerschaft', ur: 'بورگرشافٹ' },
    '_default':     { de: 'Landtag', en: 'Landtag (State Parliament)', ur: 'لانڈٹاگ' },
};

// Head-of-government titles
const GOV_TITLES = {
    'berlin':  { de: 'Regierender Bürgermeister/in', en: 'Governing Mayor (Regierender Bürgermeister/in)', ur: 'حاکم میئر' },
    'bremen':  { de: 'Bürgermeister/in (Senatspräsident/in)', en: 'Mayor / Senate President', ur: 'میئر / سینیٹ صدر' },
    'hamburg': { de: 'Erster Bürgermeister/in (Senatspräsident/in)', en: 'First Mayor / Senate President', ur: 'پہلا میئر / سینیٹ صدر' },
    '_default':{ de: 'Ministerpräsident/in', en: 'Minister-President (Ministerpräsident/in)', ur: 'وزیراعلیٰ (مِنسٹرپریزیڈنٹ)' },
};

// 3 distractors for capital city questions — pick from other states' capitals
function capitalDistractors(slug) {
    const others = Object.entries(STATE_CAPITALS)
        .filter(([s]) => s !== slug)
        .map(([, v]) => v);
    // Shuffle deterministically using slug hash
    const seed = slug.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    others.sort((a, b) => (a.de.charCodeAt(0) * seed) % 97 - (b.de.charCodeAt(0) * seed) % 97);
    return others.slice(0, 3);
}

// Build state question set (3 solid MCQ questions per state)
function buildStateQuestion(slug, meta) {
    const capital = STATE_CAPITALS[slug];
    const parliament = PARLIAMENTS[slug] || PARLIAMENTS['_default'];
    const govTitle   = GOV_TITLES[slug]  || GOV_TITLES['_default'];

    // Wrong capitals (distractors)
    const dist = capitalDistractors(slug);

    // Shuffle correct answer position: position = slug.length % 4
    const pos = slug.length % 4;
    const capitalOptions = [...dist];
    capitalOptions.splice(pos, 0, capital);

    // Parliament distractors (always offer all 3 parliament types + one fake)
    const parlDistractors = [
        { de: 'Landtag',              en: 'Landtag',              ur: 'لانڈٹاگ'         },
        { de: 'Abgeordnetenhaus',     en: 'Abgeordnetenhaus',     ur: 'ابجیارڈنیٹنہاؤس' },
        { de: 'Bürgerschaft',         en: 'Bürgerschaft',         ur: 'بورگرشافٹ'       },
        { de: 'Volkskammer',          en: 'Volkskammer (defunct)',  ur: 'فولکسکامر (تاریخی)' },
    ].filter(p => p.de !== parliament.de);
    const parlOptions = [...parlDistractors.slice(0, 3)];
    const parlPos = (slug.length + 1) % 4;
    parlOptions.splice(parlPos, 0, { de: parliament.de, en: parliament.en, ur: parliament.ur });

    // Gov-title distractors
    const govOptions = [
        { de: 'Ministerpräsident/in',             en: 'Minister-President',             ur: 'وزیراعلیٰ (مِنسٹرپریزیڈنٹ)' },
        { de: 'Regierender Bürgermeister/in',     en: 'Governing Mayor',                ur: 'حاکم میئر' },
        { de: 'Erster Bürgermeister/in',          en: 'First Mayor',                    ur: 'پہلا میئر' },
        { de: 'Bundeskanzler/in',                 en: 'Federal Chancellor',             ur: 'وفاقی چانسلر' },
    ].filter(g => g.de !== govTitle.de);
    const govOptsArr = [...govOptions.slice(0, 3)];
    const govPos = (slug.length + 2) % 4;
    govOptsArr.splice(govPos, 0, { de: govTitle.de, en: govTitle.en, ur: govTitle.ur });

    return [
        // Q1: Capital city
        {
            id: `${slug}-1`,
            de: `Wie heißt die Hauptstadt von ${meta.name_de}?`,
            en: `What is the capital city of ${meta.name_en}?`,
            ur: `${meta.name_ur} کا دارالحکومت کون سا ہے؟`,
            options: capitalOptions.map(c => ({ de: c.de, en: c.en, ur: c.ur })),
            correct: pos,
            exp_en: `The capital of ${meta.name_en} is ${capital.en}.`,
            exp_ur: `${meta.name_ur} کا دارالحکومت ${capital.ur} ہے۔`,
        },
        // Q2: Parliament name
        {
            id: `${slug}-2`,
            de: `Wie heißt das Landesparlament von ${meta.name_de}?`,
            en: `What is the state parliament of ${meta.name_en} called?`,
            ur: `${meta.name_ur} کی ریاستی پارلیمان کو کیا کہتے ہیں؟`,
            options: parlOptions,
            correct: parlPos,
            exp_en: `The state parliament of ${meta.name_en} is called the ${parliament.en}.`,
            exp_ur: `${meta.name_ur} کی ریاستی پارلیمان کو ${parliament.ur} کہتے ہیں۔`,
        },
        // Q3: Head of government title
        {
            id: `${slug}-3`,
            de: `Welchen Titel trägt das Staatsoberhaupt von ${meta.name_de}?`,
            en: `What title does the head of government of ${meta.name_en} hold?`,
            ur: `${meta.name_ur} کے سربراہِ حکومت کا عہدہ کیا ہے؟`,
            options: govOptsArr,
            correct: govPos,
            exp_en: `The head of government of ${meta.name_en} holds the title of ${govTitle.en}.`,
            exp_ur: `${meta.name_ur} کے سربراہِ حکومت کا عہدہ ${govTitle.ur} ہے۔`,
        },
    ];
}

function buildStates() {
    const stateMeta = {
        'baden-wuerttemberg': { name_de: 'Baden-Württemberg', name_en: 'Baden-Württemberg', name_ur: 'باڈن ورٹمبرگ' },
        'bayern':             { name_de: 'Bayern',            name_en: 'Bavaria (Bayern)',   name_ur: 'باویریا'       },
        'berlin':             { name_de: 'Berlin',            name_en: 'Berlin',             name_ur: 'برلن'          },
        'brandenburg':        { name_de: 'Brandenburg',       name_en: 'Brandenburg',        name_ur: 'برانڈنبرگ'    },
        'bremen':             { name_de: 'Bremen',            name_en: 'Bremen',             name_ur: 'بریمن'         },
        'hamburg':            { name_de: 'Hamburg',           name_en: 'Hamburg',            name_ur: 'ہیمبرگ'       },
        'hessen':             { name_de: 'Hessen',            name_en: 'Hesse (Hessen)',     name_ur: 'ہیسن'          },
        'mecklenburg-vorpommern': { name_de: 'Mecklenburg-Vorpommern', name_en: 'Mecklenburg-Vorpommern', name_ur: 'میکلنبرگ-فورپومرن' },
        'niedersachsen':      { name_de: 'Niedersachsen',    name_en: 'Lower Saxony',       name_ur: 'نیڈرزاخسن'    },
        'nordrhein-westfalen':{ name_de: 'Nordrhein-Westfalen', name_en: 'North Rhine-Westphalia', name_ur: 'نارڈرائن ویسٹ فالن' },
        'rheinland-pfalz':    { name_de: 'Rheinland-Pfalz',  name_en: 'Rhineland-Palatinate',name_ur: 'رائن لینڈ-فالز' },
        'saarland':           { name_de: 'Saarland',         name_en: 'Saarland',           name_ur: 'زارلینڈ'      },
        'sachsen':            { name_de: 'Sachsen',           name_en: 'Saxony (Sachsen)',   name_ur: 'زاخسن'        },
        'sachsen-anhalt':     { name_de: 'Sachsen-Anhalt',   name_en: 'Saxony-Anhalt',      name_ur: 'زاخسن-انہالٹ' },
        'schleswig-holstein': { name_de: 'Schleswig-Holstein',name_en: 'Schleswig-Holstein', name_ur: 'شلیسوگ-ہولسٹائن' },
        'thueringen':         { name_de: 'Thüringen',        name_en: 'Thuringia (Thüringen)',name_ur: 'تھیورنگن'   },
    };

    const states = {};
    for (const [slug, meta] of Object.entries(stateMeta)) {
        states[slug] = {
            slug,
            name_de: meta.name_de,
            name_en: meta.name_en,
            name_ur: meta.name_ur,
            questions: buildStateQuestion(slug, meta),
        };
        console.log(`  state: ${slug} (${states[slug].questions.length} questions)`);
    }
    return states;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function generateQuizData() {
    console.log('\n[quiz-data]');
    const general = buildGeneral();
    const states  = buildStates();

    const output = {
        version: new Date().toISOString().slice(0, 10),
        general,
        states,
    };

    const outPath = path.join(ROOT, 'quiz-data.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    const kb = Math.round(fs.statSync(outPath).size / 1024);
    console.log(`✓ quiz-data.json written (${general.length} general, ${Object.keys(states).length} states, ${kb} KB)`);
}

module.exports = { generateQuizData };
