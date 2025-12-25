
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { initializeOfflineSync } from './lib/offline-sync';

// Initialize offline sync
initializeOfflineSync();

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('ServiceWorker registration successful:', registration.scope);
      })
      .catch((error) => {
        console.log('ServiceWorker registration failed:', error);
      });
  });
}

// Remove dark mode class addition
createRoot(document.getElementById("root")!).render(<App />);
