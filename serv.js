const aedes = require('aedes')();
const net = require('net');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mysql = require('mysql2');
const crypto = require('crypto');

// ================= CONFIGURACIÓN MYSQL =================
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Carlos1243',
  database: 'iot_db',
  waitForConnections: true,
  connectionLimit: 10
});



// ================= CONFIGURACIÓN EXPRESS =================
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ================= WEBSOCKET =================
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// ================= AUTENTICACIÓN MQTT =================
aedes.authenticate = (client, username, password, callback) => {

    console.log(password);
  const apiKey = password?.toString();
  
  pool.query(
    'SELECT usuario_id FROM dispositivos WHERE api_key = ?',
    [apiKey],
    (err, results) => {
      if (err || !results.length) {
        console.log(`❌ Autenticación fallida: ${client.id}`);
        return callback(err, false);
      }
      console.log(`✅ Dispositivo autenticado: ${client.id}`);
      client.usuarioId = results[0].usuario_id;
      callback(null, true);
    }
  );
};

// ================= MANEJO DE DATOS MQTT =================
aedes.on('publish', async (packet, client) => {
    if (!client || packet.topic.startsWith('$SYS')) return;
  
    try {
      // Dividir el payload en: temperatura, humedad, apiKey
      const [temperatura, humedad, apiKey] = packet.payload.toString().split(',');
      
      // Validar que sean valores numéricos
      if (isNaN(temperatura) || isNaN(humedad)) {
        throw new Error('Datos inválidos recibidos');
      }
  
      // Guardar en base de datos
      const [result] = await pool.promise().query(
        `INSERT INTO datos (dispositivo_id, temperatura, humedad)
         SELECT id, ?, ? FROM dispositivos WHERE api_key = ?`,
        [parseFloat(temperatura), parseFloat(humedad), apiKey]
      );
  
      // Enviar actualización al dashboard
      io.to(`usuario-${client.usuarioId}`).emit('nuevo_dato', {
        temperatura: temperatura,
        humedad: humedad,
        dispositivo: packet.topic.split('/')[3], // Extrae el ID del dispositivo
        timestamp: new Date().toISOString()
      });
  
      console.log(`✅ Dato guardado ${client.usuarioId}: ${temperatura}°C, ${humedad}%`);
  
    } catch (err) {
      console.error('❌ Error procesando dato:', err.message);
      console.log('Payload recibido:', packet.payload.toString());
    }
  });

// ================= API REST =================
// Registrar nuevo usuario
app.post('/api/registro', (req, res) => {
  const { email, password } = req.body;
  pool.query(
    'INSERT INTO usuarios (email, password) VALUES (?, ?)',
    [email, password],
    (err, result) => {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ id: result.insertId });
    }
  );
});

// Registrar nuevo dispositivo
app.post('/api/dispositivos', (req, res) => {
  const { nombre, usuarioId } = req.body;
  const apiKey = crypto.randomUUID();
  
  pool.query(
    'INSERT INTO dispositivos (nombre, usuario_id, api_key) VALUES (?, ?, ?)',
    [nombre, usuarioId, apiKey],
    (err, result) => {
      if (err) return res.status(400).json({ error: err.message });
      res.json({ apiKey });
    }
  );
});

// ================= INICIO SERVIDORES =================
const mqttServer = net.createServer(aedes.handle);
mqttServer.listen(1883, () => {
  console.log('🟢 Broker MQTT: tcp://localhost:1883');
});

server.listen(3000, () => {
  console.log('🟢 Servidor HTTP: http://localhost:3000');
});

// ================= WEBSOCKET EVENTS =================
io.on('connection', (socket) => {
  console.log('🌐 Cliente web conectado:', socket.id);

  socket.on('suscribir', (usuarioId) => {
    socket.join(`usuario-${usuarioId}`);
    console.log(`👤 Usuario ${usuarioId} suscrito`);
  });

  socket.on('disconnect', () => {
    console.log('🌐 Cliente web desconectado:', socket.id);
  });
});