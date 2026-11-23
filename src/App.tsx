import { useEffect } from 'react';
import { HashRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import { ExperimentListPage } from './pages/ExperimentListPage';
import { ExperimentPage } from './pages/ExperimentPage';
import { PatternEditorPage } from './pages/PatternEditorPage';
import { LegendPage } from './pages/LegendPage';
import { LookupPage } from './pages/LookupPage';
import { AnimalsPage } from './pages/AnimalsPage';
import { CagesPage } from './pages/CagesPage';
import { PrintPage } from './pages/PrintPage';
import { ExportPage } from './pages/ExportPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { SchemeEditorPage } from './pages/SchemeEditorPage';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { OfflineBadge, ThemeToggle, UpdatePrompt } from './components/AppStatus';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    // Braces matter: in newer browsers scrollTo returns a Promise, which React
    // would mistake for an effect clean-up function.
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Hash routing keeps the app working as a static site and offline. */
export default function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <div className="app">
        <header className="app-header">
          <Link to="/" className="app-title">
            <h1>Ear punch tracker</h1>
          </Link>
          <nav className="header-nav" aria-label="Main">
            <OfflineBadge />
            <Link to="/">Experiments</Link>
            <Link to="/templates">Templates</Link>
            <ThemeToggle />
          </nav>
        </header>
        <UpdatePrompt />
        <main className="app-main">
          <ErrorBoundary>
          <Routes>
            <Route path="/" element={<ExperimentListPage />} />
            <Route path="/templates" element={<TemplatesPage />} />
            <Route path="/templates/scheme/:schemeId" element={<SchemeEditorPage />} />
            <Route path="/e/:experimentId" element={<ExperimentPage />} />
            <Route path="/e/:experimentId/legend" element={<LegendPage />} />
            <Route path="/e/:experimentId/lookup" element={<LookupPage />} />
            <Route path="/e/:experimentId/animals" element={<AnimalsPage />} />
            <Route path="/e/:experimentId/cages" element={<CagesPage />} />
            <Route path="/e/:experimentId/export" element={<ExportPage />} />
            <Route path="/e/:experimentId/print/legend" element={<PrintPage kind="legend" />} />
            <Route path="/e/:experimentId/print/cages" element={<PrintPage kind="cages" />} />
            <Route path="/e/:experimentId/print/patterns" element={<PrintPage kind="patterns" />} />
            <Route path="/e/:experimentId/p/:patternId" element={<PatternEditorPage />} />
            <Route path="*" element={<p>Page not found. <Link to="/">Go to experiments</Link></p>} />
          </Routes>
          </ErrorBoundary>
        </main>
      </div>
    </HashRouter>
  );
}
