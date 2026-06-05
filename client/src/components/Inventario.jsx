import React, { useState } from 'react';
import Equipos from './Equipos';
import Celulares from './Celulares';
import Ups from './Ups';
import ImportModal from './ImportModal';
import GenerarEnlace from './GenerarEnlace';

export default function Inventario() {
  const [tab, setTab] = useState('equipos');
  const [importOpen, setImportOpen] = useState(false);
  const [importType, setImportType] = useState('equipos');
  const [enlaceOpen, setEnlaceOpen] = useState(false);

  return (
    <div style={{padding:20}}>
      <h2>Inventario</h2>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <button onClick={() => setTab('equipos')} style={{fontWeight:tab==='equipos'?700:400}}>Equipos</button>
        <button onClick={() => setTab('celulares')} style={{fontWeight:tab==='celulares'?700:400}}>Celulares</button>
        <button onClick={() => setTab('ups')} style={{fontWeight:tab==='ups'?700:400}}>UPS</button>
        <div style={{flex:1}} />
        <select value={importType} onChange={e=>setImportType(e.target.value)}>
          <option value="equipos">Equipos</option>
          <option value="celulares">Celulares</option>
          <option value="ups">UPS</option>
        </select>
        <button onClick={() => setImportOpen(true)}>Importar</button>
        <button onClick={() => setEnlaceOpen(true)}>Generar enlace</button>
      </div>

      <div>
        {tab === 'equipos' && <Equipos />}
        {tab === 'celulares' && <Celulares />}
        {tab === 'ups' && <Ups />}
      </div>

      <ImportModal open={importOpen} type={importType} onClose={() => setImportOpen(false)} onImported={() => setImportOpen(false)} />
      <GenerarEnlace open={enlaceOpen} onClose={() => setEnlaceOpen(false)} />
    </div>
  );
}
