import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

/**
 * Keeps the API Explorer's endpoint catalog in lockstep with the shipped
 * OpenAPI spec.
 *
 * The catalog is a hand-maintained literal in ApiTestTool.tsx rather than
 * something generated from public/swagger.json at runtime, so nothing would
 * otherwise notice when the spec is refreshed and the catalog is not. This
 * test fails loudly with the exact method+path pairs that drifted.
 *
 * When the Gateway ships a new spec: drop it into public/swagger.json, run
 * this test, and add or remove catalog entries until it passes again.
 */
const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');

const HTTP_METHODS = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options']);

function specOperations(): Set<string> {
  const spec = JSON.parse(fs.readFileSync(path.join(repoRoot, 'public/swagger.json'), 'utf8'));
  const ops = new Set<string>();
  for (const [route, item] of Object.entries(spec.paths as Record<string, object>)) {
    for (const method of Object.keys(item)) {
      if (HTTP_METHODS.has(method.toLowerCase())) ops.add(`${method.toUpperCase()} ${route}`);
    }
  }
  return ops;
}

function catalogOperations(): Set<string> {
  const src = fs.readFileSync(path.join(repoRoot, 'src/components/ApiTestTool.tsx'), 'utf8');
  const start = src.indexOf('const endpointCategories');
  expect(start, 'endpointCategories literal not found').toBeGreaterThan(-1);
  const block = src.slice(start, src.indexOf('\n};', start));

  const ops = new Set<string>();
  const entry = /\{\s*method:\s*'([A-Z]+)',\s*endpoint:\s*'([^']+)'/g;
  for (const match of block.matchAll(entry)) ops.add(`${match[1]} ${match[2]}`);
  return ops;
}

describe('API Explorer endpoint catalog', () => {
  const spec = specOperations();
  const catalog = catalogOperations();

  it('parses a non-trivial number of operations from both sources', () => {
    expect(spec.size).toBeGreaterThan(300);
    expect(catalog.size).toBeGreaterThan(300);
  });

  it('covers every operation in the spec', () => {
    const missing = [...spec].filter((op) => !catalog.has(op)).sort();
    expect(missing, 'in public/swagger.json but absent from endpointCategories').toEqual([]);
  });

  it('advertises no operation the spec does not define', () => {
    const extra = [...catalog].filter((op) => !spec.has(op)).sort();
    expect(extra, 'in endpointCategories but absent from public/swagger.json').toEqual([]);
  });

  it('lists no duplicate entries', () => {
    const src = fs.readFileSync(path.join(repoRoot, 'src/components/ApiTestTool.tsx'), 'utf8');
    const start = src.indexOf('const endpointCategories');
    const block = src.slice(start, src.indexOf('\n};', start));
    const seen: string[] = [];
    for (const m of block.matchAll(/\{\s*method:\s*'([A-Z]+)',\s*endpoint:\s*'([^']+)'/g)) {
      seen.push(`${m[1]} ${m[2]}`);
    }
    const dupes = seen.filter((op, i) => seen.indexOf(op) !== i).sort();
    expect([...new Set(dupes)]).toEqual([]);
  });
});
