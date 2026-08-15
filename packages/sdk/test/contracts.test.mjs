import assert from 'node:assert/strict';
import { test } from 'node:test';
import { KastClient } from '../dist/index.js';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('forms submit uses the public API contract without inventing an envelope', async () => {
  const calls = [];
  const client = new KastClient({
    baseUrl: 'https://cms.example.com/',
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse({ ok: true });
    },
  });

  const result = await client.forms.submit('contact/form', {
    data: { email: 'a@example.com' },
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(calls[0].url, 'https://cms.example.com/api/v1/forms/contact%2Fform/submit');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { data: { email: 'a@example.com' } });
});

test('management resources send the bearer token and canonical content path', async () => {
  let call;
  const client = new KastClient({
    baseUrl: 'https://cms.example.com',
    accessToken: 'jwt',
    fetch: async (url, init) => {
      call = { url: String(url), init };
      return jsonResponse({ data: [], meta: { total: 0 } });
    },
  });

  await client.content.list('blog-post');

  assert.equal(call.url, 'https://cms.example.com/api/v1/content-types/blog-post/entries');
  assert.equal(call.init.headers.Authorization, 'Bearer jwt');
});

test('structured API errors preserve code, status, and details', async () => {
  const client = new KastClient({
    baseUrl: 'https://cms.example.com',
    fetch: async () =>
      jsonResponse(
        {
          error: {
            code: 'CONTENT_VALIDATION_FAILED',
            message: 'Invalid content',
            details: [{ field: 'title' }],
          },
        },
        400,
      ),
  });

  await assert.rejects(client.content.get('blog', 'e1'), (error) => {
    assert.equal(error.code, 'CONTENT_VALIDATION_FAILED');
    assert.equal(error.status, 400);
    assert.deepEqual(error.details, [{ field: 'title' }]);
    return true;
  });
});
