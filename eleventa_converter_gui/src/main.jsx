// src/main.jsx
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

function App() {
  const [fdbPath, setFdbPath] = useState(null);
  const [outPath, setOutPath] = useState(null);
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

  const convert = async () => {
    if (!fdbPath || !outPath) {
      setMessage('⚠ Selecciona el archivo .fdb y la carpeta de destino.');
      return;
    }
    setStatus('converting');
    setMessage('');
    setLog('Iniciando extracción completa...\n');
    setSummary(null);
    try {
      const result = await window.electronAPI.runConversion(fdbPath, outPath);
      setLog(result);
      setStatus('success');
      setMessage(`✅ Migración completada: ${outPath}`);
      
      // Try to parse summary from the output JSON
      try {
        const fs = window.electronAPI;
        // Parse the summary from the converter stdout
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
    } catch (err) {
      setStatus('error');
      setMessage(`❌ Error: ${err}`);
      setLog(String(err));
    }
  };

  const outputFolder = outPath ? outPath.replace('/apex_import_eleventa.json', '') : null;

  return (
    <div className="app">
      <div className="header">
        <div className="logo">🔄</div>
        <div>
          <h1>Migración Completa Eleventa → Apex POS</h1>
          <p className="subtitle">Extrae catálogo, ventas históricas e inventario en un solo archivo</p>
        </div>
      </div>

      <div className="card">
        <label className="field-label">1. Base de datos Eleventa (.fdb)</label>
        <div className="row">
          <span className="path-display">{fdbPath || 'Ningún archivo seleccionado'}</span>
          <button className="btn btn-secondary" onClick={pickFdb}>Examinar…</button>
        </div>
      </div>

      <div className="card">
        <label className="field-label">2. Carpeta de destino</label>
        <div className="row">
          <span className="path-display">{outputFolder || 'Ninguna carpeta seleccionada'}</span>
          <button className="btn btn-secondary" onClick={pickOut}>Carpeta…</button>
        </div>
        {outPath && (
          <p className="output-name">
            📄 Se generará: <strong>apex_import_eleventa.json</strong>
          </p>
        )}
      </div>

      {/* What gets extracted */}
      <div className="extraction-info">
        <strong>📦 Datos que se extraen:</strong>
        <div className="extraction-grid">
          <span>✓ Productos</span>
          <span>✓ Clientes + SAT</span>
          <span>✓ Categorías</span>
          <span>✓ Proveedores</span>
          <span>✓ Ventas históricas</span>
          <span>✓ Inventario real</span>
        </div>
      </div>

      <button
        className={`btn btn-primary ${status === 'converting' ? 'loading' : ''}`}
        onClick={convert}
        disabled={status === 'converting' || !fdbPath || !outPath}
      >
        {status === 'converting' ? (
          <><span className="spinner" /> Extrayendo datos…</>
        ) : (
          '🚀 Iniciar Migración Completa'
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
              <tr><td>Proveedores</td><td className="num">{summary.proveedores.toLocaleString()}</td></tr>
              <tr className="highlight"><td>Ventas</td><td className="num">{summary.ventas.toLocaleString()}</td></tr>
              <tr className="highlight"><td>Artículos vendidos</td><td className="num">{summary.articulos.toLocaleString()}</td></tr>
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
        <strong>¿Cómo importar en Apex POS?</strong>
        <ol>
          <li>Abre Apex POS → Panel de Administración → Mantenimiento</li>
          <li>Haz clic en <strong>"Cargar Archivo de Migración Eleventa"</strong></li>
          <li>Selecciona el archivo <strong>apex_import_eleventa.json</strong></li>
          <li>El sistema importará automáticamente todo: catálogo, ventas e inventario</li>
        </ol>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
