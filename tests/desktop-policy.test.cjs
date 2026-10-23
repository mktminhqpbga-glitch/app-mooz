'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {providerForURL, matchesPattern, allowedNetworkURL, resolveAppPath} = require('../desktop/policy.cjs');

test('AI connector origins require exact HTTPS hosts and safe ports', () => {
  assert.equal(providerForURL('https://chatgpt.com/c/123'), 'chatgpt');
  assert.equal(providerForURL('https://www.chatgpt.com:443/'), 'chatgpt');
  assert.equal(providerForURL('https://chat.openai.com/'), 'chatgpt');
  assert.equal(providerForURL('https://gemini.google.com/app'), 'gemini');
  assert.equal(providerForURL('https://muse.ai/'), 'muse');
  assert.equal(providerForURL('https://studio.muse.ai/chat'), 'muse');
  for (const url of ['http://chatgpt.com/', 'https://chatgpt.com:9443/',
    'https://chatgpt.com.evil.test/', 'https://notmuse.ai/', 'https://muse.ai.evil.test/',
    'https://evil.test@chatgpt.com/', 'https://chatgpt.com./', 'https://api.openai.com/',
    'file:///etc/passwd', ' https://chatgpt.com/', 'https://chatgpt.com\\@evil.test/']) {
    assert.equal(providerForURL(url), null, url);
  }
});

test('connector match patterns preserve Chrome subdomain and path semantics', () => {
  assert.equal(matchesPattern('https://muse.ai/chat', 'https://*.muse.ai/*'), true);
  assert.equal(matchesPattern('https://studio.muse.ai/chat?x=1', 'https://*.muse.ai/chat*'), true);
  assert.equal(matchesPattern('https://chatgpt.com/c/123', 'https://chatgpt.com/c/*'), true);
  assert.equal(matchesPattern('https://chatgpt.com/c/123', 'https://chatgpt.com/app/*'), false);
  assert.equal(matchesPattern('https://chatgpt.com/c/123', 'https://*.chatgpt.com/*'), false);
  assert.equal(matchesPattern('https://chatgpt.com/', '*://chatgpt.com/*'), false);
  assert.equal(matchesPattern('https://api.openai.com/', 'https://api.openai.com/*'), false);
  assert.equal(matchesPattern('https://muse.ai.evil.test/', 'https://*.muse.ai/*'), false);
});

test('network bridge only reaches supported APIs, updates, media and helper routes', () => {
  for (const url of ['https://api.openai.com/v1/responses',
    'https://generativelanguage.googleapis.com/v1beta/models/model:generateContent',
    'https://queue.fal.run/fal-ai/model', 'https://fal.media/result.mp4',
    'https://storage.fal.media/result.mp4',
    'https://raw.githubusercontent.com/owner/repo/main/data.json', 'https://api.github.com/repos/a/b',
    'http://127.0.0.1:9473/health', 'http://127.0.0.1:9473/jobs',
    'http://127.0.0.1:9473/jobs/' + 'a'.repeat(32),
    'http://127.0.0.1:9473/jobs/' + 'a'.repeat(32) + '/cancel',
    'http://127.0.0.1:9473/files/' + 'b'.repeat(32) + '?ticket=' + 'a'.repeat(48)]) {
    assert.equal(allowedNetworkURL(url), true, url);
  }
  for (const url of ['https://api.openai.com.evil.test/', 'https://evil.test@api.openai.com/',
    'https://api.openai.com:8443/', 'http://api.openai.com/', 'https://notfal.media/',
    'http://127.0.0.1:9473/admin', 'http://127.0.0.1:9474/health',
    'http://localhost:9473/health', 'https://127.0.0.1:9473/health',
    'http://169.254.169.254/latest/meta-data/', 'file:///etc/passwd',
    'http://[::1]:9473/health', 'https://chatgpt.com/']) {
    assert.equal(allowedNetworkURL(url), false, url);
  }
});

test('app protocol serves only bundled public resources and rejects traversal/symlink escapes', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'workflow-policy-'));
  t.after(() => fs.rmSync(temp, {recursive: true, force: true}));
  const root = path.join(temp, 'app');
  fs.mkdirSync(path.join(root, 'desktop'), {recursive: true});
  fs.mkdirSync(path.join(root, '.git'));
  fs.mkdirSync(path.join(root, 'tests'));
  fs.writeFileSync(path.join(root, 'app.html'), 'app');
  fs.writeFileSync(path.join(root, 'desktop', 'home.js'), 'home');
  fs.writeFileSync(path.join(root, 'desktop', 'main.cjs'), 'private');
  fs.writeFileSync(path.join(root, '.git', 'config.json'), 'private');
  fs.writeFileSync(path.join(root, 'tests', 'data.json'), 'private');
  fs.writeFileSync(path.join(temp, 'secret.json'), 'secret');
  fs.symlinkSync(path.join(temp, 'secret.json'), path.join(root, 'escape.json'));
  fs.symlinkSync(path.join(root, '.git', 'config.json'), path.join(root, 'private.json'));
  fs.symlinkSync(path.join(root, 'desktop', 'main.cjs'), path.join(root, 'private.js'));
  // macOS temporary directories can use /var -> /private/var aliases.
  // The resolver deliberately returns the canonical path for its containment checks.
  const realRoot = fs.realpathSync(root);
  assert.equal(resolveAppPath(root, 'workflow://app/app.html'), path.join(realRoot, 'app.html'));
  assert.equal(resolveAppPath(root, 'workflow://app/'), path.join(realRoot, 'app.html'));
  assert.equal(resolveAppPath(root, 'workflow://app/desktop/home.js?v=1'), path.join(realRoot, 'desktop', 'home.js'));
  const linkedRoot = path.join(temp, 'app-alias');
  fs.symlinkSync(root, linkedRoot, 'dir');
  assert.equal(resolveAppPath(linkedRoot, 'workflow://app/app.html'), path.join(realRoot, 'app.html'));
  assert.equal(resolveAppPath(linkedRoot, 'workflow://app/desktop/home.js?v=1'), path.join(realRoot, 'desktop', 'home.js'));
  for (const url of ['workflow://app/../secret.json', 'workflow://app/%2e%2e/secret.json',
    'workflow://app/%252e%252e/secret.json', 'workflow://app/%2e%2e%2fsecret.json',
    'workflow://app/%2e%2e%5csecret.json', 'workflow://app/%00.json', 'workflow://app/%zz.json',
    'workflow://app/.git/config.json', 'workflow://app/tests/data.json',
    'workflow://app/desktop/main.cjs', 'workflow://app/escape.json',
    'workflow://app/private.json', 'workflow://app/private.js',
    'workflow://app/absent.js', 'workflow://app:999/app.html',
    'workflow://user@app/app.html', 'https://app/app.html']) {
    assert.equal(resolveAppPath(root, url), null, url);
    assert.equal(resolveAppPath(linkedRoot, url), null, 'linked app root: ' + url);
  }
});
