import React, { useState } from 'react';

export default function QrTool() {
  const [text, setText] = useState('');
  return (
    <div style={{padding:20}}>
      <h2>QR Tool</h2>
      <p>Herramienta básica para crear enlaces QR.</p>
      <textarea value={text} onChange={e=>setText(e.target.value)} style={{width:'100%',height:120}} />
      <div style={{marginTop:8}}><button onClick={()=>alert('Generar QR: '+text)}>Generar QR</button></div>
    </div>
  );
}
