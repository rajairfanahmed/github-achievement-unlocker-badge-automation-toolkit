'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Dashboard error boundary:', error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="errorBoundary">
          <h1>Something went wrong</h1>
          <p>{this.state.message}</p>
          <button type="button" className="primaryBtn" onClick={() => window.location.reload()}>
            Reload dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
