/**
 * Background Sync Service
 * Automatically syncs data from server to local Zustand store
 * v2.0 - Added Offline Action Queue Processing
 */
import { useAppStore } from '../store/appStore';
import { useDataCacheStore, OfflineAction } from '../store/useDataCacheStore';
import { 
  carBrandApi, 
  carModelApi, 
  productBrandApi, 
  categoryApi, 
  productApi,
  supplierApi,
  distributorApi,
  orderApi,
  customerApi,
  syncApi,
  cartApi,
  favoriteApi,
  api
} from './api';

class SyncService {
  private syncInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private syncIntervalMs = 60000; // 1 minute
  private wasOffline = false;

  /**
   * Start the background sync service
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[SyncService] Starting background sync service');
    
    // Initial sync
    this.performSync();
    
    // Set up interval
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, this.syncIntervalMs);
  }

  /**
   * Stop the background sync service
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('[SyncService] Stopped background sync service');
  }

  /**
   * Process the offline action queue
   */
  async processOfflineQueue() {
    const cacheStore = useDataCacheStore.getState();
    const queue = cacheStore.offlineActionsQueue;
    
    if (queue.length === 0) {
      console.log('[SyncService] No offline actions to process');
      return;
    }

    if (cacheStore.isProcessingQueue) {
      console.log('[SyncService] Already processing queue, skipping');
      return;
    }

    console.log(`[SyncService] Processing ${queue.length} offline actions...`);
    cacheStore.setProcessingQueue(true);

    // Process actions sequentially
    for (const action of queue) {
      if (action.status === 'processing') continue;
      
      try {
        cacheStore.updateQueueAction(action.id, { status: 'processing' });
        
        // Execute the action based on type
        await this.executeOfflineAction(action);
        
        // Success - remove from queue
        console.log(`[SyncService] Action ${action.id} (${action.type}) completed successfully`);
        cacheStore.removeFromOfflineQueue(action.id);
        
      } catch (error: any) {
        console.error(`[SyncService] Action ${action.id} failed:`, error.message);
        
        const newRetryCount = action.retryCount + 1;
        
        if (newRetryCount >= action.maxRetries) {
          // Max retries reached - mark as failed
          cacheStore.updateQueueAction(action.id, { 
            status: 'failed', 
            retryCount: newRetryCount,
            errorMessage: error.message || 'Unknown error'
          });
          console.log(`[SyncService] Action ${action.id} marked as failed after ${newRetryCount} retries`);
        } else {
          // Update retry count and reset to pending for next attempt
          cacheStore.updateQueueAction(action.id, { 
            status: 'pending', 
            retryCount: newRetryCount,
            errorMessage: error.message
          });
        }
      }
    }

    cacheStore.setProcessingQueue(false);
    console.log('[SyncService] Offline queue processing completed');
  }

  /**
   * Execute a single offline action
   */
  private async executeOfflineAction(action: OfflineAction): Promise<void> {
    switch (action.type) {
      case 'cart_add':
        await cartApi.addItem(action.payload.product_id, action.payload.quantity);
        break;
        
      case 'cart_update':
        await cartApi.updateItem(action.payload.product_id, action.payload.quantity);
        break;
        
      case 'cart_clear':
        await cartApi.clear();
        break;
        
      case 'order_create':
        await orderApi.create(action.payload);
        break;
        
      case 'favorite_toggle':
        await favoriteApi.toggle(action.payload.product_id);
        break;
        
      default:
        // Generic API call for other actions
        const config: any = {
          method: action.method,
          url: action.endpoint,
        };
        
        if (action.payload && ['POST', 'PUT', 'PATCH'].includes(action.method)) {
          config.data = action.payload;
        }
        
        await api(config);
    }
  }

  /**
   * Perform a full data sync
   */
  async performSync() {
    const store = useAppStore.getState();
    const cacheStore = useDataCacheStore.getState();
    
    // Check if online
    if (!store.isOnline) {
      console.log('[SyncService] Offline, skipping sync');
      this.wasOffline = true;
      return;
    }

    // If we were offline and now online, process the queue first
    if (this.wasOffline && store.isOnline) {
      console.log('[SyncService] Connection restored, processing offline queue...');
      this.wasOffline = false;
      await this.processOfflineQueue();
    }

    // Check if already syncing
    if (store.syncStatus === 'syncing') {
      console.log('[SyncService] Already syncing, skipping');
      return;
    }

    store.setSyncStatus('syncing');
    store.setSyncError(null);

    try {
      console.log('[SyncService] Starting sync...');
      
      // Fetch all data in parallel
      const [
        carBrandsRes,
        carModelsRes,
        productBrandsRes,
        categoriesRes,
        productsRes,
      ] = await Promise.all([
        carBrandApi.getAll().catch(() => ({ data: [] })),
        carModelApi.getAll().catch(() => ({ data: [] })),
        productBrandApi.getAll().catch(() => ({ data: [] })),
        categoryApi.getAll().catch(() => ({ data: [] })),
        productApi.getAll({ limit: 1000 }).catch(() => ({ data: { products: [] } })),
      ]);

      // Update store with new data
      store.setCarBrands(carBrandsRes.data || []);
      store.setCarModels(carModelsRes.data || []);
      store.setProductBrands(productBrandsRes.data || []);
      store.setCategories(categoriesRes.data || []);
      store.setProducts(productsRes.data?.products || []);

      // Only fetch privileged data if user has access
      const userRole = store.userRole;
      if (['owner', 'partner'].includes(userRole)) {
        try {
          const [
            suppliersRes,
            distributorsRes,
            ordersRes,
            customersRes,
          ] = await Promise.all([
            supplierApi.getAll().catch(() => ({ data: [] })),
            distributorApi.getAll().catch(() => ({ data: [] })),
            orderApi.getAllAdmin().catch(() => ({ data: { orders: [] } })),
            customerApi.getAll().catch(() => ({ data: { customers: [] } })),
          ]);

          store.setSuppliers(suppliersRes.data || []);
          store.setDistributors(distributorsRes.data || []);
          store.setOrders(ordersRes.data?.orders || []);
          store.setCustomers(customersRes.data?.customers || []);
        } catch (e) {
          console.log('[SyncService] Could not fetch privileged data:', e);
        }
      } else if (['admin', 'subscriber'].includes(userRole)) {
        try {
          const [suppliersRes, distributorsRes] = await Promise.all([
            supplierApi.getAll().catch(() => ({ data: [] })),
            distributorApi.getAll().catch(() => ({ data: [] })),
          ]);
          store.setSuppliers(suppliersRes.data || []);
          store.setDistributors(distributorsRes.data || []);
        } catch (e) {
          console.log('[SyncService] Could not fetch supplier/distributor data:', e);
        }
      }

      store.setSyncStatus('success');
      store.setLastSyncTime(Date.now());
      console.log('[SyncService] Sync completed successfully');

      // Reset to idle after 3 seconds
      setTimeout(() => {
        if (useAppStore.getState().syncStatus === 'success') {
          useAppStore.getState().setSyncStatus('idle');
        }
      }, 3000);

    } catch (error: any) {
      console.error('[SyncService] Sync failed:', error);
      store.setSyncStatus('error');
      store.setSyncError(error.message || 'Sync failed');

      // Add error notification
      store.addNotification({
        id: `sync-error-${Date.now()}`,
        user_id: store.user?.id || 'system',
        title: 'Sync Failed',
        message: `Failed to sync data: ${error.message || 'Unknown error'}`,
        type: 'error',
        read: false,
        created_at: new Date().toISOString(),
      });

      // Reset to idle after 5 seconds
      setTimeout(() => {
        if (useAppStore.getState().syncStatus === 'error') {
          useAppStore.getState().setSyncStatus('idle');
        }
      }, 5000);
    }
  }

  /**
   * Force an immediate sync
   */
  forceSync() {
    return this.performSync();
  }

  /**
   * Force process the offline queue
   */
  forceProcessQueue() {
    return this.processOfflineQueue();
  }

  /**
   * Set the sync interval in milliseconds
   */
  setSyncInterval(ms: number) {
    this.syncIntervalMs = ms;
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Handle network status change
   */
  handleNetworkChange(isOnline: boolean) {
    const cacheStore = useDataCacheStore.getState();
    cacheStore.setOnline(isOnline);
    
    if (isOnline && this.wasOffline) {
      console.log('[SyncService] Network restored, triggering queue processing');
      this.wasOffline = false;
      this.processOfflineQueue().then(() => {
        this.forceSync();
      });
    } else if (!isOnline) {
      this.wasOffline = true;
    }
  }
}

// Singleton instance
export const syncService = new SyncService();

// Hook to use sync service
export const useSyncService = () => {
  return {
    start: () => syncService.start(),
    stop: () => syncService.stop(),
    forceSync: () => syncService.forceSync(),
    forceProcessQueue: () => syncService.forceProcessQueue(),
    setSyncInterval: (ms: number) => syncService.setSyncInterval(ms),
    handleNetworkChange: (isOnline: boolean) => syncService.handleNetworkChange(isOnline),
  };
};

export default syncService;
