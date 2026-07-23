import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = 'uploads';
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // UUID aleatorio (criptográfico) en vez de Date.now()+Math.random(): el nombre queda
    // imposible de adivinar/enumerar → nadie puede acceder a una imagen sin tener su URL exacta.
    cb(null, crypto.randomUUID() + path.extname(file.originalname));
  }
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  // URL RELATIVA (mismo origen): funciona en cualquier dominio (Railway/Fly/local) y ya no
  // depende de REPLIT_DEV_DOMAIN, que en producción generaba https://localhost:3001/... (roto).
  const url = `/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

export default router;
