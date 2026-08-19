import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

/**
 * Guards the Tailwind build pipeline.
 *
 * This repository previously shipped a pre-compiled Tailwind snapshot as
 * src/index.css with no Tailwind compiler wired into the build. The result was
 * a silent failure mode: any utility class not already baked into that snapshot
 * did nothing at all, so dialogs rendered full-bleed, overlays never appeared,
 * and switches were invisible - with a green build and a green test suite.
 *
 * These assertions are deliberately structural, so the failure mode stays loud.
 */
const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../..');
const read = (rel: string) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

describe('Tailwind build pipeline', () => {
  it('registers the Tailwind Vite plugin', () => {
    const viteConfig = read('vite.config.ts');
    expect(viteConfig).toMatch(/from '@tailwindcss\/vite'/);
    expect(viteConfig).toMatch(/tailwindcss\(\)/);
  });

  it('declares tailwindcss and @tailwindcss/vite as dependencies', () => {
    const pkg = JSON.parse(read('package.json'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps).toHaveProperty('tailwindcss');
    expect(deps).toHaveProperty('@tailwindcss/vite');
  });

  it('keeps src/index.css as Tailwind source, not compiled output', () => {
    const css = read('src/index.css');
    expect(css).toMatch(/@import ["']tailwindcss["']/);
    // A compiled Tailwind v4 bundle starts with its own banner and is full of
    // --tw-* custom property declarations; source CSS has neither.
    expect(css).not.toMatch(/^\/\*! tailwindcss v/);
    expect(css).not.toMatch(/--tw-backdrop-saturate/);
  });

  it('maps the design tokens the components actually reference', () => {
    const css = read('src/index.css');
    for (const token of [
      '--color-background',
      '--color-foreground',
      '--color-primary',
      '--color-muted-foreground',
      '--color-border',
      '--color-input',
      '--color-input-background',
      '--color-switch-background',
      '--color-ring',
    ]) {
      expect(css, `${token} missing from @theme inline`).toContain(token);
    }
  });

  it('has no versioned import specifiers left over from the Figma export', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
          const src = fs.readFileSync(full, 'utf8');
          // e.g. a Figma export writes: from "@radix-ui/react-dialog" with a
          // pinned "@<major>.<minor>.<patch>" suffix glued onto the specifier.
          if (/from\s+["'][^"']+@\d+\.\d+\.\d+["']/.test(src)) {
            offenders.push(path.relative(repoRoot, full));
          }
        }
      }
    };
    walk(path.join(repoRoot, 'src'));
    expect(offenders).toEqual([]);
  });
});
