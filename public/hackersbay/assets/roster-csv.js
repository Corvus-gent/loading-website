// Adapted from Moonbase's MIT-licensed attendee-sheet.ts CSV escape.
// See HACKERSBAY_THIRD_PARTY.md for the notice and upstream reference.
const columns = [
  ['name','Pirate name'], ['role','Class or role'], ['deck','Deck status'],
  ['builds','Builds'], ['wants','Wants'], ['offers','Offers']
];

function cell(value) {
  const text = String(value ?? '');
  const guarded = /^[\t\r]|^[\s\uFEFF]*[=+\-@]/.test(text) ? "'" + text : text;
  return /[",\n\r]/.test(guarded) ? '"' + guarded.replaceAll('"','""') + '"' : guarded;
}

export function rosterCsv(attendees, aboard) {
  const headers = columns.map(([,label]) => cell(label)).join(',');
  const records = attendees.map(person => {
    const row = { ...person, deck: aboard.has(person.id) ? 'Aboard' : 'Applicant', builds:person.builds || person.project };
    return columns.map(([key]) => cell(row[key])).join(',');
  });
  return [headers, ...records].join('\r\n');
}
