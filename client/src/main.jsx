import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import RegistrarEquipo from './components/RegistrarEquipo';

const root = createRoot(document.getElementById('root'));
if (window.location.pathname.startsWith('/registrar/')) {
	root.render(<RegistrarEquipo />);
} else {
	root.render(<App />);
}
