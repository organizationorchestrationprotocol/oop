// Restricted producer validator for the keywords used by this contract profile.
// Not a general JSON Schema implementation; unsupported keywords are rejected.
const supported = new Set(['$schema', '$id', '$defs', '$ref', 'type', 'const',
  'properties', 'required', 'additionalProperties', 'items', 'uniqueItems', 'minItems', 'minLength']);
export function validateProfile(value, schema) {
  const errors = [];
  function inspectSchema(node) {
    for (const key of Object.keys(node)) if (!supported.has(key)) throw new Error(`Unsupported schema keyword: ${key}`);
    for (const child of Object.values(node.properties ?? {})) inspectSchema(child);
    for (const child of Object.values(node.$defs ?? {})) inspectSchema(child);
    if (node.items) inspectSchema(node.items);
    if (node.additionalProperties !== undefined && typeof node.additionalProperties !== 'boolean') throw new Error('Unsupported additionalProperties');
    const types=Array.isArray(node.type)?node.type:[node.type];
    if(node.type && (!types.length || types.some(type=>!['object','array','string','boolean','null'].includes(type))))throw new Error('Unsupported profile type');
  }
  inspectSchema(schema);
  function check(data, node, path) {
    if(Array.isArray(node.type)) {
      const kind=data===null?'null':Array.isArray(data)?'array':typeof data;
      if(!node.type.includes(kind))return errors.push(`${path}: union type`);
      return check(data,{...node,type:kind},path);
    }
    if (node.$ref) {
      if (!node.$ref.startsWith('#/$defs/') || !Object.hasOwn(schema.$defs ?? {}, node.$ref.slice(8))) throw new Error('Unsupported reference');
      return check(data, schema.$defs[node.$ref.slice(8)], path);
    }
    if (Object.hasOwn(node, 'const') && JSON.stringify(data) !== JSON.stringify(node.const)) errors.push(`${path}: const`);
    if(node.type==='null') {
      if(data!==null)errors.push(`${path}: null required`);
    } else if (node.type === 'boolean') {
      if(typeof data!=='boolean') errors.push(`${path}: boolean required`);
    } else if (node.type === 'string') {
      if (typeof data !== 'string') errors.push(`${path}: string required`);
      else if ([...data].length < (node.minLength ?? 0)) errors.push(`${path}: minLength`);
    } else if (node.type === 'array') {
      if (!Array.isArray(data)) return errors.push(`${path}: array required`);
      if (data.length < (node.minItems ?? 0)) errors.push(`${path}: minItems`);
      if (node.uniqueItems && new Set(data.map(x => JSON.stringify(x))).size !== data.length) errors.push(`${path}: uniqueItems`);
      if (node.items) data.forEach((item, index) => check(item, node.items, `${path}/${index}`));
    } else if (node.type === 'object') {
      if (!data || typeof data !== 'object' || Array.isArray(data)) return errors.push(`${path}: object required`);
      for (const key of node.required ?? []) if (!Object.hasOwn(data, key)) errors.push(`${path}/${key}: required`);
      for (const [key, item] of Object.entries(data)) {
        if (Object.hasOwn(node.properties ?? {}, key)) check(item, node.properties[key], `${path}/${key}`);
        else if (node.additionalProperties === false) errors.push(`${path}/${key}: additional property`);
      }
    }
  }
  check(value, schema, '');
  return errors;
}
