import React from 'react';

export default function Home() {
  return (
    <div style={{minHeight:'100vh',background:'#0f172a',color:'#e2e8f0',padding:20,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{maxWidth:900,width:'100%'}}>
        <h1 style={{fontSize:24}}>Panel principal</h1>
        <p style={{color:'#94a3b8'}}>Bienvenido al sistema. Las páginas migradas estarán disponibles desde aquí.</p>
      </div>
    </div>
  );
}
