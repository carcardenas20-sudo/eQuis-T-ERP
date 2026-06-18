import pkg from 'whatsapp-web.js';
const { Client, RemoteAuth } = pkg;
import qrcode from 'qrcode';
import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pool } from './db.js';

// ─── Store PostgreSQL para persistir la sesión entre deploys ─────────────────
class PostgresStore {
  async sessionExists({ session }) {
    const { rows } = await pool.query(
      "SELECT id FROM entity_app_config WHERE key = $1",
      [`whatsapp_session_${session}`]
    );
    return rows.length > 0;
  }

  async save({ session }) {
    // RemoteAuth calls save() with only {session} — the ZIP is at dataPath/{session}.zip
    const zipPath = path.join('/tmp/wwebjs_auth', `${session}.zip`);
    try {
      const data = (await fs.readFile(zipPath)).toString('base64');
      const exists = await this.sessionExists({ session });
      if (exists) {
        await pool.query(
          "UPDATE entity_app_config SET value = $1, updated_date = NOW() WHERE key = $2",
          [data, `whatsapp_session_${session}`]
        );
      } else {
        await pool.query(
          "INSERT INTO entity_app_config (id, key, value, data, created_date, updated_date) VALUES ($1, $2, $3, '{}'::jsonb, NOW(), NOW())",
          [crypto.randomUUID(), `whatsapp_session_${session}`, data]
        );
      }
      console.log('✅ WhatsApp: sesión guardada en PostgreSQL');
    } catch (e) {
      console.error('WhatsApp: error guardando sesión:', e.message);
    }
  }

  async extract({ session, path: zipPath }) {
    try {
      const { rows } = await pool.query(
        "SELECT value FROM entity_app_config WHERE key = $1",
        [`whatsapp_session_${session}`]
      );
      if (!rows.length || !rows[0].value) return;
      await fs.mkdir(path.dirname(zipPath), { recursive: true });
      await fs.writeFile(zipPath, Buffer.from(rows[0].value, 'base64'));
      console.log('✅ WhatsApp: sesión restaurada desde PostgreSQL');
    } catch (e) {
      console.error('WhatsApp: error restaurando sesión:', e.message);
    }
  }

  async delete({ session }) {
    try {
      await pool.query(
        "DELETE FROM entity_app_config WHERE key = $1",
        [`whatsapp_session_${session}`]
      );
    } catch (e) {
      console.error('WhatsApp: error borrando sesión:', e.message);
    }
  }
}

// ─── Manager principal ────────────────────────────────────────────────────────
class WhatsAppManager extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.status = 'disconnected';
    this.qrRaw = null;
    this.qrImage = null;
    this.initCalled = false;
    this.store = new PostgresStore();
  }

  async init() {
    if (this.initCalled) return;
    this.initCalled = true;
    this.status = 'initializing';

    this.client = new Client({
      authStrategy: new RemoteAuth({
        clientId: 'equist',
        store: this.store,
        backupSyncIntervalMs: 60_000,
        dataPath: '/tmp/wwebjs_auth',
      }),
      puppeteer: {
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--disable-extensions',
        ],
      },
    });

    this.client.on('qr', async (qr) => {
      this.qrRaw = qr;
      this.status = 'qr';
      try {
        this.qrImage = await qrcode.toDataURL(qr);
      } catch { this.qrImage = null; }
      this.emit('qr', this.qrImage);
      console.log('📱 WhatsApp: escanea el QR en /Admin_WhatsApp');
    });

    this.client.on('authenticated', () => {
      this.status = 'initializing';
      console.log('✅ WhatsApp: autenticado');
    });

    this.client.on('remote_session_saved', () => {
      console.log('✅ WhatsApp: sesión remota guardada en PostgreSQL');
    });

    this.client.on('ready', () => {
      this.status = 'ready';
      this.qrRaw = null;
      this.qrImage = null;
      this.emit('ready');
      console.log('✅ WhatsApp: listo para enviar mensajes');
    });

    this.client.on('disconnected', (reason) => {
      this.status = 'disconnected';
      this.qrRaw = null;
      this.qrImage = null;
      this.initCalled = false;
      this.emit('disconnected', reason);
      console.log('❌ WhatsApp desconectado:', reason);
      setTimeout(() => this.init(), 10_000);
    });

    this.client.on('auth_failure', () => {
      this.status = 'disconnected';
      this.initCalled = false;
      console.log('❌ WhatsApp: fallo de autenticación — reintentando en 15 s');
      setTimeout(() => this.init(), 15_000);
    });

    try {
      await this.client.initialize();
    } catch (e) {
      console.error('WhatsApp init error:', e.message);
      this.status = 'disconnected';
      this.initCalled = false;
      // Reintentar para que no quede muerto si Puppeteer falla al arrancar
      setTimeout(() => this.init(), 20_000);
    }
  }

  async sendMessage(phone, text) {
    if (this.status !== 'ready') throw new Error('WhatsApp no está conectado');
    const digits = String(phone).replace(/\D/g, '');
    const chatId = digits.startsWith('57') ? `${digits}@c.us` : `57${digits}@c.us`;
    return this.client.sendMessage(chatId, text);
  }

  getStatus() {
    return {
      status: this.status,
      qrImage: this.status === 'qr' ? this.qrImage : null,
    };
  }
}

export const whatsappManager = new WhatsAppManager();
