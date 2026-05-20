const supabase = require('../config/supabaseClient');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');


const JWT_SECRET = process.env.JWT_SECRET || 'hackaton_secret_key';


// POST /auth/login
const login = async (req, res) => {
    const { email, password } = req.body;


    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }


    try {
        const { data: usuario, error } = await supabase
            .from('usuario')
            .select('id, nombre_completo, email, contrasena, rol_id, rol(id, nombre)')
            .eq('email', email)
            .single();


        console.log('Usuario encontrado:', usuario ? 'SI' : 'NO');
        console.log('Error supabase:', error);
        console.log('Contrasena en BD:', usuario?.contrasena);
        console.log('Password recibido:', password);


        if (error || !usuario) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }


        const passwordValido = await bcrypt.compare(password, usuario.contrasena);
        console.log('Password valido:', passwordValido);


        if (!passwordValido) {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }


        const token = jwt.sign(
            {
                id: usuario.id,
                email: usuario.email,
                rol: usuario.rol.nombre,
                rol_id: usuario.rol_id
            },
            JWT_SECRET,
            { expiresIn: '8h' }
        );


        return res.json({
            message: 'Login exitoso',
            token,
            usuario: {
                id: usuario.id,
                nombre_completo: usuario.nombre_completo,
                email: usuario.email,
                rol: usuario.rol.nombre
            }
        });


    } catch (err) {
        console.error('Error en login:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};


// POST /auth/crear-usuario (solo admin)
const crearUsuario = async (req, res) => {
    const { nombre_completo, email, password, rol_id } = req.body;


    if (!nombre_completo || !email || !password || !rol_id) {
        return res.status(400).json({ error: 'Todos los campos son requeridos: nombre_completo, email, password, rol_id' });
    }


    try {
        const { data: rol, error: rolError } = await supabase
            .from('rol')
            .select('id, nombre')
            .eq('id', rol_id)
            .single();


        if (rolError || !rol) {
            return res.status(400).json({ error: 'El rol especificado no existe' });
        }


        const { data: existe } = await supabase
            .from('usuario')
            .select('id')
            .eq('email', email)
            .single();


        if (existe) {
            return res.status(409).json({ error: 'El email ya está en uso' });
        }


        const contrasena = await bcrypt.hash(password, 10);


        const { data: nuevoUsuario, error: insertError } = await supabase
            .from('usuario')
            .insert([{ nombre_completo, email, contrasena, rol_id }])
            .select('id, nombre_completo, email, rol_id')
            .single();


        if (insertError) {
            console.error('Error insertando usuario:', insertError.message);
            return res.status(500).json({ error: 'Error al crear el usuario' });
        }


        return res.status(201).json({
            message: 'Usuario creado exitosamente',
            usuario: {
                ...nuevoUsuario,
                rol: rol.nombre
            }
        });


    } catch (err) {
        console.error('Error en crearUsuario:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};


// GET /auth/usuarios (solo admin)
const listarUsuarios = async (req, res) => {
    try {
        const { data: usuarios, error } = await supabase
            .from('usuario')
            .select('id, nombre_completo, email, rol_id, rol(nombre)')
            .order('nombre_completo', { ascending: true });


        if (error) throw error;


        return res.json({ usuarios });


    } catch (err) {
        console.error('Error en listarUsuarios:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};


// GET /auth/roles (solo admin)
const listarRoles = async (req, res) => {
    try {
        const { data: roles, error } = await supabase
            .from('rol')
            .select('id, nombre');


        if (error) throw error;


        return res.json({ roles });


    } catch (err) {
        console.error('Error en listarRoles:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};


// GET /auth/perfil (usuario autenticado)
const perfil = async (req, res) => {
    try {
        const { data: usuario, error } = await supabase
            .from('usuario')
            .select('id, nombre_completo, email, rol(nombre)')
            .eq('id', req.usuario.id)
            .single();


        if (error || !usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }


        return res.json({ usuario });


    } catch (err) {
        console.error('Error en perfil:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor' });
    }
};


module.exports = { login, crearUsuario, listarUsuarios, listarRoles, perfil };



index.js 
const supabase = require('../config/supabaseClient');


const healthCheck = async (req, res) => {
    let supabaseStatus = 'not initialized';
    let dbError = null;


    if (supabase) {
        try {
            // Test de conexión simple según requerimiento
            const { data, error } = await supabase.from('test').select('*').limit(1);
            if (error) {
                throw error;
            }
            supabaseStatus = 'connected';
        } catch (error) {
            console.error(`Error conectando a Supabase en ${req.url}:`, error.message);
            supabaseStatus = 'error';
            dbError = error.message;
        }
    }


    // El servicio siempre responde status 200 para evitar que el healthcheck o el NGINX fallen
    res.json({
        status: "ok",
        service: "servicio_1",
        supabase: supabaseStatus,
        error: dbError
    });
};


const testRoute = async (req, res) => {
    try {
        res.json({ message: 'Test route from servicio_1' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


module.exports = {
    healthCheck,
    testRoute
};


