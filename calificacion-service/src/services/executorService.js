const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TIMEOUT_MS = 5000;

async function descargarCodigo(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
  });
}

async function ejecutarCodigo(codigo, lenguaje, entrada = '') {
  // Si es una URL, descargar el código primero
  if (codigo.startsWith('http')) {
    codigo = await descargarCodigo(codigo);
  }

  // Normalizar lenguaje: c++ → cpp
  lenguaje = lenguaje.toLowerCase().replace('c++', 'cpp');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'calificacion-'));

  try {
    let comando;
    let archivoPath;
    const entradaPath = path.join(tmpDir, 'entrada.txt');
    fs.writeFileSync(entradaPath, entrada);

    if (lenguaje === 'python') {
      archivoPath = path.join(tmpDir, 'solucion.py');
      fs.writeFileSync(archivoPath, codigo);
      comando = `python ${archivoPath} < ${entradaPath}`;

    } else if (lenguaje === 'javascript') {
      archivoPath = path.join(tmpDir, 'solucion.js');
      fs.writeFileSync(archivoPath, codigo);
      comando = `node ${archivoPath} < ${entradaPath}`;

    } else if (lenguaje === 'java') {
      archivoPath = path.join(tmpDir, 'Solucion.java');
      fs.writeFileSync(archivoPath, codigo);
      execSync(`javac ${archivoPath}`, { timeout: TIMEOUT_MS });
      comando = `java -cp ${tmpDir} Solucion < ${entradaPath}`;

    } else if (lenguaje === 'cpp') {
      archivoPath = path.join(tmpDir, 'solucion.cpp');
      const outputPath = path.join(tmpDir, 'solucion_out');
      fs.writeFileSync(archivoPath, codigo);
      execSync(`g++ ${archivoPath} -o ${outputPath}`, { timeout: TIMEOUT_MS });
      comando = `${outputPath} < ${entradaPath}`;

    } else {
      return {
        exitoso: false,
        output: '',
        error: `Lenguaje no soportado: ${lenguaje}`
      };
    }

    const output = execSync(comando, {
      timeout: TIMEOUT_MS,
      encoding: 'utf8'
    }).trim();

    return {
      exitoso: true,
      output,
      error: null
    };

  } catch (err) {
    const esTimeout = err.signal === 'SIGTERM';
    return {
      exitoso: false,
      output: '',
      error: esTimeout ? 'Tiempo límite excedido (5s)' : err.stderr || err.message
    };

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { ejecutarCodigo };