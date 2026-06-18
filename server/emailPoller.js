import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { query } from './db.js';
import { ENTITY_SCHEMAS, splitRecord } from './entitySchemas.js';
import { v4 as uuidv4 } from 'uuid';

const SCHEMA = ENTITY_SCHEMAS.TransferenciaDetectada;

// Formatos soportados:
//   1.500.000,50  → punto=miles, coma=decimal  → 1500000.50
//   1,500,000.50  → coma=miles, punto=decimal  → 1500000.50
//   49.000        → todos los segmentos post-punto tienen 3 dígitos → miles → 49000
//   49.50         → segmento post-punto tiene 2 dígitos → decimal → 49.50
//   49,50         → coma única con ≤2 dígitos → decimal → 49.50
//   1,500,000     → varias comas → miles → 1500000
function parseMontoCOP(str) {
  if (!str) return null;
  let s = str.replace(/[$\s]/g, '').trim();
  if (!s || !/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) {
      // Colombiano 1.500.000,50: punto=miles, coma=decimal
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Anglosajón 1,500,000.50: coma=miles, punto=decimal
      s = s.replace(/,/g, '');
    }
  } else if (lastDot >= 0) {
    // Solo puntos: si TODOS los segmentos tras el punto tienen exactamente 3 dígitos → miles
    const segs = s.split('.');
    if (segs.slice(1).every(p => p.length === 3)) {
      s = s.replace(/\./g, ''); // 49.000→49000, 1.500.000→1500000
    }
    // else: punto decimal  (49.50 queda como 49.50)
  } else if (lastComma >= 0) {
    const segs = s.split(',');
    if (segs.length === 2 && segs[1].length <= 2) {
      s = s.replace(',', '.'); // 49,50 → 49.50
    } else {
      s = s.replace(/,/g, ''); // 1,500,000 → 1500000
    }
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
      // Captura montos bien formados: $49.000 / $1.500.000,50 / $49,50 / $49000
      // El lookahead negativo (?!\d) evita capturar números de referencia sin separadores
      const m = text.match(/\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)(?!\d)/)
             || text.match(/\$\s*([\d.,]+)/);
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
      // Captura montos bien formados: $49.000 / $1.500.000,50 / $49,50 / $49000
      // El lookahead negativo (?!\d) evita capturar números de referencia sin separadores
      const m = text.match(/\$\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)(?!\d)/)
             || text.match(/\$\s*([\d.,]+)/);
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
    // [Gmail]/All Mail cubre INBOX + Promociones + Social + cualquier etiqueta
    const lock = await client.getMailboxLock('[Gmail]/All Mail');
    try {
      // Solo emails de los últimos 14 días para no procesar historial antiguo
      const since = new Date();
      since.setDate(since.getDate() - 14);

      const orCriteria = BANK_FROM_DOMAINS.map(d => ({ from: d }));
      const baseFrom = orCriteria.length === 1 ? orCriteria[0] : { or: orCriteria };
      const criteria = { seen: false, since, ...baseFrom };

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
