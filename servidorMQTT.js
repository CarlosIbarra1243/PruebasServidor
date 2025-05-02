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
app.use(express.static(path.join(__dirname, 'public/frontend/browser')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/frontend/browser', 'index.html'));
});

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


    //Manejo de alarmas
  try {
    if (packet.topic === 'alarma/puerta') {
      try {
        const payload = packet.payload.toString();
        const dato = JSON.parse(payload);
  
        const {
          fecha,
          hora,
          tipo,
          descripcion,
          origen,
          estado,
          apiKey
        } = dato;
  
        // 1) Obtener dispositivo
        const [[disp]] = await pool.promise().query(
          `SELECT id, nombre FROM dispositivos WHERE api_key = ?`,
          [apiKey]
        );
        if (!disp) throw new Error('Dispositivo no encontrado');
  
        // 2) Insertar en tabla alarmas
        await pool.promise().query(
          `INSERT INTO alarmas
           (dispositivo_id, fecha, hora, tipo, descripcion, origen, estado)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            disp.id,
            fecha,
            hora,
            tipo,
            descripcion,
            origen,
            estado
          ]
        );
  
        // 3) Emitir a la web
        if (client.usuarioId) {
          io.to(`usuario-${client.usuarioId}`).emit('alarma_puerta', {
            tipo,
            fecha,
            hora,
            dispositivo_nombre: disp.nombre,
            descripcion,
            estado
          });
        }
      } catch (err) {
        console.error('❌ Error al procesar alarma:', err.message);
        console.log(payload);
      }
      return;
    
    }


    // Parsear todos los campos incluyendo fecha y hora desde el dispositivo
    const [fecha, hora, TempCon, TempRef, TempAmb, HumAmb, EnerCon, PuerCon, PuerRef, apiKey] = 
      packet.payload.toString().split(',');
    
    // Validar formato de fecha y hora
    const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha);
    const horaValida = /^\d{2}:\d{2}:\d{2}$/.test(hora);
    
    // Validación completa de datos
    if (!fechaValida || !horaValida ||
        [TempCon, TempRef, TempAmb, HumAmb, EnerCon].some(isNaN) || 
        ![0, 1].includes(parseInt(PuerCon)) || 
        ![0, 1].includes(parseInt(PuerRef))) {
      throw new Error('Datos inválidos o formato incorrecto');
    }

    // Insertar en base de datos con fecha y hora desde el dispositivo
    const [result] = await pool.promise().query(
      `INSERT INTO datos (
        dispositivo_id, 
        fecha, 
        hora,
        TempCon, 
        TempRef, 
        TempAmb, 
        HumAmb, 
        EnerCon, 
        PuerCon, 
        PuerRef
       )
       SELECT id, ?, ?, ?, ?, ?, ?, ?, ?, ? 
       FROM dispositivos WHERE api_key = ?`,
      [
        fecha,
        hora,
        parseFloat(TempCon),
        parseFloat(TempRef),
        parseFloat(TempAmb),
        parseInt(HumAmb),
        parseFloat(EnerCon),
        parseInt(PuerCon),
        parseInt(PuerRef),
        apiKey
      ]
    );

    // Obtener información del dispositivo
    const [dispositivo] = await pool.promise().query(
      'SELECT id, nombre, modelo FROM dispositivos WHERE api_key = ?',
      [apiKey]
    );

    // Enviar a dashboard con los datos recibidos
    if (client.usuarioId && dispositivo.length > 0) {
      io.to(`usuario-${client.usuarioId}`).emit('nuevo_dato', {
        dispositivo_id: dispositivo[0].id,
        dispositivo_nombre: dispositivo[0].nombre,
        modelo: dispositivo[0].modelo,
        fecha: fecha,
        hora: hora,
        TempCon: parseFloat(TempCon).toFixed(2),
        TempRef: parseFloat(TempRef).toFixed(2),
        TempAmb: parseFloat(TempAmb).toFixed(2),
        HumAmb: parseInt(HumAmb),
        EnerCon: parseFloat(EnerCon).toFixed(2),
        PuerCon: parseInt(PuerCon),
        PuerRef: parseInt(PuerRef)
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
  //console.log('Dashboard: http://localhost:3000/dashboard.html');
});