import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { MoneyVisibilityProvider } from './contexts/MoneyVisibilityContext'
import { SidebarProvider } from './contexts/SidebarContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <SidebarProvider>
          <MoneyVisibilityProvider>
            <App />
          </MoneyVisibilityProvider>
        </SidebarProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

