"""静态服务：带 no-store，避免浏览器吃旧模块/旧样式。
双击 start.bat 时由它调用；也可直接：
    python serve.py 8000
"""
import sys
import functools
import http.server
import socketserver

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


Handler = functools.partial(NoCacheHandler, directory='.')


class Server(socketserver.ThreadingTCPServer):
    # 模块图会一次并发拉十几个文件，单线程 server 的 backlog 会被打满，
    # 浏览器会报 "Failed to fetch dynamically imported module"。必须多线程。
    allow_reuse_address = True
    daemon_threads = True
    request_queue_size = 64


with Server(('127.0.0.1', PORT), Handler) as httpd:
    print(f'serving on http://127.0.0.1:{PORT}  (no-store, threaded)')
    httpd.serve_forever()
