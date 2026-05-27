// Agency 8 — options.js

const DEFAULT_CLIENTS = [
  { name: 'BORNTOSTANDOUT',     id: '1nsRCoRK9hdbH50rMD9zqp-GGwTpPyEAFWT69_pjVEbg' },
  { name: 'Brodo',              id: '13PXK5rMfw2S53AZLU57MhwEfv1TWwQS0LYIE7xZHOx0' },
  { name: 'Counter',            id: '1gVSv9Nz4Aucnd_8kd8YkW0AsiIEHpjtYgMRp7R3yOqY' },
  { name: 'Emma Relief',        id: '1tIs_TonI25q20QEB9perUtIAmgepb4Jd0OY4q3x-EdU' },
  { name: 'EvolveTogether',     id: '19EZE0wC_8SdK_ntNbjHz63Zdp4ml9Xf7BYJHtv7Fz9Q' },
  { name: 'Feals',              id: '1x70yNUkQS8lWvz-jRMlCC99fvROX-B7tDeuGG5PiwvM' },
  { name: 'Fur',                id: '1aYKRBpUFy2rZ7vpAmayfA_AnmW9c4tGKECFF-G1Kd6w' },
  { name: 'Harper Wilde',       id: '1Yyc85gXz45xoILd_EKprK87d2mpvCGx5wguSpt-Bs-M' },
  { name: 'Ilia',               id: '1xk0WiPIWnIyho4rhPJze_OuBFQSZS7XUAqR1XAM0jrg' },
  { name: 'Lenox and Sixteenth',id: '1mbK7-TgwBZ8jq46MxTw9wnN985h7pGr-ustMV9AiXlM' },
  { name: 'MadeGood',           id: '1HoHwoMgV1iGUBO6M3gD91DbwiK51_5TQKNxYNw7FZrs' },
  { name: 'Magic Molecule',     id: '1-hl6G1UYmovAkQLUY6toCaYabvG6Wd3uEWuVgIyNBfY' },
  { name: 'Magna',              id: '1eEgdXTQAjaWqyI-umL9G5c9K-gRpCL_a-V3aq-Mfa7U' },
  { name: 'Maev',               id: '1QSsL_AK8vaJsGhbgC1kXDUD0eOFRtAR-HuJJoRRNlQQ' },
  { name: 'Merit',              id: '1rs53MIeQW6er-xSCZeYtWQRSaG1-eB0d5ugJSJp9JT0' },
  { name: 'Momofuku',           id: '1Kk5ZgKu1RoHrLN0KcSai34RDlI0VmzxtgGKChiDOlv4' },
  { name: 'Nette',              id: '1dq07ZScfGpzQ2FwK292keRRgKXhetyQyzrt22o3Hd3k' },
  { name: 'Pattern',            id: '12QE7GRqXv_LZS7VjaD-jgCgzhMHATrMMVY8sH5ptSvk' },
  { name: 'Raazi',              id: '' },
  { name: 'Roz',                id: '1e2bZ925S7g13oqNxAkE1LMphBoXJRSZ8elPMKPGVh7M' },
  { name: 'Snif',               id: '1-Y5vwy3QlfjZMKbmT7sX7m4HH2Ji4By6ZNkk7t5oiEk' },
  { name: 'Squigs',             id: '1uuK0Sei2nHd1KD6tDAyGDKIwvV2guhUdcolmIHP2mbw' },
  { name: 'Stardust',           id: '' },
  { name: 'SYS',                id: '1T_PKGEkVaZoazmGotIXqcsI5FcPzKp7J43x87tw7Xck' },
  { name: 'Timebeam',           id: '1kfSRwoU0QSyblpYvdlSiwO_XUX7F2tL9omdcmT9IBzY' },
  { name: 'TodayTix',           id: '1en88S03oxxDk9fe37TfIs3Acmcj3j0vetE4NyWP2EHA' },
  { name: 'Tushy',              id: '15K-yi3aKwNd8YChBEEgIXAE89_30FR2mILLRcg_fEjE' },
];

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
