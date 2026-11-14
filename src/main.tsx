import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles.css';
import { prepareLanguage, ThemeProvider } from './theme/ThemeProvider';
import { SessionProvider } from './lib/session';
import { FeedbackProvider } from './components/Feedback';
import { VaultProvider } from './lib/vault';
import App from './App';
// Rätt språk från start: den engelska filen hämtas innan första renderingen när engelska gäller.
void prepareLanguage().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ThemeProvider>
        <BrowserRouter>
          <FeedbackProvider>
            <SessionProvider>
              <VaultProvider>
                <App />
              </VaultProvider>
            </SessionProvider>
          </FeedbackProvider>
        </BrowserRouter>
      </ThemeProvider>
    </StrictMode>,
  ),
);
