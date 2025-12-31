/**
 * Extended Zustand Store for Al-Ghazaly Auto Parts
 * Advanced Owner Interface - Complete State Management
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';
export type UserRole = 'guest' | 'user' | 'subscriber' | 'admin' | 'partner' | 'owner';

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  is_admin?: boolean;
  role?: UserRole;
}

export interface CartItemData {
  productId: string;
  quantity: number;
  product?: any;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  created_at: string;
}

// Color Moods for theming
export interface ColorMood {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  accent: string;
  gradient: string[];
}

export const COLOR_MOODS: ColorMood[] = [
  {
    id: 'arctic_dawn',
    name: 'Arctic Dawn',
    primary: '#3B82F6',
    secondary: '#60A5FA',
    background: '#F0F9FF',
    surface: '#FFFFFF',
    text: '#1E3A5F',
    textSecondary: '#64748B',
    accent: '#06B6D4',
    gradient: ['#E0F2FE', '#BAE6FD', '#7DD3FC'],
  },
  {
    id: 'desert_sunset',
    name: 'Desert Sunset',
    primary: '#F59E0B',
    secondary: '#FBBF24',
    background: '#FFFBEB',
    surface: '#FFFFFF',
    text: '#78350F',
    textSecondary: '#92400E',
    accent: '#EF4444',
    gradient: ['#FEF3C7', '#FDE68A', '#FCD34D'],
  },
  {
    id: 'forest_calm',
    name: 'Forest Calm',
    primary: '#10B981',
    secondary: '#34D399',
    background: '#ECFDF5',
    surface: '#FFFFFF',
    text: '#064E3B',
    textSecondary: '#047857',
    accent: '#059669',
    gradient: ['#D1FAE5', '#A7F3D0', '#6EE7B7'],
  },
  {
    id: 'neon_night',
    name: 'Neon Night',
    primary: '#8B5CF6',
    secondary: '#A78BFA',
    background: '#0F0F23',
    surface: '#1A1A2E',
    text: '#E5E5E5',
    textSecondary: '#A0A0A0',
    accent: '#EC4899',
    gradient: ['#1E1E3F', '#2D2D5F', '#3D3D7F'],
  },
  {
    id: 'ocean_breeze',
    name: 'Ocean Breeze',
    primary: '#0EA5E9',
    secondary: '#38BDF8',
    background: '#F0FDFA',
    surface: '#FFFFFF',
    text: '#0C4A6E',
    textSecondary: '#0369A1',
    accent: '#14B8A6',
    gradient: ['#CFFAFE', '#A5F3FC', '#67E8F9'],
  },
];

interface AppState {
  // Auth State
  user: User | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  userRole: UserRole;
  _hasHydrated: boolean;
  
  // UI State
  theme: 'light' | 'dark';
  language: 'en' | 'ar';
  isRTL: boolean;
  currentMood: ColorMood;
  
  // Sync State
  syncStatus: SyncStatus;
  lastSyncTime: number | null;
  isOnline: boolean;
  syncError: string | null;
  
  // Local Cart
  cartItems: CartItemData[];
  
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  
  // Data cache for offline-first
  carBrands: any[];
  carModels: any[];
  productBrands: any[];
  categories: any[];
  products: any[];
  suppliers: any[];
  distributors: any[];
  partners: any[];
  admins: any[];
  subscribers: any[];
  customers: any[];
  orders: any[];
  
  // Analytics dashboard layout
  dashboardLayout: any[];
  
  // Actions
  setUser: (user: User | null, token?: string | null) => void;
  setUserRole: (role: UserRole) => void;
  logout: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (language: 'en' | 'ar') => void;
  setColorMood: (mood: ColorMood) => void;
  setOnline: (isOnline: boolean) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setSyncError: (error: string | null) => void;
  setLastSyncTime: (time: number) => void;
  
  // Cart Actions
  addToCart: (productId: string, quantity?: number) => void;
  addToLocalCart: (item: { product_id: string; quantity: number; product?: any }) => void;
  updateCartItem: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  
  // Notification Actions
  addNotification: (notification: Notification) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  
  // Data Actions (for offline-first cache)
  setCarBrands: (data: any[]) => void;
  setCarModels: (data: any[]) => void;
  setProductBrands: (data: any[]) => void;
  setCategories: (data: any[]) => void;
  setProducts: (data: any[]) => void;
  setSuppliers: (data: any[]) => void;
  setDistributors: (data: any[]) => void;
  setPartners: (data: any[]) => void;
  setAdmins: (data: any[]) => void;
  setSubscribers: (data: any[]) => void;
  setCustomers: (data: any[]) => void;
  setOrders: (data: any[]) => void;
  
  // Dashboard Actions
  setDashboardLayout: (layout: any[]) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      user: null,
      sessionToken: null,
      isAuthenticated: false,
      userRole: 'guest',
      _hasHydrated: false,
      theme: 'light',
      language: 'ar',
      isRTL: true,
      currentMood: COLOR_MOODS[0], // Arctic Dawn default
      syncStatus: 'idle',
      lastSyncTime: null,
      isOnline: true,
      syncError: null,
      cartItems: [],
      notifications: [],
      unreadCount: 0,
      carBrands: [],
      carModels: [],
      productBrands: [],
      categories: [],
      products: [],
      suppliers: [],
      distributors: [],
      partners: [],
      admins: [],
      subscribers: [],
      customers: [],
      orders: [],
      dashboardLayout: [],

      // Auth Actions
      setUser: (user, token = null) => {
        set({
          user,
          sessionToken: token || get().sessionToken,
          isAuthenticated: !!user,
          userRole: user?.role || 'user',
        });
      },

      setUserRole: (role) => set({ userRole: role }),

      logout: () => {
        set({
          user: null,
          sessionToken: null,
          isAuthenticated: false,
          userRole: 'guest',
          cartItems: [],
          notifications: [],
          unreadCount: 0,
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

      setColorMood: (mood) => set({ currentMood: mood }),

      setOnline: (isOnline) => set({ isOnline }),
      
      setSyncStatus: (status) => set({ syncStatus: status }),
      
      setSyncError: (error) => set({ syncError: error }),
      
      setLastSyncTime: (time) => set({ lastSyncTime: time }),

      // Cart Actions
      addToCart: (productId, quantity = 1) => {
        const { cartItems } = get();
        const existingIndex = cartItems.findIndex((item) => item.productId === productId);

        if (existingIndex >= 0) {
          const updated = [...cartItems];
          updated[existingIndex].quantity += quantity;
          set({ cartItems: updated });
        } else {
          set({ cartItems: [...cartItems, { productId, quantity }] });
        }
      },

      addToLocalCart: (item) => {
        const { cartItems } = get();
        const existingIndex = cartItems.findIndex((ci) => ci.productId === item.product_id);

        if (existingIndex >= 0) {
          const updated = [...cartItems];
          updated[existingIndex].quantity += item.quantity;
          updated[existingIndex].product = item.product;
          set({ cartItems: updated });
        } else {
          set({
            cartItems: [...cartItems, { productId: item.product_id, quantity: item.quantity, product: item.product }],
          });
        }
      },

      updateCartItem: (productId, quantity) => {
        const { cartItems } = get();
        if (quantity <= 0) {
          set({ cartItems: cartItems.filter((item) => item.productId !== productId) });
        } else {
          set({
            cartItems: cartItems.map((item) =>
              item.productId === productId ? { ...item, quantity } : item
            ),
          });
        }
      },

      removeFromCart: (productId) => {
        set({ cartItems: get().cartItems.filter((item) => item.productId !== productId) });
      },

      clearCart: () => set({ cartItems: [] }),

      getCartTotal: () => get().cartItems.reduce((total, item) => total + item.quantity, 0),

      // Notification Actions
      addNotification: (notification) => {
        const { notifications } = get();
        set({
          notifications: [notification, ...notifications].slice(0, 100),
          unreadCount: get().unreadCount + 1,
        });
      },

      markNotificationRead: (id) => {
        const { notifications } = get();
        const updated = notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        );
        const unreadCount = updated.filter((n) => !n.read).length;
        set({ notifications: updated, unreadCount });
      },

      markAllNotificationsRead: () => {
        const { notifications } = get();
        set({
          notifications: notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        });
      },

      clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

      // Data Actions
      setCarBrands: (data) => set({ carBrands: data }),
      setCarModels: (data) => set({ carModels: data }),
      setProductBrands: (data) => set({ productBrands: data }),
      setCategories: (data) => set({ categories: data }),
      setProducts: (data) => set({ products: data }),
      setSuppliers: (data) => set({ suppliers: data }),
      setDistributors: (data) => set({ distributors: data }),
      setPartners: (data) => set({ partners: data }),
      setAdmins: (data) => set({ admins: data }),
      setSubscribers: (data) => set({ subscribers: data }),
      setCustomers: (data) => set({ customers: data }),
      setOrders: (data) => set({ orders: data }),

      // Dashboard Actions
      setDashboardLayout: (layout) => set({ dashboardLayout: layout }),
    }),
    {
      name: 'alghazaly-app-storage-v3',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        sessionToken: state.sessionToken,
        isAuthenticated: state.isAuthenticated,
        userRole: state.userRole,
        theme: state.theme,
        language: state.language,
        isRTL: state.isRTL,
        currentMood: state.currentMood,
        lastSyncTime: state.lastSyncTime,
        cartItems: state.cartItems,
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        carBrands: state.carBrands,
        carModels: state.carModels,
        productBrands: state.productBrands,
        categories: state.categories,
        products: state.products,
        suppliers: state.suppliers,
        distributors: state.distributors,
        dashboardLayout: state.dashboardLayout,
      }),
    }
  )
);

// Selectors
export const useUser = () => useAppStore((state) => state.user);
export const useIsAuthenticated = () => useAppStore((state) => state.isAuthenticated);
export const useUserRole = () => useAppStore((state) => state.userRole);
export const useTheme = () => useAppStore((state) => state.theme);
export const useLanguage = () => useAppStore((state) => state.language);
export const useIsRTL = () => useAppStore((state) => state.isRTL);
export const useColorMood = () => useAppStore((state) => state.currentMood);
export const useSyncStatus = () => useAppStore((state) => state.syncStatus);
export const useIsOnline = () => useAppStore((state) => state.isOnline);
export const useCartItems = () => useAppStore((state) => state.cartItems);
export const useCartTotal = () => useAppStore((state) => state.getCartTotal());
export const useNotifications = () => useAppStore((state) => state.notifications);
export const useUnreadCount = () => useAppStore((state) => state.unreadCount);

// Data selectors
export const useCarBrands = () => useAppStore((state) => state.carBrands);
export const useCarModels = () => useAppStore((state) => state.carModels);
export const useProductBrands = () => useAppStore((state) => state.productBrands);
export const useCategories = () => useAppStore((state) => state.categories);
export const useProducts = () => useAppStore((state) => state.products);
export const useOrders = () => useAppStore((state) => state.orders);

// Check if user can access owner interface
export const useCanAccessOwnerInterface = () => {
  const userRole = useAppStore((state) => state.userRole);
  return userRole === 'owner' || userRole === 'partner';
};

// Check if user can access admin panel
export const useCanAccessAdminPanel = () => {
  const userRole = useAppStore((state) => state.userRole);
  return ['owner', 'partner', 'admin'].includes(userRole);
};

export default useAppStore;
