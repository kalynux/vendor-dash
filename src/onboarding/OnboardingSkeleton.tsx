import { AppLogo } from '@/components/layout/AppLogo';
import { Skeleton } from '@/components/ui/skeleton';

export function OnboardingSkeleton() {
    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header — the brand is known before the session resolves, so it is
                painted for real rather than greyed out. This is the app's first
                frame on a cold load; a placeholder block there would read as a
                blank app. */}
            <div className="h-16 border-b flex items-center justify-between px-4 md:px-8">
                <div className="flex items-center gap-2">
                    <AppLogo className="w-8 h-8" />
                    <span className="font-bold text-sm leading-none">Wi-Mall</span>
                </div>
                <Skeleton className="h-8 w-8 rounded-full" />
            </div>

            <div className="flex-1 flex flex-col items-center px-4 py-8 md:py-12">
                {/* Progress bar */}
                <div className="w-full max-w-lg mb-8">
                    <div className="flex items-center justify-between mb-3">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-12" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                    <div className="flex justify-between mt-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex flex-col items-center gap-1">
                                <Skeleton className="h-8 w-8 rounded-full" />
                                <Skeleton className="h-3 w-16" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Card */}
                <div className="w-full max-w-lg space-y-6">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-3/4" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>

                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-10 w-full rounded-md" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sticky bottom CTA */}
            <div className="border-t px-4 py-4 md:hidden">
                <Skeleton className="h-12 w-full rounded-lg" />
            </div>
        </div>
    );
}
