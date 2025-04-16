const aedes = require('aedes')();
const net = require('net');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { Console } = require('console');

const app = express();

const server = http.createServer(app);
const io = socketIo(server, {
    cors: { origin: "*" },
});

// 🔵 Servir archivos estáticos desde la carpeta "public"
app.use(express.static(path.join(__dirname, 'public')));

// 🔵 Servir el HTML en la raíz "/"
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'hola.html'));
});

// 🔵 Iniciar el broker MQTT en el puerto 1883
const mqttServer = net.createServer(aedes.handle);
mqttServer.listen(1883, () => {
    console.log('🟢 Broker MQTT corriendo en el puerto 1883');
});

// 🔵 Iniciar el servidor HTTP en el puerto 3000
server.listen(3000, () => {
    console.log('🟢 Servidor HTTP corriendo en http://192.168.0.10:3000');
});

// 🔵 Evento cuando un cliente MQTT publica un mensaje
aedes.on('publish', (packet, client) => {
    if (client) {
        const topic = packet.topic;
        const message = packet.payload.toString();
        console.log(`📩 Mensaje recibido en "${topic}": ${message}`);

        // Enviar los datos a los clientes WebSocket
        io.emit('mqtt_message', { topic, message });
    }
});

// 🔵 Evento cuando un cliente MQTT se conecta
aedes.on('client', (client) => {
    console.log(`🔌 Cliente MQTT conectado: ${client.id}`);
    io.emit('estadoDis', { message: `Dispositivo conectado: ${client.id}`, estado: 1 });
});

// 🔵 Evento cuando un cliente MQTT se desconecta
aedes.on('clientDisconnect', (client) => {
    console.log(`❌ Cliente MQTT si desconectado: ${client.id}`);

    // Emitir un mensaje a todos los clientes WebSocket
    io.emit('estadoDis', { message: `Dispositivo desconectado: ${client.id}`, estado: 0 });
});

io.on('connection',(io)=>{
    console.log("Cliente web conectado");

});