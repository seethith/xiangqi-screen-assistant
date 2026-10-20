from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parent.parent / 'dist')
class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy','same-origin')
        self.send_header('Cross-Origin-Embedder-Policy','require-corp')
        self.send_header('Cross-Origin-Resource-Policy','same-origin')
        self.send_header('Cache-Control','no-cache')
        super().end_headers()
print('中途局面助手: http://127.0.0.1:8767',flush=True)
ThreadingHTTPServer(('127.0.0.1',8767),Handler).serve_forever()
