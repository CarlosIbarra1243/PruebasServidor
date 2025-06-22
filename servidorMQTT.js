const aedes = require('aedes')();
const net = require('net');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const authRoutes = require('./routes/auth');

const connectionTimeouts = new Map();
const deviceStatus = new Map();

const app = express();

app.use(express.json());



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

// Listar dispositivos de un usuario
app.get('/api/dispositivos', async (req, res) => {
  const usuarioId = parseInt(req.query.usuarioId, 10);
  if (!usuarioId) return res.status(400).json({ error: 'usuarioId requerido' });
  try {
    const [rows] = await pool.promise().query(
      'SELECT id, nombre FROM dispositivos WHERE usuario_id = ?',
      [usuarioId]
    );
    const result = rows.map(d => ({
      id: d.id,
      nombre: d.nombre,
      status: deviceStatus.get(d.id) || 'offline'
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== Obtener datos recientes =========================
app.get('/api/datos/recientes/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  const limit = 10; // Número de registros a obtener
  try {
    console.log(`Consultando datos recientes para deviceId: ${deviceId}`); // Log para depuración
    const [rows] = await pool.promise().query(
      'SELECT * FROM datos WHERE dispositivo_id = ? ORDER BY fecha DESC, hora DESC LIMIT ?',
      [deviceId, limit]
    );
    console.log(`Datos obtenidos: ${JSON.stringify(rows)}`); // Log de los resultados
    res.json(rows.reverse()); // Revertir para mostrar del más antiguo al más reciente
  } catch (err) {
    console.error('Error en la consulta SQL:', err); // Log detallado del error
    res.status(500).json({ error: 'Error al obtener datos recientes', details: err.message });
  }
});

// ==================== Obtener estadísticas =========================
app.get('/api/estadisticas', async (req, res) => {
  try {
    const deviceId = parseInt(req.query.deviceId, 10);
    const intervalo = req.query.intervalo;
    let callSql;
    if (intervalo === '8h') callSql = 'CALL obtener_ultimas_8_horas(?)';
    else if (intervalo === '7d') callSql = 'CALL ultimaSemana(?)';
    else return res.status(400).json({ error: 'Intervalo no válido' });
    const [resultSets] = await pool.promise().query(callSql, [deviceId]);
    const data = Array.isArray(resultSets[0]) ? resultSets[0] : resultSets;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Error interno' });
  }
});

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

// ================= CONFIGURACIÓN EXPRESS =================
app.use('/auth', authRoutes);
app.use('/api/user', authenticateToken, authRoutes);

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

    socket.on('subscribe_device', (deviceId, callback) => {
      if (!deviceId) {
        if (typeof callback === 'function') callback({ error: 'Se requiere ID de dispositivo' });
        return;
      }

      // Unir al cliente a la sala del dispositivo
      socket.join(`dispositivo-${deviceId}`);
      console.log(`Cliente ${socket.id} se ha suscrito al dispositivo ${deviceId}`);

      if (typeof callback === 'function') callback({ success: true });
    });


    socket.on('disconnect', () => {
        console.log('Cliente web desconectado:', socket.id);
    });

  });

// Evento periódico para verificar estado de los dispositivos
const checkDeviceStatus = async () => {
  try {
    const [rows] = await pool.promise().query(
      `SELECT dispositivo_id, MAX(CONCAT(fecha, ' ', hora)) as last_seen 
       FROM datos 
       GROUP BY dispositivo_id`
    );

    const deviceStatuses = {};
    const now = new Date();
    const inactivityThreshold = 30 * 1000; // 30 segundos

    rows.forEach(row => {
      const lastSeen = new Date(row.last_seen);
      const isActive = (now.getTime() - lastSeen.getTime()) < inactivityThreshold;
      deviceStatuses[row.dispositivo_id] = isActive ? 'online' : 'offline';
    });

    // Emitir estado global a todos los clientes
    io.emit('estado_global', deviceStatuses);
  } catch (err) {
    console.error('Error al verificar estados:', err);
  }
};

// Ejecutar verificación cada 60 segundos
setInterval(checkDeviceStatus, 60000);

// ================= INICIO SERVIDORES =================
const mqttServer = net.createServer(aedes.handle);
mqttServer.listen(1883, () => {
  console.log('Broker MQTT: tcp://localhost:1883');
});

server.listen(3000, () => {
  console.log('Servidor HTTP: http://localhost:3000');
  //console.log('Dashboard: http://localhost:3000/dashboard.html');
});