from http import server  # Python 3


class MyHTTPRequestHandler(server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_my_headers()

        server.SimpleHTTPRequestHandler.end_headers(self)

    def send_my_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")

        if self.path.endswith(".js"):
            self.send_header("Content-Type", "application/javascript")


if __name__ == '__main__':
    server.test(HandlerClass=MyHTTPRequestHandler)
