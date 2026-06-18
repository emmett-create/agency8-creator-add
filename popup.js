// Agency 8 — popup.js

let currentPlatform = null; // 'instagram' | 'tiktok'
let igFollowers = null;
let ttFollowers = null;

async function init() {
  document.getElementById('btn-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  document.getElementById('btn-add').addEventListener('click', addCreator);
  document.getElementById('btn-again')?.addEventListener('click', () => {
    show('form');
  });
  document.getElementById('btn-open-settings')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Check OAuth is configured
  const stored = await chrome.storage.sync.get('oauthClientId');
  if (!stored.oauthClientId) {
    show('setup');
    return;
  }

  // Load client dropdown
  const clientResp = await chrome.runtime.sendMessage({ action: 'getClients' });
  const clients = clientResp.clients || [];
  const sel = document.getElementById('f-client');
  clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    if (c.tab) opt.dataset.tab = c.tab;
    sel.appendChild(opt);
  });

  // Restore last selections
  const { lastClientId, lastGender, lastOwner } = await chrome.storage.local.get(['lastClientId', 'lastGender', 'lastOwner']);
  if (lastGender) document.getElementById('f-gender').value = lastGender;
  document.getElementById('f-gender').addEventListener('change', e =>
    chrome.storage.local.set({ lastGender: e.target.value })
  );
  if (lastOwner) document.getElementById('f-owner').value = lastOwner;
  document.getElementById('f-owner').addEventListener('change', e =>
    chrome.storage.local.set({ lastOwner: e.target.value })
  );
  if (lastClientId && [...sel.options].some(o => o.value === lastClientId)) {
    sel.value = lastClientId;
  }

  // Load verticals for the initially selected client
  if (sel.value) loadVerticals(sel.value);

  // Reload verticals whenever client changes, and remember selection
  sel.addEventListener('change', () => {
    chrome.storage.local.set({ lastClientId: sel.value });
    loadVerticals(sel.value);
  });

  // Detect current page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';

  if (url.includes('instagram.com/')) {
    await loadIG(tab.id);
  } else if (url.includes('tiktok.com/@')) {
    await loadTT(tab.id);
  } else {
    show('not-profile');
  }
}

async function sendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Content script not running (tab was open before extension loaded) — inject it now
    const file = message.action === 'getIGData' ? 'content_ig.js' : 'content_tt.js';
    await chrome.scripting.executeScript({ target: { tabId }, files: [file] });
    await new Promise(r => setTimeout(r, 300));
    return await chrome.tabs.sendMessage(tabId, message);
  }
}

async function loadIG(tabId) {
  show('loading');
  try {
    const data = await sendToTab(tabId, { action: 'getIGData' });
    if (!data?.handle) { show('not-profile'); return; }

    currentPlatform = 'instagram';
    setLabel('Instagram', 'ig');
    igFollowers = data.followers || null;
    ttFollowers = null;

    document.getElementById('f-ig-handle').value = data.handle || '';
    document.getElementById('f-name').value      = data.name || '';
    document.getElementById('f-followers').value = data.followers
      ? Number(data.followers).toLocaleString() : '';
    document.getElementById('f-location').value  = data.location || '';
    document.getElementById('f-email').value      = data.email || '';
    document.getElementById('f-bio').value        = data.bio || '';
    document.getElementById('f-platform').value  = 'IG';

    // If TikTok handle found in bio, try to compare follower counts
    if (data.tiktokHandle) {
      document.getElementById('f-tt-handle').value = data.tiktokHandle;
      const ttResp = await chrome.runtime.sendMessage({
        action: 'getTikTokFollowers',
        handle: data.tiktokHandle,
      });
      if (ttResp.followers) {
        ttFollowers = ttResp.followers;
        if (ttResp.followers > (data.followers || 0)) {
          document.getElementById('f-platform').value  = 'TT';
          document.getElementById('f-followers').value = Number(ttResp.followers).toLocaleString();
        }
      }
    }

    show('form');
    setupDupeButton(data.handle, data.tiktokHandle);

    // Fetch recent post dates asynchronously
    chrome.tabs.sendMessage(tabId, { action: 'getRecentPostDates' }, resp => {
      if (!resp?.timestamps?.length) return;
      const now = Date.now();
      const sorted = [...resp.timestamps].sort((a, b) => b - a);
      const last = new Date(sorted[0]);
      const diffDays = Math.floor((now - sorted[0]) / (1000 * 60 * 60 * 24));
      const lastLabel = diffDays === 0 ? 'today' : diffDays === 1 ? 'yesterday' : `${diffDays}d ago`;
      const postsLast15 = sorted.filter(ts => now - ts <= 15 * 24 * 60 * 60 * 1000).length;
      document.getElementById('stat-last-post').textContent = `Last post: ${lastLabel}`;
      document.getElementById('stat-posts-15').textContent  = `${postsLast15} post${postsLast15 !== 1 ? 's' : ''} in 15d`;
      document.getElementById('post-activity').classList.remove('hidden');
    });

    // Silently scan external bio links for TikTok handle and email
    if (data.bioLinks?.length) {
      chrome.runtime.sendMessage(
        { action: 'fetchExternalLinks', urls: data.bioLinks },
        async resp => {
          if (!resp) return;
          if (resp.email && !document.getElementById('f-email').value) {
            document.getElementById('f-email').value = resp.email;
          }
          if (resp.tiktokHandle && !document.getElementById('f-tt-handle').value) {
            document.getElementById('f-tt-handle').value = resp.tiktokHandle;
            // Look up TT followers and compare — same logic as when handle is in bio
            const ttResp = await chrome.runtime.sendMessage({
              action: 'getTikTokFollowers',
              handle: resp.tiktokHandle,
            });
            if (ttResp?.followers) {
              ttFollowers = ttResp.followers;
              const currentFollowers = parseInt(
                document.getElementById('f-followers').value.replace(/[^\d]/g, '') || '0'
              );
              if (ttResp.followers > currentFollowers) {
                document.getElementById('f-platform').value  = 'TT';
                document.getElementById('f-followers').value = Number(ttResp.followers).toLocaleString();
              }
            }
          }
        }
      );
    }

  } catch {
    show('not-profile');
  }
}

async function loadTT(tabId) {
  show('loading');
  try {
    const data = await sendToTab(tabId, { action: 'getTTData' });
    if (!data?.handle) { show('not-profile'); return; }

    currentPlatform = 'tiktok';
    setLabel('TikTok', 'tt');
    ttFollowers = data.followers || null;
    igFollowers = null;

    document.getElementById('f-tt-handle').value = data.handle || '';
    document.getElementById('f-ig-handle').value = data.igHandle || '';
    document.getElementById('f-name').value       = data.name || '';
    document.getElementById('f-followers').value  = data.followers
      ? Number(data.followers).toLocaleString() : '';
    document.getElementById('f-location').value   = data.location || '';
    document.getElementById('f-email').value       = data.email || '';
    document.getElementById('f-bio').value         = data.bio || '';
    document.getElementById('f-platform').value   = 'TT';

    show('form');
    setupDupeButton(data.igHandle || null, data.handle);

    // Fetch recent post dates asynchronously
    chrome.tabs.sendMessage(tabId, { action: 'getRecentPostDates' }, resp => {
      if (!resp?.timestamps?.length) return;
      const now = Date.now();
      const sorted = [...resp.timestamps].sort((a, b) => b - a);
      const diffDays = Math.floor((now - sorted[0]) / (1000 * 60 * 60 * 24));
      const lastLabel = diffDays === 0 ? 'today' : diffDays === 1 ? 'yesterday' : `${diffDays}d ago`;
      const postsLast15 = sorted.filter(ts => now - ts <= 15 * 24 * 60 * 60 * 1000).length;
      document.getElementById('stat-last-post').textContent = `Last post: ${lastLabel}`;
      document.getElementById('stat-posts-15').textContent  = `${postsLast15} post${postsLast15 !== 1 ? 's' : ''} in 15d`;
      document.getElementById('post-activity').classList.remove('hidden');
    });

    // Scan external bio links for IG handle, email
    if (data.bioLinks?.length) {
      chrome.runtime.sendMessage(
        { action: 'fetchExternalLinks', urls: data.bioLinks },
        async resp => {
          if (!resp) return;
          if (resp.email && !document.getElementById('f-email').value) {
            document.getElementById('f-email').value = resp.email;
          }
          if (resp.igHandle && !document.getElementById('f-ig-handle').value) {
            document.getElementById('f-ig-handle').value = resp.igHandle;
            // Compare IG followers with TT — update platform if IG is bigger
            const igResp = await chrome.runtime.sendMessage({
              action: 'getIGProfile',
              handle: resp.igHandle,
            });
            if (igResp?.followers) {
              igFollowers = igResp.followers;
              const currentFollowers = parseInt(
                document.getElementById('f-followers').value.replace(/[^\d]/g, '') || '0'
              );
              if (igResp.followers > currentFollowers) {
                document.getElementById('f-platform').value  = 'IG';
                document.getElementById('f-followers').value = Number(igResp.followers).toLocaleString();
              }
            }
            if (igResp?.email && !document.getElementById('f-email').value) {
              document.getElementById('f-email').value = igResp.email;
            }
          }
        }
      );
    }

    // Fetch IG profile to compare follower counts and grab email from bio
    if (data.igHandle) {
      chrome.runtime.sendMessage(
        { action: 'getIGProfile', handle: data.igHandle },
        resp => {
          if (!resp) return;
          if (resp.followers) {
            igFollowers = resp.followers;
            if (resp.followers > (data.followers || 0)) {
              document.getElementById('f-platform').value  = 'IG';
              document.getElementById('f-followers').value = Number(resp.followers).toLocaleString();
            }
          }
          if (resp.email && !document.getElementById('f-email').value) {
            document.getElementById('f-email').value = resp.email;
          }
        }
      );
    }

  } catch {
    show('not-profile');
  }
}

async function loadVerticals(spreadsheetId) {
  const vertSel = document.getElementById('f-vertical');
  const current = vertSel.value;
  const { lastVertical } = await chrome.storage.local.get('lastVertical');
  vertSel.innerHTML = '<option value="">Loading…</option>';

  const resp = await chrome.runtime.sendMessage({
    action: 'getVerticalOptions',
    spreadsheetId,
  });

  if (resp.error) {
    vertSel.innerHTML = `<option value="">⚠ ${resp.error}</option>`;
    return;
  }

  vertSel.innerHTML = '<option value="">— select —</option>';
  (resp.options || []).forEach(opt => {
    const el = document.createElement('option');
    el.value = opt;
    el.textContent = opt;
    if (opt === current || opt === lastVertical) el.selected = true;
    vertSel.appendChild(el);
  });

  // Save vertical selection whenever it changes
  vertSel.onchange = () => chrome.storage.local.set({ lastVertical: vertSel.value });

  if (!resp.options?.length) {
    vertSel.innerHTML = '<option value="">No vertical values found in sheet</option>';
  }
}

function setupDupeButton(igHandle, ttHandle) {
  const btn = document.getElementById('btn-check-dupes');
  btn.disabled = false;
  btn.textContent = 'Check if already in a list';
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = 'Checking…';
    const spreadsheetId = document.getElementById('f-client').value;
    const resp = await chrome.runtime.sendMessage({
      action: 'checkDuplicates',
      igHandle: igHandle || null,
      ttHandle: ttHandle || null,
      spreadsheetId: spreadsheetId || null,
    });
    if (resp.duplicates?.length) {
      const w = document.getElementById('duplicate-warning');
      const names = resp.duplicates.map(d => d.name).join(', ');
      w.innerHTML = `Already in: ${names} <button class="btn-update-dupe" id="btn-update-dupe">↑ Update record</button>`;
      w.classList.remove('hidden');
      btn.textContent = 'Found duplicates ↑';

      document.getElementById('btn-update-dupe').onclick = async () => {
        const updateBtn = document.getElementById('btn-update-dupe');
        updateBtn.disabled = true;
        updateBtn.textContent = 'Updating…';
        const followersRaw = document.getElementById('f-followers').value.replace(/[^\d]/g, '');
        const updateResp = await chrome.runtime.sendMessage({
          action: 'updateCreator',
          duplicates: resp.duplicates,
          creator: {
            primaryPlatform: document.getElementById('f-platform').value,
            followers:       followersRaw ? parseInt(followersRaw) : null,
            igFollowers,
            ttFollowers,
            email: document.getElementById('f-email').value.trim(),
          },
        });
        updateBtn.textContent = updateResp?.error ? '✗ Error' : '✓ Updated';
      };
    } else {
      btn.textContent = 'Not found in this list ✓';
    }
  };
}

async function addCreator() {
  const btn = document.getElementById('btn-add');
  btn.disabled = true;
  btn.textContent = 'Adding…';
  document.getElementById('error-msg').classList.add('hidden');

  const igHandle   = document.getElementById('f-ig-handle').value.trim().replace(/^@/, '');
  const ttHandle   = document.getElementById('f-tt-handle').value.trim().replace(/^@/, '');
  const platform   = document.getElementById('f-platform').value;  // "IG" or "TT"
  const followersRaw = document.getElementById('f-followers').value.replace(/[^\d]/g, '');

  const creator = {
    name:            document.getElementById('f-name').value.trim(),
    igHandle:        igHandle,
    ttHandle:        ttHandle,
    igLink:          igHandle ? `https://www.instagram.com/${igHandle}/` : '',
    ttLink:          ttHandle ? `https://www.tiktok.com/@${ttHandle}` : '',
    email:           document.getElementById('f-email').value.trim(),
    primaryPlatform: platform,
    followers:       followersRaw ? parseInt(followersRaw) : null,
    igFollowers:     igFollowers,
    ttFollowers:     ttFollowers,
    owner:           document.getElementById('f-owner').value.trim(),
    gender:          document.getElementById('f-gender').value,
    vertical:        document.getElementById('f-vertical').value.trim(),
    location:        document.getElementById('f-location').value.trim(),
    age:             document.getElementById('f-age').value,
  };

  const spreadsheetId = document.getElementById('f-client').value;
  const clientName    = document.getElementById('f-client').selectedOptions[0]?.text || '';
  const tabOverride   = document.getElementById('f-client').selectedOptions[0]?.dataset.tab || null;

  const resp = await chrome.runtime.sendMessage({
    action: 'addCreator',
    creator,
    spreadsheetId,
    tabOverride,
  });

  if (resp.error) {
    const errEl = document.getElementById('error-msg');
    errEl.textContent = resp.error === 'NO_CLIENT_ID'
      ? 'OAuth Client ID not set. Open Settings.'
      : `Error: ${resp.error}`;
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Add to Master List';
  } else {
    document.getElementById('success-detail').textContent = `Added to ${clientName}`;
    show('success');
  }
}

function setLabel(platform, cls) {
  const el = document.getElementById('platform-label');
  el.innerHTML = `Add Creator <span class="platform-badge ${cls}">${platform}</span>`;
}

function show(view) {
  const views = ['not-profile', 'loading', 'setup', 'form', 'success'];
  views.forEach(v => {
    document.getElementById(`view-${v}`)?.classList.toggle('hidden', v !== view);
  });
}

document.addEventListener('DOMContentLoaded', init);
