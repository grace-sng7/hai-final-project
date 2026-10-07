import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const notebook = JSON.parse(fs.readFileSync(new URL('../../show_your_work_extraction.ipynb', import.meta.url), 'utf8'));
const outputText = cell => cell.outputs.map(o => {
 const text = o.text ?? o.data?.['text/plain'] ?? [];
 return Array.isArray(text) ? text.join('') : text;
}).join('');
const jsonCell = notebook.cells.find(c => c.source.join('').includes('json.dumps(case_3_result, indent=2)'));
const text = outputText(jsonCell);
const extraction = JSON.parse(text.slice(text.indexOf('{')));
const inputCell = notebook.cells.find(c => c.source.join('').startsWith('case_3_input ='));
const user_message = outputText(inputCell).match(/USER INPUT:\s*"([^\n]+)"/)[1];
const target = new URL('../lib/fixtures/grace-notebook-case3.json', import.meta.url);
fs.writeFileSync(target, JSON.stringify(extraction, null, 2) + '\n');
fs.writeFileSync(new URL('../lib/fixtures/grace-notebook-case3-provenance.json', import.meta.url), JSON.stringify({notebook:'show_your_work_extraction.ipynb', json_cell_index:notebook.cells.indexOf(jsonCell), input_cell_index:notebook.cells.indexOf(inputCell),user_message, note:'Captured saved output; no notebook code or live model was executed. Historical next-May deadline is unverified.'},null,2)+'\n');
console.log(`Captured saved raw JSON to ${fileURLToPath(target)}`);
