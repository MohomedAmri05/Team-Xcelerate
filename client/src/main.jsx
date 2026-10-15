import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import App from './App';
import { AuthProvider } from './features/auth/AuthContext';
import { ConfirmProvider } from './components/ui/ConfirmDialog';
import ToastLimiter from './components/ui/ToastLimiter';

import './style.css';
import './styles/enhancements.css';

createRoot(
  document.getElementById('root')
).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
        <ToastLimiter />
        <Toaster
          position="top-center"
          gutter={10}
          toastOptions={{
            className: 'hs-toast',
            duration: 4500,
            style: {
              background: '#14161b',
              color: '#f5f1e8',
              border: '1px solid #2c2f36',
              borderRadius: '10px',
              padding: '12px 14px'
            },
            success: {
              iconTheme: {
                primary: '#3fbf8a',
                secondary: '#14161b'
              }
            },
            error: {
              duration: 6500,
              iconTheme: {
                primary: '#e5645b',
                secondary: '#14161b'
              }
            }
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);