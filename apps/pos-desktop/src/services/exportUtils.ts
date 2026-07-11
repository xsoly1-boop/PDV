import { API_V1 } from '../config';

/**
 * Convierte un array de objetos a formato CSV y descarga el archivo en el navegador.
 */
export function exportToCSV(data: any[], filename: string) {
  if (!data || !data.length) {
    alert('No hay datos para exportar.');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvRows = [];
  
  // Agregar encabezados
  csvRows.push(headers.join(','));
  
  // Agregar filas
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header] ?? '';
      const escaped = ('' + val).replace(/"/g, '""'); // Escapar comillas dobles estándar CSV
      return `"${escaped}"`;
    });
    csvRows.push(values.join(','));
  }

  // Prepend de UTF-8 BOM para asegurar soporte de acentos en Excel
  const csvContent = '\uFEFF' + csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exporta el reporte de ventas por periodo a un archivo CSV.
 */
export async function exportVentasCSV(desde: string, hasta: string) {
  try {
    const res = await fetch(`${API_V1}/reportes/ventas-periodo?desde=${desde}&hasta=${hasta}`);
    if (!res.ok) throw new Error('Error al obtener reporte de ventas');
    const data = await res.json();
    
    const mapped = data.ventas.map((v: any) => ({
      Folio: v.folio.split('|')[0],
      MetodoPago: v.folio.split('|')[1] || 'Efectivo',
      Fecha: new Date(v.creadoAt).toLocaleString('es-MX'),
      Subtotal: Number(v.subtotal).toFixed(2),
      Descuento: Number(v.descuento).toFixed(2),
      Total: Number(v.total).toFixed(2),
      Cajero: v.usuario?.nombre || 'N/A'
    }));

    exportToCSV(mapped, `Reporte_Ventas_${desde}_a_${hasta}.csv`);
  } catch (err: any) {
    console.error('Error exportando ventas:', err);
    alert('Error al exportar ventas: ' + err.message);
  }
}

/**
 * Exporta los movimientos de inventario (Kardex) a un archivo CSV.
 */
export async function exportKardexCSV(desde?: string, hasta?: string) {
  try {
    let url = `${API_V1}/inventario/kardex`;
    const params = [];
    if (desde) params.push(`desde=${desde}`);
    if (hasta) params.push(`hasta=${hasta}`);
    if (params.length) url += `?${params.join('&')}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Error al obtener Kardex');
    const data = await res.json();

    const mapped = data.map((k: any) => ({
      Fecha: new Date(k.creadoAt).toLocaleString('es-MX'),
      SKU: k.producto?.sku || 'N/A',
      Producto: k.producto?.nombre || 'N/A',
      TipoMovimiento: k.tipo,
      Cantidad: Number(k.cantidad).toString(),
      Referencia: k.referencia || '',
      Observacion: k.observacion || '',
      Sucursal: k.sucursal?.nombre || 'N/A',
      Usuario: k.usuario?.nombre || 'N/A'
    }));

    exportToCSV(mapped, `Kardex_Inventario_${desde || 'inicio'}_a_${hasta || 'hoy'}.csv`);
  } catch (err: any) {
    console.error('Error exportando Kardex:', err);
    alert('Error al exportar Kardex: ' + err.message);
  }
}

/**
 * Exporta la lista completa de clientes y sus estados de crédito a CSV.
 */
export async function exportClientesCSV() {
  try {
    const res = await fetch(`${API_V1}/clientes`);
    if (!res.ok) throw new Error('Error al obtener clientes');
    const data = await res.json();

    const mapped = data.map((c: any) => ({
      Nombre: c.nombre,
      Telefono: c.telefono || '',
      Email: c.email || '',
      Direccion: c.direccion || '',
      LimiteCredito: Number(c.limiteCredito).toFixed(2),
      SaldoDeudor: Number(c.saldoDeudor).toFixed(2),
      CreditoDisponible: (Number(c.limiteCredito) - Number(c.saldoDeudor)).toFixed(2),
      RFC: c.rfc || '',
      RazonSocial: c.razonSocial || '',
      RegimenFiscal: c.regimenFiscal || '',
      CodigoPostal: c.codigoPostal || '',
      DireccionFiscal: c.direccionFiscal || ''
    }));

    exportToCSV(mapped, 'Clientes_y_Saldos_Credito.csv');
  } catch (err: any) {
    console.error('Error exportando clientes:', err);
    alert('Error al exportar clientes: ' + err.message);
  }
}

/**
 * Exporta el corte detallado de una caja/turno a CSV.
 */
export async function exportCorteCajaCSV(turnoId: string) {
  try {
    const res = await fetch(`${API_V1}/reportes/corte-caja/${turnoId}`);
    if (!res.ok) throw new Error('Error al obtener corte de caja');
    const data = await res.json();

    const rows = [
      { Concepto: 'Turno ID', Valor: data.turno.id },
      { Concepto: 'Cajero', Valor: data.turno.usuario?.nombre || 'N/A' },
      { Concepto: 'Apertura', Valor: new Date(data.turno.abiertoAt).toLocaleString('es-MX') },
      { Concepto: 'Cierre', Valor: data.turno.cerradoAt ? new Date(data.turno.cerradoAt).toLocaleString('es-MX') : 'Turno Abierto' },
      { Concepto: 'Fondo Inicial', Valor: Number(data.fondoInicial).toFixed(2) },
      { Concepto: 'Total Ventas', Valor: Number(data.totalVentas).toFixed(2) },
      { Concepto: 'Ingresos por Flujo manual', Valor: Number(data.ingresosFlujo).toFixed(2) },
      { Concepto: 'Egresos por Flujo manual', Valor: Number(data.egresosFlujo).toFixed(2) },
      { Concepto: 'Efectivo Teórico en Caja', Valor: Number(data.efectivoTeorico).toFixed(2) },
      { Concepto: 'Efectivo Real Declarado', Valor: data.efectivoDeclarado !== null ? Number(data.efectivoDeclarado).toFixed(2) : 'Sin declarar' },
      { Concepto: 'Diferencia (Sobrante/Faltante)', Valor: data.diferencia !== null ? Number(data.diferencia).toFixed(2) : 'N/A' }
    ];

    exportToCSV(rows, `Corte_Caja_Turno_${turnoId.substring(0, 8)}.csv`);
  } catch (err: any) {
    console.error('Error exportando corte de caja:', err);
    alert('Error al exportar corte de caja: ' + err.message);
  }
}
