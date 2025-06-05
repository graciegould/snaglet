import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// import './index.css' // Commented out, assuming styles will be managed by main.scss
import './scss/main.scss' // Import global SCSS styles
import App from './App'

const rootElement = document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
} else {
  console.error("Failed to find the root element with ID 'root'.");
} 