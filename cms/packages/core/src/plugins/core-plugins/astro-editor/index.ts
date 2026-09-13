/**
 * Astro Editor Plugin
 *
 * Provides a CodeMirror 6 editor for `astro` fields. The stored value is the
 * source of a whole `.astro` file (frontmatter, markup and `{expressions}`),
 * kept verbatim: the website build writes it to a real page file and lets
 * Astro compile it.
 *
 * CodeMirror is loaded from a CDN as ES modules (the same approach the Quill
 * plugin uses for Quill itself). The field markup always contains a plain
 * textarea; it stays visible and usable until CodeMirror has mounted, and it
 * takes over again when the CDN modules cannot be loaded, so an editor can
 * never lose access to the value.
 */

import { PluginBuilder } from '../../sdk/plugin-builder'
import type { Plugin } from '@sci-fi-cms/core'

/**
 * Astro Editor configuration options
 */
export interface AstroEditorOptions {
  /** 'auto' follows the admin dark mode class on <html>. */
  theme?: 'auto' | 'dark' | 'light'
  /** Editor font size in pixels. */
  fontSize?: number
  /** Spaces used for indentation (and Tab-to-indent). */
  tabSize?: number
  /** Show the line number gutter. */
  lineNumbers?: boolean
  /** Inserted into a new, empty astro field. Empty means "use the built-in template". */
  defaultTemplate?: string
  placeholder?: string
  /** Editor viewport height in pixels. */
  height?: number
}

/**
 * Built-in starter template for a new Astro page. It renders inside the site's
 * own layout, so a freshly created page is valid Astro from the first save.
 */
export const DEFAULT_ASTRO_TEMPLATE = `---
import Layout from '@/layouts/Layout.astro'
---

<Layout title="New page" pathname="/new-page">
  <div class="flex-1 overflow-y-auto p-4 md:p-8">
    <h1 class="font-header text-size-2 text-primary-main-3">New page</h1>
    <p class="text-primary-low-2">Written in the CMS, rendered by Astro.</p>
  </div>
</Layout>`

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * A problem found in an .astro source. Offsets are character offsets in the
 * source, `line` is 1-based.
 */
export interface AstroSourceProblem {
  from: number
  to: number
  line: number
  message: string
}

const ASTRO_FENCE = /^---[ \t\r]*$/

function lineOf(text: string, offset: number): number {
  let line = 1
  const limit = Math.min(offset, text.length)
  for (let i = 0; i < limit; i++) {
    if (text.charAt(i) === '\n') line++
  }
  return line
}

/**
 * Offset of the first `{` that is never closed, ignoring strings and comments.
 * Returns -1 when braces balance.
 */
function findUnclosedBrace(text: string, start: number): number {
  const stack: number[] = []
  let quote: string | null = null
  let escaped = false
  let lineComment = false
  let blockComment = false

  for (let i = start; i < text.length; i++) {
    const ch = text.charAt(i)
    const next = text.charAt(i + 1)

    if (lineComment) {
      if (ch === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false
        i++
      }
      continue
    }
    if (quote) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === quote) {
        quote = null
      }
      continue
    }
    if (ch === '/' && next === '/') {
      lineComment = true
      i++
      continue
    }
    if (ch === '/' && next === '*') {
      blockComment = true
      i++
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{') stack.push(i)
    else if (ch === '}' && stack.length) stack.pop()
  }

  return stack.length ? stack[0]! : -1
}

/**
 * Server-side validation of an `astro` field value.
 *
 * It mirrors the browser-side checks the editor runs while typing (see
 * `getAstroEditorScript`): the frontmatter fences have to balance, the file
 * must not be empty and every `{` has to be closed. The value itself is never
 * rewritten — an empty optional field is valid (a page without astro source
 * keeps rendering through the markdown path).
 */
export function analyzeAstroSource(source: string): AstroSourceProblem[] {
  const text = typeof source === 'string' ? source : ''
  const problems: AstroSourceProblem[] = []

  if (text.trim() === '') {
    problems.push({
      from: 0,
      to: 0,
      line: 1,
      message: 'This Astro file is empty - add frontmatter and markup.'
    })
    return problems
  }

  const firstBreak = text.indexOf('\n')
  const firstLine = firstBreak === -1 ? text : text.slice(0, firstBreak)
  const opensWithFence = ASTRO_FENCE.test(firstLine)

  if (text.slice(0, 3) === '---' && !opensWithFence) {
    problems.push({
      from: 0,
      to: Math.min(3, text.length),
      line: 1,
      message: 'The frontmatter block must start on the first line with a --- fence.'
    })
  }

  let bodyStart = 0

  if (opensWithFence) {
    let closed = false
    let scan = firstBreak === -1 ? text.length : firstBreak + 1
    while (scan <= text.length) {
      const nextBreak = text.indexOf('\n', scan)
      const lineEnd = nextBreak === -1 ? text.length : nextBreak
      if (ASTRO_FENCE.test(text.slice(scan, lineEnd))) {
        closed = true
        bodyStart = nextBreak === -1 ? text.length : nextBreak + 1
        break
      }
      if (nextBreak === -1) break
      scan = nextBreak + 1
    }
    if (!closed) {
      problems.push({
        from: 0,
        to: Math.min(3, text.length),
        line: 1,
        message: 'Frontmatter is not closed - add the closing --- fence.'
      })
    }
  } else if (text.slice(0, 3) !== '---') {
    const lines = text.split('\n')
    let offset = 0
    const limit = Math.min(lines.length, 6)
    for (let i = 1; i < limit; i++) {
      offset += (lines[i - 1] ?? '').length + 1
      if (ASTRO_FENCE.test(lines[i] ?? '')) {
        problems.push({
          from: offset,
          to: Math.min(offset + 3, text.length),
          line: i + 1,
          message: 'Found a --- fence, but the file does not start with a frontmatter block.'
        })
        break
      }
    }
  }

  const unclosed = findUnclosedBrace(text, bodyStart)
  if (unclosed !== -1) {
    problems.push({
      from: unclosed,
      to: Math.min(unclosed + 1, text.length),
      line: lineOf(text, unclosed),
      message: 'Unclosed { - an expression or attribute value is never closed.'
    })
  }

  return problems
}

/**
 * Render an Astro editor field.
 *
 * The hidden input carries the submitted value (exactly the file source). The
 * textarea is both the no-JavaScript fallback and the value CodeMirror is
 * mounted from, so nothing is rendered twice into the form payload.
 *
 * @param fieldId - The field ID (also the hidden input's id)
 * @param fieldName - The field name submitted with the form
 * @param value - The current value (the .astro source, verbatim)
 * @param options - Editor configuration options
 * @returns HTML string for the Astro editor field
 */
export function renderAstroField(
  fieldId: string,
  fieldName: string,
  value: string = '',
  options: AstroEditorOptions = {}
): string {
  const text = typeof value === 'string' ? value : ''
  const safeId = escapeHtml(fieldId)
  const safeName = escapeHtml(fieldName)
  const placeholder = typeof options.placeholder === 'string' && options.placeholder
    ? options.placeholder
    : 'Write the .astro source here...'

  // Only explicitly configured options become data attributes: anything left
  // out is filled in by the page-wide plugin settings in the client script.
  const dataAttributes: string[] = [`data-field-id="${safeId}"`]
  if (options.theme === 'dark' || options.theme === 'light' || options.theme === 'auto') {
    dataAttributes.push(`data-theme="${escapeHtml(options.theme)}"`)
  }
  if (typeof options.fontSize === 'number') {
    dataAttributes.push(`data-font-size="${escapeHtml(String(options.fontSize))}"`)
  }
  if (typeof options.tabSize === 'number') {
    dataAttributes.push(`data-tab-size="${escapeHtml(String(options.tabSize))}"`)
  }
  if (typeof options.lineNumbers === 'boolean') {
    dataAttributes.push(`data-line-numbers="${options.lineNumbers ? 'true' : 'false'}"`)
  }
  if (typeof options.placeholder === 'string' && options.placeholder) {
    dataAttributes.push(`data-placeholder="${escapeHtml(options.placeholder)}"`)
  }
  if (typeof options.height === 'number') {
    dataAttributes.push(`data-height="${escapeHtml(String(options.height))}"`)
  }

  return `
    <div
      class="astro-editor-container"
      ${dataAttributes.join('\n      ')}
      data-state="idle"
    >
      <div class="astro-editor-shell">
        <div class="astro-editor-toolbar">
          <span class="astro-editor-badge">Astro</span>
          <span class="astro-editor-caption">.astro source &mdash; frontmatter, markup and expressions are stored verbatim</span>
        </div>

        <!-- CodeMirror mounts here; it stays hidden until the CDN modules load -->
        <div
          id="${safeId}-editor"
          class="astro-editor-surface"
          data-astro-surface
          hidden
        ></div>

        <!-- Fallback + source of truth until CodeMirror takes over (never submitted itself: no name) -->
        <textarea
          id="${safeId}-textarea"
          class="astro-editor-textarea"
          data-astro-textarea
          rows="18"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          aria-label="${escapeHtml(placeholder)}"
          placeholder="${escapeHtml(placeholder)}"
        >${escapeHtml(text)}</textarea>

        <div
          id="${safeId}-status"
          class="astro-editor-status"
          data-state="idle"
          role="status"
          aria-live="polite"
        ></div>
      </div>

      <!-- Hidden input to store the actual source for form submission -->
      <input
        type="hidden"
        id="${safeId}"
        name="${safeName}"
        value="${escapeHtml(text)}"
      >
    </div>
  `
}

/**
 * Styles for the Astro editor field. Injected once per page by the admin form.
 */
export function getAstroEditorStyles(): string {
  return `
    <style>
      .astro-editor-container {
        position: relative;
        max-width: 100%;
      }

      .astro-editor-shell {
        overflow: hidden;
        border-radius: 0.5rem;
        border: 1px solid #e4e4e7;
        background-color: #ffffff;
      }

      .dark .astro-editor-shell {
        border-color: #27272a;
        background-color: #09090b;
      }

      .astro-editor-toolbar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.375rem 0.75rem;
        border-bottom: 1px solid #e4e4e7;
        background-color: #fafafa;
      }

      .dark .astro-editor-toolbar {
        border-bottom-color: #27272a;
        background-color: #18181b;
      }

      .astro-editor-badge {
        font-size: 0.6875rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: #a21caf;
      }

      .dark .astro-editor-badge {
        color: #f0abfc;
      }

      .astro-editor-caption {
        font-size: 0.6875rem;
        color: #71717a;
      }

      .astro-editor-surface {
        max-height: 75vh;
        overflow: auto;
      }

      .astro-editor-textarea {
        display: block;
        width: 100%;
        min-height: 320px;
        max-height: 75vh;
        margin: 0;
        padding: 0.75rem;
        border: 0;
        outline: none;
        resize: vertical;
        background-color: transparent;
        color: #18181b;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
        font-size: 13px;
        line-height: 1.6;
        tab-size: 2;
      }

      .dark .astro-editor-textarea {
        color: #e4e4e7;
      }

      .astro-editor-status {
        padding: 0.375rem 0.75rem;
        font-size: 0.75rem;
        line-height: 1.4;
        border-top: 1px solid transparent;
      }

      .astro-editor-status:empty {
        display: none;
      }

      .astro-editor-status[data-state='invalid'] {
        color: #b45309;
        background-color: rgba(245, 158, 11, 0.08);
        border-top-color: rgba(245, 158, 11, 0.35);
      }

      .dark .astro-editor-status[data-state='invalid'] {
        color: #fcd34d;
        background-color: rgba(245, 158, 11, 0.12);
      }

      .astro-editor-status[data-state='warning'] {
        color: #b45309;
      }

      .dark .astro-editor-status[data-state='warning'] {
        color: #fcd34d;
      }

      .astro-editor-container[data-state='invalid'] .astro-editor-shell {
        border-color: #f59e0b;
        box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.35);
      }
    </style>
  `
}

/**
 * Client script for the Astro editor field.
 *
 * Loads CodeMirror 6 from the esm.sh ES module CDN, mounts every
 * `.astro-editor-container` on the page, keeps the hidden input in sync and
 * validates the source as it is typed. Any failure (offline admin, blocked CDN,
 * incompatible modules) leaves the plain textarea in place.
 *
 * @param settings - Plugin settings, used as page-wide defaults for every field
 * @returns `<style>` + `<script type="module">` tags
 */
export function getAstroEditorScript(settings: AstroEditorOptions = {}): string {
  const payload = {
    theme: settings.theme === 'dark' || settings.theme === 'light' ? settings.theme : 'auto',
    fontSize: typeof settings.fontSize === 'number' ? settings.fontSize : 13,
    tabSize: typeof settings.tabSize === 'number' ? settings.tabSize : 2,
    lineNumbers: settings.lineNumbers === false ? false : true,
    defaultTemplate: typeof settings.defaultTemplate === 'string' ? settings.defaultTemplate : '',
    placeholder: typeof settings.placeholder === 'string' ? settings.placeholder : 'Write the .astro source here...'
  }

  // Escaped so a template containing "</script>" cannot close this tag early.
  const settingsJson = JSON.stringify(payload).replace(/</g, '\\u003c')

  return getAstroEditorStyles() + String.raw`
    <script type="module">
      /* Astro Editor — CodeMirror 6 (ES modules from a CDN) with a textarea fallback. */
      (function () {
        'use strict';

        var SETTINGS = ${settingsJson};
        var NL = '\n';
        var DEFAULT_TEMPLATE = ${JSON.stringify(DEFAULT_ASTRO_TEMPLATE).replace(/</g, '\\u003c')};
        var CONTAINER_SELECTOR = '.astro-editor-container';

        // Every range/version specifier below is the same one the CodeMirror
        // packages use internally, so esm.sh resolves them to one shared module
        // instance per package (two copies of @codemirror/state break the editor).
        var MODULE_URLS = [
          'https://esm.sh/@codemirror/state@^6.0.0?target=es2022',
          'https://esm.sh/@codemirror/view@^6.0.0?target=es2022',
          'https://esm.sh/@codemirror/commands@^6.0.0?target=es2022',
          'https://esm.sh/@codemirror/language@^6.0.0?target=es2022',
          'https://esm.sh/@codemirror/autocomplete@^6.0.0?target=es2022',
          'https://esm.sh/@codemirror/lint@^6.0.0?target=es2022',
          'https://esm.sh/@codemirror/lang-html@6.4.9',
          'https://esm.sh/@codemirror/theme-one-dark@6.1.2'
        ];

        var modulesPromise = null;

        function loadModules() {
          if (!modulesPromise) {
            modulesPromise = Promise.all(MODULE_URLS.map(function (url) { return import(url); }))
              .then(function (mods) {
                return {
                  state: mods[0],
                  view: mods[1],
                  commands: mods[2],
                  language: mods[3],
                  autocomplete: mods[4],
                  lint: mods[5],
                  html: mods[6],
                  theme: mods[7]
                };
              });
          }
          return modulesPromise;
        }

        /* ------------------------------ validation ------------------------------ */

        function isFenceLine(line) {
          return /^---[ \t\r]*$/.test(line);
        }

        /**
         * Locate the frontmatter block. "open" is true when the file starts with a
         * --- fence; "end" is the offset just past the closing fence (-1 when the
         * fence is never closed).
         */
        function frontmatterRange(text) {
          var found = { open: false, start: -1, closingStart: -1, end: -1 };
          if (text.slice(0, 3) !== '---') {
            return found;
          }
          var firstBreak = text.indexOf(NL);
          if (firstBreak === -1) {
            found.open = true;
            found.start = 0;
            return found;
          }
          if (!/^[ \t\r]*$/.test(text.slice(3, firstBreak))) {
            return found;
          }
          found.open = true;
          found.start = 0;
          var scan = firstBreak + 1;
          while (scan <= text.length) {
            var nextBreak = text.indexOf(NL, scan);
            var lineEnd = nextBreak === -1 ? text.length : nextBreak;
            if (isFenceLine(text.slice(scan, lineEnd))) {
              found.closingStart = scan;
              found.end = nextBreak === -1 ? text.length : nextBreak + 1;
              return found;
            }
            if (nextBreak === -1) {
              break;
            }
            scan = nextBreak + 1;
          }
          return found;
        }

        /**
         * Offset of the first "{" that is never closed, ignoring strings and
         * comments. Returns -1 when braces are balanced.
         */
        function findUnclosedBrace(text, start) {
          var stack = [];
          var quote = null;
          var escaped = false;
          var lineComment = false;
          var blockComment = false;
          for (var i = start; i < text.length; i++) {
            var ch = text.charAt(i);
            var next = text.charAt(i + 1);
            if (lineComment) {
              if (ch === NL) lineComment = false;
              continue;
            }
            if (blockComment) {
              if (ch === '*' && next === '/') { blockComment = false; i++; }
              continue;
            }
            if (quote) {
              if (escaped) { escaped = false; continue; }
              if (ch === '\\') { escaped = true; continue; }
              if (ch === quote) quote = null;
              continue;
            }
            if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
            if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
            if (ch === '"' || ch === "'" || ch === '\u0060') { quote = ch; continue; }
            if (ch === '{') stack.push(i);
            else if (ch === '}' && stack.length) stack.pop();
          }
          return stack.length ? stack[0] : -1;
        }

        /**
         * Non-blocking validation of an .astro source. Returns a list of
         * { from, to, line, message } problems; it never throws.
         */
        function analyze(text) {
          var src = text === null || text === undefined ? '' : String(text);
          var problems = [];
          if (src.trim() === '') {
            problems.push({ from: 0, to: 0, line: 1, message: 'This Astro file is empty - add frontmatter and markup.' });
            return problems;
          }

          var fm = frontmatterRange(src);
          if (src.slice(0, 3) === '---' && !fm.open) {
            problems.push({ from: 0, to: Math.min(3, src.length), line: 1, message: 'The frontmatter block must start on the first line with a --- fence.' });
          } else if (fm.open && fm.end === -1) {
            problems.push({ from: 0, to: Math.min(3, src.length), line: 1, message: 'Frontmatter is not closed - add the closing --- fence.' });
          }

          if (!fm.open) {
            var lines = src.split(NL);
            var offset = 0;
            var limit = Math.min(lines.length, 6);
            for (var i = 1; i < limit; i++) {
              offset += lines[i - 1].length + 1;
              if (isFenceLine(lines[i])) {
                problems.push({ from: offset, to: Math.min(offset + 3, src.length), line: i + 1, message: 'Found a --- fence, but the file does not start with a frontmatter block.' });
                break;
              }
            }
          }

          var bodyStart = fm.open && fm.end !== -1 ? fm.end : 0;
          var unclosed = findUnclosedBrace(src, bodyStart);
          if (unclosed !== -1) {
            problems.push({ from: unclosed, to: Math.min(unclosed + 1, src.length), line: lineOf(src, unclosed), message: 'Unclosed { - an expression or attribute value is never closed.' });
          }

          return problems;
        }

        function lineOf(text, offset) {
          var line = 1;
          for (var i = 0; i < offset && i < text.length; i++) {
            if (text.charAt(i) === NL) line++;
          }
          return line;
        }

        function summarize(problems) {
          return problems.map(function (problem) {
            return 'Line ' + problem.line + ': ' + problem.message;
          }).join('  ');
        }

        function lintDiagnostics(text) {
          var length = text.length;
          return analyze(text).map(function (problem) {
            var from = Math.max(0, Math.min(problem.from, length));
            var to = Math.max(from, Math.min(problem.to, length));
            return { from: from, to: to, severity: 'warning', message: problem.message };
          });
        }

        /* --------------------------------- UI ---------------------------------- */

        function statusElement(container) {
          return container.querySelector('.astro-editor-status');
        }

        function renderStatus(container, problems, notice) {
          var hasProblems = !!(problems && problems.length);
          var state = hasProblems ? 'invalid' : (notice ? 'warning' : 'idle');
          container.setAttribute('data-state', state);
          var el = statusElement(container);
          if (!el) return;
          el.setAttribute('data-state', state);
          var message = '';
          if (notice) message += notice;
          if (hasProblems) message += (message ? ' ' : '') + summarize(problems);
          el.textContent = message ? '\u26a0 ' + message : '';
        }

        /* ------------------------------- field wiring -------------------------- */

        function fieldParts(container) {
          var fieldId = container.getAttribute('data-field-id') || '';
          return {
            fieldId: fieldId,
            hidden: fieldId ? document.getElementById(fieldId) : null,
            textarea: container.querySelector('[data-astro-textarea]'),
            surface: container.querySelector('[data-astro-surface]')
          };
        }

        /** Insert the default template into a new (empty) field, exactly once. */
        function applyDefaultTemplate(container, textarea, hidden) {
          if (container.getAttribute('data-astro-template-applied') === 'true') return;
          if (!textarea || textarea.value !== '') return;
          var template = typeof SETTINGS.defaultTemplate === 'string' && SETTINGS.defaultTemplate ? SETTINGS.defaultTemplate : DEFAULT_TEMPLATE;
          if (!template) return;
          container.setAttribute('data-astro-template-applied', 'true');
          textarea.value = template;
          if (hidden) hidden.value = template;
        }

        /**
         * Make the container usable with the plain textarea: bind the value sync
         * and show the current validation state. Runs before (and instead of)
         * CodeMirror.
         */
        function prepare(container) {
          if (container.getAttribute('data-astro-init') === 'true') return false;
          container.setAttribute('data-astro-init', 'true');
          var parts = fieldParts(container);
          if (!parts.textarea) return false;
          applyDefaultTemplate(container, parts.textarea, parts.hidden);
          if (parts.hidden) parts.hidden.value = parts.textarea.value;
          if (container.getAttribute('data-astro-bound') !== 'true') {
            container.setAttribute('data-astro-bound', 'true');
            parts.textarea.addEventListener('input', function () {
              if (parts.hidden) parts.hidden.value = parts.textarea.value;
              renderStatus(container, analyze(parts.textarea.value), null);
            });
          }
          renderStatus(container, analyze(parts.textarea.value), null);
          return true;
        }

        /** Keep the textarea visible and usable (CDN blocked, mount failed, ...). */
        function useTextareaFallback(container, notice) {
          var parts = fieldParts(container);
          if (parts.surface) parts.surface.hidden = true;
          if (parts.textarea) {
            parts.textarea.style.display = '';
            parts.textarea.removeAttribute('aria-hidden');
          }
          renderStatus(container, analyze(parts.textarea ? parts.textarea.value : ''), notice);
        }

        function toInt(value, fallback) {
          var parsed = parseInt(value, 10);
          return isNaN(parsed) ? fallback : parsed;
        }

        function spaces(count) {
          var out = '';
          for (var i = 0; i < count; i++) out += ' ';
          return out;
        }

        function editorTheme(EditorView, isDark, fontSize, height) {
          var mono = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
          return EditorView.theme({
            '&': {
              fontSize: fontSize + 'px',
              backgroundColor: isDark ? '#09090b' : '#ffffff',
              color: isDark ? '#e4e4e7' : '#18181b'
            },
            '&.cm-focused': { outline: 'none' },
            '.cm-scroller': { fontFamily: mono, lineHeight: '1.6', maxHeight: height + 'px', overflow: 'auto' },
            '.cm-content': { padding: '0.75rem 0', caretColor: isDark ? '#f4f4f5' : '#18181b' },
            '.cm-line': { padding: '0 0.75rem' },
            '.cm-gutters': {
              backgroundColor: isDark ? '#09090b' : '#fafafa',
              color: isDark ? '#71717a' : '#a1a1aa',
              border: 'none',
              borderRight: '1px solid ' + (isDark ? '#27272a' : '#e4e4e7')
            },
            '.cm-activeLine': { backgroundColor: isDark ? 'rgba(63, 63, 70, 0.25)' : 'rgba(244, 244, 245, 0.7)' },
            '.cm-activeLineGutter': { backgroundColor: isDark ? 'rgba(63, 63, 70, 0.25)' : 'rgba(228, 228, 231, 0.7)' },
            '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.35)' : 'rgba(59, 130, 246, 0.2)'
            },
            '.cm-cursor, .cm-dropCursor': { borderLeftColor: isDark ? '#f4f4f5' : '#18181b' },
            '.cm-astro-frontmatter': { backgroundColor: isDark ? 'rgba(39, 39, 42, 0.7)' : 'rgba(244, 244, 245, 0.9)' },
            '.cm-astro-frontmatter-fence': { color: isDark ? '#f0abfc' : '#a21caf', fontWeight: '600' },
            '.cm-astro-expression': {
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.22)' : 'rgba(59, 130, 246, 0.12)',
              borderRadius: '3px'
            },
            '.cm-astro-component': { color: isDark ? '#7dd3fc' : '#0369a1', fontWeight: '600' },
            '.cm-tooltip': {
              backgroundColor: isDark ? '#18181b' : '#ffffff',
              border: '1px solid ' + (isDark ? '#3f3f46' : '#e4e4e7'),
              color: isDark ? '#e4e4e7' : '#18181b'
            },
            '.cm-lintRange-warning': {
              backgroundImage: 'none',
              textDecoration: 'underline wavy ' + (isDark ? '#fbbf24' : '#d97706')
            },
            '.cm-panel.cm-panel-lint': {
              backgroundColor: isDark ? '#18181b' : '#ffffff',
              color: isDark ? '#e4e4e7' : '#18181b'
            }
          }, { dark: isDark });
        }

        /**
         * Small custom layer on top of the HTML language support: the frontmatter
         * block (fences + contents), {expressions} and <Component /> tags.
         */
        function astroDecorations(mods) {
          var Decoration = mods.view.Decoration;
          var ViewPlugin = mods.view.ViewPlugin;

          function build(state) {
            var text = state.doc.toString();
            var marks = [];
            var fm = frontmatterRange(text);
            var bodyStart = 0;

            if (fm.open) {
              marks.push(Decoration.mark({ class: 'cm-astro-frontmatter-fence' }).range(fm.start, Math.min(fm.start + 3, text.length)));
              if (fm.end !== -1) {
                marks.push(Decoration.mark({ class: 'cm-astro-frontmatter-fence' }).range(fm.closingStart, Math.min(fm.closingStart + 3, text.length)));
                if (fm.end > fm.start + 3) {
                  marks.push(Decoration.mark({ class: 'cm-astro-frontmatter' }).range(fm.start, fm.end));
                }
                bodyStart = fm.end;
              } else {
                bodyStart = text.length;
              }
            }

            var body = text.slice(bodyStart);
            var match;
            var expression = /\{[^{}\n]*\}/g;
            while ((match = expression.exec(body)) !== null) {
              marks.push(Decoration.mark({ class: 'cm-astro-expression' }).range(bodyStart + match.index, bodyStart + match.index + match[0].length));
            }
            var component = /<\/?[A-Z][A-Za-z0-9_.:-]*(\s[^<>\n]*)?\/?>/g;
            while ((match = component.exec(body)) !== null) {
              marks.push(Decoration.mark({ class: 'cm-astro-component' }).range(bodyStart + match.index, bodyStart + match.index + match[0].length));
            }

            return Decoration.set(marks, true);
          }

          return ViewPlugin.fromClass(
            class {
              constructor(view) {
                this.decorations = build(view.state);
              }
              update(update) {
                if (update.docChanged) {
                  this.decorations = build(update.state);
                }
              }
            },
            { decorations: function (instance) { return instance.decorations; } }
          );
        }

        function mount(container, mods) {
          var parts = fieldParts(container);
          if (!parts.textarea || !parts.surface) return false;

          applyDefaultTemplate(container, parts.textarea, parts.hidden);
          var initial = parts.textarea.value;

          var EditorState = mods.state.EditorState;
          var EditorView = mods.view.EditorView;
          var view = mods.view;
          var language = mods.language;

          var theme = container.getAttribute('data-theme') || SETTINGS.theme || 'auto';
          if (theme !== 'dark' && theme !== 'light') theme = 'auto';
          var isDark = theme === 'dark' || (theme === 'auto' && document.documentElement.classList.contains('dark'));
          var fontSize = toInt(container.getAttribute('data-font-size'), toInt(SETTINGS.fontSize, 13));
          var tabSize = toInt(container.getAttribute('data-tab-size'), toInt(SETTINGS.tabSize, 2));
          var lineNumbersAttribute = container.getAttribute('data-line-numbers');
          var lineNumbers = lineNumbersAttribute === null ? SETTINGS.lineNumbers !== false : lineNumbersAttribute !== 'false';
          var placeholder = container.getAttribute('data-placeholder') || SETTINGS.placeholder || '';
          var height = toInt(container.getAttribute('data-height'), 520);

          var extensions = [
            view.highlightSpecialChars(),
            mods.commands.history(),
            view.drawSelection(),
            view.dropCursor(),
            EditorState.allowMultipleSelections.of(true),
            language.indentOnInput(),
            language.syntaxHighlighting(language.defaultHighlightStyle, { fallback: true }),
            language.bracketMatching(),
            view.highlightActiveLine(),
            view.highlightActiveLineGutter(),
            view.rectangularSelection(),
            view.crosshairCursor(),
            mods.autocomplete.closeBrackets(),
            EditorState.tabSize.of(tabSize),
            language.indentUnit.of(spaces(tabSize)),
            view.keymap.of([].concat(
              mods.commands.defaultKeymap,
              mods.commands.historyKeymap,
              mods.autocomplete.closeBracketsKeymap,
              [mods.commands.indentWithTab]
            )),
            mods.html.html(),
            mods.lint.linter(function (target) { return lintDiagnostics(target.state.doc.toString()); }, { delay: 400 }),
            mods.lint.lintGutter(),
            astroDecorations(mods),
            editorTheme(EditorView, isDark, fontSize, height),
            EditorView.updateListener.of(function (update) {
              if (!update.docChanged) return;
              var text = update.state.doc.toString();
              if (parts.hidden) {
                // The submitted value is the file source, exactly as typed.
                parts.hidden.value = text;
                parts.hidden.dispatchEvent(new Event('input', { bubbles: true }));
              }
              renderStatus(container, analyze(text), null);
            })
          ];

          if (lineNumbers) extensions.push(view.lineNumbers());
          if (isDark) extensions.push(language.syntaxHighlighting(mods.theme.oneDarkHighlightStyle));
          if (placeholder) extensions.push(view.placeholder(placeholder));

          var state = EditorState.create({ doc: initial, extensions: extensions });
          var editor = new EditorView({ state: state, parent: parts.surface });

          parts.surface.removeAttribute('hidden');
          parts.surface.hidden = false;
          parts.textarea.style.display = 'none';
          parts.textarea.setAttribute('aria-hidden', 'true');
          container.setAttribute('data-astro-mounted', 'true');
          container.__astroEditor = editor;

          if (parts.hidden) parts.hidden.value = editor.state.doc.toString();
          renderStatus(container, analyze(editor.state.doc.toString()), null);
          return true;
        }

        /* ------------------------------- bootstrap ----------------------------- */

        function initEditors() {
          var containers = document.querySelectorAll(CONTAINER_SELECTOR);
          if (!containers.length) return;

          var pending = [];
          Array.prototype.forEach.call(containers, function (container) {
            if (container.getAttribute('data-astro-mounted') === 'true') return;
            if (prepare(container)) pending.push(container);
          });
          if (!pending.length) return;

          loadModules().then(function (mods) {
            pending.forEach(function (container) {
              if (container.getAttribute('data-astro-mounted') === 'true') return;
              try {
                mount(container, mods);
              } catch (error) {
                console.error('[Astro Editor] Failed to start CodeMirror:', error);
                useTextareaFallback(container, 'CodeMirror could not start - using the plain textarea.');
              }
            });
          }).catch(function (error) {
            console.warn('[Astro Editor] CodeMirror modules could not be loaded from the CDN:', error);
            pending.forEach(function (container) {
              useTextareaFallback(container, 'CodeMirror could not be loaded from the CDN - using the plain textarea.');
            });
          });
        }

        window.initializeAstroEditors = initEditors;
        window.astroEditorAnalyze = analyze;

        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', initEditors);
        } else {
          initEditors();
        }

        // Re-initialize after HTMX swaps (new fields, preview panes, ...)
        if (typeof htmx !== 'undefined') {
          document.body.addEventListener('htmx:afterSwap', initEditors);
        }
      })();
    </script>
  `
}

/**
 * Create the Astro Editor Plugin
 */
export function createAstroEditorPlugin(): Plugin {
  const builder = PluginBuilder.create({
    name: 'astro-editor',
    version: '1.0.0',
    description: 'CodeMirror 6 editor for astro fields (whole .astro file source)'
  })

  builder.metadata({
    author: {
      name: 'Sci-Fi CMS Team',
      email: 'team@arwes.dev'
    },
    license: 'MIT',
    compatibility: '^2.0.0'
  })

  builder.lifecycle({
    activate: async () => {
      console.info('✅ Astro Editor plugin activated')
    },

    deactivate: async () => {
      console.info('❌ Astro Editor plugin deactivated')
    }
  })

  return builder.build() as Plugin
}

// Export the plugin instance
export const astroEditorPlugin = createAstroEditorPlugin()
