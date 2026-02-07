import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-screen items-center justify-center p-6">
        <div className="flex max-w-lg flex-col gap-4">
          <h1 className="font-bold text-error text-xl">Something went wrong</h1>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-base-200 p-4 text-sm">
            {error.message}
          </pre>
          <button
            type="button"
            className="btn btn-primary btn-sm self-start"
            onClick={() => this.setState({ error: null })}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
}
