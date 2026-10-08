import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const locales = [
  { proposals: 'Proposed Changes', verdict: 'Final Change-Impact Verdict', empty: 'No changes proposed',
    fields: ['Scope and artifacts', 'Problem', 'Before example', 'Proposed change and after example', 'Source and distribution impact', 'Pros and cons'],
    source: ['Canonical normative source change', 'Canonical normative source', 'Canonical normative runtime source change'],
    distribution: ['Derived distribution regeneration', 'Derived consumer distribution regeneration'] },
  { proposals: 'Modifiche proposte', verdict: 'Verdetto finale sull’impatto delle modifiche', empty: 'Nessuna modifica proposta',
    fields: ['Ambito e artefatti', 'Problema', 'Esempio prima', 'Modifica proposta ed esempio dopo', 'Impatto su fonte e distribuzione', 'Pro e contro'],
    source: ['Modifica della fonte normativa canonica', 'Fonte normativa canonica'],
    distribution: ['Rigenerazione della distribuzione derivata'] },
];
const clean = value => value.replace(/\*\*|`/g, '').replace(/’/g, "'").trim();
const equal = (a, b) => clean(a).toLowerCase() === clean(b).toLowerCase();
const ids = value => [...value.matchAll(/\bPROP-\d+\b/g)].map(match => match[0]);
const result = (status, errors) => ({ status, assurance: 'Structure and declared consistency only; semantics and chat enforcement NOT VERIFIED', errors });

export function validateReport(markdown) {
  if (typeof markdown !== 'string' || !markdown.trim()) return result('FAIL', ['Empty or malformed report']);
  const lines = [];
  let fence;
  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length && !marker[2].trim()) fence = undefined;
      lines.push('');
    } else if (marker) { fence = marker[1]; lines.push(''); }
    else lines.push(line);
  }
  if (fence) return result('FAIL', ['Unclosed code fence']);
  const headings = lines.flatMap((line, index) => {
    const match = line.match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    return match ? [{ title: clean(match[1]), index }] : [];
  });
  const locale = locales.find(item => headings.some(h => equal(h.title, item.proposals) || equal(h.title, item.verdict)));
  if (!locale) return result('UNSUPPORTED', ['No supported English/Italian terminal headings; NOT VERIFIED']);
  const errors = [];
  const p = headings.filter(h => equal(h.title, locale.proposals));
  const v = headings.filter(h => equal(h.title, locale.verdict));
  if (p.length !== 1 || v.length !== 1) return result('FAIL', ['Exactly one proposals section and one final impact verdict required']);
  if (p[0].index >= v[0].index) return result('FAIL', ['Final impact verdict must follow the complete proposals list']);
  if (headings.some(h => h.index > p[0].index && h.index !== v[0].index)) errors.push('Terminal sections displaced by another heading');
  const body = lines.slice(p[0].index + 1, v[0].index);
  const entries = body.flatMap((line, index) => {
    const match = line.match(/^(\d+)\.\s+(.+)/);
    return match ? [{ number: Number(match[1]), title: clean(match[2]), index }] : [];
  });
  if (!entries.length) errors.push('Missing numbered proposal or no-change entry');
  const empty = entries.length === 1 && entries[0].title.toLowerCase().startsWith(locale.empty.toLowerCase());
  const statuses = { source: [], distribution: [] };
  const proposalIds = [];
  const engineCategories = [];
  function engineImpact(text, context) {
    const matches = [...clean(text).matchAll(/(?:Enforcement engine impact|Impatto (?:sul |del )?motore (?:di )?enforcement):\s*(UNCHANGED|SOURCE_BINDING_ONLY|INTERNAL_ONLY|INTERFACE_CHANGED|UNKNOWN)\s*[—–:-]\s*([^;\n]+)/gi)];
    if (matches.length !== 1) { errors.push(`${context}: one reasoned enforcement engine impact required`); return; }
    const category = matches[0][1];
    if (category === 'INTERFACE_CHANGED') {
      if (!/(?:Interface compatibility|Compatibilità (?:dell')?interfaccia):\s*(compatible_extension|adapter_required)\b/i.test(clean(text)) ||
          !/(?:Before interface|Interfaccia prima):\s*\S/i.test(clean(text)) ||
          !/(?:After interface|Interfaccia dopo):\s*\S/i.test(clean(text))) errors.push(`${context}: interface change requires compatibility and before/after examples`);
    }
    if (category === 'UNKNOWN' && /(?:compatibility verified|compatibilità verificata)/i.test(clean(text))) errors.push(`${context}: unknown impact cannot claim verified compatibility`);
    return category;
  }
  function impact(text, dimension, context) {
    const labels = locale[dimension];
    const chunks = clean(text).split(/\n|;/).map(part => part.replace(/^\s*-\s*/, '').trim());
    const matches = chunks.flatMap(part => {
      const colon = part.indexOf(':');
      if (colon < 0 || !labels.some(label => equal(label, part.slice(0, colon)))) return [];
      return [part.slice(colon + 1).trim()];
    });
    if (matches.length !== 1) { errors.push(`${context}: one independent ${dimension} classification required`); return; }
    const match = matches[0].match(/^(NOT REQUIRED|UNDETERMINED|REQUIRED)\s*(?:[—–-]|:)\s*(\S[\s\S]*)$/);
    if (!match) { errors.push(`${context}: invalid ${dimension} status or missing reason`); return; }
    return match[1];
  }
  for (let index = 0; index < entries.length; index++) {
    const entry = entries[index];
    if (entry.number !== index + 1) errors.push('Nonconsecutive list numbering');
    const content = body.slice(entry.index + 1, entries[index + 1]?.index ?? body.length).join('\n');
    if (empty) {
      if (!clean(entry.title.slice(locale.empty.length) + content).replace(/^[\s:—–-]+/, '').trim()) errors.push('No-change entry needs scope and limitations');
      continue;
    }
    const match = entry.title.match(/^(PROP-\d+)\s+[—–-]\s+.+\[.+\]$/);
    if (!match) { errors.push('Proposal title needs ID, title and finding/priority/disposition metadata'); continue; }
    const id = match[1]; proposalIds.push(id);
    if (id !== `PROP-${String(index + 1).padStart(2, '0')}`) errors.push(`${id}: nonconsecutive or duplicate ID`);
    const meta = entry.title.match(/\[([^\]]+)\]$/)?.[1];
    if (!/\bP[0-3]\b/.test(meta) || meta.split(';').length < 3 || meta.split(';').some(part => !part.trim())) errors.push(`${id}: incomplete finding/priority/disposition metadata`);
    const fields = [];
    for (const line of content.split('\n')) {
      const field = line.match(/^\s*-?\s*\*\*([^*]+?):\*\*\s*(.*)$/);
      if (field) fields.push({ label: field[1], content: field[2] });
      else if (fields.length) fields.at(-1).content += '\n' + line;
    }
    if (fields.length !== 6 || fields.some((field, i) => !equal(field.label, locale.fields[i]))) errors.push(`${id}: six supported labeled fields required in template order`);
    if (fields.some(field => !clean(field.content))) errors.push(`${id}: empty required field/example`);
    const field = fields.find(field => equal(field.label, locale.fields[4]));
    if (field) {
      engineCategories.push(engineImpact(field.content, id));
      for (const dimension of ['source', 'distribution']) statuses[dimension].push(impact(field.content, dimension, id));
      // Filenames establish neither edited region nor intent. Optional explicit roles
      // and the bounded affirmative edit profile below describe captured declarations.
      const roleLines = clean(field.content).split(/\n|;/).map(part => part.replace(/^\s*-\s*/, '').trim());
      const roles = roleLines.filter(part => /^(?:Edited region|Regione modificata):/i.test(part));
      const role = roles[0]?.split(':').slice(1).join(':').trim().toLowerCase();
      const allowed = ['runtime-only', 'maintainer-appendix-only', 'runtime+maintainer-appendix', 'reference-only'];
      if (roles.length > 1 || (roles.length && !allowed.includes(role))) errors.push(`${id}: invalid or duplicate edited region`);
      const editFields = fields.filter(item => equal(item.label, locale.fields[0]) || equal(item.label, locale.fields[3]));
      const explicitEdit = editFields.some(item => /\b(?:edit|modify|update|change|add|remove|modificare|modifica|aggiornare|aggiorna|aggiungere|aggiunge|rimuovere|rimuove)\s+(?:(?:the|il|la|l')\s*)?(?:maintainer appendix|appendice (?:del |per il )?maintainer)\b/i.test(clean(item.content)));
      const appendixRole = role === 'maintainer-appendix-only' || role === 'runtime+maintainer-appendix';
      // Retain clear legacy disclosure, but require a positive edit classification.
      const disclosed = /(?:maintainer appendix|appendice (?:del |per il )?maintainer)[^;\n]*\bREQUIRED\b/i.test(clean(field.content)) &&
        !/(?:maintainer appendix|appendice (?:del |per il )?maintainer)[^;\n]*\b(?:NOT REQUIRED|UNDETERMINED)\b/i.test(clean(field.content));
      if ((explicitEdit || appendixRole) && !disclosed) errors.push(`${id}: physical maintainer appendix edit must be distinguished`);
      if ((explicitEdit || disclosed) && roles.length && !appendixRole) errors.push(`${id}: edited region contradicts declared appendix edit`);
      if (role === 'maintainer-appendix-only' || role === 'reference-only') {
        if (statuses.source.at(-1) !== 'NOT REQUIRED' || statuses.distribution.at(-1) !== 'NOT REQUIRED') errors.push(`${id}: edited region contradicts normative impacts`);
      }
      if (role === 'runtime-only' || role === 'runtime+maintainer-appendix') {
        if (statuses.source.at(-1) !== 'REQUIRED') errors.push(`${id}: runtime edit requires normative source impact`);
      }
    }
  }
  const verdict = lines.slice(v[0].index + 1).join('\n');
  const aggregateEngine = engineImpact(verdict, 'Aggregate');
  const priority = ['UNCHANGED', 'SOURCE_BINDING_ONLY', 'INTERNAL_ONLY', 'INTERFACE_CHANGED', 'UNKNOWN'];
  const expectedEngine = engineCategories.reduce((a,b) => priority.indexOf(b)>priority.indexOf(a)?b:a, 'UNCHANGED');
  if (aggregateEngine !== expectedEngine) errors.push('Aggregate enforcement engine impact contradicts proposals');
  const known = new Set(proposalIds);
  for (const id of ids(lines.join('\n'))) if (!known.has(id)) errors.push(`Unknown cited proposal ID ${id}`);
  for (const dimension of ['source', 'distribution']) {
    const aggregate = impact(verdict, dimension, 'Aggregate');
    const expected = statuses[dimension].includes('REQUIRED') ? 'REQUIRED' : statuses[dimension].includes('UNDETERMINED') ? 'UNDETERMINED' : 'NOT REQUIRED';
    if (aggregate !== expected) errors.push(`Aggregate ${dimension} contradicts all proposals (including deferred)`);
    const labeled = clean(verdict).split('\n').filter(line => locale[dimension].some(label => line.replace(/^\s*-\s*/, '').toLowerCase().startsWith(clean(label).toLowerCase() + ':'))).join('\n');
    for (const id of proposalIds) if (!ids(labeled).includes(id)) errors.push(`Aggregate ${dimension} omits ${id}`);
    if (aggregate === 'REQUIRED' && statuses[dimension].includes('UNDETERMINED') && !/UNDETERMINED/.test(labeled)) errors.push(`Aggregate ${dimension} hides unresolved impacts`);
  }
  if (statuses.source.concat(statuses.distribution).some(status => status === 'REQUIRED' || status === 'UNDETERMINED')) {
    const preamble = body.slice(0, entries[0]?.index ?? 0).join('\n');
    if (!/\*\*[^\n]+\*\*/.test(preamble) || !/REQUIRED|UNDETERMINED/.test(preamble) || proposalIds.some(id => !ids(preamble).includes(id))) errors.push('Missing bold impact notice before list');
    const auditVerdict = headings.find(h => equal(h.title, 'Verdict') || equal(h.title, 'Verdetto'));
    if (auditVerdict && !/^\s*\*\*.*(?:REQUIRED|UNDETERMINED)/.test(lines.slice(auditVerdict.index + 1).find(line => line.trim()) ?? '')) errors.push('Missing opening audit Verdict impact notice');
  }
  return result(errors.length ? 'FAIL' : 'PASS', [...new Set(errors)]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node tools/validate-maintainer-report.mjs <local-report.md>');
    const checked = validateReport(readFileSync(process.argv[2], 'utf8'));
    console.log(JSON.stringify(checked, null, 2));
    process.exitCode = checked.status === 'PASS' ? 0 : checked.status === 'UNSUPPORTED' ? 2 : 1;
  } catch (error) { console.error(JSON.stringify(result('FAIL', [error.message]))); process.exitCode = 1; }
}
