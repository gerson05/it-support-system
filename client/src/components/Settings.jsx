import React from 'react';

export default function Settings() {
  return (
    <div style={{ padding: 20 }}>
      <div className="page-header">
        <h2>Ajustes</h2>
        <p>Configuración y accesos rápidos del sistema.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Administración
          </div>
          <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => { window.location.hash = '#users'; }}>
            Gestionar usuarios
          </button>
          <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => { window.location.hash = '#roles'; }}>
            Gestionar roles y permisos
          </button>
          <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => { window.location.hash = '#sedes'; }}>
            Gestionar sedes
          </button>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            Sistema
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Versión: <span style={{ color: 'var(--text)' }}>1.0.0</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Base de datos: <span style={{ color: 'var(--success)' }}>SQLite · activa</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Tema: <span style={{ color: 'var(--text)' }}>Oscuro (por defecto)</span>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            WhatsApp
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
            La conexión de WhatsApp se gestiona desde el header superior. Usa el botón <strong style={{ color: 'var(--text)' }}>Conectar</strong> para iniciar sesión con QR.
          </div>
          <button className="btn btn-secondary" style={{ justifyContent: 'flex-start' }} onClick={() => { window.location.hash = '#audit'; }}>
            Ver log de auditoría
          </button>
        </div>
      </div>
    </div>
  );
}
