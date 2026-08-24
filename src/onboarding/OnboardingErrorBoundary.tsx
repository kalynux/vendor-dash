import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { tStatic } from '@/i18n';

/**
 * The app-wide crash screen.
 *
 * ── Why it has to be able to let go ──────────────────────────────────────────
 *
 * This boundary sits *above* `<Routes>`, so once it catches, it replaces every
 * route at once. Left to itself that is a dead end and not a screen: navigating
 * — including with the Android hardware back button, which goes through the
 * router like any other navigation — changes the URL underneath a component
 * tree that is no longer being rendered, so nothing visibly happens. The only
 * way out is to kill the app from the task switcher, which is the report that
 * produced this comment.
 *
 * So the boundary watches the location and clears itself the moment the route
 * changes. Retry-in-place stays as well, for a failure that was transient, and
 * "Go back" is here because a crash is exactly the moment somebody reaches for
 * back and needs it to work.
 *
 * There is no re-crash loop to worry about: a route that throws deterministically
 * throws again and lands here again — the same as any other broken page — but
 * the way out never stops working.
 */

interface InnerProps {
    children: ReactNode;
    /** Changing this clears a caught error. The current pathname, in practice. */
    resetKey: string;
    onGoBack: () => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundaryView extends Component<InnerProps, State> {
    constructor(props: InnerProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // In production, forward to your error monitoring service here.
        console.error('[AppErrorBoundary]', error, info.componentStack);
    }

    componentDidUpdate(prevProps: InnerProps) {
        // The route moved on. Whatever threw belongs to a screen that is no
        // longer being asked for, so stop showing its wreckage.
        if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ hasError: false, error: null });
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                // `pt-safe`: this replaces the whole app, shell included, so on a
                // device it is the thing under the status bar.
                <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 pt-safe pb-safe text-center">
                    <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-6">
                        <AlertTriangle className="w-8 h-8 text-destructive" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">
                        {tStatic('onboarding.errorBoundary.title')}
                    </h1>
                    <p className="text-muted-foreground mb-8 max-w-sm">
                        {tStatic('onboarding.errorBoundary.description')}
                    </p>
                    <div className="flex w-full max-w-xs flex-col gap-2 sm:w-auto sm:flex-row">
                        <Button onClick={this.handleRetry} className="gap-2">
                            <RefreshCw className="w-4 h-4" />
                            {tStatic('common.actions.retry')}
                        </Button>
                        <Button variant="outline" onClick={this.props.onGoBack} className="gap-2">
                            <ArrowLeft className="w-4 h-4" />
                            {tStatic('common.actions.back')}
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

/**
 * Router-aware wrapper. Only class components can catch, and only function
 * components can use the router hooks, so the two halves are split here rather
 * than threading a location down from `App`.
 */
export function OnboardingErrorBoundary({ children }: { children: ReactNode }) {
    const location = useLocation();
    const navigate = useNavigate();

    const goBack = () => {
        // The router's own depth, not the WebView's — same reasoning as
        // `platform/shell/backButton.ts`. At the root of the stack there is
        // nothing to pop, and a `go(-1)` that leaves the app is worse than
        // landing on the dashboard.
        const idx = (window.history.state as { idx?: unknown } | null)?.idx;
        if (typeof idx === 'number' && idx > 0) navigate(-1);
        else navigate('/dashboard', { replace: true });
    };

    return (
        <ErrorBoundaryView resetKey={location.pathname} onGoBack={goBack}>
            {children}
        </ErrorBoundaryView>
    );
}
