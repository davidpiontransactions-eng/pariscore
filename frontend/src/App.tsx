import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { checkHealth } from './api/pariscore';
import PreMatch from './pages/PreMatch';
import Dashboard from './pages/Dashboard';
import H2HPage from './pages/H2HPage';
import MMAPreMatch from './pages/MMAPreMatch';

function App() {
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    checkHealth()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));
  }, []);

  const linkBase: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: 13,
    fontWeight: 600,
    textDecoration: 'none',
    padding: '4px 0',
    borderBottom: '2px solid transparent',
    transition: 'border-color 0.2s, color 0.2s',
  };

  return (
    <BrowserRouter>
      <div className="app-layout">
        <header className="app-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)' }}>
            <h1>
              Pariscore
              <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--color-text-tertiary)', marginLeft: 8 }}>
                Prédiction sportive
              </span>
            </h1>
            <nav style={{ display: 'flex', gap: 'var(--space-md)' }}>
              <NavLink
                to="/"
                end
                style={({ isActive }) => ({
                  ...linkBase,
                  color: isActive ? 'var(--color-accent-green)' : 'var(--color-text-secondary)',
                  borderBottomColor: isActive ? 'var(--color-accent-green)' : 'transparent',
                })}
              >
                🎾 ATP
              </NavLink>
              <NavLink
                to="/mma"
                style={({ isActive }) => ({
                  ...linkBase,
                  color: isActive ? 'var(--color-accent-green)' : 'var(--color-text-secondary)',
                  borderBottomColor: isActive ? 'var(--color-accent-green)' : 'transparent',
                })}
              >
                🥊 UFC
              </NavLink>
              <NavLink
                to="/dashboard"
                style={({ isActive }) => ({
                  ...linkBase,
                  color: isActive ? 'var(--color-accent-green)' : 'var(--color-text-secondary)',
                  borderBottomColor: isActive ? 'var(--color-accent-green)' : 'transparent',
                })}
              >
                Dashboard
              </NavLink>
              <NavLink
                to="/h2h"
                style={({ isActive }) => ({
                  ...linkBase,
                  color: isActive ? 'var(--color-accent-green)' : 'var(--color-text-secondary)',
                  borderBottomColor: isActive ? 'var(--color-accent-green)' : 'transparent',
                })}
              >
                H2H
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-sm">
            <span className={'status-dot ' + (apiOnline === true ? 'online' : 'offline')} />
            <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              API {apiOnline === null ? '...' : apiOnline ? 'connectee' : 'hors ligne'}
            </span>
          </div>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<PreMatch />} />
            <Route path="/mma" element={<MMAPreMatch />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/h2h" element={<H2HPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
