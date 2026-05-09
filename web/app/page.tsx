import Dashboard from './dashboard';
import { ErrorBoundary } from './ErrorBoundary';

export default function Page() {
  return (
    <ErrorBoundary>
      <Dashboard />
    </ErrorBoundary>
  );
}
