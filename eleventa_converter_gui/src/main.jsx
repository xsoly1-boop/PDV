import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

function App() {
  const [migrationType, setMigrationType] = useState('eleventa'); // 'eleventa' | 'sicar'

  // Eleventa States
  const [fdbPath, setFdbPath] = useState(null);
  const [outPath, setOutPath] = useState(null);

  // SICAR States
  const [sicarProductsPath, setSicarProductsPath] = useState(null);
  const [sicarClientsPath, setSicarClientsPath] = useState(null);
  const [sicarOutPath, setSicarOutPath] = useState(null);

  const [status, setStatus] = useState('idle'); // idle, converting, success, error
  const [message, setMessage] = useState('');
  const [log, setLog] = useState('');
  const [summary, setSummary] = useState(null);

  const pickFdb = async () => {
    const path = await window.electronAPI.selectFdb();
    if (path) {
      setFdbPath(path);
      setStatus('idle');
      setMessage('');
      setLog('');
      setSummary(null);
    }
  };

  const pickOut = async () => {
    const path = await window.electronAPI.selectOutput();
    if (path) {
      setOutPath(path);
      setStatus('idle');
      setMessage('');
    }
  };

  const pickSicarProducts = async () => {
    const path = await window.electronAPI.selectExcel('Seleccionar Catálogo de Productos SICAR');
    if (path) {
      setSicarProductsPath(path);
      setStatus('idle');
      setMessage('');
      setLog('');
      setSummary(null);
    }
  };

  const pickSicarClients = async () => {
    const path = await window.electronAPI.selectExcel('Seleccionar Catálogo de Clientes SICAR');
    if (path) {
      setSicarClientsPath(path);
      setStatus('idle');
      setMessage('');
      setLog('');
      setSummary(null);
    }
  };

  const pickSicarOut = async () => {
    const path = await window.electronAPI.selectSicarOutput();
    if (path) {
      setSicarOutPath(path);
      setStatus('idle');
      setMessage('');
    }
  };

  const convert = async () => {
    setStatus('converting');
    setMessage('');
    setLog('Iniciando extracción completa...\n');
    setSummary(null);

    if (migrationType === 'eleventa') {
      if (!fdbPath || !outPath) {
        setMessage('⚠ Selecciona el archivo .fdb y la carpeta de destino.');
        setStatus('idle');
        return;
      }
      try {
        const result = await window.electronAPI.runConversion(fdbPath, outPath);
        setLog(result);
        setStatus('success');
        setMessage(`✅ Migración completada: ${outPath}`);
        parseSummary(result);
      } catch (err) {
        setStatus('error');
        setMessage(`❌ Error: ${err}`);
        setLog(String(err));
      }
    } else {
      if (!sicarProductsPath && !sicarClientsPath) {
        setMessage('⚠ Selecciona al menos un archivo Excel de productos o clientes.');
        setStatus('idle');
        return;
      }
      if (!sicarOutPath) {
        setMessage('⚠ Selecciona la carpeta de destino.');
        setStatus('idle');
        return;
      }
      try {
        const result = await window.electronAPI.runSicarConversion(sicarProductsPath, sicarClientsPath, sicarOutPath);
        setLog(result);
        setStatus('success');
        setMessage(`✅ Migración completada: ${sicarOutPath}`);
        parseSummary(result);
      } catch (err) {
        setStatus('error');
        setMessage(`❌ Error: ${err}`);
        setLog(String(err));
      }
    }
  };

  const parseSummary = (result) => {
    try {
      const lines = result.split('\n');
      const prodLine = lines.find(l => l.includes('Productos:'));
      const clientLine = lines.find(l => l.includes('Clientes:'));
      const catLine = lines.find(l => l.includes('Categorías:'));
      const provLine = lines.find(l => l.includes('Proveedores:'));
      const ventasLine = lines.find(l => l.includes('Ventas:'));
      const artLine = lines.find(l => l.includes('Artículos:'));
      const stockLine = lines.find(l => l.includes('Inventario:'));
      
      const extractNum = (line) => {
        if (!line) return 0;
        const match = line.match(/[\d,]+/);
        return match ? parseInt(match[0].replace(',', '')) : 0;
      };
      
      setSummary({
        productos: extractNum(prodLine),
        clientes: extractNum(clientLine),
        categorias: extractNum(catLine),
        proveedores: extractNum(provLine),
        ventas: extractNum(ventasLine),
        articulos: extractNum(artLine),
        inventario: extractNum(stockLine)
      });
    } catch {}
  };

  const outputFolder = migrationType === 'eleventa' 
    ? (outPath ? outPath.replace('/vante_import_eleventa.json', '') : null)
    : (sicarOutPath ? sicarOutPath.replace('/vante_import_sicar.json', '') : null);

  const importFileName = migrationType === 'eleventa' ? 'vante_import_eleventa.json' : 'vante_import_sicar.json';

  return (
    <div className="app">
      <div className="header">
        <div className="logo">🔄</div>
        <div>
          <h1>Conversor de Base de Datos → Vante POS</h1>
          <p className="subtitle">Migra de forma gráfica catálogos, stock y clientes a tu nuevo sistema</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={() => { setMigrationType('eleventa'); setStatus('idle'); setMessage(''); setLog(''); setSummary(null); }}
          className={`btn ${migrationType === 'eleventa' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '12px' }}
        >
          Eleventa (.fdb)
        </button>
        <button 
          onClick={() => { setMigrationType('sicar'); setStatus('idle'); setMessage(''); setLog(''); setSummary(null); }}
          className={`btn ${migrationType === 'sicar' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ flex: 1, padding: '12px' }}
        >
          SICAR (Excel)
        </button>
      </div>

      {migrationType === 'eleventa' ? (
        <>
          <div className="card">
            <label className="field-label">1. Base de datos Eleventa (.fdb)</label>
            <div className="row">
              <span className="path-display">{fdbPath || 'Ningún archivo seleccionado'}</span>
              <button className="btn btn-secondary" onClick={pickFdb}>Examinar…</button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="card">
            <label className="field-label">1. Catálogo de Productos SICAR (Excel)</label>
            <div className="row">
              <span className="path-display">{sicarProductsPath || 'Ningún archivo seleccionado'}</span>
              <button className="btn btn-secondary" onClick={pickSicarProducts}>Examinar…</button>
            </div>
          </div>

          <div className="card">
            <label className="field-label">2. Catálogo de Clientes / Créditos SICAR (Excel)</label>
            <div className="row">
              <span className="path-display">{sicarClientsPath || 'Ningún archivo seleccionado'}</span>
              <button className="btn btn-secondary" onClick={pickSicarClients}>Examinar…</button>
            </div>
          </div>
        </>
      )}

      <div className="card">
        <label className="field-label">{migrationType === 'eleventa' ? '2' : '3'}. Carpeta de destino</label>
        <div className="row">
          <span className="path-display">{outputFolder || 'Ninguna carpeta seleccionada'}</span>
          <button className="btn btn-secondary" onClick={migrationType === 'eleventa' ? pickOut : pickSicarOut}>Carpeta…</button>
        </div>
        {outputFolder && (
          <p className="output-name">
            📄 Se generará: <strong>{importFileName}</strong>
          </p>
        )}
      </div>

      {/* What gets extracted */}
      <div className="extraction-info">
        <strong>📦 Datos que se extraerán:</strong>
        <div className="extraction-grid">
          <span>✓ Productos / Catálogo</span>
          <span>✓ Clientes / Adeudos</span>
          <span>✓ Categorías</span>
          {migrationType === 'eleventa' && <span>✓ Proveedores</span>}
          {migrationType === 'eleventa' && <span>✓ Ventas históricas</span>}
          <span>✓ Inventario real</span>
        </div>
      </div>

      <button
        className={`btn btn-primary ${status === 'converting' ? 'loading' : ''}`}
        onClick={convert}
        disabled={status === 'converting' || (migrationType === 'eleventa' ? (!fdbPath || !outPath) : ((!sicarProductsPath && !sicarClientsPath) || !sicarOutPath))}
      >
        {status === 'converting' ? (
          <><span className="spinner" /> Convirtiendo datos…</>
        ) : (
          '🚀 Iniciar Conversión y Migración'
        )}
      </button>

      {message && (
        <div className={`message ${status}`}>
          {message}
        </div>
      )}

      {/* Summary table */}
      {summary && (
        <div className="summary-card">
          <strong>📊 Resumen de Extracción</strong>
          <table className="summary-table">
            <tbody>
              <tr><td>Productos</td><td className="num">{summary.productos.toLocaleString()}</td></tr>
              <tr><td>Clientes</td><td className="num">{summary.clientes.toLocaleString()}</td></tr>
              <tr><td>Categorías</td><td className="num">{summary.categorias.toLocaleString()}</td></tr>
              {migrationType === 'eleventa' && <tr><td>Proveedores</td><td className="num">{summary.proveedores.toLocaleString()}</td></tr>}
              {migrationType === 'eleventa' && <tr className="highlight"><td>Ventas</td><td className="num">{summary.ventas.toLocaleString()}</td></tr>}
              {migrationType === 'eleventa' && <tr className="highlight"><td>Artículos vendidos</td><td className="num">{summary.articulos.toLocaleString()}</td></tr>}
              <tr><td>Registros de inventario</td><td className="num">{summary.inventario.toLocaleString()}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Log output */}
      {log && (
        <div className="log-area">
          <pre>{log}</pre>
        </div>
      )}

      <div className="instructions">
        <strong>¿Cómo importar en Vante POS?</strong>
        <ol>
          <li>Abre Vante POS → Panel de Administración → Mantenimiento</li>
          <li>Haz clic en <strong>{migrationType === 'eleventa' ? '"Cargar Archivo de Migración Eleventa"' : '"Cargar Archivo de Migración Eleventa"'}</strong></li>
          <li>Selecciona el archivo <strong>{importFileName}</strong></li>
          <li>El sistema importará automáticamente todo: catálogo, ventas e inventario</li>
        </ol>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
