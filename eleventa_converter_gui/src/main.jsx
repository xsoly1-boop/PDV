// src/main.jsx
import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

function App() {
  const [fdbPath, setFdbPath] = useState(null);
  const [outPath, setOutPath] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, converting, success, error
  const [message, setMessage] = useState('');

  const pickFdb = async () => {
    const path = await window.electronAPI.selectFdb();
    if (path) setFdbPath(path);
  };

  const pickOut = async () => {
    const path = await window.electronAPI.selectOutput();
    if (path) setOutPath(path);
  };

  const convert = async () => {
    if (!fdbPath || !outPath) {
      setMessage('Selecciona ambos archivos antes de convertir');
      return;
    }
    setStatus('converting');
    setMessage('');
    try {
      const result = await window.electronAPI.runConversion(fdbPath, outPath);
      setStatus('success');
      setMessage('✅ Conversión completada');
    } catch (err) {
      setStatus('error');
      setMessage(`❌ Error: ${err}`);
    }
  };

  return (
    <div>
      <h2>Conversor Eleventa → Apex</h2>
      <p><strong>DB .fdb:</strong> {fdbPath || 'Ninguno'}</p>
      <button onClick={pickFdb}>Seleccionar archivo .fdb</button>
      <p><strong>Salida JSON:</strong> {outPath || 'Ninguno'}</p>
      <button onClick={pickOut}>Seleccionar destino JSON</button>
      <button onClick={convert} disabled={status === 'converting'}>
        {status === 'converting' ? <span className="spinner"/> : 'Convertir'}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
