// Agency 8 — options.js

// DEFAULT_CLIENTS comes from clients.js, loaded via <script> before this file in options.html

async function loadClients() {
  const stored = await chrome.storage.sync.get('clients');
  return stored.clients || DEFAULT_CLIENTS;
}

async function saveClients(clients) {
  await chrome.storage.sync.set({ clients });
}

function flashSaved(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2000);
}

async function renderClients() {
  const clients = await loadClients();
  const list    = document.getElementById('client-list');
  list.innerHTML = '';

  if (clients.length === 0) {
    list.innerHTML = '<div style="color:#555; font-size:12px; padding:8px 0;">No clients yet.</div>';
    return;
  }

  clients.forEach((c, i) => {
    const row = document.createElement('div');
    row.className = 'client-row';
    row.innerHTML = `
      <div class="client-name">${c.name}</div>
      <div class="client-id" title="${c.id}">${c.id}</div>
      <button class="btn-remove" data-i="${i}">Remove</button>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const clients = await loadClients();
      clients.splice(parseInt(btn.dataset.i), 1);
      await saveClients(clients);
      renderClients();
    });
  });
}

async function init() {
  // Load saved OAuth client ID
  const stored = await chrome.storage.sync.get('oauthClientId');
  if (stored.oauthClientId) {
    document.getElementById('oauth-client-id').value = stored.oauthClientId;
  }

  // Show redirect URI
  const redirectResp = await chrome.runtime.sendMessage({ action: 'getRedirectUrl' });
  const redirectUri  = redirectResp?.url || 'Could not determine — load extension first';
  document.getElementById('redirect-uri').textContent = redirectUri;

  // Copy redirect URI
  document.getElementById('btn-copy-redirect').addEventListener('click', () => {
    navigator.clipboard.writeText(redirectUri).then(() => {
      document.getElementById('btn-copy-redirect').textContent = 'Copied!';
      setTimeout(() => {
        document.getElementById('btn-copy-redirect').textContent = 'Copy';
      }, 1500);
    });
  });

  // Save OAuth client ID
  document.getElementById('btn-save-oauth').addEventListener('click', async () => {
    const val = document.getElementById('oauth-client-id').value.trim();
    await chrome.storage.sync.set({ oauthClientId: val });
    flashSaved('saved-oauth');
  });

  // Add client
  document.getElementById('btn-add-client').addEventListener('click', async () => {
    const name = document.getElementById('new-name').value.trim();
    const id   = document.getElementById('new-id').value.trim();
    if (!name || !id) return;
    const clients = await loadClients();
    clients.push({ name, id });
    await saveClients(clients);
    document.getElementById('new-name').value = '';
    document.getElementById('new-id').value   = '';
    renderClients();
  });

  // Reset to defaults
  document.getElementById('btn-reset-clients').addEventListener('click', async () => {
    await saveClients(DEFAULT_CLIENTS);
    flashSaved('saved-reset');
    renderClients();
  });

  // Sign out
  document.getElementById('btn-signout').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ action: 'signOut' });
    document.getElementById('btn-signout').textContent = 'Signed out';
    setTimeout(() => {
      document.getElementById('btn-signout').textContent = 'Sign out of Google';
    }, 2000);
  });

  renderClients();
}

document.addEventListener('DOMContentLoaded', init);
