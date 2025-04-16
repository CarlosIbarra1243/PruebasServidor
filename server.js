const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const bodyParser = require('body-parser');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(bodyParser.json());
app.use(express.static('public'));

// Almacenamiento de datos
const devices = new Map();
const connectedClients = new Set();

// WebSocket para conexiones de clientes web
wss.on('connection', (ws) => {
    connectedClients.add(ws);
    
    ws.on('close', () => {
        connectedClients.delete(ws);
    });
});

// Endpoint para recibir datos de los ESP32
app.post('/data', (req, res) => {
    const data = req.body;
    
    if (!data.id) {
        return res.status(400).send('ID requerido');
    }
    
    // Actualizar datos del dispositivo
    devices.set(data.id, {
        ...data,
        lastUpdate: Date.now()
    });
    
    // Enviar actualización a todos los clientes web
    const update = JSON.stringify({
        type: 'data',
        devices: Array.from(devices.entries()).reduce((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {})
    });
    
    connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(update);
        }
    });
    
    res.status(200).send('Datos recibidos');
});

// WebSocket para los ESP32
const espWss = new WebSocket.Server({ port: 8081 });

espWss.on('connection', (ws) => {
    ws.isAlive = true;
    
    ws.on('pong', () => {
        ws.isAlive = true;
    });
    
    ws.on('close', () => {
        // Manejar desconexión si es necesario
    });
});

// Verificar conexiones activas cada 30 segundos
setInterval(() => {
    espWss.clients.forEach(ws => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping(null, false, true);
    });
}, 30000);

server.listen(3000, () => {
    console.log('Servidor escuchando en http://localhost:3000');
});