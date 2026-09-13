/**
 * Where a page's content belongs inside the frame it was given.
 *
 * `src/layouts/Layout.astro` marks that spot with this id, inside the layout the
 * page selected. A page with server content has Astro render into it; an app route
 * has none — its content comes from the app — and `AppShell` renders the app into
 * the same element, so the chrome the layout composes stays around either of them.
 *
 * The value lives here, rather than in the layout, because the app needs it too and
 * this module is safe to import from the client bundle.
 */
export const CONTENT_ELEMENT_ID = 'cms-page-content'
