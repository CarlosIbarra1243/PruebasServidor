const pool = require('../../config/db');

module.exports = {
  handlePublish: async (packet, client) => {
    if (!client || packet.topic.startsWith('$SYS')) return;

    try {
      const [temperatura, humedad, apiKey] = packet.payload.toString().split(',');
      
      if (isNaN(temperatura) || isNaN(humedad)) {
        throw new Error('Datos inválidos');
      }

      const [result] = await pool.query(
        `INSERT INTO datos (dispositivo_id, temperatura, humedad)
         SELECT id, ?, ? FROM dispositivos WHERE api_key = ?`,
        [parseFloat(temperatura), parseFloat(humedad), apiKey]
      );

      const [dispositivo] = await pool.query(
        'SELECT id, nombre FROM dispositivos WHERE api_key = ?',
        [apiKey]
      );

      if (client.usuarioId && dispositivo.length > 0) {
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
      console.log('Payload original:', packet.payload?.toString());
    }
  }
};