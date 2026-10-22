"""Real loopback HTTP tests with an injected downloader; no live social platform claim."""
import concurrent.futures
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
spec = importlib.util.spec_from_file_location('media_helper', Path(__file__).resolve().parents[1] / 'tools/media-helper/server.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class HelperTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.started = threading.Event()
        def download(job, url, quality, folder):
            self.started.set()
            if 'cancel' in url:
                if job['cancel'].wait(3):
                    raise ValueError('Cancelled')
            path = folder / 'media.mp4'
            path.write_bytes(b'test-video-original-bytes')
            return path, '../Vietnam <video>'
        self.manager = module.Manager(self.temp.name, 'test-token', download)
        self.server = module.ThreadingHTTPServer(('127.0.0.1', 0), module.Handler)
        self.server.manager = self.manager
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.origin = 'http://127.0.0.1:' + str(self.server.server_address[1])

    def tearDown(self):
        for job in self.manager.jobs.values(): job['cancel'].set()
        self.server.shutdown()
        self.server.server_close()
        self.manager.pool.shutdown(wait=True)
        self.temp.cleanup()

    def request(self, path, body=None, token='test-token', origin=None):
        headers = {'Authorization':'Bearer ' + token}
        if origin: headers['Origin'] = origin
        if body is not None: headers['Content-Type'] = 'application/json'
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(self.origin+path, data=data, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=5) as response: return response.status, response.read()
        except urllib.error.HTTPError as error: return error.code, error.read()

    def test_auth_and_origin(self):
        self.assertEqual(self.request('/health', token='wrong')[0], 401)
        self.assertEqual(self.request('/health', origin='https://untrusted.test')[0], 403)
        self.assertEqual(self.request('/health', origin='chrome-extension://'+'a'*32)[0], 200)

    def test_job_status_and_download_ticket(self):
        code, raw = self.request('/jobs', {'url':'https://youtu.be/example','quality':'1080'})
        self.assertEqual(code, 202)
        identity = json.loads(raw)['id']
        for _ in range(100):
            _, raw = self.request('/jobs/'+identity)
            result = json.loads(raw)
            if result['status'] == 'done': break
            time.sleep(.01)
        self.assertEqual(result['status'], 'done')
        self.assertNotIn('/', result['filename'])
        self.assertEqual(self.request('/files/'+identity+'?ticket=wrong')[0],403)
        self.assertEqual(self.request(result['path'],token='unused')[1], b'test-video-original-bytes')
        self.assertEqual(self.request('/jobs', {'url':'http://127.0.0.1/private','quality':'720'})[0],400)

    def test_cancel(self):
        _, raw = self.request('/jobs', {'url':'https://youtu.be/cancel','quality':'720'})
        identity = json.loads(raw)['id']
        self.started.wait(2)
        self.request('/jobs/'+identity+'/cancel', {})
        for _ in range(100):
            _, raw = self.request('/jobs/'+identity)
            result=json.loads(raw)
            if result['status']=='cancelled':break
            time.sleep(.01)
        self.assertEqual(result['status'],'cancelled')

    def test_platform_urls_reject_suffix_spoofing_credentials_and_non_http(self):
        for url in ['https://youtube.com.attacker.test/video','http://127.0.0.1/v','file:///etc/passwd','https://a:b@youtube.com/watch?v=x','https://youtube.com:123/watch?v=x']:
            with self.assertRaises(ValueError): module.validate_url(url)

if __name__ == '__main__': unittest.main()
