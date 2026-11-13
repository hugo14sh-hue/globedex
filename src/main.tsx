import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';
import { ThemeProvider } from './theme/ThemeProvider';
import { SessionProvider } from './lib/session';
import { FeedbackProvider } from './components/Feedback';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <FeedbackProvider>
          <SessionProvider>
            <App />
          </SessionProvider>
        </FeedbackProvider>
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
