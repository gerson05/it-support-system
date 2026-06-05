import React, { useState } from 'react';
import Equipos from './Equipos';
import Celulares from './Celulares';
import Ups from './Ups';

export default function Inventario() {
  const [tab, setTab] = useState('equipos');
  return (
    <div style={{padding:20}}>
      <h2>Inventario</h2>
      <div style={{display:'flex',gap:8,marginBottom:12}}>
        <button onClick={() => setTab('equipos')} style={{fontWeight:tab==='equipos'?700:400}}>Equipos</button>
        <button onClick={() => setTab('celulares')} style={{fontWeight:tab==='celulares'?700:400}}>Celulares</button>
        <button onClick={() => setTab('ups')} style={{fontWeight:tab==='ups'?700:400}}>UPS</button>
      </div>

      <div>
        {tab === 'equipos' && <Equipos />}
        {tab === 'celulares' && <Celulares />}
        {tab === 'ups' && <Ups />}
      </div>
    </div>
  );
}
