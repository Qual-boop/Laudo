"use client";

import { Component, ReactNode, ErrorInfo } from "react";
import { Button } from "@/components/Button";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-md border border-critica/40 bg-critica/10 px-6 py-12 text-center">
          <span aria-hidden="true" className="font-mono text-4xl text-critica">
            ⚠
          </span>
          <h1 className="text-lg font-semibold text-texto">Algo deu errado</h1>
          <p className="max-w-md text-sm text-texto-2">
            {this.state.error?.message ?? "Ocorreu um erro inesperado. Tente recarregar a página."}
          </p>
          <Button variante="primaria" onClick={this.reset}>
            recarregar página
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}