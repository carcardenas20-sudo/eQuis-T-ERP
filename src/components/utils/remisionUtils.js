/**
 * remisionUtils.js
 * Funciones para calcular cantidades de materiales en remisiones de operario.
 */

/**
 * Calcula la cantidad de un material para una remisión dado N (número de prendas del lote).
 * @param {object} material - Objeto material_requerido del producto
 * @param {number} N - Número de prendas en el lote
 * @returns {number} Cantidad a entregar al operario
 */
export function calcularCantidadRemision(material, N) {
  const formula = material.remision_formula || 'lineal';

  const round2 = (v) => Math.round(v * 100) / 100;

  if (formula === 'lineal') {
    const factor = Number(material.piezas_por_unidad) || 1;
    return round2(N * factor);
  }

  if (formula === 'ceil_divide') {
    const divisor = Number(material.remision_divisor) || 3;
    return Math.ceil(N / divisor);
  }

  if (formula === 'paso') {
    const umbral = Number(material.remision_umbral) || 15;
    const bajo = Number(material.remision_val_bajo) || 1;
    const alto = Number(material.remision_val_alto) || 2;
    return N <= umbral ? bajo : alto;
  }

  // Fallback: lineal factor 1
  return N;
}

/**
 * Genera las líneas de materiales para una remisión individual.
 * @param {object} producto - Producto con materiales_requeridos
 * @param {number} N - Número de prendas del lote
 * @param {object[]} materiasPrimas - Lista de materias primas para resolver nombres
 * @returns {object[]} Líneas de material para la remisión
 */
export function generarLineasRemision(producto, N, materiasPrimas = []) {
  const materiales = producto?.materiales_requeridos || [];
  return materiales
    .filter(m => m.materia_prima_id && !m.es_opcional && m.en_remision !== false)
    .map(m => {
      const mp = materiasPrimas.find(p => p.id === m.materia_prima_id);
      const cantidad = calcularCantidadRemision(m, N);
      return {
        materia_prima_id: m.materia_prima_id,
        nombre: m.nombre_seccion_display || mp?.nombre || '',
        cantidad,
        unidad: m.unidad_remision || mp?.unidad_medida || 'unidades',
        descripcion: m.descripcion_remision || '',
        formula: m.remision_formula || 'lineal',
      };
    });
}
