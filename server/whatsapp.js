import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode';
import { EventEmitter } from 'events';
import { execSync } from 'child_process';

class WhatsAppManager extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.status = 'disconnected'; // disconnected | initializing | qr | ready
    this.qrRaw = null;
    this.qrImage = null; // base64 PNG para mostrar en el admin
    this.initCalled = false;
  }

  async init() {
    if (this.initCalled) return;
    this.initCalled = true;
    this.status = 'initializing';

    // Detectar Chromium en el entorno (Railway / local)
    let executablePath;
    try {
      executablePath = execSync('which chromium || which chromium-browser || which google-chrome-stable || which google-chrome')
        .toString().trim();
    } catch { executablePath = undefined; }

    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: '/tmp/wwebjs_auth' }),
      puppeteer: {
        ...(executablePath ? { executablePath } : {}),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
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
      console.log('📱 WhatsApp: escanea el QR en /configuracion/whatsapp');
    });

    this.client.on('authenticated', () => {
      this.status = 'initializing';
      console.log('✅ WhatsApp: autenticado');
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
      // Reintentar en 10 segundos
      setTimeout(() => this.init(), 10_000);
    });

    this.client.on('auth_failure', () => {
      this.status = 'disconnected';
      this.initCalled = false;
      console.log('❌ WhatsApp: fallo de autenticación — re-escanea el QR');
    });

    try {
      await this.client.initialize();
    } catch (e) {
      console.error('WhatsApp init error:', e.message);
      this.status = 'disconnected';
      this.initCalled = false;
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
