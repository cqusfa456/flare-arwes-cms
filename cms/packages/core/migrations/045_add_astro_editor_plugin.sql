-- Add Astro Editor Plugin
-- Migration: 045_add_astro_editor_plugin
-- Description: Register the astro-editor plugin (CodeMirror 6 editor for `astro`
-- fields that hold a whole .astro file's source) and make it active by default,
-- matching how the Quill / EasyMDE editor plugins were registered.
--
-- `defaultTemplate` is intentionally empty: an empty value means "use the
-- built-in starter template", which the plugin exports as DEFAULT_ASTRO_TEMPLATE.
-- Storing that multi-line template here would break the single-line input the
-- generic plugin settings page renders for string settings.

INSERT OR IGNORE INTO plugins (
    id, name, display_name, description, version, author, category, icon,
    status, is_core, permissions, dependencies, settings, installed_at, last_updated
) VALUES (
    'astro-editor',
    'astro-editor',
    'Astro Editor',
    'CodeMirror 6 editor for astro fields. Holds the source of a whole .astro file (frontmatter, markup and expressions) verbatim so the website build can write it to a real page and let Astro compile it.',
    '1.0.0',
    'Sci-Fi CMS Team',
    'editor',
    '🚀',
    'active',
    FALSE,
    '[]',
    '[]',
    '{"theme":"auto","fontSize":13,"tabSize":2,"lineNumbers":true,"defaultTemplate":""}',
    unixepoch(),
    unixepoch()
);
