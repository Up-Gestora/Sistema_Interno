import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { ThemeProvider } from './contexts/ThemeContext'
import { MoneyVisibilityProvider } from './contexts/MoneyVisibilityContext'
import { SidebarProvider } from './contexts/SidebarContext'
import { bootstrapPortSharedStorage } from './services/portSharedStorage'
import {
  hydrateLaminaSnapshotIntoLocalStorage,
  syncLaminaSnapshotToSharedStorage,
} from './services/laminaStorageSnapshot'
import './index.css'

async function renderApp() {
  await bootstrapPortSharedStorage()
  hydrateLaminaSnapshotIntoLocalStorage()
  void syncLaminaSnapshotToSharedStorage()

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
}

void renderApp()
