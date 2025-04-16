const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Carlos1243',
  database: 'iot_db',
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool.promise(); 