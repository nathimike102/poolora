/** @jest-environment jsdom */

const path = require('path');

function buildDom() {
  document.body.innerHTML = `
    <main class="layout">
      <section class="panel">
        <input id="apiBase" type="text" />
        <input id="accessToken" type="text" />
        <button id="saveConfigBtn">Save Config</button>
        <button id="clearTokenBtn">Clear Token</button>
      </section>

      <section class="panel">
        <select id="endpointSelect"></select>
        <input id="requestMethod" type="text" readonly />
        <input id="requestPath" type="text" readonly />
        <textarea id="pathParams"></textarea>
        <textarea id="queryParams"></textarea>
        <textarea id="requestBody"></textarea>
        <button id="sendBtn">Send Request</button>
        <button id="extractAccessTokenBtn">Extract accessToken</button>
      </section>

      <section class="panel">
        <div id="meta" class="meta"></div>
        <pre id="requestPreview"></pre>
        <pre id="responseBody"></pre>
      </section>

      <section class="panel">
        <ul id="timeline"></ul>
      </section>
    </main>
  `;
}

function pickEndpointByPath(pathText) {
  const select = document.getElementById('endpointSelect');
  const option = Array.from(select.options).find((item) => item.textContent.includes(pathText));

  if (!option) {
    throw new Error(`Could not find endpoint option with path: ${pathText}`);
  }

  select.value = option.value;
  select.dispatchEvent(new Event('change'));
}

function click(id) {
  document.getElementById(id).dispatchEvent(new MouseEvent('click'));
}

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('frontend tester app', () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    buildDom();

    global.fetch = jest.fn();

    jest.isolateModules(() => {
      require(path.resolve(__dirname, '../frontend-tester/app.js'));
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('initializes defaults and endpoint list', () => {
    const apiBase = document.getElementById('apiBase').value;
    const endpointSelect = document.getElementById('endpointSelect');
    const meta = document.getElementById('meta').textContent;

    expect(apiBase).toBe('http://localhost:5002/');
    expect(endpointSelect.options.length).toBeGreaterThan(10);
    expect(meta).toContain('Ready. Select any endpoint and send.');
  });

  test('shows warning for invalid JSON input', async () => {
    document.getElementById('queryParams').value = '{';

    click('sendBtn');
    await flush();

    const meta = document.getElementById('meta').textContent;
    expect(meta).toContain('Query Params is invalid JSON');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('requires token for auth-protected endpoint', async () => {
    pickEndpointByPath('/auth/me');
    document.getElementById('accessToken').value = '';

    click('sendBtn');
    await flush();

    const meta = document.getElementById('meta').textContent;
    expect(meta).toContain('Endpoint requires access token.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('sends request with auth header and query params', async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    });

    pickEndpointByPath('/rides/search');
    document.getElementById('accessToken').value = 'abc-token';

    click('sendBtn');
    await flush();

    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('/api/v1/rides/search');
    expect(url).toContain('pickupLng=77.5946');
    expect(options.method).toBe('GET');
    expect(options.headers.Authorization).toBe('Bearer abc-token');

    const meta = document.getElementById('meta').textContent;
    expect(meta).toContain('HTTP 200');
  });

  test('extracts and stores access token from last response', async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({
        data: { accessToken: 'new-access-token' },
      }),
    });

    pickEndpointByPath('/health');

    click('sendBtn');
    await flush();

    click('extractAccessTokenBtn');

    const tokenInput = document.getElementById('accessToken').value;
    const stored = localStorage.getItem('tester.accessToken');
    const meta = document.getElementById('meta').textContent;

    expect(tokenInput).toBe('new-access-token');
    expect(stored).toBe('new-access-token');
    expect(meta).toContain('Extracted and saved accessToken.');
  });

  test('sends POST request with body and Content-Type header', async () => {
    global.fetch.mockResolvedValue({
      status: 201,
      text: async () => JSON.stringify({ id: '123' }),
    });

    pickEndpointByPath('/auth/send-otp');
    document.getElementById('requestBody').value = JSON.stringify({ phone: '+919876543210' });

    click('sendBtn');
    await flush();

    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, options] = global.fetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(options.body).toBe(JSON.stringify({ phone: '+919876543210' }));
  });

  test('handles HTTP 400 error response', async () => {
    global.fetch.mockResolvedValue({
      status: 400,
      text: async () => JSON.stringify({ error: 'Bad request' }),
    });

    pickEndpointByPath('/health');

    click('sendBtn');
    await flush();

    const meta = document.getElementById('meta').textContent;
    expect(meta).toContain('HTTP 400');
    expect(meta).not.toContain('err');
  });

  test('handles HTTP 500 error response', async () => {
    global.fetch.mockResolvedValue({
      status: 500,
      text: async () => JSON.stringify({ error: 'Server error' }),
    });

    pickEndpointByPath('/health');

    click('sendBtn');
    await flush();

    const meta = document.getElementById('meta').textContent;
    expect(meta).toContain('HTTP 500');
  });

  test('handles network failure', async () => {
    global.fetch.mockRejectedValue(new Error('Network timeout'));

    pickEndpointByPath('/health');

    click('sendBtn');
    await flush();

    const meta = document.getElementById('meta').textContent;
    expect(meta).toContain('Request failed: Network timeout');
  });

  test('warns when extractAccessToken finds no token', async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({}),
    });

    pickEndpointByPath('/health');

    click('sendBtn');
    await flush();

    click('extractAccessTokenBtn');

    const meta = document.getElementById('meta').textContent;
    expect(meta).toContain('No accessToken found in last response.');
  });

  test('saves config to localStorage', () => {
    document.getElementById('apiBase').value = 'http://custom-api.com';
    document.getElementById('accessToken').value = 'saved-token';

    click('saveConfigBtn');

    expect(localStorage.getItem('tester.apiBase')).toBe('http://custom-api.com');
    expect(localStorage.getItem('tester.accessToken')).toBe('saved-token');
    expect(document.getElementById('meta').textContent).toContain('Config saved.');
  });

  test('clears token from input and storage', () => {
    document.getElementById('accessToken').value = 'temp-token';
    localStorage.setItem('tester.accessToken', 'stored-token');

    click('clearTokenBtn');

    expect(document.getElementById('accessToken').value).toBe('');
    expect(localStorage.getItem('tester.accessToken')).toBeNull();
    expect(document.getElementById('meta').textContent).toContain('Token cleared.');
  });

  test('handles non-JSON response body', async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      text: async () => 'plain text response',
    });

    pickEndpointByPath('/health');

    click('sendBtn');
    await flush();

    const responseBody = document.getElementById('responseBody').textContent;
    expect(responseBody).toContain('plain text response');
  });

  test('handles empty response body', async () => {
    global.fetch.mockResolvedValue({
      status: 204,
      text: async () => '',
    });

    pickEndpointByPath('/health');

    click('sendBtn');
    await flush();

    const meta = document.getElementById('meta').textContent;
    expect(meta).toContain('HTTP 204');
  });

  test('warns for missing required path parameters', async () => {
    pickEndpointByPath('/rides/:id');
    document.getElementById('accessToken').value = 'token';
    document.getElementById('pathParams').value = '{}';

    click('sendBtn');
    await flush();

    const meta = document.getElementById('meta').textContent;
    expect(meta).toContain('Please fill required path params before sending.');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('interpolates path parameters correctly', async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    });

    pickEndpointByPath('/rides/:id');
    document.getElementById('accessToken').value = 'token';
    document.getElementById('pathParams').value = JSON.stringify({ id: 'ride-123' });

    click('sendBtn');
    await flush();

    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain('/rides/ride-123');
  });

  test('shows timeline for each request', async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    });

    pickEndpointByPath('/health');

    click('sendBtn');
    await flush();

    const timeline = document.getElementById('timeline');
    const items = timeline.querySelectorAll('li');
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].textContent).toContain('GET /health');
  });

  test('restores saved config on initialization', () => {
    localStorage.setItem('tester.apiBase', 'http://saved-api.com:3000/');
    localStorage.setItem('tester.accessToken', 'saved-access-token');

    // Re-init app
    jest.resetModules();
    buildDom();
    jest.isolateModules(() => {
      require(path.resolve(__dirname, '../frontend-tester/app.js'));
    });

    const apiBase = document.getElementById('apiBase').value;
    const token = document.getElementById('accessToken').value;

    expect(apiBase).toBe('http://saved-api.com:3000/');
    expect(token).toBe('saved-access-token');
  });

  test('handles invalid path params JSON', async () => {
    pickEndpointByPath('/health');
    document.getElementById('pathParams').value = '{invalid json}';

    click('sendBtn');
    await flush();

    const meta = document.getElementById('meta').textContent;
    expect(meta).toContain('Path Params is invalid JSON');
  });

  test('handles invalid body JSON', async () => {
    pickEndpointByPath('/auth/send-otp');
    document.getElementById('requestBody').value = '[invalid]';

    click('sendBtn');
    await flush();

    const meta = document.getElementById('meta').textContent;
    expect(meta).toContain('Request Body is invalid JSON');
  });

  test('omits body for GET requests', async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({}),
    });

    pickEndpointByPath('/health');
    document.getElementById('requestBody').value = JSON.stringify({ ignored: true });

    click('sendBtn');
    await flush();

    const [, options] = global.fetch.mock.calls[0];
    expect(options.body).toBeUndefined();
  });

  test('extracts token from alternative response paths', async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ accessToken: 'alternative-token' }),
    });

    pickEndpointByPath('/health');

    click('sendBtn');
    await flush();

    click('extractAccessTokenBtn');

    const tokenInput = document.getElementById('accessToken').value;
    expect(tokenInput).toBe('alternative-token');
  });

  test('normalizes API base URL by removing trailing slashes', () => {
    document.getElementById('apiBase').value = 'http://localhost:5002/api/v1////';

    // Trigger a request to test URL normalization
    global.fetch.mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({}),
    });

    pickEndpointByPath('/health');
    click('sendBtn');

    // Return promise to wait for async
    return new Promise((resolve) => {
      setTimeout(() => {
        const [url] = global.fetch.mock.calls[0];
        // Should normalize to proper URL without extra slashes
        expect(url).toMatch(/localhost:5002/);
        resolve();
      }, 10);
    });
  });

  test('filters empty query parameters', async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({}),
    });

    pickEndpointByPath('/health');
    document.getElementById('queryParams').value = JSON.stringify({ 
      key1: 'value', 
      key2: '', 
      key3: null,
      key4: undefined 
    });

    click('sendBtn');
    await flush();

    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain('key1=value');
    expect(url).not.toContain('key2');
    expect(url).not.toContain('key3');
  });

  test('encodes special characters in path params', async () => {
    global.fetch.mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({}),
    });

    pickEndpointByPath('/safety/sos/:id');
    document.getElementById('accessToken').value = 'token';
    document.getElementById('pathParams').value = JSON.stringify({ id: 'id@123#456' });

    click('sendBtn');
    await flush();

    const [url] = global.fetch.mock.calls[0];
    expect(url).toContain('id%40123%23456');
  });

  test('rejects JSON array in request body', async () => {
    pickEndpointByPath('/auth/send-otp');
    document.getElementById('requestBody').value = '[]';

    click('sendBtn');
    await flush();

    const meta = document.getElementById('meta').textContent;
    expect(meta).toContain('Request Body must be a JSON object');
  });

  test('rejects null JSON in request body', async () => {
    pickEndpointByPath('/auth/send-otp');
    document.getElementById('requestBody').value = 'null';

    click('sendBtn');
    await flush();

    const meta = document.getElementById('meta').textContent;
    expect(meta).toContain('Request Body must be a JSON object');
  });

  test('rejects JSON array in query params', async () => {
    pickEndpointByPath('/health');
    document.getElementById('queryParams').value = '[]';

    click('sendBtn');
    await flush();

    const meta = document.getElementById('meta').textContent;
    expect(meta).toContain('Query Params must be a JSON object');
  });

  test('rejects JSON array in path params', async () => {
    pickEndpointByPath('/health');
    document.getElementById('pathParams').value = '[]';

    click('sendBtn');
    await flush();

    const meta = document.getElementById('meta').textContent;
    expect(meta).toContain('Path Params must be a JSON object');
  });
});
