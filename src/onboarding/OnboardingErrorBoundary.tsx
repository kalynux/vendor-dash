import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { tStatic } from '@/i18n';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class OnboardingErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // In production, forward to your error monitoring service here.
        console.error('[OnboardingErrorBoundary]', error, info.componentStack);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
                    <div className="w-16 h-16 bg-destructive/10 rounded-2xl flex items-center justify-center mb-6">
                        <AlertTriangle className="w-8 h-8 text-destructive" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">
                        {tStatic('onboarding.errorBoundary.title')}
                    </h1>
                    <p className="text-muted-foreground mb-8 max-w-sm">
                        {tStatic('onboarding.errorBoundary.description')}
                    </p>
                    <Button onClick={this.handleRetry} className="gap-2">
                        <RefreshCw className="w-4 h-4" />
                        {tStatic('common.actions.retry')}
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
