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
      'SELECT id, nombre FROM dispositivos WHERE usuario_id = ? AND estado = ?',
      [usuarioId, '1']
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
    const [rows] = await pool.promise().query(
      'SELECT * FROM datos WHERE dispositivo_id = ? ORDER BY fecha DESC, hora DESC LIMIT ?',
      [deviceId, limit]
    );
    res.json(rows.reverse()); // Revertir para mostrar del más antiguo al más reciente
  } catch (err) {
    console.error('Error en la consulta SQL:', err); 
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

app.get('/api/estado_actuador', async (req, res) => {
  const dispositivoId = parseInt(req.query.dispositivoId, 10);
  if (!dispositivoId) return res.status(400).json({ error: 'ID no válido' });

  try {
    const [[actuador]] = await pool.promise().query(
      'SELECT activo as estado FROM actuadores WHERE dispositivo_id = ?',
      [dispositivoId]
    );
    if (!actuador) return res.status(404).json({ error: 'Actuador no encontrado' });
    res.json({ estado: actuador.estado });
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener el estado', details: err.message });
  }
});

// ================= API: Insertar lectura en Nodocentral =================
app.post('/api/nodocentral', async (req, res) => {
  const { temperatura, humedad } = req.body;

  // Validaciones básicas
  if (
    typeof temperatura !== 'number' ||
    typeof humedad !== 'number' ||
    temperatura < -50 || temperatura > 100 ||
    humedad < 0 || humedad > 100
  ) {
    return res.status(400).json({ error: 'Datos inválidos' });
  }

  try {
    const [result] = await pool.promise().query(
      'INSERT INTO Nodocentral (temperatura, humedad) VALUES (?, ?)',
      [temperatura, humedad]
    );
    return res.json({ success: true, insertId: result.insertId });
  } catch (err) {
    console.error('Error al insertar en Nodocentral:', err.message);
    return res.status(500).json({ error: 'Error al guardar los datos' });
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

//================= CONFIGURACIÓN EXPRESS =================
app.use('/auth', authRoutes);
app.use('/api/user', authenticateToken, authRoutes);

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
      'SELECT usuario_id FROM dispositivos WHERE api_key = ? AND estado = ?',
      [apiKey, '1'],
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
          'SELECT id, nombre FROM dispositivos WHERE api_key = ? AND estado = ?',
          [apiKey, '1'],
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
      'SELECT id, nombre FROM dispositivos WHERE api_key = ? AND estado = ?',
      [apiKey, '1'],
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

          // ✅ Obtener estado actual del actuador y enviarlo al ESP32
          pool.query(
            'SELECT activo FROM actuadores WHERE dispositivo_id = ?',
            [dispositivo.id],
            (err, result) => {
              if (!err && result.length > 0) {
                const estado = result[0].activo;

                aedes.publish({
                  topic: `estado_actuador/${dispositivo.id}`,
                  payload: Buffer.from(JSON.stringify({ estado })),
                  qos: 0,
                  retain: false
                });

                console.log(`📡 Enviado estado actual del actuador al dispositivo ${dispositivo.id}: ${estado}`);
              }
            }
          );
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
          'SELECT id, nombre FROM dispositivos WHERE api_key = ? AND estado = ?',
          [apiKey, '1'],
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
          `SELECT id, nombre FROM dispositivos WHERE api_key = ? AND estado = ?`,
          [apiKey, '1']
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
       FROM dispositivos WHERE api_key = ? AND estado = ?`,
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
        apiKey,
        '1'
      ]
    );

    // Obtener información del dispositivo
    const [dispositivo] = await pool.promise().query(
      'SELECT id, nombre, modelo FROM dispositivos WHERE api_key = ? AND estado = ?',
      [apiKey, '1']
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
          'SELECT id, nombre, api_key FROM dispositivos WHERE usuario_id = ? AND estado = ?',
          [usuarioId, '1']
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

    socket.on('subscribe_device', async (deviceId, callback) => {
      if (!deviceId) {
        if (typeof callback === 'function') callback({ error: 'Se requiere ID de dispositivo' });
        return;
      }

      socket.join(`dispositivo-${deviceId}`);
      console.log(`Cliente ${socket.id} se ha suscrito al dispositivo ${deviceId}`);

      // Obtener y enviar estado actual del actuador
      try {
        const [[estado]] = await pool.promise().query(
          'SELECT activo FROM actuadores WHERE dispositivo_id = ?',
          [deviceId]
        );

        if (estado) {
          socket.emit('estado_actuador', {
            dispositivoId: deviceId,
            nuevoEstado: estado.activo
          });
        }
      } catch (err) {
        console.error('Error al obtener estado del actuador:', err.message);
      }

      if (typeof callback === 'function') callback({ success: true });
    });



    socket.on('disconnect', () => {
        console.log('Cliente web desconectado:', socket.id);
    });

      socket.on('cambiar_estado_actuador', async ({ dispositivoId, nuevoEstado }, callback) => {
        try {
          if (![0, 1].includes(nuevoEstado)) {
            return callback?.({ error: 'Estado inválido' });
          }

          const [[actuador]] = await pool.promise().query(
            'SELECT id FROM actuadores WHERE dispositivo_id = ?',
            [dispositivoId]
          );
          if (!actuador) {
            return callback?.({ error: 'Este dispositivo no tiene actuador registrado' });
          }

          const topic = `actuador/${dispositivoId}`;
          const mensaje = JSON.stringify({ estado: nuevoEstado });

          aedes.publish({
            topic,
            payload: Buffer.from(mensaje),
            qos: 0,
            retain: true
          });

          // ✅ ACTUALIZAR EN BASE DE DATOS
          await pool.promise().query(
            'UPDATE actuadores SET activo = ? WHERE dispositivo_id = ?',
            [nuevoEstado, dispositivoId]
          );

          // Emitir evento de cambio de estado a la web
          io.to(`dispositivo-${dispositivoId}`).emit('estado_actuador', {
            dispositivoId,
            nuevoEstado
          });

          callback?.({ success: true });

        } catch (err) {
          console.error('❌ Error al cambiar estado del actuador:', err.message);
          callback?.({ error: 'Error interno del servidor' });
        }
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