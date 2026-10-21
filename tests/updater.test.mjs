import { test } from 'node:test';
import assert from 'node:assert/strict';
import { download } from '../extension/updater.mjs';

const sha = 'a'.repeat(40);
function mock(index, contents = '{}', code = 200) {
  const calls = [];
  return { calls, fetcher: async url => {
    calls.push(url);
    return new Response(url.includes('/commits/') ? JSON.stringify({ sha }) : url.endsWith('index.json') ? JSON.stringify(index) : contents, { status: code });
  } };
}
test('downloads all data from a single immutable commit', async () => {
  const { fetcher, calls } = mock({ files: ['data/settings.json'] }, '{"version":2}');
  const result = await download('owner/repo', 'main', fetcher);
  assert.equal(result.files['data/settings.json'], '{"version":2}');
  assert.equal(result.commit, sha);
  assert.ok(calls.slice(1).every(url => url.includes(`/${sha}/`)));
});
test('rejects traversal, scripts, duplicates and empty lists', async () => {
  for (const files of [['data/../secret.json'], ['data/code.js'], ['data/a.txt', 'data/a.txt'], []]) {
    await assert.rejects(download('owner/repo', 'main', mock({ files }).fetcher));
  }
});
test('rejects HTTP errors, invalid JSON and oversized content', async () => {
  await assert.rejects(download('owner/repo', 'main', mock({}, '', 404).fetcher), /HTTP 404/);
  await assert.rejects(download('owner/repo', 'main', mock({ files: ['data/a.json'] }, '{broken').fetcher));
  await assert.rejects(download('owner/repo', 'main', mock({ files: ['data/a.txt'] }, 'x'.repeat(2 * 1024 * 1024 + 1)).fetcher), /2 MB/);
});
