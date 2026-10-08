// Producer-only exact rendering. Supplied references do not prove ownership,
// host requirements, current-template verification or migration authority.
import { readFileSync } from 'node:fs';
export const pointerPath = 'templates/native-instruction-pointer.md';
export const pointerTemplate = readFileSync(new URL('./templates/native-instruction-pointer.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const tokens = ['<binding-locator>', '<rendered-locator>'];
export function renderNativePointer({ binding, rendered, variation = null }) {
  for (const locator of [binding, rendered]) {
    if (typeof locator !== 'string' || !locator.trim() || /[<>\x00-\x1f\x7f]/.test(locator)) throw Error('Invalid locator');
  }
  const block = pointerTemplate.replace(/<binding-locator>|<rendered-locator>/g, token => token === tokens[0] ? binding : rendered);
  if (variation === null) return block;
  if (!variation || Object.keys(variation).sort().join(',') !== 'documentation_ref,position,text' ||
      !['prefix','suffix'].includes(variation.position) || typeof variation.text !== 'string' || !variation.text.trim() ||
      /OOP activation block:|<binding-locator>|<rendered-locator>/.test(variation.text) ||
      typeof variation.documentation_ref !== 'string' || !/^https:\/\/[^\s]+$/.test(variation.documentation_ref) ||
      (variation.position === 'prefix' && !variation.text.endsWith('\n'))) throw Error('Invalid documented R22 variation');
  return variation.position === 'prefix' ? variation.text + block : block + variation.text;
}
export function matchesNativePointer(actual, options) {
  // No whitespace, newline or Markdown normalization can hide protected edits.
  return typeof actual === 'string' && actual === renderNativePointer(options);
}
