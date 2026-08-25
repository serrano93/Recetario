import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';
import './fonts.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Hace que la app abra sin cobertura (en el super, por ejemplo).
// En desarrollo estorba: recargaria codigo viejo mientras editas.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
