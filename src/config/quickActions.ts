import {
  Box,
  ShoppingBag,
  Ticket,
  UserPlus,
  Image as ImageIcon,
  CalendarClock,
  Megaphone,
  Coins,
  type LucideIcon,
} from 'lucide-react';

import type { TranslationKey } from '@/i18n';
import type { VendorKind } from '@/lib/vendorKind';

export interface QuickAction {
  id: string;
  /** Translation keys — resolved at render time so the menu follows the locale. */
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: LucideIcon;
  /** Path under `/dashboard/` to navigate to. */
  route: string;
  /**
   * Optional creation intent passed as router state so the destination page can
   * open its existing "create" sheet (e.g. Tickets → CreateTicketSheet).
   */
  intent?: 'create';
}

/**
 * Single source of truth for the "create new" quick actions shown under the
 * "+" control on both desktop (Header) and mobile (MobileTabBar FAB).
 */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'add-product',
    labelKey: 'nav.quickActions.addProduct',
    descriptionKey: 'nav.quickActions.addProductDescription',
    icon: Box,
    route: 'product-upload',
  },
  {
    id: 'create-order',
    labelKey: 'nav.quickActions.createOrder',
    descriptionKey: 'nav.quickActions.createOrderDescription',
    icon: ShoppingBag,
    route: 'orders',
  },
  {
    id: 'add-service',
    labelKey: 'nav.quickActions.addService',
    descriptionKey: 'nav.quickActions.addServiceDescription',
    icon: CalendarClock,
    route: 'services',
    intent: 'create',
  },
  {
    id: 'new-ticket',
    labelKey: 'nav.quickActions.newTicket',
    descriptionKey: 'nav.quickActions.newTicketDescription',
    icon: Ticket,
    route: 'tickets',
    intent: 'create',
  },
  {
    id: 'add-customer',
    labelKey: 'nav.quickActions.addCustomer',
    descriptionKey: 'nav.quickActions.addCustomerDescription',
    icon: UserPlus,
    route: 'customers',
  },
  {
    id: 'upload-media',
    labelKey: 'nav.quickActions.uploadMedia',
    descriptionKey: 'nav.quickActions.uploadMediaDescription',
    icon: ImageIcon,
    route: 'media',
  },
];

/** A service provider's "+" menu: nothing in it opens a seller screen. */
export const PROVIDER_QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'new-listing',
    labelKey: 'nav.quickActions.newListing',
    descriptionKey: 'nav.quickActions.newListingDescription',
    icon: Megaphone,
    route: 'listings/new',
  },
  {
    id: 'buy-credits',
    labelKey: 'nav.quickActions.buyCredits',
    descriptionKey: 'nav.quickActions.buyCreditsDescription',
    icon: Coins,
    route: 'account/billing',
  },
  {
    id: 'new-ticket',
    labelKey: 'nav.quickActions.newTicket',
    descriptionKey: 'nav.quickActions.newTicketDescription',
    icon: Ticket,
    route: 'tickets',
    intent: 'create',
  },
  {
    id: 'upload-photos',
    labelKey: 'nav.quickActions.uploadPhotos',
    descriptionKey: 'nav.quickActions.uploadPhotosDescription',
    icon: ImageIcon,
    route: 'media',
  },
];

export function quickActionsFor(kind: VendorKind): QuickAction[] {
  return kind === 'provider' ? PROVIDER_QUICK_ACTIONS : QUICK_ACTIONS;
}
