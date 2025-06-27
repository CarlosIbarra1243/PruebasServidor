const pool = require('../config/db');
const { DEVICE_STATUS } = require('../config/constants');

module.exports = (io, deviceStatus) => {
  io.on('connection', (socket) => {
    console.log(`Cliente web conectado: ${socket.id}`);

    socket.on('subscribe', async (usuarioId, callback) => {
      try {
        socket.join(`usuario-${usuarioId}`);
        
        const [dispositivos] = await pool.query(
          'SELECT id, nombre, api_key FROM dispositivos WHERE usuario_id = ? AND estado = ?',
          [usuarioId, '1']
        );

        dispositivos.forEach(dispositivo => {
          const status = deviceStatus.get(dispositivo.id) || DEVICE_STATUS.OFFLINE;
          socket.emit('estado_dispositivo', {
            id: dispositivo.id,
            nombre: dispositivo.nombre,
            status: status,
            lastSeen: new Date().toISOString()
          });
        });

        callback?.({ success: true });
      } catch (err) {
        console.error('Error en suscripción:', err);
        callback?.({ error: 'Error interno' });
      }
    });

    socket.on('disconnect', () => {
      console.log('Cliente web desconectado:', socket.id);
    });
  });
};