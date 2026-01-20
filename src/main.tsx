import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { initSentry } from './lib/sentry';
import './index.css';

// Inicializar Sentry antes de renderizar
initSentry();

createRoot(document.getElementById('root')!).render(<App />);
