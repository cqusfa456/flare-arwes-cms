#!/usr/bin/env python3
"""
B2 模式部署辅助：改写 wrangler.toml
- 移除所有 r2_buckets 配置块（顶层 + env.production + env.staging）
- 顶层 [vars] 段注入 B2 变量
- [env.production] vars 段注入 B2 变量（env 不继承顶层）

B2 值从环境变量读取：B2_ENDPOINT / B2_BUCKET / B2_ACCESS_KEY_ID / B2_SECRET_ACCESS_KEY / B2_REGION
用法: python3 scripts/b2-config.py /path/to/wrangler.toml
"""
import os
import re
import sys

path = sys.argv[1] if len(sys.argv) > 1 else 'wrangler.toml'
s = open(path, encoding='utf-8').read()

# 1) 删除所有 r2_buckets 配置块（含 env.production / env.staging）
s = re.sub(r'\n?\[\[[^\]]*r2_buckets\]\][^\[]*', '\n', s)

# 2) B2 值（环境变量优先，缺省用空串，避免写入占位符）
env = os.environ
b2_vals = {
    'STORAGE_BACKEND': 'b2',
    'B2_ENDPOINT': env.get('B2_ENDPOINT', ''),
    'B2_BUCKET': env.get('B2_BUCKET', ''),
    'B2_ACCESS_KEY_ID': env.get('B2_ACCESS_KEY_ID', ''),
    'B2_SECRET_ACCESS_KEY': env.get('B2_SECRET_ACCESS_KEY', ''),
    'B2_REGION': env.get('B2_REGION', ''),
}

# 3) 顶层 [vars] 段注入 B2 变量（替换注释行或追加）
def set_var(content, key, value):
    pat = re.compile(r'^#?\s*' + key + r'\s*=\s*"[^"]*"', re.M)
    if pat.search(content):
        return pat.sub(key + ' = "' + value + '"', content)
    return re.sub(
        r'^\[vars\]\s*$',
        f'[vars]\n{key} = "{value}"',
        content,
        count=1,
        flags=re.M,
    )

for k, v in b2_vals.items():
    if v.strip():
        s = set_var(s, k, v.strip())

# 4) [env.production] vars 行：把预置的 B2 占位符替换为真实值
def set_prod_var(content, key, value):
    return re.sub(
        r'(' + key + r'\s*=\s*")[^"]*(")',
        lambda m: m.group(1) + value + m.group(2),
        content,
    )

prod_part_match = re.search(r'(\[env\.production\].*?)(?=\[env\.staging\]|\Z)', s, re.S)
if prod_part_match:
    prod_part = prod_part_match.group(1)
    for k, v in b2_vals.items():
        if v.strip():
            prod_part = set_prod_var(prod_part, k, v.strip())
    s = s[: prod_part_match.start(1)] + prod_part + s[prod_part_match.end(1) :]

open(path, 'w', encoding='utf-8').write(s)
print('B2 storage configured from secrets')
