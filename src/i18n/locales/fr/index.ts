/**
 * Le catalogue français.
 *
 * Structurellement identique à l'anglais — `DeepPartial<Messages>` le vérifie à
 * la compilation, si bien qu'une clé mal orthographiée est une erreur de build,
 * tandis qu'une clé simplement absente retombe sur l'anglais au lieu d'afficher
 * un chemin de clé à l'écran.
 */

import type { DeepPartial } from '../../types';
import type { Messages } from '../../catalogs';

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

export const fr: DeepPartial<Messages> = {
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
};

export default fr;
