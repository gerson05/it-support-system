/**
 * Medivalle ERP client — session-based scraper for GeneXus Java 15 ERP.
 *
 * Authentication flow:
 *  1. GET login page → extract GXState + session cookies
 *  2. POST credentials + GXState → follow 301 to principal
 *
 * Data loading:
 *  - GET wwXxx panel → extract GXState
 *  - POST same panel with filter values + _EventName to load grid rows
 *  - Parse HTML grid rows (FIELDNAME_0001, _0002…) from GXState JSON
 */

const ERP_BASE   = 'https://medivalleerp.com/MedivalleLineaFrente1/servlet';
const LOGIN_OBJ  = 'com.version8.loginempresa';
const NIT_OBJ    = 'com.version8.wwnit';
const SUC_OBJ    = 'com.version8.wwsucursales';
const ART_OBJ    = 'com.version8.wwarticulos';

class ERPClient {
  constructor() {
    this._cookies   = {};          // name → value
    this._gxClientId = null;
    this.authenticated = false;
    this._lastAuth  = 0;
    this._authTTL   = 25 * 60 * 1000;  // re-auth after 25 min
  }

  // ── Cookie jar ──────────────────────────────────────────────────────────

  _parseCookies(headers) {
    const raw = headers.getSetCookie?.() ?? [];
    for (const h of raw) {
      const [pair] = h.split(';');
      const eq = pair.indexOf('=');
      if (eq > 0) this._cookies[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
    }
  }

  _cookieHeader() {
    return Object.entries(this._cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  // ── HTTP helpers ─────────────────────────────────────────────────────────

  async _get(url) {
    const r = await fetch(url, {
      headers: { Cookie: this._cookieHeader(), 'User-Agent': 'Mozilla/5.0' },
      redirect: 'manual',
    });
    this._parseCookies(r.headers);
    return r;
  }

  async _post(url, body, extraHeaders = {}) {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        Cookie: this._cookieHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0',
        ...extraHeaders,
      },
      body,
      redirect: 'manual',
    });
    this._parseCookies(r.headers);
    return r;
  }

  // ── GXState helpers ──────────────────────────────────────────────────────

  _extractGXState(html) {
    const m = html.match(/name=["']GXState["'][^>]*value='([\s\S]*?)'\/>/);
    if (!m) return null;
    try { return JSON.parse(m[1]); } catch { return null; }
  }

  _buildPostBody(state, formFields = {}) {
    // GeneXus expects:
    //  1. GXState = full page-state JSON string (for server-side restoration)
    //  2. Individual form field values (vUSERNAME, vUSERPASSWORD, _EventName, etc.)
    const mergedState = { ...state };
    if (formFields._EventName !== undefined) mergedState._EventName = formFields._EventName;

    const params = new URLSearchParams();
    params.set('GXState', JSON.stringify(mergedState));

    // Also send individual overridden fields so GeneXus reads them from the form
    for (const [k, v] of Object.entries(formFields)) {
      params.set(k, String(v));
    }
    return params.toString();
  }

  // ── Authentication ───────────────────────────────────────────────────────

  async _ensureAuth() {
    if (this.authenticated && Date.now() - this._lastAuth < this._authTTL) return;
    await this.authenticate();
  }

  async authenticate() {
    const user = process.env.ERP_USER;
    const pass = process.env.ERP_PASS;
    if (!user || !pass) throw new Error('ERP_USER / ERP_PASS not set');

    // Step 1: GET login page → cookies + GXState
    const loginUrl = `${ERP_BASE}/${LOGIN_OBJ}`;
    const getResp  = await this._get(loginUrl);
    const html     = await getResp.text();
    const state    = this._extractGXState(html);
    if (!state) throw new Error('ERP login: could not extract GXState');

    // Step 2: POST credentials — GeneXus button fires event "EENTER."
    const body = this._buildPostBody(state, {
      vUSERNAME:     user,
      vUSERPASSWORD: pass,
      _EventName:    'EENTER.',
    });

    const postResp = await this._post(`${loginUrl}?,`, body);
    const location  = postResp.headers.get('location');

    if (postResp.status !== 301 || !location?.includes('principal')) {
      throw new Error(`ERP login failed — status ${postResp.status}, location: ${location}`);
    }

    // Step 3: Follow redirect to establish full session
    await this._get(`${ERP_BASE}/${location.split('/servlet/')[1] ?? 'com.version8.principal'}`);

    this.authenticated = true;
    this._lastAuth     = Date.now();
  }

  // ── Grid data loader ─────────────────────────────────────────────────────

  /**
   * Load a wwXxx panel with optional filter fields.
   * Returns the GXState from the response (contains grid row arrays).
   */
  async _loadPanel(servlet, filter = {}) {
    await this._ensureAuth();

    const url = `${ERP_BASE}/${servlet}`;

    // GET page to obtain current GXState + AJAX tokens
    const getResp = await this._get(url);
    const html    = await getResp.text();
    const state   = this._extractGXState(html);
    if (!state) throw new Error(`ERP: no GXState in ${servlet}`);

    // POST with filter + ENTER event to load grid rows
    const body = this._buildPostBody(state, {
      ...filter,
      _EventName: 'EENTER.',
    });
    const postResp = await this._post(`${url}?,`, body);
    const respHtml = await postResp.text();
    const respState = this._extractGXState(respHtml);

    return { html: respHtml, state: respState ?? state };
  }

  /**
   * Parse grid rows from HTML.
   * GeneXus renders grid cells as <input name="FIELDNAME_0001" value="...">
   * Returns array of objects keyed by base field name.
   */
  _parseGridRows(html, fieldNames) {
    const rows = [];
    // Build regex to find all inputs with _NNNN suffix
    const inputRe = /name="([A-Z][A-Z0-9_]+)_(\d{4})"[^>]*?value="([^"]*)"/gi;
    const byRow   = {};   // rowNum → { FIELD: value }

    let m;
    while ((m = inputRe.exec(html)) !== null) {
      const [, field, rowNum, value] = m;
      if (!fieldNames.includes(field)) continue;
      if (!byRow[rowNum]) byRow[rowNum] = {};
      byRow[rowNum][field] = value;
    }

    // Also pick up readonly spans: <span id="span_FIELD_0001">value</span>
    const spanRe = /id="span_([A-Z][A-Z0-9_]+)_(\d{4})"[^>]*>([^<]*)</gi;
    while ((m = spanRe.exec(html)) !== null) {
      const [, field, rowNum, value] = m;
      if (!fieldNames.includes(field)) continue;
      if (!byRow[rowNum]) byRow[rowNum] = {};
      if (byRow[rowNum][field] === undefined) byRow[rowNum][field] = value.trim();
    }

    for (const rowNum of Object.keys(byRow).sort()) {
      const row = byRow[rowNum];
      if (Object.keys(row).length > 0) rows.push(row);
    }
    return rows;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Search NITs (persons/companies) by name or NIT number. */
  async searchNit(query = '') {
    const filter = query ? { vNIT: query } : {};
    const { html } = await this._loadPanel(NIT_OBJ, filter);
    return this._parseGridRows(html, ['NITIDE', 'NITSEC', 'NITNOM', 'NITCIU', 'NITDEP']);
  }

  /** Get all active sucursales. Caller should cache the result. */
  async getSucursales() {
    const { html } = await this._loadPanel(SUC_OBJ, { SUCEST: 'A' });
    return this._parseGridRows(html, ['SUCCOD', 'SUCNOM', 'SUCEST']);
  }

  /** Search artículos by description or code. */
  async searchArticulos(query = '') {
    const filter = query ? { vARTDES: query } : {};
    const { html } = await this._loadPanel(ART_OBJ, filter);
    return this._parseGridRows(html, ['ARTCOD', 'ARTDES', 'ARTPRE', 'ARTUNI']);
  }
}

// Module-level singleton
const client = new ERPClient();

export async function erpSearchNit(query) {
  return client.searchNit(query);
}

export async function erpGetSucursales() {
  return client.getSucursales();
}

export async function erpSearchArticulos(query) {
  return client.searchArticulos(query);
}

export async function erpAuthenticate() {
  return client.authenticate();
}
