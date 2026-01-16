/**
 * Delta Sync Hook - Smart incremental data synchronization
 * Fetches only changed records since last sync
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { queryKeys } from '../lib/queryClient';
import { api } from '../services/api';
import { useAppStore } from '../store/appStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SYNC_TIMESTAMP_KEY = 'alghazaly_last_sync';

// Get stored last sync timestamp
async function getLastSyncTimestamp(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(SYNC_TIMESTAMP_KEY);
  } catch {
    return null;
  }
}

// Store sync timestamp
async function setLastSyncTimestamp(timestamp: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SYNC_TIMESTAMP_KEY, timestamp);
  } catch {
    // Ignore storage errors
  }
}

// Delta sync for products
export function useProductsDeltaSync() {
  const { products, setProducts } = useAppStore();
  const queryClient = useQueryClient();
  
  return useQuery({
    queryKey: ['deltaSync', 'products'],
    queryFn: async () => {
      const lastSync = await getLastSyncTimestamp();
      const params = lastSync ? { last_sync: lastSync } : {};
      
      const response = await api.get('/delta-sync/products', { params });
      const { products: newProducts, deleted_ids, server_time, is_delta } = response.data;
      
      let mergedProducts;
      
      if (is_delta && products.length > 0) {
        // Merge delta: remove deleted, update existing, add new
        const updatedMap = new Map(newProducts.map((p: any) => [p.id, p]));
        const deletedSet = new Set(deleted_ids);
        
        mergedProducts = products
          .filter((p: any) => !deletedSet.has(p.id))
          .map((p: any) => updatedMap.has(p.id) ? updatedMap.get(p.id) : p);
        
        // Add new products not in existing list
        newProducts.forEach((p: any) => {
          if (!mergedProducts.some((ep: any) => ep.id === p.id)) {
            mergedProducts.push(p);
          }
        });
      } else {
        // Full sync
        mergedProducts = newProducts;
      }
      
      // Update Zustand store
      setProducts(mergedProducts);
      
      // Update sync timestamp
      await setLastSyncTimestamp(server_time);
      
      // Update React Query cache
      queryClient.setQueryData(queryKeys.products.all, mergedProducts);
      
      return {
        products: mergedProducts,
        is_delta,
        synced_count: newProducts.length,
        deleted_count: deleted_ids.length,
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnMount: true,
  });
}

// Full delta sync for multiple tables
export function useFullDeltaSync(tables?: string[]) {
  const store = useAppStore();
  const queryClient = useQueryClient();
  
  const tableString = tables?.join(',') || 'products,categories,car_brands,car_models,product_brands';
  
  return useQuery({
    queryKey: ['deltaSync', 'full', tableString],
    queryFn: async () => {
      const lastSync = await getLastSyncTimestamp();
      const params: any = { tables: tableString };
      if (lastSync) params.last_sync = lastSync;
      
      const response = await api.get('/delta-sync/full', { params });
      const { data, server_time, is_delta } = response.data;
      
      // Process each table
      const syncResults: Record<string, { synced: number; deleted: number }> = {};
      
      if (data.products) {
        const merged = mergeData(store.products, data.products.items, data.products.deleted_ids, is_delta);
        store.setProducts(merged);
        queryClient.setQueryData(queryKeys.products.all, merged);
        syncResults.products = { synced: data.products.items.length, deleted: data.products.deleted_ids.length };
      }
      
      if (data.categories) {
        const merged = mergeData(store.categories, data.categories.items, data.categories.deleted_ids, is_delta);
        store.setCategories(merged);
        queryClient.setQueryData(queryKeys.categories.all, merged);
        syncResults.categories = { synced: data.categories.items.length, deleted: data.categories.deleted_ids.length };
      }
      
      if (data.car_brands) {
        const merged = mergeData(store.carBrands, data.car_brands.items, data.car_brands.deleted_ids, is_delta);
        store.setCarBrands(merged);
        queryClient.setQueryData(queryKeys.carBrands.all, merged);
        syncResults.car_brands = { synced: data.car_brands.items.length, deleted: data.car_brands.deleted_ids.length };
      }
      
      if (data.car_models) {
        const merged = mergeData(store.carModels, data.car_models.items, data.car_models.deleted_ids, is_delta);
        store.setCarModels(merged);
        queryClient.setQueryData(queryKeys.carModels.all, merged);
        syncResults.car_models = { synced: data.car_models.items.length, deleted: data.car_models.deleted_ids.length };
      }
      
      if (data.product_brands) {
        const merged = mergeData(store.productBrands, data.product_brands.items, data.product_brands.deleted_ids, is_delta);
        store.setProductBrands(merged);
        queryClient.setQueryData(queryKeys.productBrands.all, merged);
        syncResults.product_brands = { synced: data.product_brands.items.length, deleted: data.product_brands.deleted_ids.length };
      }
      
      // Update timestamp
      await setLastSyncTimestamp(server_time);
      store.setLastSyncTime(Date.now());
      store.setSyncStatus('success');
      
      return {
        is_delta,
        server_time,
        results: syncResults,
      };
    },
    staleTime: 2 * 60 * 1000,
    refetchOnMount: true,
  });
}

// Helper to merge delta data
function mergeData(existing: any[], newItems: any[], deletedIds: string[], isDelta: boolean): any[] {
  if (!isDelta || existing.length === 0) {
    return newItems;
  }
  
  const updatedMap = new Map(newItems.map((item: any) => [item.id, item]));
  const deletedSet = new Set(deletedIds);
  
  // Filter deleted, update existing
  let merged = existing
    .filter((item: any) => !deletedSet.has(item.id))
    .map((item: any) => updatedMap.has(item.id) ? updatedMap.get(item.id) : item);
  
  // Add new items
  newItems.forEach((item: any) => {
    if (!merged.some((e: any) => e.id === item.id)) {
      merged.push(item);
    }
  });
  
  return merged;
}

// Manual sync trigger
export function useManualSync() {
  const queryClient = useQueryClient();
  const store = useAppStore();
  
  const triggerSync = useCallback(async () => {
    store.setSyncStatus('syncing');
    try {
      await queryClient.invalidateQueries({ queryKey: ['deltaSync'] });
      await queryClient.refetchQueries({ queryKey: ['deltaSync', 'full'] });
    } catch (error) {
      store.setSyncStatus('error');
      store.setSyncError('Sync failed');
    }
  }, [queryClient, store]);
  
  const resetSync = useCallback(async () => {
    await AsyncStorage.removeItem(SYNC_TIMESTAMP_KEY);
    store.setLastSyncTime(null);
    await triggerSync();
  }, [triggerSync, store]);
  
  return { triggerSync, resetSync };
}
