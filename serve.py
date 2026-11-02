#!/usr/bin/env python3
"""연습용 작은 서버. 웹앱이 센서 값을 읽으려면 아래 두 헤더가 필요해요 (Vercel에서는 vercel.json이 같은 일을 해요).
사용: python3 serve.py [포트]   ->  http://localhost:포트
"""
import functools
import http.server
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    # 윈도우는 파일 종류를 잘못 알려 줄 때가 있어서(.js가 글자 파일로 나옴) 직접 정해 둬요
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.wasm': 'application/wasm',
        '.json': 'application/json',
        '.css': 'text/css',
        '.html': 'text/html; charset=utf-8',
    }

    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy', 'same-origin')
        self.send_header('Cross-Origin-Embedder-Policy', 'credentialless')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8792
    handler = functools.partial(Handler, directory=HERE)
    # 127.0.0.1 = 이 컴퓨터 안에서만 열려요 (같은 와이파이의 다른 컴퓨터는 못 들어와요)
    http.server.ThreadingHTTPServer(('127.0.0.1', port), handler).serve_forever()
