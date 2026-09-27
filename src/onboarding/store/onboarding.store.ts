// Onboarding/session store barrel — `import { useOnboarding } from
// '@/onboarding/store/onboarding.store'`. The provider component lives in
// `OnboardingProvider.tsx` and the context + hook in `onboarding.context.ts`,
// so the component file exports only components and Fast Refresh keeps working.
export { OnboardingProvider, type OnboardingState } from './OnboardingProvider';
export { useOnboarding } from './onboarding.context';
