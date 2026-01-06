import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-base)] p-4">
          <Card className="max-w-lg w-full shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-[var(--color-error-bg)] flex items-center justify-center mb-4">
                <AlertTriangle className="w-8 h-8 text-[var(--color-error-text)]" />
              </div>
              <CardTitle className="text-xl text-[var(--color-text-primary)]">
                Une erreur est survenue
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-center text-[var(--color-text-secondary)]">
                L'application a rencontré un problème inattendu. Vous pouvez essayer de recharger la page ou revenir à l'accueil.
              </p>

              {process.env.NODE_ENV === "development" && this.state.error && (
                <div className="bg-[var(--color-bg-surface)] rounded-lg p-4 text-sm">
                  <p className="font-mono text-[var(--color-error-text)] mb-2">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="text-xs text-[var(--color-text-tertiary)] overflow-auto max-h-32">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}

              <div className="flex gap-3 justify-center pt-2">
                <Button variant="outline" onClick={this.handleRetry}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Réessayer
                </Button>
                <Button variant="outline" onClick={this.handleGoHome}>
                  <Home className="w-4 h-4 mr-2" />
                  Accueil
                </Button>
                <Button onClick={this.handleReload}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Recharger
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
