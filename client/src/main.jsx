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
	console.log('client main: route -> /firmar/ -> rendering Firmar');
	root.render(<Firmar />);
} else if (window.location.pathname.startsWith('/registrar/')) {
	console.log('client main: route -> /registrar/ -> rendering RegistrarEquipo');
	root.render(<RegistrarEquipo />);
} else if (window.location.pathname.startsWith('/login')) {
	console.log('client main: route -> /login -> rendering Login');
	root.render(<Login />);
} else if (window.location.pathname.startsWith('/farmacias')) {
	console.log('client main: route -> /farmacias -> rendering Farmacias');
	root.render(<Farmacias />);
} else if (window.location.pathname.startsWith('/registros-it')) {
	console.log('client main: route -> /registros-it -> rendering RegistrosIT');
	root.render(<RegistrosIT />);
} else if (window.location.pathname.startsWith('/qr-tool')) {
	console.log('client main: route -> /qr-tool -> rendering QrTool');
	root.render(<QrTool />);
} else if (window.location.pathname.startsWith('/inventario')) {
	console.log('client main: route -> /inventario -> rendering InventarioApp');
	root.render(<InventarioApp />);
} else if (window.location.pathname === '/' || window.location.pathname === '/index.html') {
		console.log('client main: route -> / or /index.html -> rendering AppShell + App (SPA)');
		// Render the SPA on the root path so migrated pages (hash routes) are available.
		if (!window.location.hash) window.location.hash = '#dashboard';
		root.render(
			<AppShell>
				<App />
			</AppShell>
		);
} else {

		// Support direct routes that map into the SPA by setting the hash
		const path = window.location.pathname;
		console.log('client main: fallback branch, original path=', path);
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

		console.log('client main: rendering AppShell + App (SPA) with hash=', window.location.hash);
		root.render(
			<AppShell>
				<App />
			</AppShell>
		);
}
