const pool = require('../../config/db');

module.exports = (client, username, password, callback) => {
  const apiKey = password?.toString();
  
  pool.query(
    'SELECT usuario_id FROM dispositivos WHERE api_key = ?',
    [apiKey]
  ).then(([results]) => {
    if (!results.length) {
      console.log(`❌ Autenticación fallida: ${client.id}`);
      return callback(new Error('Invalid credentials'), false);
    }
    
    client.apikey = apiKey;
    client.usuarioId = results[0].usuario_id;
    console.log(`✅ Dispositivo autenticado: ${client.id}`);
    
    // Obtener detalles del dispositivo
    return pool.query(
      'SELECT id, nombre FROM dispositivos WHERE api_key = ?',
      [apiKey]
    ).then(([dispositivoResults]) => {
      if (dispositivoResults.length > 0) {
        const dispositivo = dispositivoResults[0];
        deviceStatus.set(dispositivo.id, 'online');
        io.to(`usuario-${client.usuarioId}`).emit('estado_dispositivo', {
          id: dispositivo.id,
          nombre: dispositivo.nombre,
          status: 'online',
          lastSeen: new Date().toISOString()
        });
      }
      callback(null, true);
    });
  }).catch(err => callback(err, false));
};