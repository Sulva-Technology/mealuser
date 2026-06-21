import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary';
import './index.css';
import {captureError, initMonitoring} from './utils/monitoring';

initMonitoring();

window.addEventListener('unhandledrejection', event => {
  captureError(event.reason, { source: 'unhandledrejection' });
});

window.addEventListener('error', event => {
  captureError(event.error || event.message, { source: 'window.error' });
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      captureError(err, { source: 'service-worker-registration' });
      console.log('Service Worker registration failed:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
