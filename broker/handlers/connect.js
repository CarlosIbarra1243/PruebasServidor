module.exports = {
    handleConnect: (client, { pool, deviceStatus, connectionTimeouts, DEVICE_STATUS }) => {
      console.log(`Dispositivo conectado: ${client.id}`);
  
      if (connectionTimeouts.has(client.id)) {
        clearTimeout(connectionTimeouts.get(client.id));
        connectionTimeouts.delete(client.id);
      }
  
      if (client.apikey && client.usuarioId) {
        pool.query(
          'SELECT id, nombre FROM dispositivos WHERE api_key = ?',
          [client.apikey]
        ).then(([results]) => {
          if (results.length > 0) {
            const dispositivo = results[0];
            deviceStatus.set(dispositivo.id, DEVICE_STATUS.ONLINE);
            
            io.to(`usuario-${client.usuarioId}`).emit('estado_dispositivo', {
              id: dispositivo.id,
              nombre: dispositivo.nombre,
              status: DEVICE_STATUS.ONLINE,
              lastSeen: new Date().toISOString()
            });
          }
        });
      }
    },
  
    handleDisconnect: (client, { pool, deviceStatus, connectionTimeouts, DEVICE_STATUS, io }) => {
      console.log(`Dispositivo desconectado: ${client.id} key: ${client.apikey}`);
      
      if (client.apikey && client.usuarioId) {
        const timeoutId = setTimeout(() => {
          pool.query(
            'SELECT id, nombre FROM dispositivos WHERE api_key = ?',
            [client.apikey]
          ).then(([results]) => {
            if (results.length > 0) {
              const dispositivo = results[0];
              if (!aedes.clients[client.id]) {
                deviceStatus.set(dispositivo.id, DEVICE_STATUS.OFFLINE);
                io.to(`usuario-${client.usuarioId}`).emit('estado_dispositivo', {
                  id: dispositivo.id,
                  nombre: dispositivo.nombre,
                  status: DEVICE_STATUS.OFFLINE,
                  lastSeen: new Date().toISOString()
                });
              }
            }
          });
        }, CONNECTION_TIMEOUT);
  
        connectionTimeouts.set(client.id, timeoutId);
      }
    }
  };