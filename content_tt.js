// Agency 8 — content_tt.js
// Extracts creator data from a TikTok profile page.

function extractTTData() {
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  if (!parts[0]?.startsWith('@')) return null;

  const handle = parts[0].substring(1);
  const result = { handle, ttLink: `https://www.tiktok.com/@${handle}` };

  // ── Strategy 1: UNIVERSAL_DATA_FOR_REHYDRATION (very reliable) ────────────
  const dataScript = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
  if (dataScript) {
    try {
      const data = JSON.parse(dataScript.textContent);
      const userDetail = data?.['__DEFAULT_SCOPE__']?.['webapp.user-detail'];
      if (userDetail?.userInfo) {
        const user  = userDetail.userInfo.user;
        const stats = userDetail.userInfo.stats;
        result.name      = user.nickname;
        result.handle    = user.uniqueId;
        result.bio       = user.signature || '';
        result.followers = stats?.followerCount ?? null;
        result.ttLink    = `https://www.tiktok.com/@${result.handle}`;
      }
    } catch { /* ignore */ }
  }

  // ── Strategy 2: Open Graph meta tags (fallback) ───────────────────────────
  if (!result.name) {
    const ogTitle = document
      .querySelector('meta[property="og:title"]')
      ?.getAttribute('content');
    if (ogTitle) result.name = ogTitle.replace(/\s*\|.*$/, '').trim();
  }

  if (result.bio) {
    result.location = extractLocation(result.bio);
    result.email    = extractEmail(result.bio);
    result.igHandle = extractIGFromBio(result.bio);
  }

  result.bioLinks = extractTTBioLinks();

  return result;
}

function extractIGFromBio(bio) {
  const labeled = bio.match(/(?:ig|instagram)[:\s]+@?([\w.]+)/i);
  if (labeled) return labeled[1];
  const urlMatch = bio.match(/instagram\.com\/@?([\w.]+)/i);
  if (urlMatch) return urlMatch[1];
  return null;
}

function extractTTBioLinks() {
  const links = [];
  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.href;
    if (href && !href.includes('tiktok.com') && href.startsWith('http')) {
      links.push(href);
    }
  });
  return [...new Set(links)].slice(0, 3);
}

function extractEmail(bio) {
  const m = bio.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}

const TT_CITY_ABBREVS = {
  nyc:'NYC', la:'LA', sf:'SF', dc:'DC', atl:'ATL', chi:'CHI',
  phx:'PHX', mia:'MIA', bos:'BOS', pdx:'PDX', sea:'SEA', dtx:'DTX', lax:'LAX', bk:'BK',
};
const TT_STATE_ABBREVS = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC','UK','AU','NZ',
]);

function resolveLocationToken(t) {
  const a = TT_CITY_ABBREVS[t.toLowerCase()];
  if (a) return a;
  if (TT_STATE_ABBREVS.has(t.toUpperCase()) && t.length <= 3) return t.toUpperCase();
  return null;
}

function parseLocationText(text) {
  // Strip leading emoji/whitespace but keep separators for multi-location check
  const rawCleaned = text.replace(/^[\p{Emoji}\p{So}\s📍]+/u, '').trim();

  // Check multi-location BEFORE the full cleanup strips pipe/slash characters
  if (/[&|\/]/.test(rawCleaned)) {
    const parts = rawCleaned.split(/\s*[&|\/]\s*/);
    const resolved = parts.map(p => {
      const t = p.replace(/\s*[\p{Emoji}\p{So}•,;].*$/u, '').trim();
      return resolveLocationToken(t);
    }).filter(Boolean);
    if (resolved.length >= 2) return resolved.join('/');
    if (resolved.length === 1) return resolved[0];
  }

  const cleaned = rawCleaned.replace(/\s*[\p{Emoji}\p{So}|•,;].*$/u, '').trim();
  if (!cleaned) return null;

  // City, State: "Atlanta, GA"
  const csMatch = cleaned.match(/^([A-Za-z][a-z]+(?: [A-Za-z][a-z]+)*),\s*([A-Za-z]{2})\b/);
  if (csMatch && TT_STATE_ABBREVS.has(csMatch[2].toUpperCase())) {
    return `${csMatch[1].replace(/\b\w/g, c => c.toUpperCase())}, ${csMatch[2].toUpperCase()}`;
  }

  // Single city/state abbreviation
  const single = resolveLocationToken(cleaned.split(/[\s,]/)[0]);
  if (single) return single;

  return null;
}

function extractLocation(bio) {
  for (const rawLine of bio.split('\n')) {
    const line = rawLine.trim();
    if (!line || /^\d+$/.test(line)) continue; // skip pure numbers like age

    if (line.includes('📍')) {
      const loc = parseLocationText(line);
      if (loc) return loc;
    }

    const loc = parseLocationText(line);
    if (loc) return loc;
  }
  return '';
}

function getTTRecentPostDates() {
  // TikTok video IDs are Snowflake IDs: timestamp_seconds = id >> 32 (Unix epoch)
  const now = Date.now();
  const videoIds = [...new Set(
    [...document.querySelectorAll('a[href*="/video/"]')]
      .map(a => { const m = a.href.match(/\/video\/(\d+)/); return m?.[1] ?? null; })
      .filter(Boolean)
  )].slice(0, 24);

  if (videoIds.length === 0) return { timestamps: [] };

  const timestamps = videoIds
    .map(id => {
      const ts = Number(BigInt(id) >> 32n) * 1000;
      return (ts > 1_000_000_000_000 && ts <= now + 86_400_000) ? ts : null;
    })
    .filter(Boolean)
    .sort((a, b) => b - a);

  return { timestamps };
}

async function fetchBioLinks(urls) {
  let tiktokHandle = null;
  let email = null;

  for (const url of (urls || []).slice(0, 3)) {
    try {
      const resp = await fetch(url, { credentials: 'omit' });
      if (!resp.ok) continue;
      const html = await resp.text();

      if (!tiktokHandle) {
        const ttDirect = html.match(/tiktok\.com\/@([\w.]+)/i);
        if (ttDirect) {
          tiktokHandle = ttDirect[1];
        } else {
          const ndMatch = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
          if (ndMatch) {
            try {
              const ttInData = JSON.stringify(JSON.parse(ndMatch[1])).match(/tiktok\.com\/@([\w.]+)/i);
              if (ttInData) tiktokHandle = ttInData[1];
            } catch { /* malformed JSON */ }
          }
        }
      }

      if (!email) {
        const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i);
        if (mailtoMatch) {
          email = mailtoMatch[1];
        } else {
          const emailMatch = html.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
          if (emailMatch) email = emailMatch[0];
        }
      }

      if (tiktokHandle && email) break;
    } catch { /* skip unreachable */ }
  }

  return { tiktokHandle, email };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getTTData') {
    sendResponse(extractTTData());
  }
  if (request.action === 'getRecentPostDates') {
    sendResponse(getTTRecentPostDates());
  }
  if (request.action === 'fetchExternalLinks') {
    fetchBioLinks(request.urls).then(sendResponse);
  }
  return true;
});
