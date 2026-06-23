import {
  Box,
  ShoppingBag,
  Ticket,
  UserPlus,
  Image as ImageIcon,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react';

export type QuickActionRoute =
  | 'product-upload'
  | 'orders'
  | 'tickets'
  | 'customers'
  | 'media'
  | 'services';

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Legacy route name to navigate to. */
  route: QuickActionRoute;
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
    label: 'Add Product',
    description: 'Create a new listing',
    icon: Box,
    route: 'product-upload',
  },
  {
    id: 'create-order',
    label: 'Create Order',
    description: 'Draft an order for a customer',
    icon: ShoppingBag,
    route: 'orders',
  },
  {
    id: 'add-service',
    label: 'Add Service',
    description: 'Create a bookable service',
    icon: CalendarClock,
    route: 'services',
    intent: 'create',
  },
  {
    id: 'new-ticket',
    label: 'New Ticket',
    description: 'Get help from the team',
    icon: Ticket,
    route: 'tickets',
    intent: 'create',
  },
  {
    id: 'add-customer',
    label: 'Add Customer',
    description: 'Save a new contact',
    icon: UserPlus,
    route: 'customers',
  },
  {
    id: 'upload-media',
    label: 'Upload Media',
    description: 'Add product photos or banners',
    icon: ImageIcon,
    route: 'media',
  },
];
