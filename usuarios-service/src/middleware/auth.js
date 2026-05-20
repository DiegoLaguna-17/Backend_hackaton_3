const jwt = require('jsonwebtoken');


const JWT_SECRET = process.env.JWT_SECRET || 'hackaton_secret_key';


// Verifica que el token JWT sea válido
const verificarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>


    if (!token) {
        return res.status(401).json({ error: 'Token requerido' });
    }


    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
};


// Verifica que el usuario tenga rol administrador
const soloAdmin = (req, res, next) => {
    if (!req.usuario || req.usuario.rol !== 'administrador') {
        return res.status(403).json({ error: 'Acceso denegado: solo administradores' });
    }
    next();
};


module.exports = { verificarToken, soloAdmin };
