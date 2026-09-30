// ─── TeamSpec — markdown rendering (no external library) ──────────────────────
import { cn } from './styles';

// ─── Lightweight markdown → HTML converter ────────────────────────────────────
function renderTable(rows: string[]): string {
  const cells = (row: string) => row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const [head, , ...body] = rows;
  const th = cells(head).map(c => `<th>${c}</th>`).join('');
  const tr = body.map(r => `<tr>${cells(r).map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
  return `<table class="ts-md-table"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
}

export function markdownToHtml(md: string): string {
  if (!md) return '';

  // Placeholders keep code content away from the inline/paragraph rules below
  const blocks: string[] = [];
  const stash = (html: string) => `\uE000${blocks.push(html) - 1}\uE000`;

  let html = md
    .replace(/\r\n/g, '\n')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // YAML frontmatter
  html = html.replace(/^---\n([\s\S]*?)\n---\n/, (_, yaml) =>
    stash(`<pre class="ts-code-block"><code class="language-yaml">${yaml}</code></pre>`) + '\n');

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
    stash(`<pre class="ts-code-block"><code class="language-${lang || 'text'}">${code.trimEnd()}</code></pre>`));

  // Inline code
  html = html.replace(/`([^`\n]+)`/g, (_, code) => stash(`<code class="ts-inline-code">${code}</code>`));

  // Tables: header row + |---| separator + body rows
  html = html.replace(/^(\|.*\|\n\|[\s:|-]+\|\n(?:\|.*\|(?:\n|$))*)/gm, table =>
    stash(renderTable(table.trim().split('\n'))) + '\n');

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3 class="ts-md-h3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="ts-md-h2">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="ts-md-h1">$1</h1>');

  // Bold + Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr class="ts-md-hr" />');

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="ts-md-blockquote">$1</blockquote>');

  // Task list checkboxes
  html = html.replace(/^[-*] \[x\] (.+)$/gim, '<li class="ts-md-li ts-md-task done">☑ $1</li>');
  html = html.replace(/^[-*] \[ \] (.+)$/gm, '<li class="ts-md-li ts-md-task">☐ $1</li>');

  // Unordered + ordered list items, consecutive items wrapped in <ul>
  html = html.replace(/^[-*] (.+)$/gm, '<li class="ts-md-li">$1</li>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ts-md-li">$1</li>');
  html = html.replace(/((?:<li class="ts-md-li[^"]*">.*<\/li>\n?)+)/g, '<ul class="ts-md-ul">$1</ul>');

  // Links (only http/https/relative targets)
  html = html.replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/|#)[^)\s]*)\)/g,
    '<a href="$2" class="ts-md-link" target="_blank" rel="noopener">$1</a>');

  // Paragraphs — wrap lines that aren't already wrapped in block tags
  const lines = html.split('\n');
  const processed: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      processed.push('');
    } else if (
      trimmed.startsWith('<h1') ||
      trimmed.startsWith('<h2') ||
      trimmed.startsWith('<h3') ||
      trimmed.startsWith('<pre') ||
      trimmed.startsWith('<ul') ||
      trimmed.startsWith('<li') ||
      trimmed.startsWith('<hr') ||
      trimmed.startsWith('<blockquote') ||
      trimmed.startsWith('</') ||
      /^\uE000\d+\uE000$/.test(trimmed)
    ) {
      processed.push(trimmed);
    } else {
      processed.push(`<p class="ts-md-p">${trimmed}</p>`);
    }
  }

  const restore = (s: string): string =>
    s.replace(/\uE000(\d+)\uE000/g, (_, i) => restore(blocks[Number(i)]));
  return restore(processed.join('\n'));
}

// Tailwind typography classes for rendered markdown
export const MARKDOWN_CLASS = cn(
  'prose prose-sm prose-zinc max-w-none',
  'prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-xl prose-h2:mt-6 prose-h2:border-b prose-h2:border-zinc-200 prose-h2:pb-1.5 prose-h2:text-base',
  'prose-p:leading-relaxed prose-p:text-zinc-700 prose-li:text-zinc-700 prose-strong:text-zinc-900',
  'prose-a:text-indigo-700 prose-a:no-underline hover:prose-a:underline',
  'prose-code:rounded prose-code:bg-zinc-100 prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.85em] prose-code:font-normal prose-code:text-indigo-700 prose-code:before:content-none prose-code:after:content-none',
  'prose-pre:rounded-xl prose-pre:border prose-pre:border-zinc-200 prose-pre:bg-zinc-50 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-zinc-700',
  'prose-blockquote:border-indigo-400/60 prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:text-zinc-600',
  'prose-table:text-xs prose-th:bg-zinc-50 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 prose-hr:border-zinc-200',
  '[&_.ts-md-task]:list-none [&_.ts-md-task]:-ml-5 [&_.ts-md-task.done]:text-zinc-500 [&_.ts-md-task.done]:line-through',
);
