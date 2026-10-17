import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Multiplayer from './Multiplayer'
import TrialLab from './TrialLab'
import Demo from './Demo'
import Replay from './Replay'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {new URLSearchParams(location.search).has('multiplayer') ? <Multiplayer /> : new URLSearchParams(location.search).has('lab') ? <TrialLab /> : new URLSearchParams(location.search).has('demo') ? <Demo /> : new URLSearchParams(location.search).has('replay') ? <Replay /> : <App />}
  </React.StrictMode>,
)
