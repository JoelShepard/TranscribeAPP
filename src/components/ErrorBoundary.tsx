import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Unhandled React error:', error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  override render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[var(--md-sys-color-surface)] text-[var(--md-sys-color-on-surface)] flex items-center justify-center px-6">
          <div className="w-full max-w-lg rounded-[30px] border border-[color:var(--md-sys-color-outline)]/35 bg-[var(--md-sys-color-surface-container)] p-8 shadow-[0_10px_28px_rgba(22,27,45,0.12)] text-center">
            <h1 className="text-2xl font-extrabold tracking-tight">Something went wrong</h1>
            <p className="mt-3 text-sm text-[var(--md-sys-color-on-surface-variant)]">
              An unexpected UI error occurred. Reload the app to recover.
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-6 inline-flex items-center justify-center rounded-2xl bg-[var(--md-sys-color-primary)] px-5 py-2.5 font-semibold text-[var(--md-sys-color-on-primary)] hover:opacity-90"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
