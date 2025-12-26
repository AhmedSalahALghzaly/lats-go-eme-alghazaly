/**
 * Zustand Store for Al-Ghazaly Auto Parts
 * Manages UI state, auth, and sync status
 * Business data is handled by WatermelonDB (source of truth)
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { syncDatabase, SyncStatus, hasLocalData, initialSync } from '../sync/syncAdapter';

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  is_admin?: boolean;
}

export interface CartItemData {
  productId: string;
  quantity: number;
  product?: any; // Populated from WatermelonDB
}

interface AppState {
  // Auth State
  user: User | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  
  // UI State
  theme: 'light' | 'dark';
  language: 'en' | 'ar';
  isRTL: boolean;
  
  // Sync State
  syncStatus: SyncStatus;
  lastSyncTime: number | null;
  isOnline: boolean;
  syncError: string | null;
  
  // Local Cart (synced to server on checkout only)
  cartItems: CartItemData[];
  
  // Actions
  setUser: (user: User | null, token?: string | null) => void;
  logout: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: 'en' | 'ar') => void;
  setOnline: (isOnline: boolean) => void;
  
  // Sync Actions
  performSync: () => Promise<void>;
  setSyncStatus: (status: SyncStatus) => void;
  setSyncError: (error: string | null) => void;
  
  // Cart Actions (local-first)
  addToCart: (productId: string, quantity?: number) => void;
  updateCartItem: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      user: null,
      sessionToken: null,
      isAuthenticated: false,
      theme: 'light',
      language: 'ar',
      isRTL: true,
      syncStatus: 'idle',
      lastSyncTime: null,
      isOnline: true,
      syncError: null,
      cartItems: [],

      // Auth Actions
      setUser: (user, token = null) => {
        set({
          user,
          sessionToken: token || get().sessionToken,
          isAuthenticated: !!user,
        });
      },

      logout: () => {
        set({
          user: null,
          sessionToken: null,
          isAuthenticated: false,
          cartItems: [],
        });
      },

      // UI Actions
      setTheme: (theme) => set({ theme }),
      
      setLanguage: (language) => {
        set({
          language,
          isRTL: language === 'ar',
        });
      },

      setOnline: (isOnline) => {
        set({ isOnline });
        // Trigger sync when coming back online
        if (isOnline && get().syncStatus !== 'syncing') {
          get().performSync();
        }
      },

      // Sync Actions
      performSync: async () => {
        const { isOnline, syncStatus } = get();
        
        if (!isOnline || syncStatus === 'syncing') {
          return;
        }

        set({ syncStatus: 'syncing', syncError: null });

        try {
          const result = await syncDatabase();
          
          if (result.success) {
            set({
              syncStatus: 'success',
              lastSyncTime: result.timestamp || Date.now(),
              syncError: null,
            });
          } else {
            set({
              syncStatus: 'error',
              syncError: result.error || 'Sync failed',
            });
          }
        } catch (error: any) {
          set({
            syncStatus: 'error',
            syncError: error.message || 'Sync failed',
          });
        }

        // Reset to idle after a delay
        setTimeout(() => {
          if (get().syncStatus !== 'syncing') {
            set({ syncStatus: 'idle' });
          }
        }, 3000);
      },

      setSyncStatus: (status) => set({ syncStatus: status }),
      
      setSyncError: (error) => set({ syncError: error }),

      // Cart Actions (local-first approach)
      addToCart: (productId, quantity = 1) => {
        const { cartItems } = get();
        const existingIndex = cartItems.findIndex((item) => item.productId === productId);

        if (existingIndex >= 0) {
          const updated = [...cartItems];
          updated[existingIndex].quantity += quantity;
          set({ cartItems: updated });
        } else {
          set({
            cartItems: [...cartItems, { productId, quantity }],
          });
        }
      },

      updateCartItem: (productId, quantity) => {
        const { cartItems } = get();
        
        if (quantity <= 0) {
          set({
            cartItems: cartItems.filter((item) => item.productId !== productId),
          });
        } else {
          set({
            cartItems: cartItems.map((item) =>
              item.productId === productId ? { ...item, quantity } : item
            ),
          });
        }
      },

      removeFromCart: (productId) => {
        set({
          cartItems: get().cartItems.filter((item) => item.productId !== productId),
        });
      },

      clearCart: () => {
        set({ cartItems: [] });
      },

      getCartTotal: () => {
        return get().cartItems.reduce((total, item) => total + item.quantity, 0);
      },
    }),
    {
      name: 'alghazaly-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        // Only persist these fields
        user: state.user,
        sessionToken: state.sessionToken,
        isAuthenticated: state.isAuthenticated,
        theme: state.theme,
        language: state.language,
        isRTL: state.isRTL,
        lastSyncTime: state.lastSyncTime,
        cartItems: state.cartItems,
      }),
    }
  )
);

// Selectors for better performance
export const useUser = () => useAppStore((state) => state.user);
export const useIsAuthenticated = () => useAppStore((state) => state.isAuthenticated);
export const useTheme = () => useAppStore((state) => state.theme);
export const useLanguage = () => useAppStore((state) => state.language);
export const useIsRTL = () => useAppStore((state) => state.isRTL);
export const useSyncStatus = () => useAppStore((state) => state.syncStatus);
export const useIsOnline = () => useAppStore((state) => state.isOnline);
export const useCartItems = () => useAppStore((state) => state.cartItems);
export const useCartTotal = () => useAppStore((state) => state.getCartTotal());

// Initialize sync on app start
export async function initializeApp() {
  const hasData = await hasLocalData();
  
  if (!hasData) {
    // First launch - do initial sync
    console.log('First launch detected, performing initial sync...');
    await initialSync();
  } else {
    // Background sync
    useAppStore.getState().performSync();
  }
}

export default useAppStore;
