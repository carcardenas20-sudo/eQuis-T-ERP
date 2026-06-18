import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { query } from './db.js';
import { ENTITY_SCHEMAS, splitRecord } from './entitySchemas.js';
import { v4 as uuidv4 } from 'uuid';

const SCHEMA = ENTITY_SCHEMAS.TransferenciaDetectada;

function parseMontoCOP(str) {
  if (!str) return null;
  let s = str.replace(/[$\s]/g, '');
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',') && !s.includes('.')) {
    s = s.replace(/,/g, '');
  } else if (s.includes('.') && !s.includes(',')) {
    const parts = s.split('.');
    if (parts[parts.length - 1].length !== 2) s = s.replace(/\./g, '');
  }
  const n = parseFloat(s);
  return isNaN(n) || n <= 0 ? null : n;
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
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
    parse(text, subject) {
      const m = text.match(/\$\s*([\d.,]+)/);
      if (!m) return null;
      const monto = parseMontoCOP(m[1]);
      if (!monto) return null;
      const remitente =
        text.match(/(?:te transfer[ií]|de parte de|ordenante|nombre del remitente)[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]{2,40}?)(?:\n|<|\r|$)/i)
          ?.[1]?.trim() || null;
      const referencia = text.match(/(?:referencia|comprobante)[:\s]*([A-Z0-9]{6,})/i)?.[1] || null;
      return { monto, remitente, referencia };
    },
  },
  {
    banco: 'bbva',
    fromPattern: /bbva/i,
    skipSubject: /compra|hiciste|enviaste|d[eé]bito|en proceso|bienvenid/i,
    parse(text, subject) {
      const m = text.match(/\$\s*([\d.,]+)/);
      if (!m) return null;
      const monto = parseMontoCOP(m[1]);
      if (!monto) return null;
      const remitente =
        text.match(/(?:remitente|ordenante)[:\s]+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]{2,40}?)(?:\n|$)/i)
          ?.[1]?.trim() || null;
      return { monto, remitente, referencia: null };
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

async function pollEmails() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  if (!user || !pass) return;

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const BANK_FROM_DOMAINS = ['bancolombia', 'bbva'];

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const orCriteria = BANK_FROM_DOMAINS.map(d => ({ from: d }));
      const criteria = orCriteria.length === 1
        ? { seen: false, from: orCriteria[0].from }
        : { seen: false, or: orCriteria };

      // Usar UIDs para que sean estables aunque cambie el mailbox
      const uids = await client.search(criteria, { uid: true });
      if (!uids.length) return;

      for (const uid of uids) {
        try {
          const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!msg?.source) continue;

          const parsed = await simpleParser(msg.source);
          const from = parsed.from?.value?.[0]?.address || '';
          const subject = parsed.subject || '';
          const messageId = parsed.messageId || `fallback-${uid}`;

          const rule = BANK_RULES.find(r => r.fromPattern.test(from) || r.fromPattern.test(subject));
          if (!rule) {
            await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
            continue;
          }

          // Saltar notificaciones de pagos salientes (compras, transferencias enviadas)
          if (rule.skipSubject?.test(subject)) {
            console.log(`[emailPoller] Ignorado (salida) — "${subject}"`);
            await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
            continue;
          }

          // Verificar duplicado por Message-ID antes de procesar
          const dup = await query(
            `SELECT id FROM ${SCHEMA.table} WHERE email_uid = $1 LIMIT 1`,
            [messageId]
          );

          if (dup.rows.length > 0) {
            await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
            continue;
          }

          let text = parsed.text ||
            (parsed.html || '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                               .replace(/<[^>]+>/g, ' ')
                               .replace(/\s+/g, ' ');
          text = decodeHtmlEntities(text);

          // Solo procesar emails que contengan un monto — ignora logins, bienvenidas, etc.
          const hasAmount = /\$\s*[\d.,]+/.test(text);
          if (!hasAmount) {
            console.log(`[emailPoller] Ignorado (sin monto) — "${subject}"`);
            await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
            continue;
          }

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

          if (!result) {
            console.log(`[emailPoller] Sin parsear — "${subject}" | Texto: ${text.slice(0, 200)}`);
          }

          await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
        } catch (msgErr) {
          console.error(`[emailPoller] Error en uid ${uid}:`, msgErr.message);
        }
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    console.error('[emailPoller] Error IMAP:', err.message);
    try { client.close(); } catch {}
  }
}

export function startEmailPoller() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASSWORD;
  if (!user || !pass) {
    console.log('[emailPoller] EMAIL_USER/EMAIL_PASSWORD no configurados — desactivado');
    return;
  }
  console.log(`[emailPoller] Activo — ${user} — revisando cada 60 s`);
  pollEmails();
  setInterval(pollEmails, 60_000);
}
