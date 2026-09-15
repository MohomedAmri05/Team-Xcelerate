import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import App from './App';
import { AuthProvider } from './features/auth/AuthContext';

import './style.css';

createRoot(
  document.getElementById('root')
).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />

        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#101b2b',
              color: '#ffffff'
            }
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);