import http.server
import socketserver
import sys

PORT = 9000

class LogHandler(http.server.BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/log':
            self.send_response(404)
            self.end_headers()
            return
        length = int(self.headers.get('content-length', 0))
        body = self.rfile.read(length).decode('utf-8', errors='replace')
        print('\n[REMOTE LOG] ' + body)
        sys.stdout.flush()
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'OK')

    def log_message(self, format, *args):
        # suppress default logging
        return

if __name__ == '__main__':
    try:
        with socketserver.TCPServer(('0.0.0.0', PORT), LogHandler) as httpd:
            print(f'Log server listening on http://0.0.0.0:{PORT}/log')
            httpd.serve_forever()
    except Exception as e:
        print('Log server error:', e)
