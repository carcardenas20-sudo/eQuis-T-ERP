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
    // Solo procesar si dice "recibiste" — filtra pagos salientes
    requireText: /recibiste/i,
    parse(text, subject) {
      // "Recibiste una consignacion por $578.000 desde el corresponsal X"
      // "recibiste un pago de NOMBRE por $1.00 en tu cuenta"
      const m = text.match(/por\s*\$\s*([\d.,]+)/i);
      if (!m) return null;
      const monto = parseMontoCOP(m[1]);
      if (!monto) return null;

      const remitente =
        // Pago con llave: "recibiste un pago de NOMBRE por"
        text.match(/recibiste un pago de\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)\s+por/i)?.[1]?.trim()
        // Consignación corresponsal: "desde el corresponsal NOMBRE en"
        || text.match(/desde el corresponsal\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s\-]+?)\s+en\s/i)?.[1]?.trim()
        || null;

      // Número de llave como referencia
      const referencia = text.match(/llave\s+(\d{6,})/i)?.[1] || null;
      return { monto, remitente, referencia };
    },
  },
  {
    banco: 'bbva',
    fromPattern: /bbva/i,
    // El subject de transferencias entrantes BBVA es siempre este — es el filtro principal
    requireSubject: /Tu dinero ya est[aá] disponible/i,
    // Doble seguro: el cuerpo debe decir "Valor recibido"
    requireText: /Valor recibido/i,
    parse(text, subject) {
      // "Valor recibido $ 25.000,00"  o  "Valor recibido $ 1,00"
      const m = text.match(/Valor recibido\s*\$\s*([\d.,]+)/i);
      if (!m) return null;
      const monto = parseMontoCOP(m[1]);
      if (!monto) return null;

      // "Persona que envía\nNOMBRE APELLIDO"
      const remitente =
        text.match(/Persona que env[íi]a\s+([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?:\s{2,}|Tipo de llave|$)/i)?.[1]?.trim()
        || null;

      // "Código de operación\n12371166..."
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
      // 30 días — sin filtro seen:false porque emails anteriores ya fueron marcados
      // como leídos por corridas previas del poller aunque no se guardaran bien.
      // El chequeo de duplicados por email_uid (messageId) en BD previene re-guardados.
      const since = new Date();
      since.setDate(since.getDate() - 30);

      const uidsB = await client.search({ since, from: 'bancolombia' }, { uid: true });
      const uidsV = await client.search({ since, from: 'bbva' }, { uid: true });
      const allUids = [...new Set([...uidsB, ...uidsV])];

      if (!allUids.length) return;

      for (const uid of allUids) {
        try {
          const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
          if (!msg?.source) continue;

          const parsed = await simpleParser(msg.source);
          const from = parsed.from?.value?.[0]?.address || '';
          const subject = parsed.subject || '';
          const messageId = parsed.messageId || `fallback-${uid}`;

          const rule = BANK_RULES.find(r => r.fromPattern.test(from) || r.fromPattern.test(subject));
          if (!rule) {
            continue;
          }

          // Si el banco requiere un subject específico, ignorar cualquier otro
          if (rule.requireSubject && !rule.requireSubject.test(subject)) {
            console.log(`[emailPoller] Ignorado (subject no coincide) — "${subject}"`);
            continue;
          }

          let text = parsed.text ||
            (parsed.html || '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                               .replace(/<[^>]+>/g, ' ')
                               .replace(/\s+/g, ' ');
          text = decodeHtmlEntities(text);

          // Bancolombia: solo procesar si el texto contiene "recibiste" (ingreso)
          if (rule.requireText && !rule.requireText.test(text)) {
            console.log(`[emailPoller] Ignorado (no es ingreso) — "${subject}"`);
            continue;
          }

          // Verificar duplicado por Message-ID antes de procesar
          const dup = await query(
            `SELECT id FROM ${SCHEMA.table} WHERE email_uid = $1 LIMIT 1`,
            [messageId]
          );

          if (dup.rows.length > 0) {
            continue;
          }

          // Solo procesar emails que contengan un monto — ignora logins, bienvenidas, etc.
          const hasAmount = /\$\s*[\d.,]+/.test(text);
          if (!hasAmount) {
            console.log(`[emailPoller] Ignorado (sin monto) — "${subject}"`);
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
