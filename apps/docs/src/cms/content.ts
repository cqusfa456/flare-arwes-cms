/**
 * Content helpers for CMS-rendered pages.
 */

/**
 * Remove the leading `# Title` a document renders for itself, but only when it
 * matches the title the page renders — otherwise a different heading would be
 * dropped. Without this a CMS page printed its heading twice: once from the
 * document and once from the page.
 */
export const stripLeadingTitle = (html: string, title: string): string => {
  const match = html.match(/^\s*<h1[^>]*>([\s\S]*?)<\/h1>\s*/i)
  if (!match) {
    return html
  }

  const heading = match[1].replace(/<[^>]*>/g, '').trim()
  return heading === title.trim() ? html.slice(match[0].length) : html
}
