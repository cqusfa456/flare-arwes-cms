#!/usr/bin/env python3
"""
Cloudflare resource bootstrap for the deploy workflow.

Why this exists
---------------
The deploy used to read ``CF_D1_DATABASE_ID`` / ``CF_KV_NAMESPACE_ID`` from
repository secrets. A resource id is not self-describing: when the database or
namespace behind it is deleted (or belongs to another account) ``wrangler
deploy`` fails with an opaque binding error, and re-creating the resource means
editing secrets by hand before the next run.

This script resolves the resources **by name** instead, creating them when they
do not exist, and writes the ids into the ephemeral ``wrangler.toml`` inside the
runner. Deploying onto a fresh account — or onto one whose resources were
deleted — therefore needs no manual step. Nothing is persisted to the repository
and no credential is written anywhere.

Resources
---------
- D1 database    ``sci-fi-cms-db``     (override: ``D1_NAME``)
- KV namespace   ``sci-fi-cms-cache``  (override: ``KV_NAME``)
- R2 bucket      ``sci-fi-cms-media``  (override: ``R2_NAME``, skip: ``SKIP_R2=1``)

R2 is only needed when Cloudflare R2 is the media backend; with
``STORAGE_BACKEND=b2``/``s3`` the R2 binding is removed and the bucket is
skipped (``scripts/storage-config.py`` does the removal).

Usage
-----
    python3 scripts/cf-resources.py cms/packages/cms/wrangler.toml

Requires ``CLOUDFLARE_API_TOKEN`` / ``CLOUDFLARE_ACCOUNT_ID`` in the
environment (the same ones wrangler uses) and a working ``npx wrangler``.
"""
import json
import os
import re
import subprocess
import sys

D1_NAME = os.environ.get('D1_NAME') or 'sci-fi-cms-db'
KV_NAME = os.environ.get('KV_NAME') or 'sci-fi-cms-cache'
R2_NAME = os.environ.get('R2_NAME') or 'sci-fi-cms-media'
SKIP_R2 = (os.environ.get('SKIP_R2') or '').strip() in ('1', 'true', 'yes')

UUID_RE = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
KV_ID_RE = re.compile(r'[0-9a-f]{32}')


def fail(message):
    print(f'::error::cf-resources.py: {message}', file=sys.stderr)
    return 1


def wrangler(args, expect_json=False):
    """Run ``npx wrangler <args>`` and return stdout.

    Raises RuntimeError with the stderr tail on a non-zero exit so the workflow
    log shows Cloudflare's own message instead of a Python traceback.
    """
    cmd = ['npx', 'wrangler'] + args
    print(f'  $ {" ".join(cmd)}')
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        tail = (result.stderr or result.stdout or '').strip()[-600:]
        raise RuntimeError(f'{" ".join(cmd)} exited {result.returncode}: {tail}')
    return result.stdout or ''


def parse_json_array(raw, what):
    """Parse a JSON array from wrangler output, tolerating leading log lines."""
    start = raw.find('[')
    if start < 0:
        raise RuntimeError(f'no JSON array in `{what}` output: {raw.strip()[:300]}')
    try:
        data = json.loads(raw[start:])
    except json.JSONDecodeError as error:
        raise RuntimeError(f'could not parse `{what}` output ({error}): {raw.strip()[:300]}')
    if not isinstance(data, list):
        raise RuntimeError(f'`{what}` did not return a list')
    return data


def ensure_d1():
    for entry in parse_json_array(wrangler(['d1', 'list', '--json']), 'd1 list'):
        if entry.get('name') == D1_NAME:
            print(f'  D1 "{D1_NAME}" exists ({entry.get("uuid")})')
            return entry['uuid']
    print(f'  D1 "{D1_NAME}" not found — creating')
    out = wrangler(['d1', 'create', D1_NAME])
    match = UUID_RE.search(out)
    if not match:
        raise RuntimeError(f'created {D1_NAME} but no database id in the output: {out.strip()[:300]}')
    return match.group(0)


def ensure_kv():
    for entry in parse_json_array(wrangler(['kv', 'namespace', 'list']), 'kv namespace list'):
        if entry.get('title') == KV_NAME:
            print(f'  KV "{KV_NAME}" exists ({entry.get("id")})')
            return entry['id']
    print(f'  KV "{KV_NAME}" not found — creating')
    out = wrangler(['kv', 'namespace', 'create', KV_NAME])
    match = KV_ID_RE.search(out)
    if not match:
        raise RuntimeError(f'created {KV_NAME} but no namespace id in the output: {out.strip()[:300]}')
    return match.group(0)


def ensure_r2():
    names = [entry.get('name') for entry in parse_json_array(wrangler(['r2', 'bucket', 'list']), 'r2 bucket list')]
    if R2_NAME in names:
        print(f'  R2 "{R2_NAME}" exists')
        return R2_NAME
    print(f'  R2 "{R2_NAME}" not found — creating')
    wrangler(['r2', 'bucket', 'create', R2_NAME])
    return R2_NAME


def rewrite(path, d1_id, kv_id, r2_name):
    """Fill the placeholders in wrangler.toml (all environments)."""
    with open(path, encoding='utf-8') as handle:
        content = handle.read()

    # database_name / database_id appear for the top-level, env.production and
    # env.staging blocks; every one of them must point at a real database.
    content, d1_ids = re.subn(
        r'^(\s*database_id[ \t]*=[ \t]*)"[^"]*"', lambda m: m.group(1) + f'"{d1_id}"', content, flags=re.M
    )
    content, d1_names = re.subn(
        r'^(\s*database_name[ \t]*=[ \t]*)"[^"]*"', lambda m: m.group(1) + f'"{D1_NAME}"', content, flags=re.M
    )
    content, kv_ids = re.subn(
        r'^(\s*id[ \t]*=[ \t]*)"[^"]*"', lambda m: m.group(1) + f'"{kv_id}"', content, flags=re.M
    )
    bucket_names = 0
    if r2_name:
        content, bucket_names = re.subn(
            r'^(\s*bucket_name[ \t]*=[ \t]*)"[^"]*"', lambda m: m.group(1) + f'"{r2_name}"', content, flags=re.M
        )

    if d1_ids == 0:
        return fail('no database_id placeholder found in wrangler.toml')
    if kv_ids == 0:
        return fail('no KV id placeholder found in wrangler.toml')

    with open(path, 'w', encoding='utf-8') as handle:
        handle.write(content)

    print(
        '  wrangler.toml updated: '
        f'{d1_ids} database_id, {d1_names} database_name, {kv_ids} KV id'
        + (f', {bucket_names} bucket_name' if r2_name else '')
    )
    return 0


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else 'wrangler.toml'
    if not os.path.exists(path):
        return fail(f'{path} not found')

    if not os.environ.get('CLOUDFLARE_API_TOKEN'):
        return fail('CLOUDFLARE_API_TOKEN is not set (wrangler cannot authenticate)')

    print(f'Resolving Cloudflare resources (R2 {"skipped" if SKIP_R2 else "included"})')
    try:
        d1_id = ensure_d1()
        kv_id = ensure_kv()
        r2_name = None if SKIP_R2 else ensure_r2()
    except RuntimeError as error:
        return fail(str(error))

    code = rewrite(path, d1_id, kv_id, r2_name)
    if code:
        return code

    print(f'D1 {D1_NAME} = {d1_id}')
    print(f'KV {KV_NAME} = {kv_id}')
    if r2_name:
        print(f'R2 {r2_name}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
