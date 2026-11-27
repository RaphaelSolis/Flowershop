#!/usr/bin/env python3
"""Serve the storefront and the password-protected dashboard on loopback."""

import argparse
from getpass import getpass
from hashlib import pbkdf2_hmac
from http import HTTPStatus
from http.cookies import CookieError, SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import json
import os
from pathlib import Path
from secrets import compare_digest, token_bytes, token_urlsafe
from threading import Lock
from time import monotonic
from urllib.parse import parse_qs, unquote, urlsplit

ADMIN = Path(__file__).resolve().parent
SHOP = ADMIN.parent
CONFIG = Path.home() / ".local/share/flowershop-admin/credentials.json"
USERNAME = "PetalFlower"
LOGIN_PATH = "/Log-Sign/LoginPage.html"
SESSION_COOKIE = "petal_admin"
SESSION_SECONDS = 8 * 60 * 60
PUBLIC_EXTENSIONS = {".html", ".css", ".js", ".ttf", ".webp", ".png", ".jpg"}
PUBLIC_FOLDERS = {"assets", "Log-Sign", "order details page elements"}


def password_digest(password, salt):
    return pbkdf2_hmac("sha256", password.encode(), salt, 600_000)


def setup_credentials():
    if CONFIG.exists():
        raise ValueError(f"Credentials are already configured at {CONFIG}.")
    password = getpass(f"Password for {USERNAME}: ")
    if not 1 <= len(password) <= 128 or password != getpass("Confirm password: "):
        raise ValueError("Enter matching passwords of 1 to 128 characters.")
    salt = token_bytes(16)
    data = {"salt": salt.hex(), "digest": password_digest(password, salt).hex()}
    CONFIG.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor = os.open(CONFIG, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, "w") as file:
        json.dump(data, file)


class ShopServer(ThreadingHTTPServer):
    def __init__(self, port):
        data = json.loads(CONFIG.read_text())
        self.salt = bytes.fromhex(data["salt"])
        self.digest = bytes.fromhex(data["digest"])
        if len(self.salt) != 16 or len(self.digest) != 32:
            raise ValueError("The admin credentials file is invalid.")
        self.sessions = {}
        self.session_lock = Lock()
        super().__init__(("127.0.0.1", port), ShopHandler)
        self.host = f"127.0.0.1:{self.server_port}"
        self.origin = f"http://{self.host}"

    def create_session(self, previous):
        token = token_urlsafe(32)
        now = monotonic()
        with self.session_lock:
            self.sessions = {key: expires for key, expires in self.sessions.items() if expires > now}
            self.sessions.pop(previous, None)
            self.sessions[token] = now + SESSION_SECONDS
        return token

    def authenticated(self, token):
        with self.session_lock:
            return self.sessions.get(token, 0) > monotonic()

    def end_session(self, token):
        with self.session_lock:
            self.sessions.pop(token, None)


class ShopHandler(SimpleHTTPRequestHandler):
    def session_token(self):
        cookies = SimpleCookie()
        try:
            cookies.load(self.headers.get("Cookie", ""))
        except CookieError:
            return ""
        return cookies[SESSION_COOKIE].value if SESSION_COOKIE in cookies else ""

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        if self.path.partition("?")[0].startswith("/admin"):
            self.send_header("Cache-Control", "no-store")
            self.send_header("Referrer-Policy", "same-origin")
            self.send_header(
                "Content-Security-Policy",
                "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; "
                "media-src blob:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
            )
        super().end_headers()

    def empty_response(self, status, *, location=None, token=None):
        self.send_response(status)
        if location:
            self.send_header("Location", location)
        if token is not None:
            age = SESSION_SECONDS if token else 0
            self.send_header("Set-Cookie", f"{SESSION_COOKIE}={token}; Path=/admin/; Max-Age={age}; HttpOnly; SameSite=Strict")
        if status != HTTPStatus.NO_CONTENT:
            self.send_header("Content-Length", "0")
        self.end_headers()

    def login_page(self):
        page = (SHOP / LOGIN_PATH.lstrip("/")).read_text(encoding="utf-8")
        payload = page.replace('id="login-form"', 'id="login-form" data-admin-login="/admin/login"', 1).encode()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        return BytesIO(payload)

    def send_head(self):
        if self.headers.get("Host") != self.server.host:
            self.send_error(HTTPStatus.BAD_REQUEST)
            return None
        route = unquote(urlsplit(self.path).path)
        if route == LOGIN_PATH:
            return self.login_page()
        if route == "/admin":
            self.empty_response(HTTPStatus.SEE_OTHER, location="/admin/")
            return None
        if route == "/admin/":
            if not self.server.authenticated(self.session_token()):
                self.empty_response(HTTPStatus.SEE_OTHER, location=LOGIN_PATH)
                return None
            return self.open_file(ADMIN / "dashboard.html")
        if route == "/admin/dashboard.css":
            return self.open_file(ADMIN / "dashboard.css")
        if route in {"/admin/dashboard.js", "/admin/session"} and self.server.authenticated(self.session_token()):
            if route == "/admin/session":
                self.empty_response(HTTPStatus.NO_CONTENT)
                return None
            return self.open_file(ADMIN / "dashboard.js")

        if route == "/":
            route = "/index.html"
        # Only public storefront files are served. The project and backup directories stay private.
        parts = route.removeprefix("/").split("/")
        if any(not part or part.startswith(".") or "\\" in part or "\x00" in part for part in parts):
            self.send_error(HTTPStatus.NOT_FOUND)
            return None
        candidate = SHOP.joinpath(*parts)
        if candidate.suffix not in PUBLIC_EXTENSIONS or (len(parts) > 1 and parts[0] not in PUBLIC_FOLDERS) or candidate.resolve() != candidate:
            self.send_error(HTTPStatus.NOT_FOUND)
            return None
        return self.open_file(candidate)

    def open_file(self, path):
        try:
            file = path.open("rb")
        except OSError:
            self.send_error(HTTPStatus.NOT_FOUND)
            return None
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", self.guess_type(str(path)))
        self.send_header("Content-Length", str(os.fstat(file.fileno()).st_size))
        if path.parent != ADMIN and path.suffix in {".html", ".css", ".js"}:
            self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        return file

    def do_POST(self):
        route = urlsplit(self.path).path
        if self.headers.get("Host") != self.server.host or self.headers.get("Origin") != self.server.origin:
            self.send_error(HTTPStatus.FORBIDDEN)
            return
        if route == "/admin/logout":
            self.server.end_session(self.session_token())
            self.empty_response(HTTPStatus.SEE_OTHER, location=LOGIN_PATH, token="")
            return
        if route != "/admin/login":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= 4096 or self.headers.get_content_type() != "application/x-www-form-urlencoded":
                raise ValueError
            fields = parse_qs(self.rfile.read(length).decode(), max_num_fields=2)
            username = fields["username"][0]
            password = fields["password"][0]
        except (KeyError, ValueError):
            self.send_error(HTTPStatus.BAD_REQUEST)
            return
        matches = compare_digest(password_digest(password, self.server.salt), self.server.digest)
        if username != USERNAME or not matches:
            self.empty_response(HTTPStatus.UNAUTHORIZED)
            return
        token = self.server.create_session(self.session_token())
        self.empty_response(HTTPStatus.NO_CONTENT, token=token)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--setup", action="store_true", help="Set the initial admin password.")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    try:
        if args.setup:
            setup_credentials()
            return
        with ShopServer(args.port) as server:
            print(f"Admin dashboard: {server.origin}/admin/", flush=True)
            print(f"Storefront: {server.origin}/", flush=True)
            server.serve_forever()
    except FileNotFoundError:
        parser.exit(1, "Run python3 admin/server.py --setup to configure the admin password.\n")
    except (OSError, KeyError, ValueError) as error:
        parser.exit(1, f"{error}\n")
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
