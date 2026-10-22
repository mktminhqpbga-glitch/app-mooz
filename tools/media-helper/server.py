"""Loopback-only yt-dlp helper. No browser cookies or third-party download service."""
from __future__ import annotations
import argparse
import concurrent.futures
import hmac
import json
import mimetypes
from pathlib import Path
import re
import secrets
import shutil
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

DOMAINS = ('youtube.com', 'youtu.be', 'tiktok.com', 'facebook.com', 'fb.watch', 'instagram.com', 'x.com', 'twitter.com', 'douyin.com', 'vimeo.com', 'dailymotion.com', 'dai.ly', 'bilibili.com', 'b23.tv')
VERSION = '1.0.0'

def validate_url(value):
    if not isinstance(value, str) or len(value) > 8192:
        raise ValueError('Link không hợp lệ.')
    url = urlsplit(value.strip())
    if url.scheme not in ('https', 'http') or url.username or url.password or url.port not in (None, 80, 443):
        raise ValueError('Chỉ nhận link HTTP/HTTPS công khai.')
    host = (url.hostname or '').lower()
    if not any(host == domain or host.endswith('.' + domain) for domain in DOMAINS):
        raise ValueError('Nền tảng này chưa được bộ tải hỗ trợ.')
    return url.geturl()

class Manager:
    def __init__(self, root, token, downloader=None):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.token = token
        self.jobs = {}
        self.lock = threading.RLock()
        self.pool = concurrent.futures.ThreadPoolExecutor(max_workers=2)
        self.downloader = downloader or self.download
        self.ffmpeg = bool(shutil.which('ffmpeg'))
        self.cleanup()

    def cleanup(self):
        # Only own job directories; do not traverse user folders or symlinks.
        for path in self.root.iterdir():
            if re.fullmatch('[a-f0-9]{32}', path.name) and path.is_dir() and not path.is_symlink() and time.time() - path.stat().st_mtime > 86400:
                shutil.rmtree(path, ignore_errors=True)

    def create(self, value, quality):
        url = validate_url(value)
        if quality not in ('720', '1080', 'best'):
            raise ValueError('Chất lượng không hợp lệ.')
        with self.lock:
            if sum(job['status'] in ('queued', 'running') for job in self.jobs.values()) >= 8:
                raise ValueError('Đang có 8 tác vụ. Đợi tải xong rồi thêm link.')
            identity = secrets.token_hex(16)
            job = dict(id=identity, status='queued', message='Đang đợi lượt tải…', cancel=threading.Event(), ticket=secrets.token_hex(24), created=time.time())
            self.jobs[identity] = job
        self.pool.submit(self.run, job, url, quality)
        return identity

    def run(self, job, url, quality):
        directory = self.root / job['id']
        try:
            directory.mkdir()
            with self.lock:
                if job['cancel'].is_set():
                    raise ValueError('Đã hủy tải.')
                job.update(status='running', message='Đang đọc link và chọn định dạng…')
            path, title = self.downloader(job, url, quality, directory)
            path = Path(path).resolve()
            if not path.is_relative_to(directory.resolve()) or not path.is_file() or not path.stat().st_size:
                raise ValueError('Bộ tải không tạo được tệp media hợp lệ.')
            name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '_', title).strip('. ')[:100] or 'Video'
            with self.lock:
                if job['cancel'].is_set():
                    raise ValueError('Đã hủy tải.')
                job.update(status='done', file=path, filename=name + path.suffix, message='Đã xử lý xong.', finished=time.time())
        except Exception as error:
            with self.lock:
                job.update(status='cancelled' if job['cancel'].is_set() else 'error', error=str(error)[:1500], message='Không hoàn tất tải.')
            shutil.rmtree(directory, ignore_errors=True)

    def download(self, job, url, quality, directory):
        try:
            import yt_dlp
        except ImportError as error:
            raise ValueError('Chưa cài yt-dlp. Chạy start-windows.bat hoặc start.sh.') from error
        def progress(data):
            if job['cancel'].is_set():
                raise ValueError('Đã hủy tải.')
            total = data.get('total_bytes') or data.get('total_bytes_estimate')
            done = data.get('downloaded_bytes', 0)
            with self.lock:
                job['message'] = ('Đang tải ' + str(min(99, round(done / total * 100))) + '%') if total else 'Đang tải dữ liệu…'
        height = '' if quality == 'best' else f'[height<={quality}]'
        fmt = f'bv*{height}+ba/b{height}' if self.ffmpeg else f'b{height}[vcodec!=none][acodec!=none]'
        options = dict(format=fmt, outtmpl=str(directory / 'media.%(ext)s'), noplaylist=True,
                       quiet=True, no_warnings=True, progress_hooks=[progress], socket_timeout=20,
                       retries=2, fragment_retries=2, max_filesize=1024 * 1024 * 1024,
                       merge_output_format='mp4', cachedir=False, restrictfilenames=True)
        with yt_dlp.YoutubeDL(options) as loader:
            info = loader.extract_info(url, download=True)
        if not info or info.get('_type') in ('playlist', 'multi_video'):
            raise ValueError('Chỉ tải một video mỗi link; không tải toàn bộ danh sách.')
        candidates = [p for p in directory.glob('media.*') if p.suffix.lower() in ('.mp4', '.webm', '.mkv', '.mov', '.flv', '.m4v')]
        if not candidates:
            raise ValueError('Không tìm thấy video tải xong. Có thể link cần đăng nhập hoặc FFmpeg.')
        return max(candidates, key=lambda p: p.stat().st_size), str(info.get('title') or 'Video')

    def view(self, identity):
        with self.lock:
            job = self.jobs.get(identity)
            if not job:
                raise KeyError('Không tìm thấy tác vụ.')
            result = {key: job[key] for key in ('id', 'status', 'message', 'error', 'filename') if key in job}
            if job['status'] == 'done':
                result['path'] = f"/files/{identity}?ticket={job['ticket']}"
            return result

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # URLs and local access tokens are never printed in access logs.

    def origin_ok(self):
        origin = self.headers.get('Origin')
        return origin is None or re.fullmatch(r'chrome-extension://[a-p]{32}', origin) is not None

    def cors(self):
        origin = self.headers.get('Origin')
        if origin and self.origin_ok():
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        self.send_header('Access-Control-Allow-Private-Network', 'true')

    def reply(self, code, value):
        content = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(code)
        self.cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(content)

    def authorized(self):
        if not self.origin_ok():
            self.reply(403, {'error': 'Chỉ extension được phép gọi bộ tải này.'})
            return False
        if not hmac.compare_digest(self.headers.get('Authorization', '').encode(), ('Bearer ' + self.server.manager.token).encode()):
            self.reply(401, {'error': 'Mã kết nối bộ tải chưa đúng. Dán mã trong cửa sổ bộ tải rồi thử lại.'})
            return False
        return True

    def do_OPTIONS(self):
        if not self.origin_ok():
            return self.reply(403, {'error': 'Origin không được phép.'})
        self.send_response(204)
        self.cors()
        self.send_header('Access-Control-Allow-Headers', 'Authorization, Content-Type')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.end_headers()

    def do_GET(self):
        value = urlsplit(self.path)
        match = re.fullmatch('/files/([a-f0-9]{32})', value.path)
        if match:
            if not self.origin_ok():
                return self.reply(403, {'error': 'Origin không được phép.'})
            with self.server.manager.lock:
                job = self.server.manager.jobs.get(match[1])
                ticket = parse_qs(value.query).get('ticket', [''])[0]
                if not job or job['status'] != 'done' or not hmac.compare_digest(ticket.encode(), job['ticket'].encode()) or time.time() - job['finished'] > 3600:
                    return self.reply(403, {'error': 'Link tải không hợp lệ hoặc đã hết hạn.'})
                path = job['file']
            if not path.is_file():
                return self.reply(404, {'error': 'Tệp không còn tồn tại. Tải lại link gốc.'})
            self.send_response(200)
            self.send_header('Content-Type', mimetypes.guess_type(path.name)[0] or 'application/octet-stream')
            self.send_header('Content-Length', str(path.stat().st_size))
            self.send_header('Content-Disposition', 'attachment')
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            try:
                with path.open('rb') as source:
                    shutil.copyfileobj(source, self.wfile)
            except (BrokenPipeError, ConnectionResetError):
                pass
            return
        if not self.authorized():
            return
        if value.path == '/health':
            return self.reply(200, {'version': VERSION, 'ffmpeg': self.server.manager.ffmpeg})
        match = re.fullmatch('/jobs/([a-f0-9]{32})', value.path)
        if match:
            try:
                return self.reply(200, self.server.manager.view(match[1]))
            except KeyError:
                return self.reply(404, {'error': 'Không tìm thấy tác vụ.'})
        self.reply(404, {'error': 'Đường dẫn không hợp lệ.'})

    def do_POST(self):
        if not self.authorized():
            return
        try:
            length = int(self.headers.get('Content-Length', 0))
            if length < 0 or length > 12000:
                raise ValueError('Yêu cầu quá lớn.')
            if self.path == '/jobs':
                body = json.loads(self.rfile.read(length))
                identity = self.server.manager.create(body.get('url'), body.get('quality', '1080'))
                return self.reply(202, {'id': identity})
            match = re.fullmatch('/jobs/([a-f0-9]{32})/cancel', self.path)
            if match:
                with self.server.manager.lock:
                    job = self.server.manager.jobs.get(match[1])
                    if job and job['status'] in ('running', 'queued'):
                        job['cancel'].set()
                return self.reply(200, {'ok': True})
            self.reply(404, {'error': 'Đường dẫn không hợp lệ.'})
        except (ValueError, TypeError, AttributeError) as error:
            self.reply(400, {'error': str(error)})

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--data-dir', type=Path, default=Path.home() / '.workflow-media')
    args = parser.parse_args()
    args.data_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    token_file = args.data_dir / 'token'
    if not token_file.exists():
        token_file.write_text(secrets.token_hex(24))
        token_file.chmod(0o600)
    manager = Manager(args.data_dir / 'downloads', token_file.read_text().strip())
    server = ThreadingHTTPServer(('127.0.0.1', 9473), Handler)
    server.manager = manager
    print('Workflow Media Helper: http://127.0.0.1:9473', flush=True)
    print('Ma ket noi / mã kết nối: ' + manager.token, flush=True)
    print('Giu cua so nay mo trong luc tai. Ctrl+C de dung.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        for job in manager.jobs.values():
            job['cancel'].set()
        server.server_close()
        manager.pool.shutdown(wait=False, cancel_futures=True)

if __name__ == '__main__':
    main()
