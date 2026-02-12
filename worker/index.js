/**
 * Cloudflare Worker proxy for Airtable registration.
 * Keeps AIRTABLE_API_KEY server-side (CF secret).
 * 
 * Routes:
 *   POST /register  — create registration
 *   GET  /confirm?token=xxx — confirm registration
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function corsHeaders(origin, env) {
  const allowed = [env.ALLOWED_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'];
  const allowOrigin = allowed.includes(origin) ? origin : env.ALLOWED_ORIGIN;
  return { ...CORS_HEADERS, 'Access-Control-Allow-Origin': allowOrigin };
}

function jsonResponse(data, status, origin, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) },
  });
}

// Simple input sanitization
function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.trim().slice(0, 500);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateToken() {
  const array = new Uint8Array(20);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(36).padStart(2, '0')).join('').slice(0, 24);
}

async function airtableRequest(method, env, { path = '', body = null } = {}) {
  const url = `https://api.airtable.com/v0/${env.AIRTABLE_BASE_ID}/${env.AIRTABLE_TABLE_NAME}${path}`;
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${env.AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts);
}

async function handleRegister(request, env) {
  const origin = request.headers.get('Origin') || '';
  
  let data;
  try {
    data = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400, origin, env);
  }

  const name = sanitize(data.name);
  const address = sanitize(data.address);
  const email = sanitize(data.email);
  const phone = sanitize(data.phone);
  const notes = sanitize(data.notes || '');

  // Validate required fields
  if (!name || !address || !email || !phone) {
    return jsonResponse({ error: 'Alle Pflichtfelder müssen ausgefüllt sein.' }, 400, origin, env);
  }
  if (!isValidEmail(email)) {
    return jsonResponse({ error: 'Ungültige E-Mail-Adresse.' }, 400, origin, env);
  }

  const token = generateToken();

  const resp = await airtableRequest('POST', env, {
    body: {
      fields: {
        Name: name,
        Address: address,
        Email: email,
        Phone: phone,
        Notes: notes,
        Status: 'new',
        ConfirmationToken: token,
        RegistrationDate: new Date().toISOString().split('T')[0],
      },
    },
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => 'Unknown error');
    console.error('Airtable error:', errText);
    return jsonResponse({ error: 'Registrierung fehlgeschlagen. Bitte versuchen Sie es später erneut.' }, 500, origin, env);
  }

  return jsonResponse({ ok: true, message: 'Anmeldung erfolgreich! Bitte bestätigen Sie Ihre E-Mail.' }, 200, origin, env);
}

async function handleConfirm(request, env) {
  const origin = request.headers.get('Origin') || '';
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token || token.length < 10) {
    return jsonResponse({ error: 'Ungültiger Bestätigungslink.' }, 400, origin, env);
  }

  // Find record by token
  const filterFormula = encodeURIComponent(`{ConfirmationToken}="${token}"`);
  const resp = await airtableRequest('GET', env, {
    path: `?filterByFormula=${filterFormula}&maxRecords=1`,
  });

  if (!resp.ok) {
    return jsonResponse({ error: 'Fehler bei der Bestätigung.' }, 500, origin, env);
  }

  const result = await resp.json();
  if (!result.records || result.records.length === 0) {
    return jsonResponse({ error: 'Bestätigungslink ungültig oder abgelaufen.' }, 404, origin, env);
  }

  const recordId = result.records[0].id;

  // Update status to confirmed
  const updateResp = await airtableRequest('PATCH', env, {
    path: `/${recordId}`,
    body: { fields: { Status: 'confirmed' } },
  });

  if (!updateResp.ok) {
    return jsonResponse({ error: 'Fehler beim Aktualisieren des Status.' }, 500, origin, env);
  }

  return jsonResponse({ ok: true, message: 'Anmeldung erfolgreich bestätigt!' }, 200, origin, env);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    // Route
    if (url.pathname === '/register' && request.method === 'POST') {
      return handleRegister(request, env);
    }
    if (url.pathname === '/confirm' && request.method === 'GET') {
      return handleConfirm(request, env);
    }

    return jsonResponse({ error: 'Not found' }, 404, origin, env);
  },
};
