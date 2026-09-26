#!/usr/bin/env python3
"""Tiny local server for the motion-sensor test page.

Serves index.html over LAN HTTP and HTTPS (self-signed cert) so a phone on the
same Wi-Fi can open it. Sends COOP/COEP headers so Chrome's Generic Sensor API
is allowed. No dependencies beyond Python 3.8+ and (optionally) openssl.
"""
import argparse
import os
import socket
import ssl
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
CERT_DIR = os.path.join(ROOT, ".certs")
CERT = os.path.join(CERT_DIR, "cert.pem")
KEY = os.path.join(CERT_DIR, "key.pem")
INDEX = os.path.join(ROOT, "index.html")

HEADERS = [
    ("Cross-Origin-Opener-Policy", "same-origin"),
    ("Cross-Origin-Embedder-Policy", "require-corp"),
    ("Cache-Control", "no-store"),
]


class Handler(BaseHTTPRequestHandler):
    server_version = "SensorTest/1.0"

    def end_headers(self):
        for name, value in HEADERS:
            self.send_header(name, value)
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0].split("#", 1)[0]
        if path in ("/", "/index.html", "/index.htm"):
            self._send_file(INDEX, "text/html; charset=utf-8")
        elif path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
        else:
            body = b"404 Not Found\n"
            self.send_response(404)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def _send_file(self, full_path, ctype):
        try:
            with open(full_path, "rb") as fh:
                body = fh.read()
        except OSError:
            self.send_error(500, "Cannot read index.html")
            return
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # keep the console clean


def lan_ip():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        ip = sock.getsockname()[0]
    except OSError:
        ip = "127.0.0.1"
    finally:
        sock.close()
    if ip.startswith("127."):
        try:
            ip = socket.gethostbyname(socket.gethostname())
        except OSError:
            ip = "127.0.0.1"
    return ip


def cert_covers_ip(ip):
    if not (os.path.exists(CERT) and os.path.exists(KEY)):
        return False
    try:
        out = subprocess.run(
            ["openssl", "x509", "-in", CERT, "-noout", "-ext", "subjectAltName"],
            capture_output=True, text=True, check=True,
        ).stdout
        return ip in out
    except Exception:
        return False


def ensure_cert(ip):
    if cert_covers_ip(ip):
        return True
    try:
        os.makedirs(CERT_DIR, exist_ok=True)
        san = "DNS:localhost,IP:127.0.0.1,IP:%s" % ip
        subprocess.run(
            ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
             "-days", "825", "-keyout", KEY, "-out", CERT,
             "-subj", "/CN=neuropilet-sensor-test",
             "-addext", "subjectAltName=" + san],
            capture_output=True, check=True,
        )
        return True
    except Exception as exc:
        print("  ! Could not create HTTPS certificate (%s)." % exc)
        print("    HTTPS disabled - sensors will NOT work from a phone over plain HTTP.")
        return False


def run(httpd):
    try:
        httpd.serve_forever()
    except OSError:
        pass


def main():
    parser = argparse.ArgumentParser(description="Serve the motion sensor test page.")
    parser.add_argument("--host", default="0.0.0.0", help="bind address (default 0.0.0.0)")
    parser.add_argument("--http-port", type=int, default=8000)
    parser.add_argument("--https-port", type=int, default=8443)
    parser.add_argument("--no-https", action="store_true", help="skip HTTPS")
    args = parser.parse_args()

    if not os.path.exists(INDEX):
        sys.exit("index.html not found next to server.py")

    ip = lan_ip()
    httpd_http = ThreadingHTTPServer((args.host, args.http_port), Handler)

    threads = []
    https = False
    if not args.no_https and ensure_cert(ip):
        try:
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ctx.load_cert_chain(CERT, KEY)
            httpd_https = ThreadingHTTPServer((args.host, args.https_port), Handler)
            httpd_https.socket = ctx.wrap_socket(httpd_https.socket, server_side=True)
            https = True
        except Exception as exc:
            print("  ! HTTPS server failed to start: %s" % exc)
            httpd_https = None
    else:
        httpd_https = None

    t = threading.Thread(target=run, args=(httpd_http,), daemon=True)
    t.start()
    threads.append(t)
    if https:
        t2 = threading.Thread(target=run, args=(httpd_https,), daemon=True)
        t2.start()
        threads.append(t2)

    print("")
    print("  Motion sensor test server running")
    print("  ---------------------------------")
    if https:
        print("  Phone (HTTPS, recommended): https://%s:%d" % (ip, args.https_port))
    print("  Phone (HTTP, likely blocked): http://%s:%d" % (ip, args.http_port))
    print("  This computer:               http://localhost:%d" % args.http_port)
    print("")
    print("  * Phone and computer must be on the same Wi-Fi/network.")
    if https:
        print("  * The HTTPS certificate is self-signed: your phone will warn you.")
        print("    Accept the warning (e.g. 'show this website') to continue.")
        print("    iPhone: if no 'visit' link appears, tap the URL bar and load it twice.")
    print("  * To allow another IP later, delete the .certs folder and restart.")
    print("")
    print("  Press Ctrl+C to stop.")

    try:
        while True:
            threading.Event().wait(3600)
    except KeyboardInterrupt:
        print("\nStopped.")
        httpd_http.shutdown()
        if httpd_https:
            httpd_https.shutdown()


if __name__ == "__main__":
    main()
