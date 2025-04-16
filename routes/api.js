const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const crypto = require('crypto');

router.post('/registro', (req, res) => {
  const { email, password } = req.body;
  pool.query(
    'INSERT INTO usuarios (email, password) VALUES (?, ?)',
    [email, password]
  ).then(([result]) => {
    res.json({ id: result.insertId });
  }).catch(err => {
    res.status(400).json({ error: err.message });
  });
});

router.post('/dispositivos', (req, res) => {
  const { nombre, usuarioId } = req.body;
  const apiKey = crypto.randomUUID();
  
  pool.query(
    'INSERT INTO dispositivos (nombre, usuario_id, api_key) VALUES (?, ?, ?)',
    [nombre, usuarioId, apiKey]
  ).then(([result]) => {
    res.json({ apiKey });
  }).catch(err => {
    res.status(400).json({ error: err.message });
  });
});

module.exports = router;