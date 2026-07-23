// Agency 8 — Creator Add
// background.js — OAuth, Google Sheets API, message handling

const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

// ── Default client list ──────────────────────────────────────────────────────

const DEFAULT_CLIENTS = [
  { name: "Allies of Skin",      id: "1_iPEHJi3HOypcBBHyv9DpMBxgVGryt2KSgqEbwzC3N8" },
  { name: "BORNTOSTANDOUT",      id: "1nsRCoRK9hdbH50rMD9zqp-GGwTpPyEAFWT69_pjVEbg" },
  { name: "Brodo",               id: "13PXK5rMfw2S53AZLU57MhwEfv1TWwQS0LYIE7xZHOx0" },
  { name: "Dr. Squatch",         id: "1hmz1j7FDgkkmBx7qklTIkeNhZ64bFxIzeLyZ4BJAMu4" },
  { name: "Emma Relief",         id: "1tIs_TonI25q20QEB9perUtIAmgepb4Jd0OY4q3x-EdU" },
  { name: "EvolveTogether",      id: "19EZE0wC_8SdK_ntNbjHz63Zdp4ml9Xf7BYJHtv7Fz9Q" },
  { name: "EvolveTogether Paid", id: "1wjpKQpMoyVfGErkCNP4wecNa1yd9dClszJyIUeTX-Tw", tab: "Master List (Working)" },
  { name: "Feals",               id: "1x7OyNUkQS8lWvz-jRMlCC99fvROX-B7tDeuGG5PiwvM" },
  { name: "Harper Wilde",        id: "1Yyc85gXz45xoILd_EKprK87d2mpvCGx5wguSpt-Bs-M" },
  { name: "Ilia",                id: "1xkOWiPIWnIyho4rhPJze_OuBFQSZS7XUAqR1XAM0jrg" },
  { name: "Kalshi",             id: "1-Rkb-r9wlLQcCuPPaimDSSNvFJc0U3ZqkQ7pm7BDbb8" },
  { name: "Lenox and Sixteenth", id: "1mbK7-TgwBZ8jq46MxTw9wnN985h7pGr-ustMV9AiXlM" },
  { name: "MadeGood",            id: "1HoHwoMgV1iGUBO6M3gD91DbwiK51_5TQKNxYNw7FZrs" },
  { name: "MadeGood Paid — Internal", type: "paid_system", url: "https://madegood-paid-system.onrender.com", password: "a8paid123", list_type: "INT", client: "madegood" },
  { name: "Magic Molecule",      id: "1-hl6G1UYmovAkQLUY6toCaYabvG6Wd3uEWuVgIyNBfY" },
  { name: "Magna",               id: "1eEgdXTQAjaWqyI-umL9G5c9K-gRpCL_a-V3aq-Mfa7U" },
  { name: "Maev",                id: "1QSsL_AK8vaJsGhbgC1kXDUD0eOFRtAR-HuJJoRRNlQQ" },
  { name: "Merit",               id: "1e75T4ZUvG-WBfm-IzCTHUlxT3yfiBx4JMAwBXekTKz4" },
  { name: "Momofuku",            id: "1Kk5ZgKu1RoHrLN0KcSai34RDlI0VmzxtgGKChiDOlv4", tab: "Master List 2" },
  { name: "Nette",               id: "1dq07ZScfGpzQ2FwK292keRRgKXhetyQyzrt22o3Hd3k" },
  { name: "Roz",                 id: "1e2bZ925S7g13oqNxAkE1LMphBoXJRSZ8elPMKPGVh7M" },
  { name: "Snif",                id: "1-Y5vwy3QlfjZMKbmT7sX7m4HH2Ji4By6ZNkk7t5oiEk" },
  { name: "Squigs",              id: "1uuKOSei2nHd1KD6tDAyGDKIwvV2guhUdcolmIHP2mbw" },
  { name: "Stardust Tarot Mailer", id: "1Qz6ynzsQX-hf_0s5qxoq_jsztri1uhA25V-qO-c202k", tab: "Tarot Mailer Master List" },
  { name: "SYS",                 id: "1T_PKGEkVaZoazmGotIXqcsI5FcPzKp7J43x87tw7Xck" },
  { name: "Tein",                id: "1Enujzezf-kIKSgF9Xkded96yz5txr49gGk7ooMji8t0" },
  { name: "The Absorption Company", id: "1xcVQ2SvbyenVLZnuQcJQBzDGD4xWDpM1kwhPWXw2s7w" },
  { name: "Timebeam",            id: "1kfSRwoUOQSyblpYvdlSiwO_XUX7F2tL9omdcmT9IBzY" },
  { name: "TodayTix",            id: "1en88S03oxxDk9fe37TfIs3Acmcj3j0vetE4NyWP2EHA" },
  { name: "Tushy",               id: "15K-yi3aKwNd8YChBEEgIXAE89_30FR2mILLRcg_fEjE" },
];

// Initialise storage on install; merge new defaults on update
chrome.runtime.onInstalled.addListener(async (details) => {
  const stored = await chrome.storage.sync.get('clients');
  if (!stored.clients) {
    await chrome.storage.sync.set({ clients: DEFAULT_CLIENTS });
  } else if (details.reason === 'update') {
    const existingNames = new Set(stored.clients.map(c => c.name));
    const toAdd = DEFAULT_CLIENTS.filter(c => !existingNames.has(c.name));
    if (toAdd.length) {
      await chrome.storage.sync.set({ clients: [...stored.clients, ...toAdd] });
    }
  }
});

// ── OAuth ────────────────────────────────────────────────────────────────────

async function getToken() {
  const stored = await chrome.storage.session.get(['token', 'tokenExpiry']);
  if (stored.token && stored.tokenExpiry > Date.now() + 60_000) {
    return stored.token;
  }

  const clientId = await getClientId();
  if (!clientId) throw new Error('NO_CLIENT_ID');

  const redirectUri = chrome.identity.getRedirectURL();
  const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/spreadsheets');
  authUrl.searchParams.set('prompt', 'select_account');

  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      async (responseUrl) => {
        if (chrome.runtime.lastError || !responseUrl) {
          reject(new Error(chrome.runtime.lastError?.message || 'Auth cancelled'));
          return;
        }
        const hash = new URL(responseUrl).hash.substring(1);
        const params = new URLSearchParams(hash);
        const token = params.get('access_token');
        const expiresIn = parseInt(params.get('expires_in') || '3600');
        await chrome.storage.session.set({
          token,
          tokenExpiry: Date.now() + expiresIn * 1000,
        });
        resolve(token);
      }
    );
  });
}

async function getClientId() {
  const stored = await chrome.storage.sync.get('oauthClientId');
  return stored.oauthClientId || null;
}

// ── Sheets helpers ────────────────────────────────────────────────────────────

// Find the master list tab and return { headers, sheetName }
// Searches all tabs for one that has "Name" + "Clean IG Handle" columns.
async function getHeaders(token, spreadsheetId, tabOverride) {
  const cacheKey = `headers_${spreadsheetId}${tabOverride ? '_' + tabOverride : ''}`;
  const cached = await chrome.storage.local.get(cacheKey);
  const entry = cached[cacheKey];
  // Expire after 5 minutes so column renames are picked up quickly
  if (entry?.ts && Date.now() - entry.ts < 5 * 60 * 1000) return entry;

  // If a specific tab is specified, use it directly without scanning
  if (tabOverride) {
    const resp = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(tabOverride)}!1:1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) throw new Error(`Could not read tab "${tabOverride}" (${resp.status})`);
    const data    = await resp.json();
    const headers = data.values?.[0] || [];
    const result  = { headers, sheetName: tabOverride, ts: Date.now() };
    await chrome.storage.local.set({ [cacheKey]: result });
    return result;
  }

  // Get all tab names
  const metaResp = await fetch(
    `${SHEETS_API}/${spreadsheetId}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!metaResp.ok) throw new Error(`Could not read spreadsheet (${metaResp.status})`);
  const meta = await metaResp.json();
  const allTabs = (meta.sheets || []).map(s => s.properties.title);

  // Try likely master list tab names first to save API calls
  const preferred = ['Master List', '1 Master List', 'Sheet1', 'Roster', 'Creators'];
  const tabs = [
    ...preferred.filter(p => allTabs.some(t => t.toLowerCase() === p.toLowerCase())),
    ...allTabs.filter(t => !preferred.some(p => p.toLowerCase() === t.toLowerCase())),
  ];

  // Try each tab; pick the first one that looks like a master list
  for (const tab of tabs) {
    const resp = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(tab)}!1:1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) continue;
    const data    = await resp.json();
    const headers = data.values?.[0] || [];
    const lower   = headers.map(h => h.trim().toLowerCase());
    const hasName = lower.some(h => h === 'name');
    const hasIG   = lower.some(h => h.includes('ig handle') || h.includes('ig link'));
    if (hasName && hasIG) {
      const result = { headers, sheetName: tab, ts: Date.now() };
      await chrome.storage.local.set({ [cacheKey]: result });
      return result;
    }
  }

  throw new Error(`Could not find master list tab. Tabs found: ${tabs.join(', ')}`);
}

// Build a row array matching the sheet's exact column order.
// Columns from the master list:
//   A: Owner  B: Name  C: IG Link  D: Clean IG Handle
//   E: TikTok Link  F: Clean TT Handle  G: E-mail
//   H: Primary Platform  I: Followers on Primary Platform
//   J: Gender  K: Vertical  L: Location  M: Age  … (campaign cols)
function buildRow(headers, creator) {
  const row = new Array(headers.length).fill('');

  const set = (needle, value) => {
    if (!value && value !== 0) return;
    const idx = headers.findIndex(
      h => h.trim().toLowerCase() === needle.toLowerCase()
    );
    if (idx >= 0) row[idx] = value;
  };

  set('Owner',                          creator.owner);
  set('Name',                          creator.name);
  set('IG Link',                        creator.igLink);
  set('Clean IG Handle',                creator.igHandle);
  set('TikTok Link',                    creator.ttLink);
  set('Clean TT Handle',                creator.ttHandle);
  set('E-mail',                         creator.email);
  set('Email',                          creator.email);
  set('Primary Platform',               creator.primaryPlatform);
  set('Followers on Primary Platform',  creator.followers ? String(creator.followers) : '');
  set('Followers on Primary',           creator.followers ? String(creator.followers) : '');  // Stardust variant
  set('Gender',                         creator.gender);
  set('Vertical',                       creator.vertical);
  set('Location',                       creator.location);
  set('Age',                            creator.age);

  const igF = creator.igFollowers ?? 0;
  const ttF = creator.ttFollowers ?? 0;
  set('IG Followers',    igF);
  set('TikTok Followers', ttF);
  set('Total Followers',  igF + ttF);

  return row;
}

async function appendRow(token, spreadsheetId, sheetName, row) {
  // Find the true last row by scanning A:J (column A is often blank for owner)
  const scanRange = encodeURIComponent(`${sheetName}!A:J`);
  const scanResp = await fetch(`${SHEETS_API}/${spreadsheetId}/values/${scanRange}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let lastRow = 1;
  if (scanResp.ok) {
    const scanData = await scanResp.json();
    lastRow = (scanData.values || []).length;
  }
  const newRow = lastRow + 1;

  // Use a batch update writing ONLY cells with actual values.
  // This preserves mid-row and trailing formulas the extension doesn't touch.
  const colLetter = (i) => i < 26
    ? String.fromCharCode(65 + i)
    : String.fromCharCode(64 + Math.floor(i / 26)) + String.fromCharCode(65 + (i % 26));

  const data = row
    .map((val, i) => ({ range: `${sheetName}!${colLetter(i)}${newRow}`, values: [[val]] }))
    .filter(({ values }) => values[0][0] !== '' && values[0][0] != null);

  if (!data.length) return;

  const url = `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }
  return resp.json();
}

// ── Duplicate check ───────────────────────────────────────────────────────────

async function checkDuplicates(igHandle, ttHandle, spreadsheetId) {
  const token = await getToken();
  const stored = await chrome.storage.sync.get('clients');
  const clients = stored.clients || DEFAULT_CLIENTS;

  if (!spreadsheetId) return [];

  const client = clients.find(c => c.id === spreadsheetId);
  const result = await checkOneSheet(token, spreadsheetId, igHandle, ttHandle).catch(() => ({ found: false }));
  return result.found && client
    ? [{ name: client.name, id: spreadsheetId, rowIndex: result.rowIndex, sheetName: result.sheetName }]
    : [];
}

async function checkOneSheet(token, spreadsheetId, igHandle, ttHandle) {
  let sheetName = 'Sheet1';
  try {
    const info = await getHeaders(token, spreadsheetId);
    sheetName = info.sheetName;
  } catch { /* use default */ }

  const resp = await fetch(
    `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A:G`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) return { found: false };
  const data = await resp.json();
  const rows = data.values || [];
  if (rows.length < 2) return { found: false };

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const igIdx = headers.findIndex(h => h === 'clean ig handle');
  const ttIdx = headers.findIndex(h => h === 'clean tt handle');

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (igHandle && igIdx >= 0 && r[igIdx]?.toLowerCase() === igHandle.toLowerCase()) return { found: true, rowIndex: i + 1, sheetName };
    if (ttHandle && ttIdx >= 0 && r[ttIdx]?.toLowerCase() === ttHandle.toLowerCase()) return { found: true, rowIndex: i + 1, sheetName };
  }
  return { found: false };
}

// ── Vertical dropdown options ─────────────────────────────────────────────────
// Reads the data-validation dropdown list from the Vertical column of a sheet.

function colIndexToLetter(idx) {
  let letter = '';
  let n = idx + 1; // convert to 1-based
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

async function getVerticalOptions(token, spreadsheetId) {
  const { headers, sheetName } = await getHeaders(token, spreadsheetId);
  const vertIdx = headers.findIndex(h => h.trim().toLowerCase().includes('vertical'));
  if (vertIdx < 0) throw new Error(`No "Vertical" column found. Headers: ${headers.join(', ')}`);

  const col   = colIndexToLetter(vertIdx);
  const range = encodeURIComponent(`${sheetName}!${col}2:${col}20`);
  const url   =
    `${SHEETS_API}/${spreadsheetId}` +
    `?ranges=${range}&includeGridData=true` +
    `&fields=sheets(data(rowData(values(dataValidation))))`;

  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`Sheets API error ${resp.status}`);

  const data = await resp.json();
  const rows = data?.sheets?.[0]?.data?.[0]?.rowData || [];

  // Find first cell that has data validation
  let validation = null;
  for (const row of rows) {
    const v = row?.values?.[0]?.dataValidation;
    if (v) { validation = v; break; }
  }

  // No validation rule found — fall back to reading existing unique values
  if (!validation) {
    const valResp = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!${col}2:${col}2000`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!valResp.ok) return [];
    const existing = [...new Set((await valResp.json()).values?.flat().map(v => v.trim()).filter(Boolean) || [])];
    return existing.sort();
  }

  // ONE_OF_LIST: options hardcoded in the rule
  if (validation.condition?.type === 'ONE_OF_LIST') {
    return validation.condition.values.map(v => v.userEnteredValue);
  }

  // ONE_OF_RANGE: options come from another range (e.g. =Sheet2!A1:A20)
  if (validation.condition?.type === 'ONE_OF_RANGE') {
    const ref      = validation.condition.values?.[0]?.userEnteredValue || '';
    const cleanRef = ref.replace(/^=["']?|["']?$/g, '');
    const rangeResp = await fetch(
      `${SHEETS_API}/${spreadsheetId}/values/${encodeURIComponent(cleanRef)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!rangeResp.ok) return [];
    return (await rangeResp.json()).values?.flat().filter(Boolean) || [];
  }

  return [];
}

// ── Update existing creator row ───────────────────────────────────────────────

async function updateCreatorRow(token, spreadsheetId, sheetName, rowIndex, creator) {
  const { headers } = await getHeaders(token, spreadsheetId);
  const updates = [];

  const addUpdate = (needle, value) => {
    if (value == null || value === '') return;
    const idx = headers.findIndex(h => h.trim().toLowerCase() === needle.toLowerCase());
    if (idx >= 0) updates.push({
      range: `${sheetName}!${colIndexToLetter(idx)}${rowIndex}`,
      values: [[value]],
    });
  };

  if (creator.primaryPlatform) addUpdate('Primary Platform', creator.primaryPlatform);
  if (creator.followers)       addUpdate('Followers on Primary Platform', String(creator.followers));
  if (creator.email)           { addUpdate('E-mail', creator.email); addUpdate('Email', creator.email); }

  const igF = creator.igFollowers ?? 0;
  const ttF = creator.ttFollowers ?? 0;
  if (creator.igFollowers != null) addUpdate('IG Followers', igF);
  if (creator.ttFollowers != null) addUpdate('TikTok Followers', ttF);
  if (creator.igFollowers != null || creator.ttFollowers != null) addUpdate('Total Followers', igF + ttF);

  if (!updates.length) return;

  const resp = await fetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ valueInputOption: 'USER_ENTERED', data: updates }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${resp.status}`);
  }
  return resp.json();
}

// ── External link scanning (linktree, beacons, etc.) ─────────────────────────
// Fetches up to 3 external bio links and searches for TikTok handles and emails.

const IG_SKIP = /^(p|reel|reels|stories|explore|accounts|about|legal|press|api|_)$/i;

function extractIGHandleFromText(text) {
  const matches = text.matchAll(/instagram\.com\/?\\?\/?\@?([\w.]+)/gi);
  for (const m of matches) {
    const handle = m[1];
    if (!IG_SKIP.test(handle)) return handle;
  }
  return null;
}

async function fetchExternalLinks(urls) {
  let tiktokHandle = null;
  let igHandle     = null;
  let email        = null;

  // Sites that aggregate many brand TikTok links — fetching these causes wrong handle detection
  const SKIP_FOR_TT = ['shopmy.us', 'shopmy.co', 'shop.app', 'ltk.com', 'liketoknow.it',
                        'amazon.com', 'magic-links.com', 'linkinbio.at', 'beacons.ai'];

  for (const url of urls.slice(0, 3)) {
    try {
      const urlHost = new URL(url).hostname.replace(/^www\./, '');
      const skipTT  = SKIP_FOR_TT.some(s => urlHost.includes(s));

      const resp = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (!resp.ok) continue;
      const html = await resp.text();

      // TikTok handle: skip shopping/affiliate sites that list many brand handles
      if (!tiktokHandle && !skipTT) {
        const ndMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
        const searchText = ndMatch ? (() => {
          try { return JSON.stringify(JSON.parse(ndMatch[1])); } catch { return html; }
        })() : html;

        const allHandles = [...searchText.matchAll(/tiktok\.com\/@([\w.]+)/gi)]
          .map(m => m[1])
          .filter(h => h !== h.toUpperCase()); // skip all-caps like NYFW, UTA, etc.

        if (allHandles.length > 0) {
          const freq = {};
          allHandles.forEach(h => { const lc = h.toLowerCase(); freq[lc] = (freq[lc] || 0) + 1; });
          tiktokHandle = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
        }
      }

      // Instagram handle: same approach — direct match first, then __NEXT_DATA__
      if (!igHandle) {
        igHandle = extractIGHandleFromText(html);
        if (!igHandle) {
          const ndMatch = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
          if (ndMatch) {
            try {
              igHandle = extractIGHandleFromText(JSON.stringify(JSON.parse(ndMatch[1])));
            } catch { /* malformed JSON, ignore */ }
          }
        }
      }

      // Email: prefer mailto: links (more reliable), fall back to text pattern
      if (!email) {
        const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
        if (mailtoMatch) {
          email = mailtoMatch[1];
        } else {
          const emailMatch = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) email = emailMatch[0];
        }
      }

      if (tiktokHandle && igHandle && email) break;
    } catch { /* skip unreachable links */ }
  }

  return { tiktokHandle, igHandle, email };
}

// ── TikTok follower count lookup ─────────────────────────────────────────────

async function getTikTokFollowers(handle) {
  try {
    const resp = await fetch(`https://www.tiktok.com/@${handle}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!resp.ok) return null;
    const html = await resp.text();
    const match = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
    );
    if (!match) return null;
    const data = JSON.parse(match[1]);
    const stats =
      data?.['__DEFAULT_SCOPE__']?.['webapp.user-detail']?.userInfo?.stats;
    return stats?.followerCount ?? null;
  } catch {
    return null;
  }
}

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {

        case 'addCreator': {
          const token = await getToken();
          const { headers, sheetName } = await getHeaders(token, request.spreadsheetId, request.tabOverride);
          const row = buildRow(headers, request.creator);
          await appendRow(token, request.spreadsheetId, sheetName, row);
          sendResponse({ success: true });
          break;
        }

        case 'checkDuplicates': {
          const dupes = await checkDuplicates(request.igHandle, request.ttHandle, request.spreadsheetId);
          sendResponse({ duplicates: dupes });
          break;
        }

        case 'updateCreator': {
          const token = await getToken();
          await Promise.all(request.duplicates.map(d =>
            updateCreatorRow(token, d.id, d.sheetName, d.rowIndex, request.creator)
          ));
          sendResponse({ success: true });
          break;
        }

        case 'getTikTokFollowers': {
          const followers = await getTikTokFollowers(request.handle);
          sendResponse({ followers });
          break;
        }

        case 'getClients': {
          const stored = await chrome.storage.sync.get('clients');
          sendResponse({ clients: stored.clients || DEFAULT_CLIENTS });
          break;
        }

        case 'getVerticalOptions': {
          // Paid system entries use a hardcoded vertical list
          if (request.isPaidSystem) {
            sendResponse({ options: [
              'Health / Wellness','Beauty / Skincare','Fashion / Lifestyle',
              'Cool Guys','Models','Parents','Student','Travel','Creatives',
              'Food / Bev','Professionals','Fitness','Couple',
            ]});
            break;
          }
          try {
            // Check persistent cache first — verticals rarely change
            const cacheKey = `verticals_${request.spreadsheetId}`;
            const cached = await chrome.storage.local.get(cacheKey);
            if (cached[cacheKey]) {
              sendResponse({ options: cached[cacheKey] });
              break;
            }
            const token = await getToken();
            const options = await getVerticalOptions(token, request.spreadsheetId);
            await chrome.storage.local.set({ [cacheKey]: options });
            sendResponse({ options });
          } catch(e) {
            sendResponse({ options: [], error: e.message });
          }
          break;
        }

        case 'fetchExternalLinks': {
          const result = await fetchExternalLinks(request.urls || []);
          sendResponse(result);
          break;
        }

        case 'getIGProfile': {
          try {
            const resp = await fetch(`https://www.instagram.com/${request.handle}/`, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              },
            });
            if (!resp.ok) { sendResponse({}); break; }
            const html = await resp.text();
            const result = {};
            // Follower count
            const followerMatch = html.match(/"follower_count"\s*:\s*(\d+)/) ||
                                  html.match(/"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/);
            if (followerMatch) result.followers = parseInt(followerMatch[1]);
            // Email from biography
            const bioMatch = html.match(/"biography"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (bioMatch) {
              const bio = bioMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
              const emailMatch = bio.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
              if (emailMatch) result.email = emailMatch[0];
            }
            sendResponse(result);
          } catch { sendResponse({}); }
          break;
        }

        case 'getRedirectUrl': {
          sendResponse({ url: chrome.identity.getRedirectURL() });
          break;
        }

        case 'signOut': {
          await chrome.storage.session.remove(['token', 'tokenExpiry']);
          sendResponse({ success: true });
          break;
        }

        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (e) {
      sendResponse({ error: e.message });
    }
  })();
  return true; // keep channel open for async response
});
