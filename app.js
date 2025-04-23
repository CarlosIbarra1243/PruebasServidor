const express = require('express');
const http = require('http');
const path = require('path');
const { mqttServer, deviceStatus } = require('./broker/mqtt');
const apiRoutes = require('./routes/api');
const setupSockets = require('./sockets');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public/frontend/browser')));
app.use('/api', apiRoutes);
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/frontend/browser', 'index.html'));
});

const server = http.createServer(app);
const io = require('socket.io')(server, { 
  cors: { 
    origin: "*",
    methods: ["GET", "POST"]
  }
});

setupSockets(io, deviceStatus);

mqttServer.listen(1883, () => {
  console.log('Broker MQTT: tcp://localhost:1883');
});

server.listen(3000, () => {
  console.log('Servidor HTTP: http://localhost:3000');
  console.log('Dashboard: http://localhost:3000/dashboard.html');
});

module.exports = { io };