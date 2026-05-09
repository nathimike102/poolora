const API_BASE = "http://localhost:5002/";
const API_PREFIX = '/api/v1';

const STORAGE_KEYS = {
  apiBase: 'tester.apiBase',
  accessToken: 'tester.accessToken',
};

const ENDPOINTS = [
  { group: 'system', name: 'Health', method: 'GET', path: '/health', auth: false, params: {}, query: {}, body: {} },

  { group: 'auth', name: 'Send OTP', method: 'POST', path: '/auth/send-otp', auth: false, params: {}, query: {}, body: { phone: '+919876543210' } },
  { group: 'auth', name: 'Verify OTP', method: 'POST', path: '/auth/verify-otp', auth: false, params: {}, query: {}, body: { phone: '+919876543210', otp: '123456', name: 'Test User' } },
  { group: 'auth', name: 'Refresh Token', method: 'POST', path: '/auth/refresh-token', auth: false, params: {}, query: {}, body: { refreshToken: '' } },
  { group: 'auth', name: 'Firebase Login', method: 'POST', path: '/auth/firebase-login', auth: false, params: {}, query: {}, body: { idToken: '' } },
  { group: 'auth', name: 'Logout', method: 'POST', path: '/auth/logout', auth: true, params: {}, query: {}, body: {} },
  { group: 'auth', name: 'Auth Me', method: 'GET', path: '/auth/me', auth: true, params: {}, query: {}, body: {} },
  { group: 'auth', name: 'Submit KYC', method: 'POST', path: '/auth/kyc', auth: true, params: {}, query: {}, body: { licenseNumber: 'LIC123', drivingLicenseUrl: 'https://example.com/license.jpg', vehicle: { make: 'Honda', model: 'City', year: 2022, color: 'White', plateNumber: 'KA01AB1234', vehicleType: 'CAR', hasAC: true, registrationDocUrl: 'https://example.com/registration.jpg', insuranceDocUrl: 'https://example.com/insurance.jpg', photos: ['https://example.com/car.jpg'] } } },
  { group: 'auth', name: 'Approve KYC', method: 'POST', path: '/auth/kyc/:userId/approve', auth: true, params: { userId: '' }, query: {}, body: {} },

  { group: 'users', name: 'Get Me', method: 'GET', path: '/users/me', auth: true, params: {}, query: {}, body: {} },
  { group: 'users', name: 'Saved Routes', method: 'GET', path: '/users/saved-routes', auth: true, params: {}, query: {}, body: {} },

  { group: 'rides', name: 'Search Rides', method: 'GET', path: '/rides/search', auth: true, params: {}, query: { pickupLng: 77.5946, pickupLat: 12.9716, dropoffLng: 77.6762, dropoffLat: 12.9352, departureTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), radiusKm: 5, timeDeviationMins: 120, page: 1, limit: 20 }, body: {} },
  { group: 'rides', name: 'Upcoming Rides', method: 'GET', path: '/rides/upcoming', auth: true, params: {}, query: {}, body: {} },
  { group: 'rides', name: 'My Rides', method: 'GET', path: '/rides/my-rides', auth: true, params: {}, query: { page: 1, limit: 20 }, body: {} },
  { group: 'rides', name: 'Driver Location', method: 'POST', path: '/rides/driver/location', auth: true, params: {}, query: {}, body: { bookingId: '', lng: 77.5946, lat: 12.9716, speed: 20, heading: 180, accuracy: 10 } },
  { group: 'rides', name: 'Create Ride', method: 'POST', path: '/rides', auth: true, params: {}, query: {}, body: { rideType: 'CAR_POOL', vehicleId: '', pickup: { lng: 77.5946, lat: 12.9716, address: 'MG Road, Bengaluru' }, dropoff: { lng: 77.6762, lat: 12.9352, address: 'HSR Layout, Bengaluru' }, departureTime: new Date(Date.now() + 45 * 60 * 1000).toISOString(), totalSeats: 3, pricePerSeat: 150 } },
  { group: 'rides', name: 'Get Ride', method: 'GET', path: '/rides/:id', auth: true, params: { id: '' }, query: {}, body: {} },
  { group: 'rides', name: 'Cancel Ride', method: 'POST', path: '/rides/:id/cancel', auth: true, params: { id: '' }, query: {}, body: { reason: 'Change of plan' } },
  { group: 'rides', name: 'Complete Ride', method: 'POST', path: '/rides/:id/complete', auth: true, params: { id: '' }, query: {}, body: {} },

  { group: 'bookings', name: 'Rider Bookings', method: 'GET', path: '/bookings/as-rider', auth: true, params: {}, query: { page: 1, limit: 20 }, body: {} },
  { group: 'bookings', name: 'Driver Bookings', method: 'GET', path: '/bookings/as-driver', auth: true, params: {}, query: { page: 1, limit: 20 }, body: {} },
  { group: 'bookings', name: 'Create Booking', method: 'POST', path: '/bookings', auth: true, params: {}, query: {}, body: { rideId: '', seatsBooked: 1, pickup: { lng: 77.5946, lat: 12.9716, address: 'MG Road, Bengaluru' }, dropoff: { lng: 77.6762, lat: 12.9352, address: 'HSR Layout, Bengaluru' } } },
  { group: 'bookings', name: 'Confirm Booking', method: 'POST', path: '/bookings/:id/confirm', auth: true, params: { id: '' }, query: {}, body: {} },
  { group: 'bookings', name: 'Reject Booking', method: 'POST', path: '/bookings/:id/reject', auth: true, params: { id: '' }, query: {}, body: { reason: 'Not available' } },
  { group: 'bookings', name: 'Cancel Booking', method: 'POST', path: '/bookings/:id/cancel', auth: true, params: { id: '' }, query: {}, body: { reason: 'Plan changed' } },
  { group: 'bookings', name: 'Complete Booking', method: 'POST', path: '/bookings/:id/complete', auth: true, params: { id: '' }, query: {}, body: {} },

  { group: 'payments', name: 'Payment Webhook', method: 'POST', path: '/payments/webhook', auth: false, params: {}, query: {}, body: {} },
  { group: 'payments', name: 'Payment History', method: 'GET', path: '/payments/history', auth: true, params: {}, query: {}, body: {} },

  { group: 'chat', name: 'Unread Count', method: 'GET', path: '/chat/unread-count', auth: true, params: {}, query: {}, body: {} },
  { group: 'chat', name: 'Send Message', method: 'POST', path: '/chat/messages', auth: true, params: {}, query: {}, body: { bookingId: '', content: 'Hello', contentType: 'text' } },
  { group: 'chat', name: 'Get Messages', method: 'GET', path: '/chat/:bookingId/messages', auth: true, params: { bookingId: '' }, query: {}, body: {} },
  { group: 'chat', name: 'Mark Read', method: 'POST', path: '/chat/:bookingId/read', auth: true, params: { bookingId: '' }, query: {}, body: {} },

  { group: 'maps', name: 'Directions', method: 'GET', path: '/maps/directions', auth: true, params: {}, query: { origin: '12.9716,77.5946', destination: '12.9352,77.6762' }, body: {} },
  { group: 'maps', name: 'Distance', method: 'GET', path: '/maps/distance', auth: true, params: {}, query: { origin: '12.9716,77.5946', destination: '12.9352,77.6762' }, body: {} },
  { group: 'maps', name: 'Pickup To Drop', method: 'GET', path: '/maps/pickup-to-drop', auth: true, params: {}, query: { pickup: '12.9716,77.5946', dropoff: '12.9352,77.6762' }, body: {} },
  { group: 'maps', name: 'Nearest Driver', method: 'POST', path: '/maps/nearest-driver', auth: true, params: {}, query: {}, body: { origin: { lat: 12.9716, lng: 77.5946 }, drivers: [{ id: 'd1', lat: 12.975, lng: 77.61 }] } },
  { group: 'maps', name: 'Traffic Route', method: 'GET', path: '/maps/traffic-route', auth: true, params: {}, query: { origin: '12.9716,77.5946', destination: '12.9352,77.6762' }, body: {} },
  { group: 'maps', name: 'Geolocation', method: 'POST', path: '/maps/geolocation', auth: true, params: {}, query: {}, body: { cellTowers: [], wifiAccessPoints: [] } },
  { group: 'maps', name: 'Optimize Route', method: 'POST', path: '/maps/optimize-route', auth: true, params: {}, query: {}, body: { origin: { lat: 12.9716, lng: 77.5946 }, destination: { lat: 12.9352, lng: 77.6762 }, waypoints: [] } },
  { group: 'maps', name: 'Navigation', method: 'GET', path: '/maps/navigation', auth: true, params: {}, query: { origin: '12.9716,77.5946', destination: '12.9352,77.6762' }, body: {} },
  { group: 'maps', name: 'Grounding', method: 'POST', path: '/maps/grounding', auth: true, params: {}, query: {}, body: { query: 'Nearest police station' } },
  { group: 'maps', name: 'Nearby Places', method: 'GET', path: '/maps/nearby', auth: true, params: {}, query: { lat: 12.9716, lng: 77.5946, type: 'police', radius: 3000 }, body: {} },
  { group: 'maps', name: 'Validate Address', method: 'POST', path: '/maps/validate-address', auth: true, params: {}, query: {}, body: { address: 'MG Road, Bengaluru' } },

  { group: 'notifications', name: 'Unread Count', method: 'GET', path: '/notifications/unread-count', auth: true, params: {}, query: {}, body: {} },
  { group: 'notifications', name: 'Mark All Read', method: 'PATCH', path: '/notifications/read-all', auth: true, params: {}, query: {}, body: {} },
  { group: 'notifications', name: 'Get Notifications', method: 'GET', path: '/notifications', auth: true, params: {}, query: { page: 1, limit: 20 }, body: {} },
  { group: 'notifications', name: 'Mark Notification Read', method: 'PATCH', path: '/notifications/:id/read', auth: true, params: { id: '' }, query: {}, body: {} },

  { group: 'ratings', name: 'Create Rating', method: 'POST', path: '/ratings', auth: true, params: {}, query: {}, body: { bookingId: '', score: 5, tags: ['punctuality'], comment: 'Great ride' } },
  { group: 'ratings', name: 'User Ratings', method: 'GET', path: '/ratings/user/:userId', auth: true, params: { userId: '' }, query: {}, body: {} },

  { group: 'safety', name: 'Active SOS (Admin)', method: 'GET', path: '/safety/sos/active', auth: true, params: {}, query: {}, body: {} },
  { group: 'safety', name: 'Trigger SOS', method: 'POST', path: '/safety/sos', auth: true, params: {}, query: {}, body: { bookingId: '', location: { lng: 77.5946, lat: 12.9716 } } },
  { group: 'safety', name: 'SOS Location Update', method: 'POST', path: '/safety/sos/:id/location', auth: true, params: { id: '' }, query: {}, body: { location: { lng: 77.595, lat: 12.972 } } },
  { group: 'safety', name: 'SOS Add Evidence', method: 'POST', path: '/safety/sos/:id/evidence', auth: true, params: { id: '' }, query: {}, body: { type: 'image', url: 'https://example.com/evidence.jpg' } },
  { group: 'safety', name: 'Acknowledge SOS (Admin)', method: 'POST', path: '/safety/sos/:id/acknowledge', auth: true, params: { id: '' }, query: {}, body: {} },
  { group: 'safety', name: 'Resolve SOS (Admin)', method: 'POST', path: '/safety/sos/:id/resolve', auth: true, params: { id: '' }, query: {}, body: { resolution: 'Incident resolved' } },

  { group: 'wallet', name: 'Tier Info', method: 'GET', path: '/wallet/tiers', auth: false, params: {}, query: {}, body: {} },
  { group: 'wallet', name: 'Get Wallet', method: 'GET', path: '/wallet', auth: true, params: {}, query: {}, body: {} },
  { group: 'wallet', name: 'Create Topup', method: 'POST', path: '/wallet/topup', auth: true, params: {}, query: {}, body: { amount: 500 } },
  { group: 'wallet', name: 'Confirm Topup', method: 'POST', path: '/wallet/topup/confirm', auth: true, params: {}, query: {}, body: { razorpayOrderId: '', razorpayPaymentId: '', razorpaySignature: '' } },
  { group: 'wallet', name: 'Wallet Transactions', method: 'GET', path: '/wallet/transactions', auth: true, params: {}, query: { page: 1, limit: 20 }, body: {} },
  { group: 'wallet', name: 'Coin History', method: 'GET', path: '/wallet/coins/history', auth: true, params: {}, query: { page: 1, limit: 20 }, body: {} },
  { group: 'wallet', name: 'Convert Coins', method: 'POST', path: '/wallet/coins/convert', auth: true, params: {}, query: {}, body: { coins: 100 } },
];

let lastResponse = null;

function byId(id) {
  return document.getElementById(id);
}

function pretty(v) {
  return JSON.stringify(v ?? {}, null, 2);
}

function normalizeBase(base) {
  return (base || '').trim().replace(/\/+$/, '');
}

function getApiRoot() {
  const base = normalizeBase(byId('apiBase').value || API_BASE);
  return base.endsWith(API_PREFIX) ? base : base + API_PREFIX;
}

function setMeta(message, level) {
  const el = byId('meta');
  el.textContent = message;
  el.className = 'meta ' + (level || 'warn');
}

function addTimeline(message) {
  const li = document.createElement('li');
  li.textContent = new Date().toLocaleTimeString() + ' - ' + message;
  byId('timeline').prepend(li);
}

function parseJsonOrThrow(raw, label) {
  const text = (raw || '').trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
      throw new Error(label + ' must be a JSON object');
    }
    return parsed;
  } catch (error) {
    throw new Error(label + ' is invalid JSON: ' + error.message);
  }
}

function interpolatePath(path, pathParams) {
  return path.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    const value = pathParams[key];
    if (value === undefined || value === null || value === '') {
      return ':' + key;
    }
    return encodeURIComponent(String(value));
  });
}

function showRequestPreview(requestPreview) {
  byId('requestPreview').textContent = pretty(requestPreview);
}

function showResponse(responseBody) {
  byId('responseBody').textContent = pretty(responseBody);
}

function saveConfig() {
  localStorage.setItem(STORAGE_KEYS.apiBase, byId('apiBase').value.trim());
  localStorage.setItem(STORAGE_KEYS.accessToken, byId('accessToken').value.trim());
  setMeta('Config saved.', 'ok');
}

function clearToken() {
  byId('accessToken').value = '';
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  setMeta('Token cleared.', 'ok');
}

function restoreConfig() {
  byId('apiBase').value = localStorage.getItem(STORAGE_KEYS.apiBase) || API_BASE;
  byId('accessToken').value = localStorage.getItem(STORAGE_KEYS.accessToken) || '';
}

function getSelectedEndpoint() {
  const index = Number(byId('endpointSelect').value || '0');
  return ENDPOINTS[index];
}

function renderSelectedEndpoint() {
  const endpoint = getSelectedEndpoint();
  if (!endpoint) return;

  byId('requestMethod').value = endpoint.method;
  byId('requestPath').value = endpoint.path;
  byId('pathParams').value = pretty(endpoint.params);
  byId('queryParams').value = pretty(endpoint.query);
  byId('requestBody').value = pretty(endpoint.body);
}

function initEndpointOptions() {
  const select = byId('endpointSelect');
  select.innerHTML = '';

  ENDPOINTS.forEach((endpoint, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = '[' + endpoint.group + '] ' + endpoint.method + ' ' + endpoint.path + ' - ' + endpoint.name;
    select.append(option);
  });

  select.value = '0';
  renderSelectedEndpoint();
}

async function sendRequest() {
  const endpoint = getSelectedEndpoint();
  if (!endpoint) {
    setMeta('No endpoint selected.', 'warn');
    return;
  }

  let pathParams;
  let queryParams;
  let body;

  try {
    pathParams = parseJsonOrThrow(byId('pathParams').value, 'Path Params');
    queryParams = parseJsonOrThrow(byId('queryParams').value, 'Query Params');
    body = parseJsonOrThrow(byId('requestBody').value, 'Request Body');
  } catch (error) {
    setMeta(error.message, 'warn');
    return;
  }

  const resolvedPath = interpolatePath(endpoint.path, pathParams);
  if (/:([A-Za-z0-9_]+)/.test(resolvedPath)) {
    setMeta('Please fill required path params before sending.', 'warn');
    return;
  }

  const url = new URL(getApiRoot() + resolvedPath);
  Object.entries(queryParams).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v));
    }
  });

  const headers = {};
  if (endpoint.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  if (endpoint.auth) {
    const token = byId('accessToken').value.trim();
    if (!token) {
      setMeta('Endpoint requires access token.', 'warn');
      return;
    }
    headers.Authorization = 'Bearer ' + token;
  }

  const requestPreview = {
    endpoint: endpoint.name,
    method: endpoint.method,
    url: url.toString(),
    headers,
    body: endpoint.method === 'GET' ? null : body,
  };

  showRequestPreview(requestPreview);
  console.log('API Request:', requestPreview);

  const started = performance.now();
  setMeta('Sending request...', 'warn');

  try {
    const response = await fetch(url.toString(), {
      method: endpoint.method,
      headers,
      body: endpoint.method === 'GET' ? undefined : JSON.stringify(body),
    });

    const raw = await response.text();
    let parsed;
    try {
      parsed = raw ? JSON.parse(raw) : {};
    } catch {
      parsed = { raw };
    }

    lastResponse = parsed;
    showResponse(parsed);
    console.log('API Response:', parsed);

    const duration = Math.round(performance.now() - started);
    const level = response.status >= 500 ? 'err' : response.status >= 400 ? 'warn' : 'ok';
    setMeta('HTTP ' + response.status + ' in ' + duration + ' ms', level);
    addTimeline(endpoint.method + ' ' + resolvedPath + ' -> ' + response.status + ' (' + duration + ' ms)');
  } catch (error) {
    setMeta('Request failed: ' + error.message, 'err');
    addTimeline(endpoint.method + ' ' + resolvedPath + ' -> request failed');
  }
}

function extractAccessToken() {
  const token =
    lastResponse?.data?.accessToken ||
    lastResponse?.data?.data?.accessToken ||
    lastResponse?.accessToken ||
    '';

  if (!token) {
    setMeta('No accessToken found in last response.', 'warn');
    return;
  }

  byId('accessToken').value = token;
  localStorage.setItem(STORAGE_KEYS.accessToken, token);
  setMeta('Extracted and saved accessToken.', 'ok');
}

function wireEvents() {
  byId('saveConfigBtn').addEventListener('click', saveConfig);
  byId('clearTokenBtn').addEventListener('click', clearToken);
  byId('endpointSelect').addEventListener('change', renderSelectedEndpoint);
  byId('sendBtn').addEventListener('click', sendRequest);
  byId('extractAccessTokenBtn').addEventListener('click', extractAccessToken);
}

function init() {
  restoreConfig();
  initEndpointOptions();
  wireEvents();
  setMeta('Ready. Select any endpoint and send.', 'ok');
}

init();
