import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AppShell from './components/AppShell';
import './styles.css';
import RegistrarEquipo from './components/RegistrarEquipo';
import Firmar from './components/Firmar';
import Home from './pages/Home';
import Login from './pages/Login';
import Farmacias from './pages/Farmacias';
import RegistrosIT from './pages/RegistrosIT';
import QrTool from './pages/QrTool';
import InventarioApp from './components/InventarioApp';

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
} else if (window.location.pathname.startsWith('/inventario')) {
	root.render(<InventarioApp />);
} else if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
	root.render(<Home />);
} else {

		// Support direct routes that map into the SPA by setting the hash
		const path = window.location.pathname;
		if (path === '/tickets') window.location.hash = '#tickets';
		if (path === '/tech-requests') window.location.hash = '#tech-requests';
		if (path === '/dashboard') window.location.hash = '#dashboard';
		if (path === '/despacho') window.location.hash = '#despacho';
		if (path === '/users') window.location.hash = '#users';
		if (path === '/settings') window.location.hash = '#settings';
		if (path === '/sedes') window.location.hash = '#sedes';
		if (path === '/faqs') window.location.hash = '#faqs';
		if (path === '/audit') window.location.hash = '#audit';

		// Routes with ids
		const ticketMatch = path.match(/^\/ticket\/(\d+)/);
		if (ticketMatch) window.location.hash = `#ticket/${ticketMatch[1]}`;
		const techReqMatch = path.match(/^\/tech-request\/(\d+)/);
		if (techReqMatch) window.location.hash = `#tech-request/${techReqMatch[1]}`;

		root.render(
			<AppShell>
				<App />
			</AppShell>
		);
}
