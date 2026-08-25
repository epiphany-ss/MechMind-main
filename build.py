#!/usr/bin/env python3
"""
理论力学研究平台 - 轻量构建工具
用法:
  python build.py dev          # 启动开发服务器 (端口8080)
  python build.py build        # 生产构建 (压缩CSS/JS到dist/)
  python build.py optimize     # 优化图片 (WebP转换)
"""
import os
import sys
import re
import shutil
import http.server
import socketserver
import threading
import time
from pathlib import Path

BASE = Path(__file__).parent
DIST = BASE / 'dist'


def minify_css(css: str) -> str:
    """Simple CSS minifier."""
    # Remove comments
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.DOTALL)
    # Remove whitespace
    css = re.sub(r'\s+', ' ', css)
    # Remove spaces around special chars
    css = re.sub(r'\s*([{}:;,>~+])\s*', r'\1', css)
    # Remove trailing semicolons before }
    css = re.sub(r';}', '}', css)
    return css.strip()


def minify_js(js: str) -> str:
    """Simple JS minifier (conservative - preserves string contents)."""
    lines = js.split('\n')
    result = []
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith('//'):
            continue
        # Remove inline comments (but not in strings)
        if '//' in stripped:
            # Simple heuristic: only remove if not inside quotes
            in_str = False
            for i, c in enumerate(stripped):
                if c in ('"', "'", '`'):
                    in_str = not in_str
                elif not in_str and stripped[i:i+2] == '//':
                    stripped = stripped[:i].rstrip()
                    break
        result.append(stripped)
    joined = ' '.join(result)
    # Compress whitespace
    joined = re.sub(r'\s+', ' ', joined)
    joined = re.sub(r'\s*([{}:;,=<>!&|?+\-*/])\s*', r'\1', joined)
    return joined.strip()


def build():
    """Build production version to dist/."""
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir()

    # Copy structure
    for subdir in ['css', 'js', 'statics', 'qdata']:
        src = BASE / subdir
        if src.exists():
            shutil.copytree(src, DIST / subdir)

    # Copy HTML files
    for html in BASE.glob('*.html'):
        shutil.copy2(html, DIST / html.name)

    # Minify CSS
    css_dir = DIST / 'css'
    if css_dir.exists():
        for css_file in css_dir.glob('*.css'):
            original = css_file.read_text(encoding='utf-8')
            minified = minify_css(original)
            css_file.write_text(minified, encoding='utf-8')
            ratio = (1 - len(minified) / len(original)) * 100 if original else 0
            print(f"  CSS: {css_file.name} ({len(original)} -> {len(minified)} bytes, {ratio:.0f}% smaller)")

    # Minify JS
    js_dir = DIST / 'js'
    if js_dir.exists():
        for js_file in js_dir.glob('*.js'):
            original = js_file.read_text(encoding='utf-8')
            minified = minify_js(original)
            js_file.write_text(minified, encoding='utf-8')
            ratio = (1 - len(minified) / len(original)) * 100 if original else 0
            print(f"  JS:  {js_file.name} ({len(original)} -> {len(minified)} bytes, {ratio:.0f}% smaller)")

    # Report
    total_src = sum(f.stat().st_size for f in BASE.rglob('*') if f.is_file())
    total_dist = sum(f.stat().st_size for f in DIST.rglob('*') if f.is_file())
    print(f"\n  Source: {total_src/1024/1024:.1f} MB")
    print(f"  Build:  {total_dist/1024/1024:.1f} MB")
    print(f"  Saved:  {(total_src-total_dist)/1024/1024:.1f} MB")
    print(f"\n  Output: {DIST}")


def dev_server(port=8080):
    """Start a local dev server with auto-refresh support."""
    os.chdir(BASE)

    class Handler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, format, *args):
            print(f"  [{time.strftime('%H:%M:%S')}] {args[0]}")

        def end_headers(self):
            # Enable CORS for local dev
            self.send_header('Access-Control-Allow-Origin', '*')
            # No-cache for development
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            super().end_headers()

    with socketserver.TCPServer(("", port), Handler) as httpd:
        print(f"  Dev server running at http://localhost:{port}")
        print(f"  Serving: {BASE}")
        print(f"  Press Ctrl+C to stop\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  Server stopped.")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    cmd = sys.argv[1].lower()

    if cmd == 'dev':
        port = int(sys.argv[2]) if len(sys.argv) > 2 else 8080
        dev_server(port)
    elif cmd == 'build':
        print("Building production version...")
        build()
    elif cmd == 'optimize':
        print("Image optimization is handled by convert_to_webp.py")
    else:
        print(f"Unknown command: {cmd}")
        print(__doc__)


if __name__ == '__main__':
    main()
