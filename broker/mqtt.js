const aedes = require('aedes')();
const net = require('net');
const { CONNECTION_TIMEOUT, DEVICE_STATUS } = require('../config/constants');
const authHandler = require('./handlers/auth');
const connectHandler = require('./handlers/connect');
const publishHandler = require('./handlers/publish');

const deviceStatus = new Map();
const connectionTimeouts = new Map();

aedes.authenticate = authHandler;
aedes.on('client', client => connectHandler.handleConnect(client, { pool: require('../config/db'), deviceStatus, connectionTimeouts, DEVICE_STATUS, CONNECTION_TIMEOUT }));
aedes.on('clientDisconnect', client => connectHandler.handleDisconnect(client, { pool: require('../config/db'), deviceStatus, connectionTimeouts, DEVICE_STATUS, io: require('../app').io }));
aedes.on('publish', publishHandler.handlePublish);

const mqttServer = net.createServer(aedes.handle);

module.exports = {
  mqttServer,
  deviceStatus
};