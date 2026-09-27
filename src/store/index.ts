// Global store barrel — `import { useXxxStore, StoreProvider } from '@/store'`.
// The provider lives in its own file so Fast Refresh sees a components-only module.
export { StoreProvider } from './StoreProvider';
export {
  useUIStore, useStoreStore, useProductStore, useOrderStore,
  useNotificationStore, useAnalyticsStore,
} from './contexts';
