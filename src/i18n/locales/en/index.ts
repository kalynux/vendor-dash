/**
 * The English catalog — the schema for every other language.
 *
 * One module per feature so a namespace stays reviewable and two people can
 * work on different screens without colliding. The top-level key here is what
 * `t()` calls are prefixed with: `t('orders.title')` lives in `orders.ts`.
 *
 * Adding a namespace: create the module, add it below, and every `t()` call
 * site gets the new keys with autocomplete immediately.
 */

import common from './common';
import errors from './errors';
import nav from './nav';
import onboarding from './onboarding';
import overview from './overview';
import orders from './orders';
import products from './products';
import inventory from './inventory';
import services from './services';
import customers from './customers';
import analytics from './analytics';
import media from './media';
import tickets from './tickets';
import notifications from './notifications';
import transactions from './transactions';
import billing from './billing';
import settings from './settings';
import account from './account';
import agency from './agency';

export const en = {
    common,
    errors,
    nav,
    onboarding,
    overview,
    orders,
    products,
    inventory,
    services,
    customers,
    analytics,
    media,
    tickets,
    notifications,
    transactions,
    billing,
    settings,
    account,
    agency,
} as const;

export default en;
