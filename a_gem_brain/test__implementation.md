Vendor Onboarding Upgrade — Adopting the Agency-Dash Pattern
Port the robust, production-grade onboarding architecture from agency-dash into vendor-dash. The agency-dash implementation has matured through multiple iterations and includes features the vendor-dash currently lacks: per-step API endpoints, draft form caching, back-navigation with viewingStep, clickable stepper, per-step submit functions with optimistic concurrency, and a polished card-based UI.

User Review Required
IMPORTANT

Backend API design decision: The agency-dash uses per-step PUT endpoints (/agency/onboarding/logistics, /agency/onboarding/payout, etc.) while the vendor-dash currently uses a single generic PATCH (/vendor/onboarding/step). The plan below assumes we keep the vendor's existing single-PATCH backend (since we're only changing the frontend), but wraps it with per-step submit functions (submitBasicSetup, submitDeliveryLinking, submitBranding) in the store for type safety. If you plan to refactor the vendor backend to per-step endpoints, let me know and I'll adjust the service layer accordingly.

IMPORTANT

Step 2 (Delivery Linking) is optional per recent changes: Conversation b247d036 indicates that Step 2 should be skippable for service-only vendors. The plan includes a skip flag for Step 2, mirroring how Step 3 (Branding) already supports skipping. Please confirm this is still the desired behavior.

Open Questions
IMPORTANT

Optimistic concurrency for vendor: Agency-dash sends updated_at with each step submission for OCC. Should we add this to the vendor payloads as well, or does the vendor backend not support it yet?
constants/ directory: Vendor-dash does not have a constants/ folder (the agency-dash has onboarding-steps.ts and locations.json there). Should we create one for the vendor?
Proposed Changes
The changes are grouped by component in dependency order.

1. Types (src/types/api.ts)
[MODIFY] 
api.ts
Add missing features from the agency-dash ApiError class and refine types:

Add isConcurrentModification getter to ApiError (code: VENDOR_ONBOARDING_CONCURRENT_MODIFICATION)
Add isAlreadyCompleted getter to ApiError (code: VENDOR_ONBOARDING_ALREADY_COMPLETED)
Add updated_at?: string field to VendorRoleEntity (for optimistic concurrency)
Add message?: string field to OnboardingStepResponse
Update Step2Payload to include optional skip?: boolean flag
Refine DeliveryAgency interface with stronger typing (region, coverage_areas as string[])
2. Zod Schemas (src/onboarding/schemas/onboarding.schemas.ts)
[MODIFY] 
onboarding.schemas.ts
No schema changes required — the existing schemas are correct for the vendor domain. The agency schemas are different because they validate agency-specific fields (logistics, policies). Vendor schemas for Step 1, 2, 3 are already well-defined.

3. Onboarding Service (src/services/onboarding.service.ts)
[MODIFY] 
onboarding.service.ts
Wrap the single submitStep call with per-step service methods for clarity and type narrowing:

diff
+   submitBasicSetup(payload: Step1Payload): Promise<OnboardingStepResponse>
+   submitDeliveryLinking(payload: Step2Payload): Promise<OnboardingStepResponse>
+   submitBranding(payload: Step3Payload): Promise<OnboardingStepResponse>
These all call the same api.patch('/vendor/onboarding/step', payload) underneath but provide typed entry points.

4. Onboarding Store (src/onboarding/store/onboarding.store.tsx)
[MODIFY] 
onboarding.store.tsx
This is the largest change. Port the following patterns from agency-dash:

Feature	Vendor (current)	Agency (target)	Change
Submit model	Single submitStep(payload)	Per-step: submitBasicSetup, submitDeliveryLinking, submitBranding	Refactor
Draft cache	❌ None	StepDrafts object saved before API call	Add
viewingStep	❌ None	Tracks which step user is viewing (can differ from currentStep)	Add
goBack()	❌ None	Navigates to previous step	Add
saveDraft()	❌ None	Saves form values before API call	Add
handleStepResponse	Inline in submitStep	Shared helper with sequential navigation logic	Add
stepToRoute	Private, not exported	Exported for use in Layout stepper	Export
Session update	Direct spread	Maps updatedAt → updated_at explicitly	Add
Logout	Clears session only	Also clears drafts	Add
Specific changes:

Add StepDrafts interface with basicSetup, deliveryLinking, branding slots
Add viewingStep state
Add saveDraft() overloaded function
Add handleStepResponse() shared callback (sequential navigation)
Replace submitStep with submitBasicSetup, submitDeliveryLinking, submitBranding
Add goBack() navigation
Export stepToRoute for use in the Layout's clickable stepper
Update OnboardingState interface to expose all new fields
5. Onboarding Layout (src/onboarding/OnboardingLayout.tsx)
[MODIFY] 
OnboardingLayout.tsx
Port the clickable horizontal stepper from agency-dash:

Feature	Vendor (current)	Agency (target)
Stepper style	Linear progress bar + step dots (non-clickable)	Clickable step nodes with animated connector lines
viewingStepOverride	❌ Not supported	Prop to override displayed step
selectTriggerClass	❌ Not exported	Exported helper for consistent Select styling
Step node interaction	Static	Clickable completed/unlocked steps, locked future steps
Card wrapper	❌ Children rendered raw	Wrapped in bg-white rounded-2xl border shadow-sm card
Header styling	Basic	Enhanced with shadow, dark mode colors
Changes:

Replace StepProgress with the agency's clickable version using stepToRoute + useNavigate
Add viewingStepOverride prop to OnboardingLayoutProps
Export selectTriggerClass helper
Wrap {children} in the white card container
Update header with agency-dash's polished styling
6. Onboarding Router (src/onboarding/OnboardingRouter.tsx)
[MODIFY] 
OnboardingRouter.tsx
Port the back-navigation-aware routing from agency-dash:

Feature	Vendor (current)	Agency (target)
StepGuard	Strict equality: currentStep !== allowed	Range-based: minRequired > currentStep
useEffect navigation	Forces URL sync on step change	❌ Removed — URL is authoritative
Back navigation	❌ Not supported	User can visit any step ≤ currentStep
Changes:

Change StepGuard from allowed (exact match) to minRequired (range guard)
Remove the useEffect that forces URL sync — this causes bugs during back-navigation
Update index route to use stepPath for redirection
Support Step 2 skip route if applicable
7. Step Components
[MODIFY] 
Step1BasicSetup.tsx
Port the agency-dash UI patterns:

Use submitBasicSetup instead of generic submitStep
Add saveDraft(1, values) before submission
Pre-populate form from drafts.basicSetup ?? session.role_entity
Add viewingStepOverride={1} to OnboardingLayout
Upgrade to card-based UI with FieldRow, IconInput components from agency-dash
Add concurrent modification error handling
Wrap CTA in px-6 pb-6 pt-2 styled slot matching agency-dash
[MODIFY] 
Step2DeliveryLinking.tsx
Use submitDeliveryLinking instead of generic submitStep
Add viewingStepOverride={2} to OnboardingLayout
Add Back button (using goBack() from store)
Add optional skip functionality for service-only vendors
Pre-populate selectedId from session.role_entity.default_delivery_agency_id
Upgrade card UI to match agency-dash visual style
[MODIFY] 
Step3Branding.tsx
Use submitBranding instead of generic submitStep
Add saveDraft(3, values) before submission
Pre-populate form from drafts.branding ?? session.role_entity
Add viewingStepOverride={3} to OnboardingLayout
Add Back button (using goBack() from store)
Upgrade to card-based UI with agency-dash styling (rounded-xl borders, section headers)
Move CTA to px-6 pb-6 pt-2 flex layout with Back + Save
8. Onboarding Guard (src/onboarding/OnboardingGuard.tsx)
[MODIFY] 
OnboardingGuard.tsx
Minor update: add the auth:logout event listener (already present in agency-dash) to handle forced logout from the API client on terminal refresh failure.

9. No changes needed
OnboardingErrorBoundary.tsx — Already identical between both projects ✅
OnboardingSkeleton.tsx — Already identical ✅
App.tsx — Already wired correctly ✅
src/services/api.ts — Already identical ✅
src/services/auth.service.ts — Already identical ✅
Summary of New Capabilities After Implementation
Capability	Before	After
Per-step typed submit functions	❌	✅
Draft form caching (survives navigation)	❌	✅
Back button navigation	❌	✅
Clickable stepper (jump to completed steps)	❌	✅
viewingStep tracking	❌	✅
Card-based UI with section headers	❌	✅
Concurrent modification error handling	❌	✅
Step 2 skip support (service-only vendors)	❌	✅
Consistent select dropdown styling	❌	✅
Form pre-population on back-navigation	❌	✅
Verification Plan
Automated Tests
Run npm run build in vendor-dash to ensure no TypeScript compilation errors
Verify no ESLint errors with npm run lint
Manual Verification
Start dev server with npm run dev
Walk through complete onboarding flow (Step 1 → 2 → 3)
Test back-navigation via Back button and clickable stepper
Test Step 3 skip functionality
Test Step 2 skip functionality
Verify form pre-population when navigating back to a completed step
Test error states (API errors, validation errors)
Test responsive behavior (mobile sticky CTA, desktop inline CTA)