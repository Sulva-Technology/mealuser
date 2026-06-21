import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Catches render-time crashes so a single broken view doesn't white-screen the app.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  declare props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Hook point for an error reporter (e.g. Sentry) in production
    console.error('Unhandled UI error:', error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const props = this.props as ErrorBoundaryProps;
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50">
          <div className="max-w-sm w-full text-center bg-white rounded-3xl border border-red-100 shadow-sm p-8">
            <div className="w-12 h-12 rounded-full bg-red-100 text-danger flex items-center justify-center mx-auto mb-4 text-2xl">
              !
            </div>
            <h1 className="font-display font-black text-lg text-emerald-strong">Something went wrong</h1>
            <p className="text-xs text-muted-grey mt-2 leading-relaxed">
              The app hit an unexpected error. Your cart and orders are saved. Reload to continue.
            </p>
            <button
              onClick={this.handleReload}
              className="mt-6 w-full py-3 bg-emerald-deep hover:bg-emerald-strong text-white font-bold rounded-2xl text-xs cursor-pointer transition"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return props.children;
  }
}
