import React,{Suspense} from 'react';
import ReactDOM from 'react-dom/client';
import GameEntry from './GameEntry';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Suspense fallback={<main className="mode-picker"><h1>Loading game…</h1></main>}><GameEntry/></Suspense></React.StrictMode>);
