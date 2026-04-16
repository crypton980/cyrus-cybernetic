import { Component, ReactNode, ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  pageName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary] Uncaught error in ${this.props.pageName || "component"}:`, error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full bg-black text-white p-8 gap-6">
          <div className="w-16 h-16 bg-red-500/20 rounded-2xl flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <div className="text-center max-w-md">
            <h2 className="text-xl font-bold mb-2">
              {this.props.pageName ? `${this.props.pageName} Error` : "Module Error"}
            </h2>
            <p className="text-[rgba(235,235,245,0.5)] text-sm mb-1">
              This module encountered an unexpected error and could not render.
            </p>
            {this.state.error && (
              <p className="text-red-400 text-xs font-mono mt-2 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#2c2c2e] hover:bg-[#3c3c3e] border border-[rgba(84,84,88,0.65)] rounded-xl text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
