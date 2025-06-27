const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'clave_ultrasecreta_xd'

// Middleware para verificar JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers && req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acceso no autorizado' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    req.user = decoded;
    next();
  });
};

// Registro de usuario
router.post('/register', async (req, res) => {
    try {
        const { email, fechaNacimiento, genero, nombre, password, rol, telefono} = req.body;
        if (!email || !password || !nombre || !fechaNacimiento || !genero || !telefono || !rol) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }
        
        if (![1, 2].includes(parseInt(rol))) {
            return res.status(400).json({ error: 'Rol inválido' });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const [result] = await pool.promise().query(
            'INSERT INTO usuarios (nombre, email, password, telefono, fecha_nacimiento, genero, rol) VALUES (?,?,?,?,?,?,?)', [nombre, email, hashedPassword, telefono, fechaNacimiento, genero, rol]
        );
        res.status(201).json({ id: result.insertId, message: 'Usuario registrado' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al registrar usuario' });
    }
});

// Inicio de sesión
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }
        const [users] = await pool.promise().query('SELECT * FROM usuarios WHERE email = ?', [email]);
        if (users.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        const user = users[0];

        // Verificación de contraseña ingresada
        const passMatch = await bcrypt.compare(password, user.password);
        if (!passMatch) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }
        const token = jwt.sign({ id: user.id, rol: user.rol }, JWT_SECRET, { expiresIn: '1h'});
        res.json({ token, rol: user.rol});
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});



router.get('/devices', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id; // Obtenido del token JWT
    const [devices] = await pool.promise().query(
      'SELECT id, nombre, modelo FROM dispositivos WHERE usuario_id = ? AND estado = ?',
      [userId, '1']
    );
    res.json(devices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener dispositivos' });
  }
});

router.post('/addDevice', authenticateToken, async (req, res) => {
  try {
    const { nombre, modelo } = req.body;
    if (!nombre || !modelo) {
      return res.status(400).json({ error: 'Faltan datos requeridos (nombre y modelo)' });
    }

    const userId = req.user.id;
    const apiKey = require('uuid').v4(); // Genera una nueva API key

    const [result] = await pool.promise().query(
      'INSERT INTO dispositivos (usuario_id, nombre, modelo, api_key) VALUES (?, ?, ?, ?)',
      [userId, nombre, modelo, apiKey]
    );

    const newDevice = {
      id: result.insertId,
      usuario_id: userId,
      nombre,
      modelo,
      api_key: apiKey
    };

    res.status(201).json({ message: 'Dispositivo agregado exitosamente', device: newDevice });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al agregar dispositivo' });
  }
});

router.post('/editDevice/:id', authenticateToken, async (req, res) => {
  try {
    const deviceId = req.params.id;
    const { nombre, modelo } = req.body;
    if (!nombre || !modelo) {
      return res.status(400).json({ error: 'Faltan datos requeridos (nombre y modelo)' });
    }

    const userId = req.user.id;
    const [device] = await pool.promise().query(
      'SELECT usuario_id FROM dispositivos WHERE id = ? AND estado = ?',
      [deviceId, '1']
    );

    if (device.length === 0) {
      return res.status(404).json({ error: 'Dispositivo no encontrado' });
    }

    if (device[0].usuario_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para editar este dispositivo' });
    }

    await pool.promise().query(
      'UPDATE dispositivos SET nombre = ?, modelo = ? WHERE id = ? AND estado = ?',
      [nombre, modelo, deviceId, '1']
    );

    // Devolver el dispositivo actualizado
    const [updatedDevice] = await pool.promise().query(
      'SELECT id, nombre, modelo FROM dispositivos WHERE id = ? AND estado = ?',
      [deviceId, '1']
    );
    res.json(updatedDevice[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar dispositivo' });
  }
});

router.get('/devices/:id', authenticateToken, async (req, res) => {
  try {
    const deviceId = req.params.id;
    const userId = req.user.id;

    const [device] = await pool.promise().query(
      'SELECT id, nombre, modelo, api_key FROM dispositivos WHERE id = ? AND usuario_id = ? AND estado = ?',
      [deviceId, userId, '1']
    );

    if (device.length === 0) {
      return res.status(404).json({ error: 'Dispositivo no encontrado o no tienes acceso' });
    }

    res.json(device[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el dispositivo' });
  }
});

router.post('/deactivateDevice/:id', authenticateToken, async (req, res) => {
  try {
    const deviceId = req.params.id;
    const { estado } = req.body;
    const userId = req.user.id;

    if (!estado) {
      return res.status(400).json({ error: 'Falta el estado' });
    }

    // Verificar que el dispositivo existe y pertenece al usuario
    const [device] = await pool.promise().query(
      'SELECT usuario_id FROM dispositivos WHERE id = ? AND estado = ?',
      [deviceId, '1']
    );

    if (device.length === 0) {
      return res.status(404).json({ error: 'Dispositivo no encontrado' });
    }

    if (device[0].usuario_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para editar este dispositivo' });
    }

    // Actualizar el estado del dispositivo
    await pool.promise().query(
      'UPDATE dispositivos SET estado = ? WHERE id = ?',
      [estado, deviceId]
    );

    res.json({ message: 'Estado actualizado exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el estado' });
  }
});

router.get('/alertas', authenticateToken, async (req, res) => {
  try {
    const { deviceId } = req.query;
    const userId = req.user.id;

    let query = 'SELECT id, dispositivo_id, fecha, hora, tipo, descripcion, origen, estado FROM alarmas WHERE dispositivo_id IN (SELECT id FROM dispositivos WHERE usuario_id = ? AND estado = ?)';
    let params = [userId, '1'];

    if (deviceId) {
      query += ' AND dispositivo_id = ?';
      params.push(deviceId);
    }

    query += ' ORDER BY fecha DESC, hora DESC';
    const [alerts] = await pool.promise().query(query, params);

    res.json(alerts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener alertas' });
  }
});

router.post('/validatePassword', authenticateToken, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Falta la contraseña' });
    }

    const userId = req.user.id;
    const [user] = await pool.promise().query(
      'SELECT password FROM usuarios WHERE id = ?',
      [userId]
    );

    if (user.length === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const isValid = await bcrypt.compare(password, user[0].password);
    res.json({ isValid });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al validar la contraseña' });
  }
});

module.exports = router;