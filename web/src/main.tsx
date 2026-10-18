import { createRoot } from 'react-dom/client';
import '@fontsource/shippori-mincho/latin-800.css';
import '@fontsource/zen-maru-gothic/latin-500.css';
import '@fontsource/zen-maru-gothic/latin-700.css';
import './fonts.css';
import './styles.css';
import App from './App';

createRoot(document.getElementById('root')!).render(<App />);
