const aedes = require('aedes')();
const net = require('net');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const mysql = require('mysql2');
const crypto = require('crypto');


const connectionTimeouts = new Map();

const deviceStatus = new Map();

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
const io = socketIo(server, { 
  cors: { 
    origin: "*",
    methods: ["GET", "POST"]
  }
});




// Actualiza la autenticación para guardar el API Key en el cliente
aedes.authenticate = (client, username, password, callback) => {
    const apiKey = password?.toString();
    
    // 1. Validar API Key y obtener usuario_id
    pool.query(
      'SELECT usuario_id FROM dispositivos WHERE api_key = ?',
      [apiKey],
      (err, results) => {
        if (err || !results.length) {
          console.log(`❌ Autenticación fallida: ${client.id}`);
          return callback(err, false);
        }
        
        // 2. Asignar propiedades al cliente
        client.apikey = apiKey;
        client.usuarioId = results[0].usuario_id;
        console.log(`✅ Dispositivo autenticado: ${client.id}`);
        
        // 3. Obtener detalles del dispositivo (secuencialmente)
        pool.query(
          'SELECT id, nombre FROM dispositivos WHERE api_key = ?',
          [apiKey],
          (err, results) => {
            if (err) return; // Manejar error si es necesario
            
            // 4. Actualizar estado y notificar
            if (results.length > 0) {
              const dispositivo = results[0];
              deviceStatus.set(dispositivo.id, 'online');
              io.to(`usuario-${client.usuarioId}`).emit('estado_dispositivo', {
                id: dispositivo.id,
                nombre: dispositivo.nombre,
                status: 'online',
                lastSeen: new Date().toISOString()
              });
            }
            
            // 5. Finalizar autenticación
            callback(null, true); 
          }
        );
      }
    );
  };
// ================= MANEJO DE CONEXIONES MQTT =================

aedes.on('client', (client) => {
    console.log(`Dispositivo conectado: ${client.id} `);
    
    // Cancelar timeout de desconexión previo si existe
    if (connectionTimeouts.has(client.id)) {
      clearTimeout(connectionTimeouts.get(client.id));
      connectionTimeouts.delete(client.id);
    }
  
    const apiKey = client.authenticated ? client.apikey : null;
    
    if (apiKey && client.usuarioId) {
      pool.query(
        'SELECT id, nombre FROM dispositivos WHERE api_key = ?',
        [apiKey],
        (err, results) => {
          if (!err && results.length > 0) {
            const dispositivo = results[0];
            deviceStatus.set(dispositivo.id, 'online');
            
            io.to(`usuario-${client.usuarioId}`).emit('estado_dispositivo', {
              id: dispositivo.id,
              nombre: dispositivo.nombre,
              status: 'online',
              lastSeen: new Date().toISOString()
            });
          }
        }
      );
    }
  });

aedes.on('clientDisconnect', (client) => {
    console.log(`Dispositivo desconectado: ${client.id} key: ${client.apikey}`);
    const apiKey = client.apikey;
    
    if (apiKey && client.usuarioId) {
      // Programar la verificación de estado después de 5 segundos
      const timeoutId = setTimeout(() => {
        pool.query(
          'SELECT id, nombre FROM dispositivos WHERE api_key = ?',
          [apiKey],
          (err, results) => {
            if (!err && results.length > 0) {
              const dispositivo = results[0];
              
              // Verificar si sigue desconectado
              if (aedes.clients[client.id] === undefined) {
                deviceStatus.set(dispositivo.id, 'offline');
                io.to(`usuario-${client.usuarioId}`).emit('estado_dispositivo', {
                  id: dispositivo.id,
                  nombre: dispositivo.nombre,
                  status: 'offline',
                  lastSeen: new Date().toISOString()
                });
              }
            }
          }
        );
      }, 5000); // 5 segundos de espera
  
      connectionTimeouts.set(client.id, timeoutId);
    }
  });


// ================= MANEJO DE DATOS MQTT =================
aedes.on('publish', async (packet, client) => {
  if (!client || packet.topic.startsWith('$SYS')) return;

 // console.log(`\nPaquete MQTT recibido: ${packet.topic}`);
  //console.log(`Payload: ${packet.payload.toString()}`);

  try {
    const [temperatura, humedad, apiKey] = packet.payload.toString().split(',');
    
    // Validación de datos
    if (isNaN(temperatura) || isNaN(humedad)) {
      throw new Error('Datos inválidos');
    }

    // Insertar en base de datos
    const [result] = await pool.promise().query(
      `INSERT INTO datos (dispositivo_id, temperatura, humedad)
       SELECT id, ?, ? FROM dispositivos WHERE api_key = ?`,
      [parseFloat(temperatura), parseFloat(humedad), apiKey]
    );

    //console.log(`Datos almacenados: ${result.affectedRows} fila(s) afectada(s)`);

       // Obtener información del dispositivo
       const [dispositivo] = await pool.promise().query(
        'SELECT id, nombre FROM dispositivos WHERE api_key = ?',
        [apiKey]
      );
  
      // Enviar a dashboard con ID y nombre del dispositivo
      if (client.usuarioId && dispositivo.length > 0) {
       // console.log(`Enviando a usuario-${client.usuarioId}`);
        io.to(`usuario-${client.usuarioId}`).emit('nuevo_dato', {
          temperatura: parseFloat(temperatura).toFixed(2),
          humedad: parseFloat(humedad).toFixed(2),
          dispositivo_id: dispositivo[0].id,
          dispositivo_nombre: dispositivo[0].nombre,
          timestamp: new Date().toISOString()
        });
      }

  } catch (err) {
    console.error('❌ Error:', err.message);
    console.log('Payload original:', packet.payload.toString());
  }
});

// ================= API REST =================
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


// ================= WEBSOCKET EVENTS =================
io.on('connection', (socket) => {
    console.log(`Cliente web conectado: ${socket.id}`);
  
    socket.on('subscribe', async (usuarioId, callback) => {
      if (!usuarioId) {
        if (typeof callback === 'function') callback({ error: 'Se requiere ID de usuario' });
        return;
      }
  
      try {
        // 1. Unirse a la sala del usuario
        socket.join(`usuario-${usuarioId}`);
        
        // 2. Obtener dispositivos del usuario
        const [dispositivos] = await pool.promise().query(
          'SELECT id, nombre, api_key FROM dispositivos WHERE usuario_id = ?',
          [usuarioId]
        );
  
        // 3. Enviar estado actual de cada dispositivo
        dispositivos.forEach(dispositivo => {
          const status = deviceStatus.get(dispositivo.id) || 'offline';
          socket.emit('estado_dispositivo', {
            id: dispositivo.id,
            nombre: dispositivo.nombre,
            status: status,
            lastSeen: new Date().toISOString()
          });
        });
  
        if (typeof callback === 'function') callback({ success: true });
        
      } catch (err) {
        console.error('Error en suscripción:', err);
        if (typeof callback === 'function') callback({ error: 'Error interno' });
      }
    });


    socket.on('disconnect', () => {
        console.log('Cliente web desconectado:', socket.id);
      });

  });

// ================= INICIO SERVIDORES =================
const mqttServer = net.createServer(aedes.handle);
mqttServer.listen(1883, () => {
  console.log('Broker MQTT: tcp://localhost:1883');
});

server.listen(3000, () => {
  console.log('Servidor HTTP: http://localhost:3000');
  console.log('Dashboard: http://localhost:3000/dashboard.html');
});