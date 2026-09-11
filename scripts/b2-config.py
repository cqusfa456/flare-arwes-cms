#!/usr/bin/env python3
"""
Backwards-compatible wrapper around ``scripts/storage-config.py``.

Historically this script only knew how to configure Backblaze B2. Storage
configuration is now provider-agnostic (``b2`` and generic ``s3``), so the real
implementation lives in ``storage-config.py``.

Kept so existing automation that calls ``b2-config.py`` keeps working; it
defaults ``STORAGE_BACKEND`` to ``b2`` when unset.

用法: python3 scripts/b2-config.py /path/to/wrangler.toml
"""
import os
import runpy
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
TARGET = os.path.join(HERE, 'storage-config.py')

# Legacy callers did not set STORAGE_BACKEND — B2 was implied.
if not (os.environ.get('STORAGE_BACKEND') or '').strip():
    os.environ['STORAGE_BACKEND'] = 'b2'

sys.argv = [TARGET] + sys.argv[1:]

runpy.run_path(TARGET, run_name='__main__')
