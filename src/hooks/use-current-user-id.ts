import { useContext } from 'react';
import { OnboardingContext } from '@/onboarding/store/onboarding.context';

/**
 * The signed-in person's account id (`users._id`) — NOT the vendor profile id.
 * It is what a ticket stores as `created_by_user_id` and a follower as
 * `user_id`, so "is this mine?" is a comparison against this.
 *
 * `null` until the session has loaded; treat that as "not mine".
 */
export function useCurrentUserId(): string | null {
  const session = useContext(OnboardingContext)?.session;
  if (!session) return null;
  const user = session.user as { _id?: string; id?: string } | undefined;
  return user?._id ?? user?.id ?? session.role_entity?.user_id ?? null;
}
