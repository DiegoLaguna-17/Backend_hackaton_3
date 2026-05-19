const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
    // Se usa el cliente por defecto. En Node 22 los WebSockets son nativos y no falla Realtime.
    supabase = createClient(supabaseUrl, supabaseKey);
} else {
    console.error('ERROR: No se encontraron SUPABASE_URL o SUPABASE_KEY en las variables de entorno.');
}

module.exports = supabase;
