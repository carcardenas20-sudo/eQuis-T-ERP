import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db.js';
import { JWT_SECRET, JWT_EXPIRES } from '../config.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const result = await query('SELECT * FROM app_users WHERE email = $1 AND is_active = true', [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    const { password_hash, ...userOut } = user;
    res.json({ token, user: { ...userOut, ...user.data } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No autenticado' });

    const decoded = jwt.verify(token, JWT_SECRET);
    const result = await query('SELECT * FROM app_users WHERE id = $1 AND is_active = true', [decoded.id]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    const { password_hash, ...userOut } = user;
    res.json({ ...userOut, ...user.data });
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
});

router.post('/logout', (req, res) => {
  res.json({ ok: true });
});

export default router;
