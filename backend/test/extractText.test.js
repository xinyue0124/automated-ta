// Text extraction for every upload format.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildPdf, buildDocx, buildPptx } from './fixtures.js';
import { extractText } from '../src/services/documentProcessor.js';

let dir;
before(async () => { dir = await mkdtemp(path.join(tmpdir(), 'extract-')); });
after(() => rm(dir, { recursive: true, force: true }));

async function save(name, data) {
  const file = path.join(dir, name);
  await writeFile(file, data);
  return file;
}

test('extracts text from a PDF', async () => {
  const file = await save('notes.pdf', buildPdf('Photosynthesis converts light into chemical energy'));
  const text = await extractText(file);
  assert.match(text, /Photosynthesis converts light into chemical energy/);
});

test('extracts paragraphs from a DOCX', async () => {
  const file = await save('notes.docx', await buildDocx(['Week 3 reading', 'Cite primary sources']));
  const text = await extractText(file);
  assert.match(text, /Week 3 reading/);
  assert.match(text, /Cite primary sources/);
});

test('extracts PPTX slide text in slide order, joining runs and decoding entities', async () => {
  const file = await save('lecture.pptx', await buildPptx({
    10: [['Slide ten']],
    2: [['Slide two']],
    1: [['Intro to ', 'journalism'], ['Q&amp;A at the end']]
  }));
  const text = await extractText(file);
  assert.equal(text, 'Intro to journalism\nQ&A at the end\n\nSlide two\n\nSlide ten');
});

test('reads TXT and MD as plain text', async () => {
  assert.equal(await extractText(await save('a.txt', 'plain notes')), 'plain notes');
  assert.equal(await extractText(await save('b.md', '# Heading')), '# Heading');
});

test('rejects formats it cannot parse', async () => {
  await assert.rejects(extractText(await save('old.doc', 'binary')), /Unsupported file type: \.doc/);
});
