import React from 'react';
import { createRoot } from 'react-dom/client';
import Home from './page';

window.parent.postMessage({ source: 'zuma-player', type: 'boot', session: new URLSearchParams(location.search).get('session') }, location.origin);

createRoot(document.getElementById('root')!).render(<Home />);
