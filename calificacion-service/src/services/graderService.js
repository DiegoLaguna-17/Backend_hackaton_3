const { ejecutarCodigo } = require('./executorService');

async function calificar(codigo, lenguaje, casosPrueba) {
  let notaTotal = 0;
  const resultadosPorCaso = [];

  for (const caso of casosPrueba) {
    const { entrada, salida_esperada, peso_porcentaje } = caso;

    const resultado = await ejecutarCodigo(codigo, lenguaje, entrada);

    const outputLimpio = resultado.output.trim();
    const esperadoLimpio = salida_esperada.trim();
    const paso = resultado.exitoso && outputLimpio === esperadoLimpio;

    if (paso) {
      notaTotal += peso_porcentaje;
    }

    resultadosPorCaso.push({
      entrada,
      salida_esperada: esperadoLimpio,
      salida_obtenida: outputLimpio,
      paso,
      puntos_obtenidos: paso ? peso_porcentaje : 0,
      puntos_posibles: peso_porcentaje,
      error: resultado.error || null
    });
  }

  return {
    nota_final: notaTotal,
    casos: resultadosPorCaso,
    compilo_exitosamente: resultadosPorCaso.every(c => c.error === null || c.paso)
  };
}

module.exports = { calificar };