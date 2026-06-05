import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import RegistrarEquipo from './components/RegistrarEquipo';
import Firmar from './components/Firmar';
import Home from './pages/Home';
import Login from './pages/Login';
import Farmacias from './pages/Farmacias';
import RegistrosIT from './pages/RegistrosIT';
import QrTool from './pages/QrTool';

const root = createRoot(document.getElementById('root'));
if (window.location.pathname.startsWith('/firmar/')) {
	root.render(<Firmar />);
} else if (window.location.pathname.startsWith('/registrar/')) {
	root.render(<RegistrarEquipo />);
} else if (window.location.pathname.startsWith('/login')) {
	root.render(<Login />);
} else if (window.location.pathname.startsWith('/farmacias')) {
	root.render(<Farmacias />);
} else if (window.location.pathname.startsWith('/registros-it')) {
	root.render(<RegistrosIT />);
} else if (window.location.pathname.startsWith('/qr-tool')) {
	root.render(<QrTool />);
} else if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
	root.render(<Home />);
} else {
	root.render(<App />);
}
