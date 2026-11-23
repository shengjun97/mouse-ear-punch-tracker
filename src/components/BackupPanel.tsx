import { useEffect, useRef, useState } from 'react';
import { requestPersistentStorage, storageStatus } from './AppStatus';
import { repo } from '../db/repo';
import { BackupError, backupSummary, makeBackup, parseBackup, type Backup } from '../export/backup';
import { downloadText, today } from '../export/download';

/** Full backup to a JSON file and restore from one. Files stay on this device. */
export function BackupPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ name: string; backup: Backup } | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [storage, setStorage] = useState<Awaited<ReturnType<typeof storageStatus>>>({});
  useEffect(() => {
    void storageStatus().then(setStorage);
  }, [message]);

  const pick = async (file: File | undefined) => {
    setMessage('');
    setError('');
    setPending(null);
    if (!file) return;
    try {
      setPending({ name: file.name, backup: parseBackup(await file.text()) });
    } catch (e) {
      setError(e instanceof BackupError ? e.message : 'Could not read this file.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const restore = async () => {
    if (!pending) return;
    if (mode === 'replace' && !window.confirm('Replace ALL data on this device with this backup? Data not in the backup will be lost.')) return;
    try {
      const r = await repo.importBackup(pending.backup, mode);
      setMessage(
        mode === 'replace'
          ? `Restored ${r.added} records from ${pending.name}.`
          : `Added ${r.added} records from ${pending.name}${r.skipped ? `; ${r.skipped} already on this device were kept as they are` : ''}.`,
      );
      setPending(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <section className="panel stack" aria-labelledby="backup-h">
      <h2 id="backup-h">Backup and restore</h2>
      <p className="hint" style={{ margin: 0 }}>
        Your data lives only in this browser. Download a backup regularly, and use it to move data to another device.
      </p>
      <p className="hint" style={{ margin: 0 }}>
        {storage.persisted === true
          ? 'This browser has agreed to keep your data (persistent storage).'
          : storage.persisted === false
            ? 'This browser may clear the data if the device runs low on space. Keep backups, or ask it to keep the data.'
            : ''}
        {storage.usage !== undefined ? ` Using ${(storage.usage / 1024 / 1024).toFixed(1)} MB.` : ''}
        {storage.persisted === false && (
          <>
            {' '}
            <button
              type="button"
              className="link-button"
              onClick={async () => {
                const ok = await requestPersistentStorage();
                setMessage(ok ? 'The browser will keep your data.' : 'The browser did not agree this time. Installing the app usually helps.');
              }}
            >
              Ask to keep my data
            </button>
          </>
        )}
      </p>
      <div className="row-actions">
        <button
          type="button"
          className="primary"
          onClick={async () => {
            const data = await repo.exportAll();
            downloadText(JSON.stringify(makeBackup(data), null, 1), `ear-punch-backup_${today()}.json`, 'application/json');
            setError('');
            setMessage(`Backup saved: ${backupSummary(data)}.`);
          }}
        >
          Download full backup
        </button>
        <label className="button-link">
          Restore from file…
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
        </label>
      </div>

      {pending && (
        <div className="stack restore-box">
          <p style={{ margin: 0 }}>
            <strong>{pending.name}</strong>: {backupSummary(pending.backup)}, exported {pending.backup.exportedAt.slice(0, 10)}.
          </p>
          <fieldset className="radio-row">
            <legend>How to restore</legend>
            <label>
              <input type="radio" name="restore-mode" checked={mode === 'merge'} onChange={() => setMode('merge')} />
              Add to what's here (keep existing)
            </label>
            <label>
              <input type="radio" name="restore-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />
              Replace everything on this device
            </label>
          </fieldset>
          <div className="row-actions">
            <button type="button" className={mode === 'replace' ? 'danger' : 'primary'} onClick={() => void restore()}>
              {mode === 'replace' ? 'Replace all data' : 'Add from backup'}
            </button>
            <button type="button" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className="saved-note" role="status" style={{ margin: 0 }}>
          {message}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
