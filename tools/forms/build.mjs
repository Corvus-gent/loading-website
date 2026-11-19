import fs from 'node:fs/promises';
const forms = {};
for (const name of await fs.readdir('forms')) {
  if (!name.endsWith('.ts') || name === 'schema.ts') continue;
  const source = await fs.readFile('forms/' + name, 'utf8');
  const match = source.match(/export default\s+([\s\S]+)\s+satisfies FeedbackForm;/);
  if (!match) throw Error('Form config must be a typed JSON object: ' + name);
  const form = JSON.parse(match[1]);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug) || forms[form.slug]) throw Error('Invalid/duplicate form slug');
  if (!form.questions?.length || new Set(form.questions.map(q => q.id)).size !== form.questions.length) throw Error('Missing/duplicate questions');
  for (const q of form.questions) if (!['thumbs', 'text'].includes(q.type) || !q.label || !form.sections.some(s => s.id === q.section)) throw Error('Invalid question');
  forms[form.slug] = form;
}
await fs.writeFile('forms/generated.js', '// Generated from forms/*.ts by tools/forms/build.mjs. Do not edit.\nexport const forms = ' + JSON.stringify(forms, null, 2) + ';\n');
console.log('Built ' + Object.keys(forms).length + ' feedback form config(s).');
await fs.copyFile('tools/forms/page.html', 'forms/index.html');
