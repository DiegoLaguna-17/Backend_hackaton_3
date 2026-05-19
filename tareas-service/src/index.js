process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

require('dotenv').config();
const express = require('express');
const routes = require('./routes');

const app = express();
const port = process.env.PORT || 3002;

app.use(express.json());

app.use('/', routes);

app.listen(port, '0.0.0.0', () => {
    console.log(`servicio_2 corriendo en puerto ${port}`);
    console.log('Intentando conexión a Supabase...');
});
