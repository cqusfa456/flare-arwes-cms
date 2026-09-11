#!/usr/bin/env python3
"""
Media storage backend deploy helper: rewrite wrangler.toml for a non-R2 backend.

What it does
------------
1. Removes every ``[[*r2_buckets]]`` block (top level, ``env.production``,
   ``env.staging``) so the Worker no longer holds an R2 binding.
2. Injects ``STORAGE_BACKEND`` plus the provider's variables into the top-level
   ``[vars]`` section.
3. Injects the same values into ``[env.production]`` vars, because Wrangler
   environments do not inherit top-level vars.

Providers (``STORAGE_BACKEND``)
-------------------------------
- ``b2`` → B2_ENDPOINT / B2_BUCKET / B2_ACCESS_KEY_ID / B2_SECRET_ACCESS_KEY / B2_REGION
- ``s3`` → S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY /
           S3_REGION / S3_FORCE_PATH_STYLE

Values come from the process environment (GitHub secrets → step env), so no
credential is ever written into the repository. Only the ephemeral
``wrangler.toml`` inside the runner is modified.

Usage
-----
    STORAGE_BACKEND=b2 python3 scripts/storage-config.py cms/packages/cms/wrangler.toml
"""
import os
import re
import sys

# Provider → (required vars, optional vars)
PROVIDERS = {
    'b2': (
        ['B2_BUCKET', 'B2_ACCESS_KEY_ID', 'B2_SECRET_ACCESS_KEY'],
        ['B2_ENDPOINT', 'B2_REGION'],
    ),
    's3': (
        ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY'],
        ['S3_ENDPOINT', 'S3_REGION', 'S3_FORCE_PATH_STYLE'],
    ),
}

# Aliases accepted by the Worker's resolveStorage() — kept in sync with
# cms/packages/core/src/storage/providers.ts
ALIASES = {
    'backblaze': 'b2',
    'backblaze-b2': 'b2',
    'aws': 's3',
    'aws-s3': 's3',
    'minio': 's3',
    'wasabi': 's3',
    's3-compatible': 's3',
}


def fail(message):
    print(f'::error::storage-config.py: {message}', file=sys.stderr)
    return 1


def set_var(content, key, value):
    """Set ``key = "value"`` in the file, replacing the first placeholder.

    Matches both commented (``# KEY = "..."``) and active forms so the
    placeholders shipped in wrangler.toml can be filled in place.
    """
    pattern = re.compile(r'^#?[ \t]*' + re.escape(key) + r'[ \t]*=[ \t]*"[^"]*"', re.M)
    matches = pattern.findall(content)

    if len(matches) > 1:
        print(f'::warning::storage-config.py: {key} has {len(matches)} placeholders; only the first is set')

    return pattern.sub(lambda m: f'{key} = "{value}"', content, count=1)


def set_env_production_var(content, key, value):
    """Replace ``KEY = "..."`` inside [env.production] (inline ``vars = { ... }``)."""
    return re.sub(
        r'(' + re.escape(key) + r'[ \t]*=[ \t]*")[^"]*(")',
        lambda m: m.group(1) + value + m.group(2),
        content,
        count=1,
    )


def main():
    raw_backend = (os.environ.get('STORAGE_BACKEND') or '').strip().lower()
    backend = ALIASES.get(raw_backend, raw_backend)

    if backend in ('', 'r2', 'cloudflare', 'cloudflare-r2', 'cf'):
        # Nothing to rewrite: the R2 binding stays as shipped.
        print('STORAGE_BACKEND is unset or r2 — leaving wrangler.toml untouched')
        return 0

    if backend not in PROVIDERS:
        return fail(
            f'unsupported STORAGE_BACKEND "{raw_backend}" '
            f'(expected b2 or s3; use the default path for r2)'
        )

    path = sys.argv[1] if len(sys.argv) > 1 else 'wrangler.toml'
    with open(path, encoding='utf-8') as handle:
        content = handle.read()

    required, optional = PROVIDERS[backend]
    values = {'STORAGE_BACKEND': backend}
    for key in required + optional:
        values[key] = (os.environ.get(key) or '').strip()

    missing = [key for key in required if not values[key]]
    if missing:
        return fail(
            f'STORAGE_BACKEND={backend} requires {", ".join(missing)} '
            f'(add them as repository secrets)'
        )

    # 1) Drop every R2 binding block, for all environments.
    content = re.sub(r'\n?\[\[[^\]]*r2_buckets\]\][^\[]*', '\n', content)

    # 2) Top-level [vars] — placeholders exist for every key except
    #    STORAGE_BACKEND when switching away from the default.
    for key, value in values.items():
        if value:
            content = set_var(content, key, value)

    # 3) [env.production] vars. Optional vars that were left empty keep their
    #    empty placeholder so the Worker falls back to its own defaults
    #    (region → endpoint derivation, path-style addressing, ...).
    match = re.search(r'(\[env\.production\].*?)(?=\[env\.staging\]|\Z)', content, re.S)
    if match:
        block = match.group(1)
        for key, value in values.items():
            if value:
                block = set_env_production_var(block, key, value)
        content = content[: match.start(1)] + block + content[match.end(1) :]
    else:
        print('::warning::storage-config.py: no [env.production] section found; production vars not updated')

    with open(path, 'w', encoding='utf-8') as handle:
        handle.write(content)

    print(f'{backend.upper()} storage configured (R2 bindings removed)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
