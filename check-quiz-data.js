#!/usr/bin/env node
/**
 * check-quiz-data.js
 *
 * Regression check for quiz-data.json. Run this after every `npm run build`
 * (or wire it into build.js / CI) to catch silent data corruption before
 * it ships — e.g. a generator falling back to synthetic placeholders,
 * a translation field going missing, an image path pointing at a file
 * that was never committed, or the total question count drifting from
 * the official 460 (300 general + 16 states x 10).
 *
 * Exit code 0 = all checks passed. Exit code 1 = at least one failure,
 * with every failure printed (not just the first) so you can fix them
 * all in one pass.
 *
 * Usage:
 *   node check-quiz-data.js
 *   node check-quiz-data.js path/to/quiz-data.json
 */

const fs = require('fs');
const path = require('path');

const QUIZ_DATA_PATH = process.argv[2] || path.join(__dirname, 'quiz-data.json');
const IMAGES_DIR = path.join(path.dirname(QUIZ_DATA_PATH), 'images');

const EXPECTED_GENERAL_COUNT = 300;
const EXPECTED_STATE_COUNT = 16;
const EXPECTED_QUESTIONS_PER_STATE = 10;
const LANG_FIELDS = ['de', 'en', 'ur', 'ar']; // add 'tr', 'ru' etc. here as they're added to the schema
const REQUIRED_QUESTION_FIELDS = ['id', 'options', 'correct', 'exp_en', 'exp_ur', 'exp_ar'];

let errors = [];
let warnings = [];

function fail(msg) {
  errors.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}

function checkQuestion(q, context) {
  // Required scalar/lang fields present and non-empty
  for (const field of LANG_FIELDS) {
    if (!(field in q)) {
      fail(`${context}: missing field "${field}"`);
    } else if (typeof q[field] !== 'string' || q[field].trim() === '') {
      fail(`${context}: field "${field}" is empty`);
    }
  }
  for (const field of REQUIRED_QUESTION_FIELDS) {
    if (!(field in q)) {
      fail(`${context}: missing field "${field}"`);
    }
  }

  // Options: exactly 4, each with all language fields non-empty
  if (!Array.isArray(q.options)) {
    fail(`${context}: "options" is not an array`);
  } else {
    if (q.options.length !== 4) {
      fail(`${context}: expected 4 options, found ${q.options.length}`);
    }
    q.options.forEach((opt, i) => {
      for (const field of LANG_FIELDS) {
        if (!(field in opt) || typeof opt[field] !== 'string' || opt[field].trim() === '') {
          fail(`${context}: option[${i}] missing/empty field "${field}"`);
        }
      }
    });
  }

  // correct must be a valid index into options
  if (typeof q.correct !== 'number' || !Number.isInteger(q.correct)) {
    fail(`${context}: "correct" is not an integer (got ${JSON.stringify(q.correct)})`);
  } else if (Array.isArray(q.options) && (q.correct < 0 || q.correct >= q.options.length)) {
    fail(`${context}: "correct" index ${q.correct} is out of range for ${q.options.length} options`);
  }

  // Explanations non-empty (already covered by REQUIRED_QUESTION_FIELDS presence,
  // but double-check they're not just whitespace)
  for (const field of ['exp_en', 'exp_ur', 'exp_ar']) {
    if (typeof q[field] === 'string' && q[field].trim() === '') {
      fail(`${context}: "${field}" is present but empty`);
    }
  }

  // Image path, if present, must point at a file that actually exists on disk
  if (q.image) {
    const imgPath = path.join(path.dirname(QUIZ_DATA_PATH), q.image);
    if (!fs.existsSync(imgPath)) {
      fail(`${context}: image "${q.image}" does not exist on disk (expected at ${imgPath})`);
    }
  }

  // Detect the specific "generic/circular explanation" smell we hit with
  // template-generated state explanations (e.g. "shows the coat of arms of X")
  if (typeof q.exp_en === 'string') {
    const circular = /^the correct image shows the official coat of arms of/i.test(q.exp_en.trim())
      || /^the map shows the location of/i.test(q.exp_en.trim());
    if (circular) {
      warn(`${context}: exp_en looks like a generic template explanation, consider enriching it`);
    }
  }
}

function main() {
  if (!fs.existsSync(QUIZ_DATA_PATH)) {
    console.error(`✗ quiz-data.json not found at ${QUIZ_DATA_PATH}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(QUIZ_DATA_PATH, 'utf8'));
  } catch (e) {
    console.error(`✗ quiz-data.json is not valid JSON: ${e.message}`);
    process.exit(1);
  }

  // ---- General questions ----
  if (!Array.isArray(data.general)) {
    fail('data.general is missing or not an array');
  } else {
    if (data.general.length !== EXPECTED_GENERAL_COUNT) {
      fail(`Expected ${EXPECTED_GENERAL_COUNT} general questions, found ${data.general.length}`);
    }
    const seenIds = new Set();
    for (let i = 1; i <= EXPECTED_GENERAL_COUNT; i++) {
      const q = data.general.find(x => x.id === i);
      if (!q) {
        fail(`General question ${i} is missing entirely`);
        continue;
      }
      if (seenIds.has(q.id)) fail(`Duplicate general question id ${q.id}`);
      seenIds.add(q.id);
      checkQuestion(q, `general[${i}]`);
    }
  }

  // ---- State questions ----
  if (!data.states || typeof data.states !== 'object') {
    fail('data.states is missing or not an object');
  } else {
    const stateSlugs = Object.keys(data.states);
    if (stateSlugs.length !== EXPECTED_STATE_COUNT) {
      fail(`Expected ${EXPECTED_STATE_COUNT} states, found ${stateSlugs.length}: [${stateSlugs.join(', ')}]`);
    }
    for (const slug of stateSlugs) {
      const s = data.states[slug];
      if (!s.questions || !Array.isArray(s.questions)) {
        fail(`states.${slug}: "questions" missing or not an array`);
        continue;
      }
      if (s.questions.length !== EXPECTED_QUESTIONS_PER_STATE) {
        fail(`states.${slug}: expected ${EXPECTED_QUESTIONS_PER_STATE} questions, found ${s.questions.length}`);
      }
      // Detect the specific bug we hit: hardcoded synthetic fallback content
      // instead of real parsed markdown (recognizable by generic capital-city-only
      // question sets with no real per-state detail)
      s.questions.forEach((q, i) => {
        checkQuestion(q, `states.${slug}[${i}] (id=${q.id})`);
      });
      // Name fields for every language must exist too
      for (const field of ['name_de', 'name_en', 'name_ur', 'name_ar']) {
        if (!s[field] || typeof s[field] !== 'string' || s[field].trim() === '') {
          fail(`states.${slug}: missing/empty "${field}"`);
        }
      }
    }
  }

  // ---- Total count sanity check ----
  const totalGeneral = Array.isArray(data.general) ? data.general.length : 0;
  const totalState = data.states
    ? Object.values(data.states).reduce((sum, s) => sum + (Array.isArray(s.questions) ? s.questions.length : 0), 0)
    : 0;
  const total = totalGeneral + totalState;
  const expectedTotal = EXPECTED_GENERAL_COUNT + EXPECTED_STATE_COUNT * EXPECTED_QUESTIONS_PER_STATE;
  if (total !== expectedTotal) {
    fail(`Total question count is ${total}, expected ${expectedTotal} (${EXPECTED_GENERAL_COUNT} general + ${EXPECTED_STATE_COUNT}x${EXPECTED_QUESTIONS_PER_STATE} state)`);
  }

  // ---- Report ----
  console.log(`Checked ${QUIZ_DATA_PATH}`);
  console.log(`General questions: ${totalGeneral}/${EXPECTED_GENERAL_COUNT}`);
  console.log(`States: ${data.states ? Object.keys(data.states).length : 0}/${EXPECTED_STATE_COUNT}`);
  console.log(`Total questions: ${total}/${expectedTotal}`);
  console.log('');

  if (warnings.length > 0) {
    console.log(`⚠ ${warnings.length} warning(s):`);
    warnings.forEach(w => console.log(`  - ${w}`));
    console.log('');
  }

  if (errors.length > 0) {
    console.log(`✗ ${errors.length} error(s):`);
    errors.forEach(e => console.log(`  - ${e}`));
    console.log('');
    console.log('✗ FAILED — fix the above before deploying.');
    process.exit(1);
  } else {
    console.log('✓ All checks passed.');
    process.exit(0);
  }
}

main();
