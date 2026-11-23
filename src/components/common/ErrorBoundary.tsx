import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Shows a recoverable message instead of a blank page. Saved data is unaffected. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="panel stack" role="alert">
        <h2>Something went wrong on this screen</h2>
        <p>Your saved data is still on this device. Reload to continue.</p>
        <pre className="hint">{this.state.error.message}</pre>
        <div className="row-actions">
          <button type="button" className="primary" onClick={() => window.location.reload()}>
            Reload
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/';
              window.location.reload();
            }}
          >
            Go to experiments
          </button>
        </div>
      </div>
    );
  }
}
