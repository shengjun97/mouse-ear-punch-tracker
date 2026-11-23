import { NavLink } from 'react-router-dom';

/** Section navigation inside an experiment. */
export function ExperimentTabs({ experimentId }: { experimentId: string }) {
  const base = `/e/${experimentId}`;
  const tabs = [
    { to: base, label: 'Patterns', end: true },
    { to: `${base}/legend`, label: 'Legend', end: false },
    { to: `${base}/lookup`, label: 'Lookup', end: false },
    { to: `${base}/animals`, label: 'Animals', end: false },
    { to: `${base}/cages`, label: 'Cages', end: false },
    { to: `${base}/export`, label: 'Export', end: false },
  ];
  return (
    <nav className="tabs" aria-label="Experiment sections">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? 'tab active' : 'tab')}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
