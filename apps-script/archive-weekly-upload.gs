/**
 * Agency 8 — Weekly Archive Auto-Upload
 *
 * Every Friday, reads each client's "Archive Auto Upload Form" tab (columns:
 * Account Type | Username | Labels) from their master-list spreadsheet and
 * imports every row into that client's own Archive workspace via Archive's
 * importCreators API — same thing a human currently does by hand, just run
 * automatically. Re-uploads the whole tab every time (not just new rows) —
 * safe because Archive's import/label-assign is idempotent: a creator or
 * label that already exists is a no-op, never a duplicate.
 *
 * Intentionally skipped tabs: "Pre-Archive Auto Form" (a staging/review tab,
 * left for a human) and Tilt Beauty's "SM Archive Auto Upload Form" (a
 * second account, not currently in scope — per Emmett, 2026-11-19).
 *
 * ── One-time setup ──────────────────────────────────────────────────────
 * 1. While logged into the Google account that has edit/view access to
 *    every sheet in CLIENT_SHEETS below, go to script.google.com -> New
 *    project. Paste this whole file in, replacing the default Code.gs.
 * 2. Project Settings (gear icon) -> set the project's time zone to
 *    America/New_York. This is what makes "every Friday at 9am" actually
 *    mean 9am Eastern year-round, including across Daylight Saving changes
 *    — a plain UTC cron schedule would silently drift by an hour twice a
 *    year, which a Google-side time-based trigger does not.
 * 3. Project Settings -> Script Properties -> add one property:
 *    ARCHIVE_API_TOKEN = <the same token already used by the Paid System's
 *    ARCHIVE_APP_TOKEN env var on Render — reuse it, don't regenerate it;
 *    regenerating invalidates it everywhere else it's already in use>.
 * 4. Run `setup` once from the editor's function dropdown + Run button.
 *    Authorize when prompted (Review Permissions -> Allow) — this is what
 *    installs the recurring Friday 9am trigger.
 * 5. Done. `weeklyUpload` now runs automatically every Friday at 9am
 *    America/New_York. Check Executions (clock-with-history icon) after
 *    the first Friday to confirm it ran clean.
 *
 * To run it immediately instead of waiting for Friday (e.g. to test), just
 * select `weeklyUpload` in the function dropdown and click Run.
 *
 * To stop it: Triggers (clock icon) -> delete the trigger.
 */

// ── Config ───────────────────────────────────────────────────────────────
const ARCHIVE_URL = "https://app.archive.com/api/v2";
const UPLOAD_TAB_NAME = "Archive Auto Upload Form";

// provider strings as they appear in the "Account Type" column -> Archive's enum
const PROVIDER_MAP = {
  "instagram": "INSTAGRAM",
  "tiktok": "TIKTOK",
  "youtube": "YOUTUBE",
};

// Client display name -> master-list spreadsheet id. The display name only
// needs to be close enough to the real Archive workspace name to match via
// normalizeName_ below (exact match not required) — see resolveWorkspaces_.
const CLIENT_SHEETS = [
  {name: "Biossance", sheetId: "131C23f9pQ6CykkGRsCIBqZfsjGYXUdORCydkdvd634k"},
  {name: "BORNTOSTANDOUT", sheetId: "1nsRCoRK9hdbH50rMD9zqp-GGwTpPyEAFWT69_pjVEbg"},
  {name: "Brodo", sheetId: "13PXK5rMfw2S53AZLU57MhwEfv1TWwQS0LYIE7xZHOx0"},
  {name: "Clare V.", sheetId: "12t1s81q3vOy_yFdIM-169dKXo_jL_HRr4rovqIVuBUk"},
  {name: "Counter", sheetId: "1gVSv9Nz4Aucnd_8kd8YkW0AsiIEHpjtYgMRp7R3yOqY"},
  {name: "Dr. Diamond's Metacine", sheetId: "1mAFMTWf7BzeXGAHoUU_cALe78BHjErwjXttZ_6moa4c"},
  {name: "Dr. Squatch", sheetId: "1hmz1j7FDgkkmBx7qklTIkeNhZ64bFxIzeLyZ4BJAMu4"},
  {name: "EvolveTogether", sheetId: "19EZE0wC_8SdK_ntNbjHz63Zdp4ml9Xf7BYJHtv7Fz9Q"},
  {name: "EvolveTogether Paid", sheetId: "1wjpKQpMoyVfGErkCNP4wecNa1yd9dClszJyIUeTX-Tw"},
  {name: "Feals", sheetId: "1x7OyNUkQS8lWvz-jRMlCC99fvROX-B7tDeuGG5PiwvM"},
  {name: "Fur", sheetId: "1aYKRBpUFy2rZ7vpAmayfA_AnmW9c4tGKECFF-G1Kd6w"},
  {name: "Gimme Seaweed", sheetId: "1zEhl-fgugMz97Dm1Q-0amnxxqoWGlkg8uiBxdCB0vU0"},
  {name: "Harper Wilde", sheetId: "1Yyc85gXz45xoILd_EKprK87d2mpvCGx5wguSpt-Bs-M"},
  {name: "Ilia", sheetId: "1xkOWiPIWnIyho4rhPJze_OuBFQSZS7XUAqR1XAM0jrg"},
  {name: "MadeGood", sheetId: "1HoHwoMgV1iGUBO6M3gD91DbwiK51_5TQKNxYNw7FZrs"},
  {name: "Magic Molecule", sheetId: "1-hl6G1UYmovAkQLUY6toCaYabvG6Wd3uEWuVgIyNBfY"},
  {name: "Magna", sheetId: "1Id9_j-5yVGMBQXlaQvNcIGEA1PRRMw1V_E4eq8RDYIc"},
  {name: "Maev", sheetId: "1QSsL_AK8vaJsGhbgC1kXDUD0eOFRtAR-HuJJoRRNlQQ"},
  {name: "Merit", sheetId: "1e75T4ZUvG-WBfm-IzCTHUlxT3yfiBx4JMAwBXekTKz4"},
  {name: "Murad", sheetId: "1lHSQmip5amibXU3me3UW8MCZTwletlzndX-CeOYqT5M"},
  {name: "Personal Day", sheetId: "1luLrAJtMGe0oCRmc-aqmyvF24Osx5gdDCodNDxP8fRo"},
  {name: "Raazi Tea", sheetId: "1DcybNwr-F6uJMa0xfo29cMBJPNa7-lkMl8YFMP0Sbg0"},
  {name: "Reale Actives", sheetId: "1dmOV65MU9SM-Otq1lNgk1koIVsk-3jDQfmLGcVN1Hhc"},
  {name: "Roz", sheetId: "1e2bZ925S7g13oqNxAkE1LMphBoXJRSZ8elPMKPGVh7M"},
  {name: "Snif", sheetId: "1-Y5vwy3QlfjZMKbmT7sX7m4HH2Ji4By6ZNkk7t5oiEk"},
  {name: "Squigs", sheetId: "1uuKOSei2nHd1KD6tDAyGDKIwvV2guhUdcolmIHP2mbw"},
  {name: "Stars + Honey", sheetId: "1nZUCDXuNPmy_s2H9KisgJPA9gZ_OQsMtY_5q0rsKDRE"},
  {name: "Stardust (Working)", sheetId: "1Qz6ynzsQX-hf_0s5qxoq_jsztri1uhA25V-qO-c202k"},
  {name: "Stocked", sheetId: "1rnXcLlL_HKvS7IVA2Bzza2oqhIG6KPAOAUjMzg5xaVE"},
  {name: "SYS", sheetId: "1T_PKGEkVaZoazmGotIXqcsI5FcPzKp7J43x87tw7Xck"},
  {name: "Tein", sheetId: "1Enujzezf-kIKSgF9Xkded96yz5txr49gGk7ooMji8t0"},
  {name: "The Absorption Company Master List", sheetId: "1xcVQ2SvbyenVLZnuQcJQBzDGD4xWDpM1kwhPWXw2s7w"},
  {name: "Tilt Beauty", sheetId: "1PyowbTWyAZ_k86bGBtexotoExcqWmUQgYJloTSUZBC0"},
  {name: "Timebeam", sheetId: "1kfSRwoUOQSyblpYvdlSiwO_XUX7F2tL9omdcmT9IBzY"},
  {name: "Tushy", sheetId: "15K-yi3aKwNd8YChBEEgIXAE89_30FR2mILLRcg_fEjE"},
  {name: "U Beauty", sheetId: "1Clh5lceTRC0bFvUD-o8WPOixanCc6nWxM0xX-HqOzv4"},
];

function setup() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "weeklyUpload") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("weeklyUpload")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.FRIDAY)
    .atHour(9)
    .create();
  Logger.log("Setup complete — weeklyUpload will now run every Friday at 9am (project time zone).");
}

/**
 * The recurring job. Resolves every client's Archive workspace once, then
 * uploads each client's sheet independently — one client failing (a
 * missing tab, a bad row, an API hiccup) never blocks the rest.
 */
function weeklyUpload() {
  const apiKey = PropertiesService.getScriptProperties().getProperty("ARCHIVE_API_TOKEN");
  if (!apiKey) {
    Logger.log("ARCHIVE_API_TOKEN isn't set in Script Properties — see setup instructions at the top of this file.");
    return;
  }

  const workspaces = fetchAllWorkspaces_(apiKey);

  CLIENT_SHEETS.forEach(client => {
    try {
      const workspaceId = resolveWorkspaceId_(client.name, workspaces);
      if (!workspaceId) {
        Logger.log(`SKIP ${client.name}: no matching Archive workspace found.`);
        return;
      }

      const rows = readUploadRows_(client.sheetId);
      if (rows === null) {
        Logger.log(`SKIP ${client.name}: no "${UPLOAD_TAB_NAME}" tab found.`);
        return;
      }
      if (rows.length === 0) {
        Logger.log(`${client.name}: tab is empty, nothing to upload.`);
        return;
      }

      const creators = rows.map(rowToCreator_).filter(c => c !== null);
      let totalAccepted = 0;
      let totalSkipped = 0;
      for (let i = 0; i < creators.length; i += 250) {
        const batch = creators.slice(i, i + 250);
        const result = importCreatorsBatch_(apiKey, workspaceId, batch);
        totalAccepted += result.acceptedCount || 0;
        totalSkipped += (result.skipped || []).length;
        if ((result.userErrors || []).length) {
          Logger.log(`${client.name}: userErrors ${JSON.stringify(result.userErrors)}`);
        }
      }
      Logger.log(`${client.name} -> workspace ${workspaceId}: ${totalAccepted} accepted, ${totalSkipped} skipped (of ${creators.length} rows).`);
    } catch (err) {
      Logger.log(`ERROR ${client.name}: ${err}`);
    }
  });
}

/** Reads Account Type / Username / Labels from the upload tab. Returns null if the tab doesn't exist. */
function readUploadRows_(sheetId) {
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName(UPLOAD_TAB_NAME);
  if (!sheet) return null;

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  return values.slice(1).filter(r => (r[1] || "").toString().trim() !== "");
}

/** One sheet row -> one CreatorImportInput, or null if the Account Type isn't recognized. */
function rowToCreator_(row) {
  const provider = PROVIDER_MAP[(row[0] || "").toString().trim().toLowerCase()];
  const handle = (row[1] || "").toString().trim();
  if (!provider || !handle) return null;

  const labels = (row[2] || "")
    .toString()
    .split(",")
    .map(s => s.trim())
    .filter(s => s !== "");

  const creator = {handles: [{provider, handle}]};
  if (labels.length) creator.labels = labels;
  return creator;
}

function importCreatorsBatch_(apiKey, workspaceId, creators) {
  const query = `
    mutation ImportCreatorsDefault($creators: [CreatorImportInput!]!, $operationId: ID) {
      importCreators(creators: $creators, operationId: $operationId) {
        operationId
        acceptedCount
        skipped { index provider handle reason }
        userErrors { field message }
      }
    }`;
  const data = archiveRequest_(apiKey, query, {creators, operationId: Utilities.getUuid()}, workspaceId);
  return data.importCreators;
}

/** Pages through every workspace the token can see. Returns [{id, name}]. */
function fetchAllWorkspaces_(apiKey) {
  const query = `
    query WorkspacesDefault($first: Int, $after: String) {
      workspaces(first: $first, after: $after) {
        edges { node { id name } }
        pageInfo { hasNextPage endCursor }
      }
    }`;
  let after = null;
  const all = [];
  while (true) {
    const data = archiveRequest_(apiKey, query, {first: 100, after});
    const page = data.workspaces;
    page.edges.forEach(e => all.push(e.node));
    if (!page.pageInfo.hasNextPage) break;
    after = page.pageInfo.endCursor;
  }
  return all;
}

/** Fuzzy-matches a client name against the fetched workspace list (containment, case/punctuation-insensitive). */
function resolveWorkspaceId_(clientName, workspaces) {
  const key = normalizeName_(clientName);
  const hit = workspaces.find(w => {
    const wkey = normalizeName_(w.name);
    return key === wkey || wkey.indexOf(key) !== -1 || key.indexOf(wkey) !== -1;
  });
  return hit ? hit.id : null;
}

function normalizeName_(s) {
  return s
    .toLowerCase()
    .replace(/\b(a8|master list|\(working\)|\(horoscope\)|paid|internal)\b/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function archiveRequest_(apiKey, query, variables, workspaceId) {
  const headers = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (workspaceId) headers["WORKSPACE-ID"] = workspaceId;

  const res = UrlFetchApp.fetch(ARCHIVE_URL, {
    method: "post",
    contentType: "application/json",
    headers,
    payload: JSON.stringify({query, variables}),
    muteHttpExceptions: true,
  });

  const body = JSON.parse(res.getContentText());
  if (body.errors) {
    throw new Error(`Archive GraphQL error: ${JSON.stringify(body.errors)}`);
  }
  return body.data;
}
