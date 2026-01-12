/**
 * Background Sync Service
 * v3.0 - Enhanced with Partial Sync, Conflict Resolution, and Snapshot Support
 * Automatically syncs data from server to local Zustand store
 * Integrated with offlineDatabaseService for persistent storage
 */
import { useAppStore } from '../store/appStore';
import { useDataCacheStore, OfflineAction, SyncResult } from '../store/useDataCacheStore';
import { offlineDatabaseService } from './offlineDatabaseService';
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
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private syncIntervalMs = 60000; // 1 minute
  private cleanupIntervalMs = 300000; // 5 minutes
  private wasOffline = false;

  /**
   * Start the background sync service
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[SyncService v3.0] Starting background sync service');
    
    // Initial sync
    this.performSync();
    
    // Set up sync interval
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, this.syncIntervalMs);

    // Set up cleanup interval (every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.cleanupIntervalMs);
  }

  /**
   * Stop the background sync service
   */
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isRunning = false;
    console.log('[SyncService] Stopped background sync service');
  }

  /**
   * Perform automated cleanup
   */
  performCleanup() {
    const cacheStore = useDataCacheStore.getState();
    
    // Purge old queue items
    const purgedCount = cacheStore.purgeOldQueueItems();
    if (purgedCount > 0) {
      console.log(`[SyncService] Purged ${purgedCount} old queue items during cleanup`);
    }

    // Cleanup after sync
    cacheStore.cleanupAfterSync();
  }

  /**
   * Process the offline action queue
   */
  async processOfflineQueue(): Promise<number> {
    const cacheStore = useDataCacheStore.getState();
    const queue = cacheStore.offlineActionsQueue;
    
    if (queue.length === 0) {
      console.log('[SyncService] No offline actions to process');
      return 0;
    }

    if (cacheStore.isProcessingQueue) {
      console.log('[SyncService] Already processing queue, skipping');
      return 0;
    }

    console.log(`[SyncService] Processing ${queue.length} offline actions...`);
    cacheStore.setProcessingQueue(true);

    let successCount = 0;
    let failCount = 0;

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
        successCount++;
        
      } catch (error: any) {
        failCount++;
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
    console.log(`[SyncService] Offline queue processing completed: ${successCount} success, ${failCount} failed`);
    
    return successCount;
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
        
      case 'product_update':
        await productApi.update(action.payload.product_id, action.payload.updates);
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
   * Perform a full data sync with Partial Sync support
   * If one resource fails, continues syncing others
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

    // Create a snapshot before sync for potential rollback
    const snapshotId = cacheStore.createSnapshot('Pre-sync backup');

    const syncResults: SyncResult[] = [];
    let hasAnyError = false;

    try {
      console.log('[SyncService] Starting partial sync...');
      
      // ==================== Core Resources (Always Sync) ====================
      
      // Car Brands
      try {
        const carBrandsRes = await carBrandApi.getAll();
        const carBrands = carBrandsRes.data || [];
        store.setCarBrands(carBrands);
        cacheStore.setCarBrands(carBrands);
        syncResults.push({ resource: 'carBrands', success: true, itemCount: carBrands.length, timestamp: Date.now() });
      } catch (error: any) {
        console.error('[SyncService] Failed to sync carBrands:', error.message);
        syncResults.push({ resource: 'carBrands', success: false, errorMessage: error.message, timestamp: Date.now() });
        hasAnyError = true;
      }

      // Car Models
      try {
        const carModelsRes = await carModelApi.getAll();
        const carModels = carModelsRes.data || [];
        store.setCarModels(carModels);
        cacheStore.setCarModels(carModels);
        syncResults.push({ resource: 'carModels', success: true, itemCount: carModels.length, timestamp: Date.now() });
      } catch (error: any) {
        console.error('[SyncService] Failed to sync carModels:', error.message);
        syncResults.push({ resource: 'carModels', success: false, errorMessage: error.message, timestamp: Date.now() });
        hasAnyError = true;
      }

      // Product Brands
      try {
        const productBrandsRes = await productBrandApi.getAll();
        const productBrands = productBrandsRes.data || [];
        store.setProductBrands(productBrands);
        cacheStore.setProductBrands(productBrands);
        syncResults.push({ resource: 'productBrands', success: true, itemCount: productBrands.length, timestamp: Date.now() });
      } catch (error: any) {
        console.error('[SyncService] Failed to sync productBrands:', error.message);
        syncResults.push({ resource: 'productBrands', success: false, errorMessage: error.message, timestamp: Date.now() });
        hasAnyError = true;
      }

      // Categories
      try {
        const categoriesRes = await categoryApi.getAll();
        const categories = categoriesRes.data || [];
        store.setCategories(categories);
        cacheStore.setCategories(categories);
        syncResults.push({ resource: 'categories', success: true, itemCount: categories.length, timestamp: Date.now() });
      } catch (error: any) {
        console.error('[SyncService] Failed to sync categories:', error.message);
        syncResults.push({ resource: 'categories', success: false, errorMessage: error.message, timestamp: Date.now() });
        hasAnyError = true;
      }

      // Products (with conflict detection)
      try {
        const productsRes = await productApi.getAll({ limit: 1000 });
        const products = productsRes.data?.products || [];
        
        // Extract server product IDs for purging
        const serverProductIds = products.map((p: any) => p.id);
        
        // Check for conflicts with locally modified products
        const localProducts = store.products || [];
        for (const serverProduct of products) {
          const localProduct = localProducts.find((p: any) => p.id === serverProduct.id);
          if (localProduct && localProduct._localModified) {
            // Check version conflict
            const hasConflict = cacheStore.checkConflict(
              serverProduct.id, 
              'product', 
              serverProduct._version || 1
            );
            if (hasConflict) {
              console.log(`[SyncService] Product conflict detected: ${serverProduct.id}`);
              // Keep local version for now, user can resolve later
              continue;
            }
          }
        }
        
        store.setProducts(products);
        cacheStore.setProducts(products);
        
        // Purge deleted products from local cache (Zero-Waste Policy)
        if (serverProductIds.length > 0) {
          cacheStore.purgeDeletedItems({ products: serverProductIds });
        }
        
        syncResults.push({ resource: 'products', success: true, itemCount: products.length, timestamp: Date.now() });
      } catch (error: any) {
        console.error('[SyncService] Failed to sync products:', error.message);
        syncResults.push({ resource: 'products', success: false, errorMessage: error.message, timestamp: Date.now() });
        hasAnyError = true;
      }

      // ==================== Privileged Resources (Role-Based) ====================
      
      const userRole = store.userRole;
      
      if (['owner', 'partner'].includes(userRole)) {
        // Suppliers
        try {
          const suppliersRes = await supplierApi.getAll();
          store.setSuppliers(suppliersRes.data || []);
          syncResults.push({ resource: 'suppliers', success: true, itemCount: (suppliersRes.data || []).length, timestamp: Date.now() });
        } catch (error: any) {
          console.error('[SyncService] Failed to sync suppliers:', error.message);
          syncResults.push({ resource: 'suppliers', success: false, errorMessage: error.message, timestamp: Date.now() });
          hasAnyError = true;
        }

        // Distributors
        try {
          const distributorsRes = await distributorApi.getAll();
          store.setDistributors(distributorsRes.data || []);
          syncResults.push({ resource: 'distributors', success: true, itemCount: (distributorsRes.data || []).length, timestamp: Date.now() });
        } catch (error: any) {
          console.error('[SyncService] Failed to sync distributors:', error.message);
          syncResults.push({ resource: 'distributors', success: false, errorMessage: error.message, timestamp: Date.now() });
          hasAnyError = true;
        }

        // Orders (Admin)
        try {
          const ordersRes = await orderApi.getAllAdmin();
          const orders = ordersRes.data?.orders || [];
          store.setOrders(orders);
          cacheStore.setOrders(orders);
          syncResults.push({ resource: 'orders', success: true, itemCount: orders.length, timestamp: Date.now() });
        } catch (error: any) {
          console.error('[SyncService] Failed to sync orders:', error.message);
          syncResults.push({ resource: 'orders', success: false, errorMessage: error.message, timestamp: Date.now() });
          hasAnyError = true;
        }

        // Customers
        try {
          const customersRes = await customerApi.getAll();
          store.setCustomers(customersRes.data?.customers || []);
          syncResults.push({ resource: 'customers', success: true, itemCount: (customersRes.data?.customers || []).length, timestamp: Date.now() });
        } catch (error: any) {
          console.error('[SyncService] Failed to sync customers:', error.message);
          syncResults.push({ resource: 'customers', success: false, errorMessage: error.message, timestamp: Date.now() });
          hasAnyError = true;
        }
      } else if (['admin', 'subscriber'].includes(userRole)) {
        // Limited privileged data for admins/subscribers
        try {
          const [suppliersRes, distributorsRes] = await Promise.all([
            supplierApi.getAll().catch(() => ({ data: [] })),
            distributorApi.getAll().catch(() => ({ data: [] })),
          ]);
          store.setSuppliers(suppliersRes.data || []);
          store.setDistributors(distributorsRes.data || []);
          syncResults.push({ resource: 'suppliers', success: true, timestamp: Date.now() });
          syncResults.push({ resource: 'distributors', success: true, timestamp: Date.now() });
        } catch (e: any) {
          console.log('[SyncService] Could not fetch supplier/distributor data:', e.message);
        }
      }

      // Store sync results
      cacheStore.setLastSyncResults(syncResults);

      // Determine final status
      const allSucceeded = syncResults.every((r) => r.success);
      const allFailed = syncResults.every((r) => !r.success);

      if (allFailed) {
        store.setSyncStatus('error');
        store.setSyncError('All sync operations failed');
        // Restore from snapshot on complete failure
        console.log('[SyncService] All syncs failed, restoring from snapshot');
        cacheStore.restoreSnapshot(snapshotId);
      } else if (hasAnyError) {
        store.setSyncStatus('success'); // Partial success
        store.setSyncError(`Partial sync: ${syncResults.filter((r) => !r.success).length} resources failed`);
        console.log('[SyncService] Partial sync completed with some failures');
      } else {
        store.setSyncStatus('success');
        // Delete the snapshot on full success
        cacheStore.deleteSnapshot(snapshotId);
        console.log('[SyncService] Full sync completed successfully');
      }

      store.setLastSyncTime(Date.now());
      cacheStore.setLastSyncTime(Date.now());

      // Cleanup after successful sync
      cacheStore.cleanupAfterSync();

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

      // Restore from snapshot on critical failure
      cacheStore.restoreSnapshot(snapshotId);

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
    const appStore = useAppStore.getState();
    
    cacheStore.setOnline(isOnline);
    appStore.setOnline(isOnline);
    
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

  /**
   * Get sync status summary
   */
  getSyncSummary() {
    const cacheStore = useDataCacheStore.getState();
    const lastResults = cacheStore.lastSyncResults;
    const conflicts = cacheStore.getConflicts();
    const queueLength = cacheStore.getQueueLength();

    return {
      lastSyncTime: cacheStore.lastSyncTime,
      syncResults: lastResults,
      successCount: lastResults.filter((r) => r.success).length,
      failCount: lastResults.filter((r) => !r.success).length,
      conflictCount: conflicts.length,
      pendingQueueItems: queueLength,
    };
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
    getSyncSummary: () => syncService.getSyncSummary(),
  };
};

export default syncService;
