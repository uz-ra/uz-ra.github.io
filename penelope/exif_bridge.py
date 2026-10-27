"""Loopback-only Google Drive image reader for Penelope (standard library only)."""
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = 8769
MAX_BYTES = 80 * 1024 * 1024
LOCAL_ORIGIN = f"http://127.0.0.1:{PORT}"
ALLOWED_ORIGINS = {"https://uz-ra.github.io", "http://127.0.0.1:8768", LOCAL_ORIGIN}
ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "dist" if (ROOT / "dist" / "index.html").is_file() else ROOT
STATIC_FILES = {"/": ("index.html", "text/html; charset=utf-8"),
                "/index.html": ("index.html", "text/html; charset=utf-8"),
                "/app.js": ("app.js", "application/javascript"),
                "/styles.css": ("styles.css", "text/css"),
                "/qrcode.min.js": ("qrcode.min.js", "application/javascript")}


class GoogleRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        target = urllib.parse.urlsplit(newurl)
        if target.scheme != "https" or target.hostname != "drive.usercontent.google.com":
            raise urllib.error.HTTPError(newurl, 403, "Unexpected redirect", headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass  # Image IDs and filenames should not appear in logs.

    def allowed(self):
        same_origin = (not self.headers.get("Origin")
                       and self.headers.get("Referer", "").startswith(LOCAL_ORIGIN + "/"))
        return ((self.headers.get("Origin") in ALLOWED_ORIGINS or same_origin)
                and self.headers.get("Host") == f"127.0.0.1:{PORT}")

    def reply(self, status, data, content_type="application/json"):
        self.send_response(status)
        if self.allowed():
            self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", LOCAL_ORIGIN))
            self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Vary", "Origin")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        try:
            self.wfile.write(data)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_OPTIONS(self):
        self.reply(204 if self.allowed() else 403, b"")

    def do_GET(self):
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path in STATIC_FILES and self.headers.get("Host") == f"127.0.0.1:{PORT}":
            filename, content_type = STATIC_FILES[parsed.path]
            self.reply(200, (ASSETS / filename).read_bytes(), content_type)
            return
        if not self.allowed():
            self.reply(403, b'{"error":"origin not allowed"}')
            return
        if parsed.path == "/health":
            self.reply(200, b'{"service":"penelope-exif-bridge"}')
            return
        params = urllib.parse.parse_qs(parsed.query)
        file_id = params.get("id", [""])[0]
        if parsed.path != "/drive-image" or not re.fullmatch(r"[A-Za-z0-9_-]{10,200}", file_id):
            self.reply(400, b'{"error":"invalid file ID"}')
            return
        query = {"id": file_id, "export": "download"}
        resource_key = params.get("resourcekey", [""])[0]
        if resource_key and re.fullmatch(r"[A-Za-z0-9_-]{1,200}", resource_key):
            query["resourcekey"] = resource_key
        url = "https://drive.usercontent.google.com/download?" + urllib.parse.urlencode(query)
        try:
            opener = urllib.request.build_opener(GoogleRedirects())
            with opener.open(url, timeout=30) as response:
                content_type = response.headers.get("Content-Type", "application/octet-stream")
                if "text/html" in content_type or int(response.headers.get("Content-Length", "0")) > MAX_BYTES:
                    raise ValueError("Image is unavailable or too large")
                data = response.read(MAX_BYTES + 1)
                if len(data) > MAX_BYTES:
                    raise ValueError("Image is too large")
            self.reply(200, data, content_type)
        except Exception:
            self.reply(502, json.dumps({"error": "Google Driveから画像を取得できませんでした"}, ensure_ascii=False).encode())


if __name__ == "__main__":
    print(f"Penelope Exif補助を起動しました: http://127.0.0.1:{PORT}", flush=True)
    print(f"自動取得対応の編集画面: {LOCAL_ORIGIN}/   終了: Ctrl+C", flush=True)
    try:
        ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        pass
