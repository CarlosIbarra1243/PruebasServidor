const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'clave_ultrasecreta_xd'

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

// Obtención de datos del usuario
router.get('/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        if (req.user.id !== parseInt(userId)){
            return res.status(403).json({ error: 'Acceso no autorizado al usuario' });
        }
        const [users] = await pool.promise().query('SELECT id, nombre, email, telefono, fecha_nacimiento, genero, rol FROM usuarios WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        res.json(users[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al obtener datos del usuario' });
    }
});

module.exports = router;