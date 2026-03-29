"use client";

import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production, errors are logged silently (no console.error)
    // Send to error tracking service here if desired
    void error;
    void info;
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message ?? "An unexpected error occurred.";
      return (
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <div className="w-full max-w-md bg-white border border-border rounded-[12px] p-8 shadow-sm text-center">
            <div className="w-10 h-10 rounded-full bg-semantic-danger-bg flex items-center justify-center mx-auto mb-4">
              <span className="text-semantic-danger text-[20px] font-bold">!</span>
            </div>
            <h2 className="text-[18px] font-semibold text-text-primary mb-2">Something went wrong</h2>
            <pre className="text-left bg-surface-raised border border-border-subtle rounded-[8px] p-3 text-[12px] font-mono text-text-secondary overflow-x-auto mb-6 whitespace-pre-wrap break-words">
              {message}
            </pre>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-accent-primary hover:bg-accent-hover text-white text-[13px] font-medium rounded-[6px] transition-colors"
              >
                Retry
              </button>
              <a
                href="/dashboard"
                className="px-4 py-2 bg-surface-raised hover:bg-border-subtle border border-border text-text-secondary text-[13px] font-medium rounded-[6px] transition-colors"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
