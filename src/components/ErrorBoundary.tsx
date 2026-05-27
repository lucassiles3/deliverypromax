import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
  /** Rótulo opcional para identificar a região nos logs. */
  label?: string;
};

type State = { hasError: boolean; error: Error | null };

/**
 * Captura erros de renderização e evita "tela branca".
 * Use no topo do app e em seções críticas (ex: Admin, Kanban, KDS).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <div className="max-w-md space-y-1">
          <h2 className="text-lg font-bold">Algo deu errado</h2>
          <p className="text-sm text-muted-foreground">
            Ocorreu um erro inesperado nesta tela. Tente novamente — seus dados estão seguros.
          </p>
          {this.state.error?.message && (
            <p className="mt-2 break-words rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              {this.state.error.message}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={this.reset}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            <RotateCw className="h-4 w-4" /> Tentar de novo
          </button>
          <button
            onClick={this.reload}
            className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-bold"
          >
            Recarregar página
          </button>
        </div>
      </div>
    );
  }
}
