import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Replay from './Replay'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {new URLSearchParams(location.search).has('replay') ? <Replay /> : <App />}
  </React.StrictMode>,
)
