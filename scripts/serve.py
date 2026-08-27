#!/usr/bin/env python3
"""Static dev server that never lets the browser cache a file.

The plain `python3 -m http.server` hands back 304s, so an edited module keeps
running the old code until a hard reload. That is a slow way to chase a bug
that was never there.
"""
from http.server import SimpleHTTPRequestHandler, test


class NoStore(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()


if __name__ == '__main__':
    test(NoStore, port=8000)
