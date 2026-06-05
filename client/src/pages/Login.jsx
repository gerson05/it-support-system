import React, { useState } from 'react';
import fetchJson from '../utils/fetchJson';

export default function Login() {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await fetchJson('/api/auth/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ user, pass }) });
      window.location.href = '/';
    } catch (e) { alert('Credenciales inválidas'); }
    finally { setLoading(false); }
  }

  return (
    <div style={{minHeight:'100vh',background:'#0f172a',color:'#e2e8f0',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <form onSubmit={submit} style={{background:'#1e293b',padding:24,borderRadius:12,width:360}}>
        <h2 style={{marginBottom:12}}>Iniciar sesión</h2>
        <label style={{color:'#94a3b8'}}>Usuario</label>
        <input value={user} onChange={e=>setUser(e.target.value)} style={{width:'100%',padding:8,marginBottom:8}} />
        <label style={{color:'#94a3b8'}}>Contraseña</label>
        <input type="password" value={pass} onChange={e=>setPass(e.target.value)} style={{width:'100%',padding:8,marginBottom:12}} />
        <button type="submit" disabled={loading} style={{width:'100%',padding:10,background:'#6366f1',color:'#fff',borderRadius:8}}>{loading ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
