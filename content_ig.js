// Agency 8 — content_ig.js
// Extracts creator data from an Instagram profile page.

function extractIGData() {
  const path  = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  const skip  = ['explore', 'accounts', 'p', 'reel', 'reels', 'stories', 'tv', 'direct'];
  if (parts.length === 0 || skip.includes(parts[0])) return null;

  const handle = parts[0];
  const result = { handle, igLink: `https://www.instagram.com/${handle}/` };

  // Check if meta/script data is fresh for this handle.
  // On Instagram SPA navigation, the URL updates immediately but <meta>/<script> tags
  // may still reflect the previous profile — detect this by checking og:title.
  const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
  const metaIsFresh = ogTitle.toLowerCase().includes(handle.toLowerCase());

  // ── Strategy 1: JSON-LD (only if fresh) ───────────────────────────────────
  if (metaIsFresh) {
    const ldScript = document.querySelector('script[type="application/ld+json"]');
    if (ldScript) {
      try {
        const ld = JSON.parse(ldScript.textContent);
        if (ld.name) {
          const m = ld.name.match(/^(.+?)\s*\(@/);
          const candidate = m ? m[1].trim() : ld.name.replace(/•.*$/, '').trim();
          const handleLower = handle.toLowerCase();
          const wordsInHandle = candidate.split(/\s+/).filter(w => {
            const wl = w.toLowerCase().replace(/[^a-z]/g, '');
            return wl.length > 2 && handleLower.includes(wl);
          });
          if (!(candidate === candidate.toLowerCase() && wordsInHandle.length === 0)) {
            result.name = candidate;
          }
        }
        if (ld.description) result.bio = ld.description;
      } catch { /* ignore */ }
    }
  }

  // ── Strategy 2: Open Graph meta tags (only if fresh) ──────────────────────
  if (metaIsFresh) {
    if (ogTitle && !result.name) {
      const m = ogTitle.match(/^(.+?)\s*\(@/);
      const candidate = m ? m[1].trim() : ogTitle.replace(/•.*$/, '').trim();
      const handleLower = handle.toLowerCase();
      const wordsInHandle = candidate.split(/\s+/).filter(w => {
        const wl = w.toLowerCase().replace(/[^a-z]/g, '');
        return wl.length > 2 && handleLower.includes(wl);
      });
      if (!(candidate === candidate.toLowerCase() && wordsInHandle.length === 0)) {
        result.name = candidate;
      }
    }

    const ogDesc = document.querySelector('meta[property="og:description"]')?.getAttribute('content');
    if (ogDesc) {
      const fm = ogDesc.match(/([\d,.]+[KMB]?)\s+Followers?/i);
      if (fm) result.followers = parseFollowers(fm[1]);
    }
  }

  // Clean name: use handle to strip credential prefixes like "Diabetes RD Erin Palinski-Wade"
  if (result.name) result.name = cleanName(result.name, handle);

  // ── Strategy 3: Search all inline scripts for profile JSON ─────────────────
  // Try multiple key patterns — Instagram changes their JSON structure often
  const bioPatterns = [
    /"biography"\s*:\s*"((?:[^"\\]|\\.)*)"/,
    /"bio"\s*:\s*"((?:[^"\\]|\\.)*)"/,
  ];
  const followerPatterns = [
    /"edge_followed_by"\s*:\s*\{\s*"count"\s*:\s*(\d+)/,
    /"follower_count"\s*:\s*(\d+)/,
    /"followers_count"\s*:\s*(\d+)/,
    /"followers"\s*:\s*(\d+)/,
  ];

  const decodeBioRaw = raw => raw
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
    .replace(/\\u([dD][89aAbB][0-9a-fA-F]{2})\\u([dD][c-fC-F][0-9a-fA-F]{2})/g,
      (_, h, l) => String.fromCodePoint(
        (parseInt(h, 16) - 0xD800) * 0x400 + parseInt(l, 16) - 0xDC00 + 0x10000
      ))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)));

  // HIGH-PRIORITY pass: find bio tied to the correct "username" field.
  // Instagram embeds the logged-in account's data in the same page scripts,
  // so we must anchor the bio search to the target handle's username entry.
  let foundConfidentBio = false;
  if (metaIsFresh) {
    const handleEsc = handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const usernameRe = new RegExp(`"username"\\s*:\\s*"${handleEsc}"`, 'i');
    for (const script of document.querySelectorAll('script:not([src])')) {
      const t = script.textContent;
      if (t.length < 200) continue;
      const uMatch = usernameRe.exec(t);
      if (!uMatch) continue;
      // Search within a bounded window around the username match
      const chunk = t.slice(Math.max(0, uMatch.index - 300), uMatch.index + 3000);
      for (const pat of bioPatterns) {
        const m = chunk.match(pat);
        if (m && m[1] !== undefined) {
          result.bio = decodeBioRaw(m[1]);
          foundConfidentBio = true;
          break;
        }
      }
      if (foundConfidentBio) break;
    }
  }

  for (const script of metaIsFresh ? document.querySelectorAll('script:not([src])') : []) {
    const t = script.textContent;
    if (t.length < 200) continue;

    // Generic bio scan — only runs if the high-priority pass didn't find a confident match.
    // Scan ALL occurrences of each pattern — prefer the one that contains the handle,
    // otherwise keep the longest. This avoids picking up brand/ad biography fields.
    if (!foundConfidentBio) {
      for (const pat of bioPatterns) {
        const globalPat = new RegExp(pat.source, 'g');
        for (const m of t.matchAll(globalPat)) {
          const candidate = m[1];
          const currentBio = result.bio || '';
          const candidateHasHandle = candidate.toLowerCase().includes(handle.toLowerCase());
          const currentHasHandle = currentBio.toLowerCase().includes(handle.toLowerCase());
          const prefer = candidateHasHandle && !currentHasHandle
            || (candidateHasHandle === currentHasHandle && candidate.length > currentBio.length);
          if (prefer) {
            result.bio = decodeBioRaw(candidate);
          }
        }
      }
    }

    // Always update followers if we find an exact number
    for (const pat of followerPatterns) {
      const m = t.match(pat);
      if (m) {
        const exact = parseInt(m[1]);
        // Prefer the larger/more precise count
        if (!result.followers || exact > result.followers * 0.9) {
          result.followers = exact;
        }
        break;
      }
    }

  }

  // ── Strategy 4: DOM extraction for bio ────────────────────────────────────
  // What's rendered on screen is always the correct profile. Run DOM extraction
  // and prefer it over script-based results unless we already have a confident
  // username-anchored hit — DOM can be noisy but is never the wrong account.
  const domBio = extractBioFromDOM();
  if (!foundConfidentBio && domBio.length > 0) {
    // Prefer DOM bio: it's what the user sees on screen
    result.bio = domBio;
  } else if (domBio.length > (result.bio || '').length) {
    // If confident bio is shorter than DOM, DOM likely captured more lines
    result.bio = domBio;
  }

  // ── Strategy 5: Follower count from DOM title attribute ───────────────────
  if (!result.followers) {
    const followerEl = [...document.querySelectorAll('span[title], a[title]')]
      .find(el => {
        const next = el.parentElement?.textContent || '';
        return next.toLowerCase().includes('follower');
      });
    if (followerEl) {
      const titleVal = followerEl.getAttribute('title')?.replace(/,/g, '');
      if (titleVal && /^\d+$/.test(titleVal)) result.followers = parseInt(titleVal);
    }
  }

  // ── DOM name fallback (used when meta is stale from SPA navigation) ────────
  if (!result.name) {
    // Instagram renders: handle line → display name line → pronouns → stats → bio
    const lines = (document.body.innerText || '').split('\n').map(l => l.trim()).filter(Boolean);
    const handleIdx = lines.findIndex(l => l.toLowerCase() === handle.toLowerCase());
    if (handleIdx >= 0) {
      const candidate = lines[handleIdx + 1] || '';
      const handleLower = handle.toLowerCase();
      const wordsInHandle = candidate.split(/\s+/).filter(w => {
        const wl = w.toLowerCase().replace(/[^a-z]/g, '');
        return wl.length > 2 && handleLower.includes(wl);
      });
      // Skip if all-lowercase with no words matching the handle — likely bio text, not a display name
      const looksLikeBio = candidate === candidate.toLowerCase() && wordsInHandle.length === 0;
      if (!looksLikeBio && candidate.length > 1 && candidate.length < 60 &&
          !candidate.match(/^\d/) && !candidate.includes('http')) {
        result.name = capitalize(cleanName(candidate, handle));
      }
    }
    // Fall back to handle if still no name
    if (!result.name) result.name = handle;
  }

  // ── Extract from bio ───────────────────────────────────────────────────────
  if (result.bio) {
    result.tiktokHandle = extractTikTokFromBio(result.bio);
    result.location     = extractLocation(result.bio);
    result.email        = extractEmail(result.bio);
  }

  // Also scan body text for TikTok handle (bio may be truncated)
  if (!result.tiktokHandle) {
    result.tiktokHandle = extractTikTokFromBio(document.body.innerText || '');
  }

  // Email and location are bio-only — body.innerText is too noisy (picks up ads, captions, etc.)

  // ── Extract external bio links (linktree, beacons, etc.) ──────────────────
  result.bioLinks = extractBioLinks();

  return result;
}

// Read bio text directly from the rendered DOM.
// Instagram sets dir="auto" on user-generated text (bios, captions) for RTL support.
// We target that attribute within the profile header — not the top nav — to avoid
// accidentally reading the logged-in account's info from sidebar/nav elements.
function extractBioFromDOM() {
  // Prefer header inside <main> or <article> over the top-nav <header>
  const profileHeader =
    document.querySelector('main header') ||
    document.querySelector('article header') ||
    document.querySelector('main section');

  const searchRoot = profileHeader ||
    document.querySelector('main') ||
    document.querySelector('[role="main"]');
  if (!searchRoot) return '';

  // Primary: collect span/div elements with dir="auto" (Instagram's bio text marker)
  // Use innerText (not textContent) so <br> line-breaks are preserved as newlines —
  // otherwise "code ABBS\nabigailwhite@..." collapses to "ABBSabigailwhite@..." and
  // the email regex picks up the wrong prefix.
  const dirAutoEls = [...searchRoot.querySelectorAll('span[dir="auto"], h1[dir="auto"]')];
  if (dirAutoEls.length > 0) {
    const bioText = dirAutoEls
      .map(el => (el.innerText || el.textContent || '').trim())
      .filter(t => t.length > 3)
      .slice(0, 8)
      .join('\n')
      .trim();
    if (bioText) return bioText;
  }

  // Fallback: walk leaf text nodes within the profile header
  const skipText = new Set([
    'follow', 'message', 'edit profile', 'posts', 'followers',
    'following', 'subscribe', 'contact', 'email', 'verified',
    'she/her', 'he/him', 'they/them', 'more', '... more',
  ]);
  const skipPattern = /^(she|he|they|her|him|them|more|\.\.\.)$/i;

  const walk = (el, depth = 0) => {
    if (depth > 8) return '';
    if (['BUTTON', 'A', 'SCRIPT', 'STYLE'].includes(el.tagName)) return '';
    const children = [...el.children];
    if (children.length === 0) {
      const text = (el.innerText || el.textContent || '').trim();
      if (
        text.length > 15 &&
        !text.match(/^[\d,\.KMB%]+$/) &&
        !skipText.has(text.toLowerCase()) &&
        !skipPattern.test(text)
      ) return text;
      return '';
    }
    return children.map(c => walk(c, depth + 1)).filter(Boolean).join('\n');
  };

  const bio = walk(searchRoot);
  const lines = bio.split('\n').filter(l => l.trim().length > 5);
  return lines.slice(0, 5).join('\n').trim();
}

function parseFollowers(raw) {
  const s = raw.replace(/,/g, '').trim().toUpperCase();
  if (s.endsWith('M')) return Math.round(parseFloat(s) * 1_000_000);
  if (s.endsWith('K')) return Math.round(parseFloat(s) * 1_000);
  if (s.endsWith('B')) return Math.round(parseFloat(s) * 1_000_000_000);
  return parseInt(s) || 0;
}

// Collapse names like "J U S T I N ⚓ A N D E R S O N" → "JUSTIN ANDERSON"
// The emoji acts as a word separator; each spaced-letter segment is collapsed.
function normalizeSpacedName(name) {
  const singleLetterCount = name.split(/\s+/).filter(w => /^[A-Za-z]$/.test(w)).length;
  if (singleLetterCount <= 3) return name; // fast path — not a spaced-letter name

  const emojiRe = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]+/gu;
  const parts = name.split(emojiRe).map(p => p.trim()).filter(Boolean);

  const collapsed = parts.map(part => {
    const words = part.split(/\s+/);
    if (words.length > 1 && words.every(w => /^[A-Za-z]$/.test(w))) return words.join('');
    return part;
  });

  return collapsed.join(' ').trim() || name;
}

// Strip title prefixes and credential suffixes, use handle to remove leading descriptor words.
// e.g. "Dr Jonathan Spages" + "drjspages" → "Jonathan Spages"
//      "Diabetes RD Erin Palinski-Wade" + "erinpalinskiwade" → "Erin Palinski-Wade"
function cleanName(rawName, handle) {
  rawName = normalizeSpacedName(rawName);
  const handleLower = (handle || '').toLowerCase();

  // Strip job title / descriptor after pipe or dash separator (e.g. "Blair Cooley | Dietitian")
  let name = rawName.replace(/\s*[|—–]\s*.+$/, '').trim() || rawName;

  // Strip "at [Brand/Location]" suffix (e.g. "Lauren Matts at Sunny Hill Farm")
  name = name.replace(/\s+at\s+\S.+$/i, '').trim() || name;

  // Strip common title prefixes
  name = name
    .replace(/^(Dr\.?|Prof\.?|Mr\.?|Mrs\.?|Ms\.?|Miss|Sir|Coach)\s+/i, '')
    .trim();
  // Strip credential abbreviations anywhere
  name = name
    .replace(/\s*\b(RD|MD|PhD|CPT|NP|PA|MS|BS|RN|DO|DDS|DVM|MPH|MBA|CPA|DC|OD|CNS|APRN|LCSW)\b\.?/gi, '')
    .trim();

  if (!name) return rawName;
  if (!handleLower) return name;

  const words = name.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return name;

  const inHandle = words.map(w => {
    const s = w.toLowerCase().replace(/[^a-z]/g, '');
    return s.length > 2 && handleLower.includes(s); // min 3 chars — avoids prepositions like "at", "of", "or"
  });

  // If last name (last word) is confirmed in the handle:
  if (inHandle[inHandle.length - 1]) {
    const matchCount = inHandle.filter(Boolean).length;
    // Count leading words NOT found in handle
    let leadStart = 0;
    while (leadStart < words.length - 1 && !inHandle[leadStart]) leadStart++;

    // Strip leading descriptor words only when 2+ words ARE in the handle
    // (avoids stripping "Jonathan" from "Jonathan Spages" where only last name matches)
    if (matchCount >= 2 && leadStart > 0) return capitalize(words.slice(leadStart).join(' '));
    return capitalize(name); // Last name confirmed, keep full name (e.g. "Jonathan Spages")
  }

  // Fallback: keep words that appear in handle
  const kept = words.filter((_, i) => inHandle[i]);
  if (kept.length >= 2) return capitalize(kept.join(' '));
  return capitalize(name);
}

function capitalize(str) {
  // If entirely uppercase (e.g. "IVVY BURBAGE"), convert to title case first
  const base = str === str.toUpperCase() && str.length > 1 ? str.toLowerCase() : str;
  return base.replace(/\b([a-z])/g, c => c.toUpperCase());
}

function extractTikTokFromBio(bio) {
  const urlMatch = bio.match(/tiktok\.com\/@([\w.]+)/i);
  if (urlMatch) return urlMatch[1];
  // MUST require explicit @ to avoid grabbing words like "pages" from "Our TikTok pages @handle"
  const labeledAt = bio.match(/(?:tiktok|tt)\b[^@\n]{0,20}@([\w.]+)/i);
  if (labeledAt) return labeledAt[1];
  return null;
}

function extractEmail(bio) {
  const m = bio.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}

// Known major cities — case-insensitive lookup via KNOWN_CITIES_LOWER
const KNOWN_CITIES = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Dallas', 'Atlanta',
  'Miami', 'Seattle', 'Boston', 'Denver', 'Austin', 'Nashville', 'Portland',
  'San Francisco', 'San Diego', 'Las Vegas', 'Phoenix', 'Minneapolis',
  'Philadelphia', 'Charlotte', 'Tampa', 'New Orleans', 'Detroit', 'Baltimore',
  'Toronto', 'Vancouver', 'Montreal', 'London', 'Paris', 'Sydney', 'Melbourne',
  'Dubai', 'Amsterdam', 'Berlin', 'Tokyo', 'Seoul', 'Mexico City',
  'Sacramento', 'San Jose', 'Jacksonville', 'Columbus', 'Indianapolis',
  'Fort Worth', 'San Antonio', 'Oklahoma City', 'Louisville', 'Memphis',
  'Raleigh', 'Richmond', 'Pittsburgh', 'Cincinnati', 'Kansas City',
  'Salt Lake City', 'New Haven', 'Hartford', 'Providence', 'Albany',
  'Calgary', 'Ottawa', 'Winnipeg', 'Edinburgh', 'Manchester', 'Dublin',
  'Lagos', 'Nairobi', 'Accra', 'Cape Town', 'Johannesburg',
];
const KNOWN_CITIES_LOWER = new Map(KNOWN_CITIES.map(c => [c.toLowerCase(), c]));

// US states — matched when a state name appears at the start of a bio line
const KNOWN_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
  'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina',
  'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas',
  'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming',
];
const KNOWN_STATES_LOWER = new Map(KNOWN_STATES.map(s => [s.toLowerCase(), s]));

// Valid 2-3 letter US state abbreviations (plus common country codes)
// Used to reject false positives like "jolieskinco, and" from the City, ST regex
const VALID_STATE_ABBREVS = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC','UK','AU','NZ',
]);

function matchKnownCity(text) {
  // Strip leading AND trailing emoji/punctuation, then check case-insensitively.
  // Handles patterns like "🤩Houston" or "📍Los Angeles 🌴"
  const cleaned = text.trim()
    .replace(/^[\p{Emoji}\p{So}\s]+/u, '')        // strip leading emoji
    .replace(/\s*[\p{Emoji}\p{So}|•,;].*$/u, '')  // strip trailing emoji and beyond
    .trim()
    .toLowerCase();
  return KNOWN_CITIES_LOWER.get(cleaned) || null;
}

function extractLocation(text) {
  // Strip Instagram UI lines that aren't bio content (e.g. "Followed by X, Y, and Z")
  text = text.split('\n').filter(l => !/^followed by\b/i.test(l.trim())).join('\n');

  // 📍 emoji — highest confidence
  // Handles both "LA 📍" (location before pin) and "📍 LA" (location after pin)
  const pinLine = text.split('\n').find(l => l.includes('📍'));
  if (pinLine) {
    // Remove the pin emoji and any other emoji, then clean up
    const cleaned = pinLine
      .replace(/📍/g, ' ')
      .trim()
      .replace(/^[\p{Emoji}\p{So}\s]+/u, '')
      .replace(/\s*[\p{Emoji}\p{So}|•,;].*$/u, '')
      .trim();
    if (cleaned.length >= 2) {
      const pinFirst = cleaned.split(/\s*[|&]\s*/)[0].trim();
      const pinCity = matchKnownCity(pinFirst);
      if (pinCity) return pinCity;
      const pinLower = pinFirst.toLowerCase();
      for (const [stateLower, stateName] of KNOWN_STATES_LOWER) {
        if (pinLower === stateLower ||
            pinLower.startsWith(stateLower + ',') ||
            pinLower.startsWith(stateLower + ' ')) {
          return stateName;
        }
      }
      const pinCityState = cleaned.match(/\b([A-Za-z][a-z]+(?: [A-Za-z][a-z]+)*),\s*([A-Za-z]{2,3})\b/i);
      if (pinCityState && VALID_STATE_ABBREVS.has(pinCityState[2].toUpperCase())) {
        return `${pinCityState[1].replace(/\b\w/g, c => c.toUpperCase())}, ${pinCityState[2].toUpperCase()}`;
      }
      // Slash-separated multi-location (e.g. "bk / dc", "nyc / la")
      if (/\//.test(cleaned)) {
        const slashParts = cleaned.split(/\s*\/\s*/);
        const resolved = slashParts.map(p => {
          const m = p.trim().match(/^(nyc|la|sf|dc|atl|chi|phx|mia|bos|pdx|sea|dtx|lax|bk)\b/i);
          return m ? m[1].toUpperCase() : null;
        });
        if (resolved.filter(Boolean).length >= 2) return resolved.filter(Boolean).join('/');
      }
      const abbrevMatch = cleaned.match(/\b(nyc|la|sf|dc|atl|chi|phx|mia|bos|pdx|sea|dtx|lax|bk)\b(?!\s*\d)/i);
      if (abbrevMatch) return abbrevMatch[1].toUpperCase();
      if (cleaned.length <= 40) return cleaned;
    }
  }

  // City/State, Country or City, ST — case-insensitive (e.g. "tucson, az", "Los Angeles, CA")
  // Validate the abbreviation against known state codes to avoid false positives like
  // "jolieskinco, and" (from "Followed by" text) matching as a city/state pair.
  const cityState = text.match(/\b([A-Za-z][a-z]+(?: [A-Za-z][a-z]+)*),\s*([A-Za-z]{2,3})\b/i);
  if (cityState && VALID_STATE_ABBREVS.has(cityState[2].toUpperCase())) {
    const city = cityState[1].replace(/\b\w/g, c => c.toUpperCase());
    const state = cityState[2].toUpperCase();
    return `${city}, ${state}`;
  }

  // Known city abbreviations — but NOT when followed by a digit (e.g. "NYC 2" highlight names)
  const lowerAbbrev = text.match(/\b(nyc|la|sf|dc|atl|chi|phx|mia|bos|pdx|sea|dtx|lax)\b(?!\s*\d)/i);
  if (lowerAbbrev) return lowerAbbrev[1].toUpperCase();

  // Multi-city uppercase abbreviations: "NYC | LA", "NYC/LA"
  const multiCity = text.match(/\b([A-Z]{2,4}(?:\s*[|\/&]\s*[A-Z]{2,4})+)\b/);
  if (multiCity) return multiCity[1].trim();

  // Helper: resolve a single token to a known city or state name, or null
  const resolvePlace = token => {
    const city = matchKnownCity(token);
    if (city) return city;
    const stripped = token.replace(/^[\p{Emoji}\p{So}\s]+/u, '').trim();
    const lower = stripped.toLowerCase();
    for (const [stateLower, stateName] of KNOWN_STATES_LOWER) {
      if (lower === stateLower ||
          lower.startsWith(stateLower + ',') ||
          lower.startsWith(stateLower + ' ')) {
        return stateName;
      }
    }
    return null;
  };

  // Scan each line: known city or US state at the start of the line.
  // Handles "atlanta | wellness & lifestyle creator", "Toronto 🎮",
  // "California, cozy outfits & Jesus", "🤩Houston", "Hawaii+California", etc.
  for (const line of text.split(/\n/)) {
    const t = line.trim();
    const candidate = t.split(/\s*[|&]\s*/)[0].trim();

    // Multi-location joined by + or / (e.g. "Hawaii+California", "NYC/LA")
    if (/[+\/]/.test(candidate)) {
      const parts = candidate.split(/\s*[+\/]\s*/);
      const places = parts.map(resolvePlace).filter(Boolean);
      if (places.length >= 2) return places.join('/');
      if (places.length === 1) return places[0];
    }

    const place = resolvePlace(candidate);
    if (place) return place;
  }

  return '';
}

// Click "... more" to expand collapsed bio before extracting
async function expandBio() {
  // Only search within the profile header, not the nav/sidebar
  const header = document.querySelector('header') ||
                 document.querySelector('main section') ||
                 document.querySelector('[role="main"]');
  if (!header) return;

  const moreEl = [...header.querySelectorAll('span, div')].find(
    el => el.children.length === 0 && /^\s*more\s*$/i.test(el.textContent)
  );
  if (moreEl) {
    moreEl.click();
    await new Promise(r => setTimeout(r, 400));
  }
}

// Extract external link URLs from the profile area (linktree, beacons, etc.)
// Searches all of <main> but only keeps links that are clearly external profile
// links — either from a known link-in-bio service, or whose anchor text looks
// like a URL (e.g. "linktr.ee/username").
function extractBioLinks() {
  const mainEl = document.querySelector('main') || document.querySelector('[role="main"]');
  if (!mainEl) return [];

  const KNOWN_HOSTS = /linktr\.ee|beacons\.ai|bio\.link|linkin\.bio|lnk\.bio|allmylinks\.com|solo\.to|tr\.ee|taplink\.cc|campsite\.bio|msha\.ke|flowpage\.com|koji\.to/i;
  const seen = new Set();
  const links = [];

  for (const a of mainEl.querySelectorAll('a[href]')) {
    let href = a.getAttribute('href') || '';

    // Decode Instagram's l.instagram.com redirect wrapper.
    // Handle both https: and protocol-relative // forms.
    if (href.includes('l.instagram.com')) {
      try {
        const full = href.startsWith('//') ? 'https:' + href : href;
        const u = new URL(full).searchParams.get('u');
        if (u) href = decodeURIComponent(u);
      } catch {}
    }

    if (!href.startsWith('http')) continue;
    if (href.includes('instagram.com')) continue;
    if (href.includes('tiktok.com')) continue;
    if (href.includes('threads.net') || href.includes('threads.com')) continue;
    if (/\/(p|reel|explore|accounts|stories)\//.test(href)) continue;
    if (seen.has(href)) continue;

    // Only keep links that are from a known link-in-bio host, OR whose
    // visible text looks like a URL (e.g. "linktr.ee/TheHungryHooker").
    const anchorText = (a.textContent || '').trim();
    const textIsUrl = /^[a-z0-9-]+\.[a-z]{2,}\/\S/i.test(anchorText);

    if (!KNOWN_HOSTS.test(href) && !textIsUrl) continue;

    seen.add(href);
    links.push(href);
    if (links.length >= 5) break;
  }

  // Fallback: Instagram sometimes renders the external bio link as a non-anchor
  // element (no href). Scan the visible page text for known link-in-bio domains.
  if (links.length === 0) {
    const bodyText = document.body.innerText || '';
    const textRe = /(?:https?:\/\/)?(?:www\.)?((?:linktr\.ee|beacons\.ai|bio\.link|linkin\.bio|lnk\.bio|allmylinks\.com|solo\.to|tr\.ee|taplink\.cc|campsite\.bio|msha\.ke|flowpage\.com|koji\.to)\/[^\s\n"'<>]+)/gi;
    for (const m of bodyText.matchAll(textRe)) {
      const url = m[0].startsWith('http') ? m[0] : `https://${m[1]}`;
      const clean = url.replace(/[.,;!?]+$/, '');
      if (!seen.has(clean)) {
        seen.add(clean);
        links.push(clean);
        if (links.length >= 3) break;
      }
    }
  }

  return links;
}

async function getRecentPostDates() {
  // Instagram shortcodes encode a timestamp — decode it without any network requests.
  // Shortcode alphabet: A-Z a-z 0-9 - _  (indices 0–63)
  // Formula: id = base64decode(shortcode); timestamp_ms = (id >> 23) + 1314220021721
  const IG_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const IG_EPOCH = 1314220021721n;
  const now = Date.now();

  function shortcodeToTimestamp(code) {
    let id = 0n;
    for (const c of code) {
      const i = IG_ALPHABET.indexOf(c);
      if (i < 0) return null;
      id = id * 64n + BigInt(i);
    }
    const ts = Number((id >> 23n) + IG_EPOCH);
    return (ts > 1_000_000_000_000 && ts <= now + 86_400_000) ? ts : null;
  }

  // Strategy 1: decode timestamps from post/reel shortcodes in the DOM
  const shortcodes = [...new Set(
    [...document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')]
      .map(a => { const m = a.href.match(/\/(p|reel)\/([\w-]+)\/?(?:\?|$)/); return m?.[2] ?? null; })
      .filter(Boolean)
  )].slice(0, 24);

  if (shortcodes.length > 0) {
    const timestamps = shortcodes.map(shortcodeToTimestamp).filter(Boolean);
    if (timestamps.length > 0) return { timestamps: timestamps.sort((a, b) => b - a) };
  }

  // Strategy 2: scan inline scripts for taken_at unix timestamps
  const inlineTimestamps = [];
  const takenAtRe = /"taken_at"\s*:\s*(\d{10})/g;
  for (const script of document.querySelectorAll('script:not([src])')) {
    const t = script.textContent;
    if (t.length < 100) continue;
    for (const m of t.matchAll(takenAtRe)) {
      const ts = parseInt(m[1]) * 1000;
      if (ts > now - 2 * 365 * 24 * 60 * 60 * 1000 && ts <= now) inlineTimestamps.push(ts);
    }
  }
  if (inlineTimestamps.length > 0) {
    return { timestamps: [...new Set(inlineTimestamps)].sort((a, b) => b - a).slice(0, 24) };
  }

  return { timestamps: [] };
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
  if (request.action === 'getIGData') {
    expandBio().then(() => sendResponse(extractIGData()));
  }
  if (request.action === 'getRecentPostDates') {
    getRecentPostDates().then(sendResponse);
  }
  if (request.action === 'fetchExternalLinks') {
    fetchBioLinks(request.urls).then(sendResponse);
  }
  return true;
});
