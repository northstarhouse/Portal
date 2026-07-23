// Generates a donor thank-you letter + envelope (.docx templates -> Google Drive)
// for a single donations row, and writes status/links back onto that row.
//
// POST body: { donationId: number, overrides?: { greeting, mailingName, signerName, signerTitle, letterDate } }
// GET  ?exportFileId=<driveFileId>&mime=application/pdf  -> proxies a Drive export (used by the
//      "Download as PDF" buttons, since the browser has no Drive credentials of its own)

import JSZip from "npm:jszip@3.10.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_SERVICE_ACCOUNT_KEY = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY")!;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sbHeaders = (extra?: Record<string, string>) => ({
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  ...extra,
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

// ---------- Supabase REST helpers ----------

async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
  if (!res.ok) throw new Error(`Supabase GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function sbPatch(path: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: sbHeaders({ Prefer: "return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${path} failed: ${res.status} ${await res.text()}`);
}

// ---------- Google service-account auth ----------

function base64url(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = "";
  for (const b of arr) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string) {
  const b64 = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getDriveAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.token;

  const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT_KEY);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };
  const encHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encClaims = base64url(new TextEncoder().encode(JSON.stringify(claims)));
  const signingInput = `${encHeader}.${encClaims}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

// ---------- Drive helpers ----------

async function driveFindOrCreateFolder(name: string, parentId: string, driveId: string, token: string) {
  const escaped = name.replace(/'/g, "\\'");
  const q = `name='${escaped}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`;
  const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&corpora=drive&driveId=${driveId}&includeItemsFromAllDrives=true&supportsAllDrives=true&fields=files(id,name)`;
  const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!listRes.ok) throw new Error(`Drive folder lookup failed: ${listRes.status} ${await listRes.text()}`);
  const found = await listRes.json();
  if (found.files && found.files.length > 0) return found.files[0].id as string;

  const createRes = await fetch("https://www.googleapis.com/drive/v3/files?supportsAllDrives=true", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder", parents: [parentId] }),
  });
  if (!createRes.ok) throw new Error(`Drive folder create failed: ${createRes.status} ${await createRes.text()}`);
  const created = await createRes.json();
  return created.id as string;
}

// Module-level cache: survives across warm invocations of the same function instance (helps
// back-to-back calls, e.g. batch generation), on top of the persisted root_folder_cache_id below
// (which survives cold starts too, since it's stored in the database).
const warmFolderCache = new Map<string, string>();

async function resolveDestinationFolder(settings: any, donorFolderName: string, letterDate: Date, token: string) {
  const driveId = settings.shared_drive_id;
  if (!driveId) throw new Error("No Shared Drive configured (acknowledgment_settings.shared_drive_id is empty)");
  const year = String(letterDate.getFullYear());
  const month = letterDate.toLocaleString("en-US", { month: "long" });
  const rootName = settings.root_folder_name || "North Star House";

  // The top two levels (org root, "Donor Acknowledgments") never change once created --
  // resolving them from scratch every single call was costing ~4 sequential Drive API round
  // trips (~4s) for zero benefit. Cache the resolved id persistently once found.
  let rootFolderId: string;
  const warmKey = `root:${driveId}:${rootName}`;
  if (settings.root_folder_cache_id) {
    rootFolderId = settings.root_folder_cache_id;
  } else if (warmFolderCache.has(warmKey)) {
    rootFolderId = warmFolderCache.get(warmKey)!;
  } else {
    const orgFolderId = await driveFindOrCreateFolder(rootName, driveId, driveId, token);
    rootFolderId = await driveFindOrCreateFolder("Donor Acknowledgments", orgFolderId, driveId, token);
    if (settings.id) {
      await sbPatch(`acknowledgment_settings?id=eq.${settings.id}`, { root_folder_cache_id: rootFolderId }).catch(() => {});
    }
  }
  warmFolderCache.set(warmKey, rootFolderId);

  let parentId = rootFolderId;
  const yearMonthDonor = [year, month, donorFolderName];
  for (const segment of yearMonthDonor) {
    parentId = await driveFindOrCreateFolder(segment, parentId, driveId, token);
  }
  const path = [rootName, "Donor Acknowledgments", ...yearMonthDonor];
  return { folderId: parentId, pathLabel: path.join(" / ") };
}

async function driveUploadDocx(filename: string, bytes: Uint8Array, folderId: string, token: string) {
  const metadata = {
    name: filename,
    parents: [folderId],
    mimeType: "application/vnd.google-apps.document",
  };
  const boundary = `nsh-${crypto.randomUUID()}`;
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [
    encoder.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`),
    encoder.encode(`--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n`),
    bytes,
    encoder.encode(`\r\n--${boundary}--`),
  ];
  const body = new Blob(parts);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  if (!res.ok) throw new Error(`Drive upload failed for ${filename}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ id: string; webViewLink: string }>;
}

async function driveDeleteFile(fileId: string, token: string) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

// ---------- Docx template merge ----------

const OPTIONAL_BLANK_TOKENS = new Set(["ADDRESS_LINE_2", "RECIPIENT_ADDRESS_LINE2", "RETURN_ADDRESS_LINE2"]);

function paragraphText(paragraphXml: string): string {
  const matches = [...paragraphXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)];
  return matches.map((m) => m[1]).join("");
}

function buildRunXml(rPrXml: string, text: string): string {
  const lines = text.split("\n");
  return lines
    .map((line, i) => {
      const t = `<w:t xml:space="preserve">${escapeXml(line)}</w:t>`;
      return i === 0 ? `<w:r>${rPrXml}${t}</w:r>` : `<w:r>${rPrXml}<w:br/>${t}</w:r>`;
    })
    .join("");
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Replace every {{Token}} paragraph-by-paragraph. Each paragraph's runs are collapsed into
// one run (losing any mid-paragraph bold/italic switches) so a token split across Word's
// auto-generated run boundaries still resolves correctly -- these templates don't use
// mid-paragraph formatting, so the tradeoff is safe here.
function fillDocumentXml(documentXml: string, variables: Record<string, string>): { xml: string; missing: string[] } {
  const missing: string[] = [];
  const filled = documentXml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraphXml) => {
    const text = paragraphText(paragraphXml);
    const tokenMatches = [...text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)];
    if (tokenMatches.length === 0) return paragraphXml;

    // whole-paragraph optional blank line (e.g. a lone {{ADDRESS_LINE_2}})
    if (tokenMatches.length === 1 && text.trim() === `{{${tokenMatches[0][1].trim()}}}` && OPTIONAL_BLANK_TOKENS.has(tokenMatches[0][1].trim())) {
      const value = variables[tokenMatches[0][1].trim()] ?? "";
      if (!value.trim()) return "";
    }

    let replaced = text;
    for (const [, rawToken] of tokenMatches) {
      const token = rawToken.trim();
      if (!(token in variables)) {
        missing.push(token);
        continue;
      }
      replaced = replaced.split(`{{${rawToken}}}`).join(variables[token]);
    }
    if (missing.length) return paragraphXml;

    const pPrMatch = paragraphXml.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch ? pPrMatch[0] : "";
    const rPrMatch = pPr.match(/<w:rPr>[\s\S]*?<\/w:rPr>/);
    const rPr = rPrMatch ? rPrMatch[0] : "";
    return `<w:p>${pPr}${buildRunXml(rPr, replaced)}</w:p>`;
  });
  return { xml: filled, missing: [...new Set(missing)] };
}

async function mergeDocxTemplate(templateBytes: Uint8Array, variables: Record<string, string>) {
  const zip = await JSZip.loadAsync(templateBytes);
  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) throw new Error("Template is not a valid .docx (missing word/document.xml)");
  const documentXml = await docXmlFile.async("string");

  const { xml, missing } = fillDocumentXml(documentXml, variables);
  if (missing.length) {
    throw new Error(`Template variable(s) could not be filled: ${missing.join(", ")}`);
  }

  zip.file("word/document.xml", xml);
  const outBytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { bytes: outBytes };
}

// ---------- Donor name / greeting / address logic ----------

function lastNameOf(fullName: string) {
  const parts = (fullName || "").trim().split(/\s+/);
  return parts[parts.length - 1] || "";
}

function resolveDonorNameAndGreeting(donor: any) {
  const isOrg = ["Organization", "Corporate", "Foundation"].includes(donor.account_type);
  let donorName: string;
  let defaultGreeting: string;

  if (isOrg) {
    donorName = donor.formal_name;
    defaultGreeting = `Friends at ${donor.formal_name}`;
  } else if (donor.joint_donor_name) {
    const last = lastNameOf(donor.formal_name);
    const first = donor.informal_first_name || donor.formal_name.replace(new RegExp(`\\s*${last}$`), "");
    donorName = `${first} and ${donor.joint_donor_name} ${last}`.replace(/\s+/g, " ").trim();
    defaultGreeting = `${first} and ${donor.joint_donor_name}`;
  } else {
    donorName = donor.formal_name;
    defaultGreeting = donor.informal_first_name || donor.formal_name;
  }

  const greeting = donor.preferred_letter_greeting || defaultGreeting;
  return { donorName, greeting };
}

function addressLines(donor: any) {
  if (donor.mailing_address_line1 && donor.mailing_city && donor.mailing_state && donor.mailing_zip) {
    return {
      line1: donor.mailing_address_line1,
      line2: donor.mailing_address_line2 || "",
      city: donor.mailing_city,
      state: donor.mailing_state,
      zip: donor.mailing_zip,
      complete: true,
    };
  }
  return { line1: donor.address || "", line2: "", city: "", state: "", zip: "", complete: false };
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatAmount(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}

const ACK_TYPE_TOKEN_MAP: Record<string, string> = {
  "General Donation": "Restricted Purpose / Project",
  "Memorial Donation": "Name of Honoree",
  "Honorary Donation": "Name of Honoree",
  "In-Kind Donation": "Description of Donated Goods/Services",
};

function buildVariableMap(donation: any, donor: any, settings: any, overrides: any) {
  const { donorName, greeting: defaultGreeting } = resolveDonorNameAndGreeting(donor);
  const greeting = overrides?.greeting || defaultGreeting;
  const mailingName = overrides?.mailingName || donorName;
  const addr = addressLines(donor);
  const letterDate = overrides?.letterDate ? new Date(overrides.letterDate) : new Date();
  const contribDate = donation.date ? new Date(donation.date) : letterDate;
  const signerName = overrides?.signerName || donation.signer_name || settings?.default_signer_name || "Ken Underwood";
  const signerTitle = overrides?.signerTitle || donation.signer_title || settings?.default_signer_title || "President";

  const addressBlock = [addr.line1, addr.line2, [addr.city, addr.state, addr.zip].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join("\n");

  const vars: Record<string, string> = {
    DonorName: mailingName,
    Address: addressBlock,
    Name: greeting,
    Amount: formatAmount(donation.amount),
    Date: formatDate(contribDate),
    "Restricted Purpose / Project": donation.event_name || donation.donation_notes || "",
    "Name of Honoree": donation.honoree_name || donation.memorial_recipient || "",
    "Description of Donated Goods/Services": donation.in_kind_description || "",
    "Estimated Value": donation.in_kind_value != null ? formatAmount(donation.in_kind_value) : "",

    LETTER_DATE: formatDate(letterDate),
    DONOR_NAME: mailingName,
    GREETING: greeting,
    ADDRESS_LINE_1: addr.line1,
    ADDRESS_LINE_2: addr.line2,
    CITY: addr.city,
    STATE: addr.state,
    ZIP: addr.zip,
    CONTRIBUTION_DATE: formatDate(contribDate),
    CONTRIBUTION_AMOUNT: formatAmount(donation.amount),
    CONTRIBUTION_TYPE: donation.acknowledgment_type || donation.type || "",
    MEMBERSHIP_LEVEL: donation.membership_level || "",
    MEMBERSHIP_START_DATE: donation.membership_start_date ? formatDate(new Date(donation.membership_start_date)) : "",
    MEMBERSHIP_EXPIRATION_DATE: donation.membership_expiration_date ? formatDate(new Date(donation.membership_expiration_date)) : "",
    EVENT_NAME: donation.event_name || "",
    SPONSORSHIP_LEVEL: donation.sponsorship_level || "",
    BRICK_INSCRIPTION: donation.brick_inscription || "",
    MEMORIAL_NAME: donation.memorial_recipient || "",
    HONOREE_NAME: donation.honoree_name || "",
    IN_KIND_DESCRIPTION: donation.in_kind_description || "",
    TAX_DEDUCTIBLE_AMOUNT: donation.tax_deductible_amount != null ? formatAmount(donation.tax_deductible_amount) : "",
    GOODS_SERVICES_VALUE: donation.goods_services_value != null ? formatAmount(donation.goods_services_value) : "",
    SIGNER_NAME: signerName,
    SIGNER_TITLE: signerTitle,

    RETURN_ADDRESS_LINE1: settings?.org_legal_name || "North Star House",
    RETURN_ADDRESS_LINE2: settings?.return_address_line1 || "",
    RETURN_ADDRESS_CITY_STATE_ZIP: [settings?.return_address_city, settings?.return_address_state, settings?.return_address_zip]
      .filter(Boolean)
      .join(", "),
    RECIPIENT_NAME: mailingName,
    RECIPIENT_ADDRESS_LINE1: addr.line1,
    RECIPIENT_ADDRESS_LINE2: addr.line2,
    RECIPIENT_CITY_STATE_ZIP: [addr.city, addr.state, addr.zip].filter(Boolean).join(", "),
  };

  return { vars, donorName, greeting, mailingName, addressComplete: addr.complete, letterDate };
}

// ---------- Main generation flow ----------

async function generate(donationId: number, overrides: any) {
  try {
    return await generateInner(donationId, overrides);
  } catch (err: any) {
    await sbPatch(`donations?id=eq.${donationId}`, {
      acknowledgment_status: "error",
      generation_error: err.message || String(err),
    }).catch(() => {});
    throw err;
  }
}

async function generateInner(donationId: number, overrides: any) {
  const [donationRows, settingsRows] = await Promise.all([
    sbGet(`donations?id=eq.${donationId}&select=*`),
    sbGet(`acknowledgment_settings?select=*&limit=1`),
  ]);
  const donation = donationRows[0];
  if (!donation) throw new Error(`Donation ${donationId} not found`);
  const settings = settingsRows[0] || {};

  const donorRows = await sbGet(`donors?id=eq.${donation.donor_id}&select=*`);
  const donor = donorRows[0];
  if (!donor) throw new Error(`Donor ${donation.donor_id} not found for donation ${donationId}`);

  if (!donation.acknowledgment_type) throw new Error("Acknowledgment Type is required before generating documents");
  if (donation.amount == null && !donation.in_kind_description) {
    throw new Error("A contribution amount or in-kind description is required");
  }

  const templateRows = await sbGet(`acknowledgment_templates?acknowledgment_type=eq.${encodeURIComponent(donation.acknowledgment_type)}&select=*`);
  const template = templateRows[0];
  if (!template || !template.active || !template.letter_storage_path) {
    throw new Error(`No active letter template configured for "${donation.acknowledgment_type}"`);
  }

  const { vars, donorName, addressComplete, letterDate } = buildVariableMap(donation, donor, settings, overrides);

  const [letterTemplateBytes, envelopeTemplateBytes] = await Promise.all([
    fetchStorageFile(template.letter_storage_path),
    template.envelope_storage_path ? fetchStorageFile(template.envelope_storage_path) : Promise.resolve(null),
  ]);

  const letterMerge = await mergeDocxTemplate(letterTemplateBytes, vars);

  let envelopeMerge: { bytes: Uint8Array } | null = null;
  if (envelopeTemplateBytes) {
    if (!addressComplete) {
      throw new Error(
        "This donor does not have a complete mailing address. Add an address or choose to generate the letter without an envelope.",
      );
    }
    envelopeMerge = await mergeDocxTemplate(envelopeTemplateBytes, vars);
  }

  const token = await getDriveAccessToken();
  const donorFolderName = donorName.trim().replace(/\s+/g, " ").replace(/[\\/:*?"<>|]/g, "-");
  const { folderId, pathLabel } = await resolveDestinationFolder(settings, donorFolderName, letterDate, token);

  const dateStamp = letterDate.toISOString().slice(0, 10);
  const docLabel = `${donation.acknowledgment_type} Letter`;
  const letterName = `${dateStamp} - ${donorName} - ${docLabel}`;
  const envelopeName = `${dateStamp} - ${donorName} - Envelope`;

  let letterFile: { id: string; webViewLink: string } | null = null;
  try {
    letterFile = await driveUploadDocx(letterName, letterMerge.bytes, folderId, token);
    let envelopeFile: { id: string; webViewLink: string } | null = null;
    if (envelopeMerge) {
      envelopeFile = await driveUploadDocx(envelopeName, envelopeMerge.bytes, folderId, token);
    }

    await sbPatch(`donations?id=eq.${donationId}`, {
      acknowledgment_status: "generated",
      letter_drive_url: letterFile.webViewLink,
      letter_drive_file_id: letterFile.id,
      envelope_drive_url: envelopeFile?.webViewLink || null,
      envelope_drive_file_id: envelopeFile?.id || null,
      template_used: template.template_name,
      document_version: (donation.document_version || 0) + 1,
      date_generated: new Date().toISOString(),
      generated_by: overrides?.generatedBy || null,
      generation_error: null,
    });

    return {
      letterName,
      envelopeName: envelopeFile ? envelopeName : null,
      letterUrl: letterFile.webViewLink,
      envelopeUrl: envelopeFile?.webViewLink || null,
      letterFileId: letterFile.id,
      envelopeFileId: envelopeFile?.id || null,
      folderPath: pathLabel,
    };
  } catch (err) {
    if (letterFile) await driveDeleteFile(letterFile.id, token);
    throw err;
  }
}

async function fetchStorageFile(path: string): Promise<Uint8Array> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/acknowledgment-templates/${path}`, {
    headers: sbHeaders(),
  });
  if (!res.ok) throw new Error(`Could not load template "${path}": ${res.status} ${await res.text()}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function exportFile(fileId: string, mime: string) {
  const token = await getDriveAccessToken();
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(mime)}&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Drive export failed: ${res.status} ${await res.text()}`);
  return res;
}

// ---------- HTTP entrypoint ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  try {
    const url = new URL(req.url);

    if (req.method === "GET" && url.searchParams.get("selfTestMerge")) {
      const templatePath = url.searchParams.get("selfTestMerge") || "membership.docx";
      const started = Date.now();
      const bytes = await fetchStorageFile(templatePath);
      const fetchMs = Date.now() - started;

      const dummyVars: Record<string, string> = {
        DonorName: "Jane Test Donor", Address: "123 Main St\nGrass Valley, CA 95945",
        Name: "Jane", Amount: "$100.00", Date: "July 23, 2026",
        "Restricted Purpose / Project": "Test Project", "Name of Honoree": "Test Honoree",
        "Description of Donated Goods/Services": "Test Goods", "Estimated Value": "$50.00",
        RETURN_ADDRESS_LINE1: "North Star Historic Conservancy", RETURN_ADDRESS_LINE2: "PO Box 1538",
        RETURN_ADDRESS_CITY_STATE_ZIP: "Grass Valley, CA 95945",
        RECIPIENT_NAME: "Jane Test Donor", RECIPIENT_ADDRESS_LINE1: "123 Main St", RECIPIENT_ADDRESS_LINE2: "",
        RECIPIENT_CITY_STATE_ZIP: "Grass Valley, CA 95945",
      };
      try {
        const { bytes: mergedBytes } = await mergeDocxTemplate(bytes, dummyVars);
        return json({
          success: true,
          templatePath,
          fetchedBytes: bytes.length,
          fetchMs,
          mergedBytes: mergedBytes.length,
          totalMs: Date.now() - started,
        });
      } catch (mergeErr: any) {
        return json({
          success: false,
          step: "merge",
          templatePath,
          fetchedBytes: bytes.length,
          fetchMs,
          error: mergeErr.message || String(mergeErr),
        });
      }
    }

    if (req.method === "GET" && url.searchParams.get("selfTestFull")) {
      const started = Date.now();
      const timings: Record<string, number> = {};
      let mark = started;
      const lap = (label: string) => { const now = Date.now(); timings[label] = now - mark; mark = now; };

      const settingsRows = await sbGet(`acknowledgment_settings?select=*&limit=1`);
      const settings = settingsRows[0] || {};
      lap("fetchSettings");

      const templateBytes = await fetchStorageFile("membership.docx");
      lap("fetchTemplate");

      const dummyVars: Record<string, string> = {
        DonorName: "ZZZ SelfTest Donor (delete me)", Address: "123 Main St\nGrass Valley, CA 95945",
        Name: "Test", Amount: "$1.00", Date: "July 23, 2026",
      };
      const merged = await mergeDocxTemplate(templateBytes, dummyVars);
      lap("merge");

      const token = await getDriveAccessToken();
      lap("driveToken");

      const { folderId, pathLabel } = await resolveDestinationFolder(settings, "ZZZ SelfTest Donor (delete me)", new Date(), token);
      lap("resolveFolder");

      const uploaded = await driveUploadDocx("selfTestFull-" + Date.now() + ".docx", merged.bytes, folderId, token);
      lap("upload");

      await driveDeleteFile(uploaded.id, token);
      lap("cleanupDelete");

      return json({ success: true, pathLabel, totalMs: Date.now() - started, timings });
    }

    if (req.method === "GET" && url.searchParams.get("selfTestDrive")) {
      const started = Date.now();
      const token = await getDriveAccessToken();
      const tokenMs = Date.now() - started;

      const drivesRes = await fetch(
        `https://www.googleapis.com/drive/v3/drives?pageSize=25&fields=drives(id,name)`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const visibleDrives = await drivesRes.json();

      const settingsRows = await sbGet(`acknowledgment_settings?select=shared_drive_id&limit=1`);
      const driveId = settingsRows[0]?.shared_drive_id;

      const about = await fetch(`https://www.googleapis.com/drive/v3/about?fields=user`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json());

      return json({
        success: true,
        tokenAcquiredMs: tokenMs,
        serviceAccountIdentity: about?.user || null,
        configuredSharedDriveId: driveId,
        drivesVisibleToServiceAccount: visibleDrives,
      });
    }

    if (req.method === "GET" && url.searchParams.get("exportFileId")) {
      const fileId = url.searchParams.get("exportFileId")!;
      const mime = url.searchParams.get("mime") || "application/pdf";
      const driveRes = await exportFile(fileId, mime);
      return new Response(driveRes.body, {
        headers: { "Content-Type": mime, ...CORS_HEADERS },
      });
    }

    if (req.method !== "POST") return json({ error: "Unsupported method" }, 405);

    const body = await req.json();
    if (!body.donationId) return json({ error: "donationId is required" }, 400);

    const result = await generate(body.donationId, body.overrides || {});
    return json({ success: true, ...result });
  } catch (err: any) {
    return json({ success: false, error: err.message || String(err) }, 500);
  }
});
