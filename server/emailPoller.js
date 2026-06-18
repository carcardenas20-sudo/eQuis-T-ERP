import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { query } from './db.js';
import { ENTITY_SCHEMAS, splitRecord } from './entitySchemas.js';
import { v4 as uuidv4 } from 'uuid';

const SCHEMA = ENTITY_SCHEMAS.TransferenciaDetectada;

function parseMontoCOP(str) {
  if (!str) return null;
  let s = str.replace(/[$\s]/g, '').trim();
  if (!s || !/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastDot >= 0) {
    const segs = s.split('.');
    if (segs.slice(1).every(p => p.length === 3)) {
      s = s.replace(/\./g, '');
    }
  } else if (lastComma >= 0) {
    const segs = s.split(',');
    if (segs.length === 2 && segs[1].length <= 2) {
      s = s.replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  }

  const n = parseFloat(s);
  return isNaN(n) || n <= 0 ? null : n;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/g, 'á').replace(/&Aacute;/g, 'Á')
    .replace(/&eacute;/g, 'é').replace(/&Eacute;/g, 'É')
    .replace(/&iacute;/g, 'í').replace(/&Iacute;/g, 'Í')
    .replace(/&oacute;/g, 'ó').replace(/&Oacute;/g, 'Ó')
    .replace(/&uacute;/g, 'ú').replace(/&Uacute;/g, 'Ú')
    .replace(/&ntilde;/g, 'ñ').replace(/&Ntilde;/g, 'Ñ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
}

const BANK_RULES = [
  {
    banco: 'bancolombia',
    fromPattern: /bancolombia/i,
    requireText: /recibiste/i,
    parse(text) {
      const m = text.match(/por\s*\$\s*([\d.,]+)/i);
      if (!m) return null;
      const monto = parseMontoCOP(m[1]);
      if (!monto) return null;
      const remitente =
        text.match(/recibiste un pago de\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)\s+por/i)?.[1]?.trim()
        || text.match(/desde el corresponsal\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s\-]+?)\s+en\s/i)?.[1]?.trim()
        || null;
      const referencia = text.match(/llave\s+(\d{6,})/i)?.[1] || null;
      return { monto, remitente, referencia };
    },
  },
  {
    banco: 'bbva',
    fromPattern: /bbva/i,
    requireSubject: /Tu dinero ya est[aá] disponible/i,
    requireText: /Valor recibido/i,
    parse(text) {
      const m = text.match(/Valor recibido\s*\$\s*([\d.,]+)/i);
      if (!m) return null;
      const monto = parseMontoCOP(m[1]);
      if (!monto) return null;
      const remitente =
        text.match(/Persona que env[íi]a\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?:\s{2,}|Tipo de llave|$)/i)?.[1]?.trim()
        || null;
      const referencia = text.match(/C[oó]digo de operaci[oó]n\s*(\d{10,})/i)?.[1] || null;
      return { monto, remitente, referencia };
    },
  },
];

async function saveTransferencia(data) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const { typedValues, dataRest } = splitRecord(SCHEMA, data);
  const typedCols = Object.keys(SCHEMA.typed);
  const colNames = ['id', ...typedCols, 'data', 'created_date', 'updated_date'];
  const colValues = [id, ...typedCols.map(c => typedValues[c] ?? null), JSON.stringify(dataRest), now, now];
  const placeholders = colValues.map((_, i) => `$${i + 1}`).join(', ');
  await query(
    `INSERT INTO ${SCHEMA.table} (${colNames.join(', ')}) VALUES (${placeholders})`,
    colValues
  );
  console.log(`[emailPoller] Guardada: ${data.banco} $${data.monto} de "${data.remitente || '?'}"`);
}

// Procesa una lista de UIDs en el mailbox abierto.
// useSeenFilter=true marca como leído después de procesar (polling normal).
// useSeenFilter=false no marca (backfill — deja el estado de Gmail intacto).
async function processUids(client, uids) {
  for (const uid of uids) {
    try {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      if (!msg?.source) continue;

      const parsed = await simpleParser(msg.source);
      const from = parsed.from?.value?.[0]?.address || '';
      const subject = parsed.subject || '';
      const messageId = parsed.messageId || `fallback-${uid}`;

      console.log(`[emailPoller] uid=${uid} from="${from}" subject="${subject}"`);

      const rule = BANK_RULES.find(r => r.fromPattern.test(from) || r.fromPattern.test(subject));
      if (!rule) { console.log(`[emailPoller]   → sin regla`); continue; }

      if (rule.requireSubject && !rule.requireSubject.test(subject)) {
        console.log(`[emailPoller]   → subject no coincide`); continue;
      }

      let text = parsed.text ||
        (parsed.html || '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                           .replace(/<[^>]+>/g, ' ')
                           .replace(/\s+/g, ' ');
      text = decodeHtmlEntities(text);

      if (rule.requireText && !rule.requireText.test(text)) {
        console.log(`[emailPoller]   → requireText no coincide`); continue;
      }
      if (!/\$\s*[\d.,]+/.test(text)) {
        console.log(`[emailPoller]   → sin monto`); continue;
      }

      const dup = await query(
        `SELECT id FROM ${SCHEMA.table} WHERE email_uid = $1 LIMIT 1`,
        [messageId]
      );
      if (dup.rows.length > 0) { console.log(`[emailPoller]   → duplicado`); continue; }

      const result = rule.parse(text, subject);
      await saveTransferencia({
        banco: rule.banco,
        monto: result?.monto ?? null,
        remitente: result?.remitente ?? null,
        referencia: result?.referencia ?? null,
        fecha_pago: parsed.date?.toISOString() ?? new Date().toISOString(),
        estado: 'sin_asignar',
        email_uid: messageId,
        email_subject: subject,
        email_from: from,
        email_texto: text.slice(0, 2000),
      });

      if (!result) console.log(`[emailPoller] Sin parsear — "${subject}" | ${text.slice(0, 150)}`);

    } catch (e) {
      console.error(`[emailPoller] Error uid ${uid}:`, e.message);
    }
  }
}

const MAX_EMAILS_PER_RUN = 30;

// Conexión IMAP persistente — se crea una vez y se reutiliza en todos los ciclos.
// Gmail tolera bien conexiones largas; lo que no tolera es abrir/cerrar cada 30s.
let imapClient = null;

async function getClient(user, pass) {
  if (imapClient?.usable) return imapClient;

  if (imapClient) { try { imapClient.close(); } catch {} imapClient = null; }

  const client = new ImapFlow({
    host: 'imap.gmail.com', port: 993, secure: true,
    auth: { user, pass }, logger: false,
  });
  client.on('error', err => {
    console.error('[emailPoller] IMAP error:', err.message);
    imapClient = null;
  });
  client.on('close', () => { imapClient = null; });

  await client.connect();
  imapClient = client;
  console.log('[emailPoller] IMAP conectado');
  return client;
}

async function runPoll({ days }) {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  if (!user || !pass) return;

  try {
    const client = await getClient(user, pass);
    const lock = await client.getMailboxLock('INBOX');
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const uidsV = await client.search({ since, from: 'bbva' }, { uid: true });
      const uidsB = await client.search({ since, from: 'bancolombia' }, { uid: true });
      const allUids = [...new Set([...uidsV, ...uidsB])].slice(0, MAX_EMAILS_PER_RUN);

      if (allUids.length) {
        console.log(`[emailPoller] BBVA:${uidsV.length} Bancolombia:${uidsB.length} → procesando ${allUids.length}`);
        await processUids(client, allUids);
      }
    } finally {
      lock.release();
    }
    // Sin logout — mantener la conexión abierta para el próximo ciclo
  } catch (err) {
    console.error('[emailPoller] Error poll:', err.message);
    if (imapClient) { try { imapClient.close(); } catch {} imapClient = null; }
  }
}

export async function backfillEmails() {
  return runPoll({ days: 30 });
}

export function startEmailPoller() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  if (!user || !pass) {
    console.log('[emailPoller] EMAIL_USER/EMAIL_PASSWORD no configurados — desactivado');
    return;
  }
  console.log(`[emailPoller] Activo — ${user} — revisando cada 30 s`);

  runPoll({ days: 30 }).catch(e => console.error('[emailPoller] Error inicial:', e.message));

  setInterval(
    () => runPoll({ days: 7 }).catch(e => console.error('[emailPoller] Error poll:', e.message)),
    30_000
  );
}
