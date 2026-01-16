/**
 * React Query (TanStack Query) Configuration
 * Optimized for Al-Ghazaly Auto Parts with smart caching
 */
import { QueryClient } from '@tanstack/react-query';

// Create QueryClient with optimized settings
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data considered fresh for 2 minutes
      staleTime: 2 * 60 * 1000,
      // Cache kept for 10 minutes
      gcTime: 10 * 60 * 1000,
      // Retry failed requests 2 times
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      // Don't refetch on window focus for mobile
      refetchOnWindowFocus: false,
      // Refetch on reconnect
      refetchOnReconnect: true,
      // Keep previous data while loading new
      placeholderData: (previousData: unknown) => previousData,
    },
    mutations: {
      // Retry mutations once
      retry: 1,
    },
  },
});

// Query keys factory for type-safe and organized keys
export const queryKeys = {
  // Products
  products: {
    all: ['products'] as const,
    list: (filters?: Record<string, unknown>) => ['products', 'list', filters] as const,
    detail: (id: string) => ['products', 'detail', id] as const,
    search: (query: string) => ['products', 'search', query] as const,
  },
  // Categories
  categories: {
    all: ['categories'] as const,
    tree: ['categories', 'tree'] as const,
  },
  // Car Brands
  carBrands: {
    all: ['carBrands'] as const,
  },
  // Car Models
  carModels: {
    all: ['carModels'] as const,
    byBrand: (brandId: string) => ['carModels', 'brand', brandId] as const,
  },
  // Product Brands
  productBrands: {
    all: ['productBrands'] as const,
  },
  // Orders
  orders: {
    all: ['orders'] as const,
    admin: ['orders', 'admin'] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
    userOrders: (userId: string) => ['orders', 'user', userId] as const,
  },
  // Cart
  cart: {
    current: ['cart'] as const,
  },
  // Favorites
  favorites: {
    all: ['favorites'] as const,
    check: (productId: string) => ['favorites', 'check', productId] as const,
  },
  // Customers (Admin)
  customers: {
    all: ['customers'] as const,
    detail: (id: string) => ['customers', 'detail', id] as const,
  },
  // Delta Sync
  deltaSync: {
    products: (lastSync?: string) => ['deltaSync', 'products', lastSync] as const,
    categories: (lastSync?: string) => ['deltaSync', 'categories', lastSync] as const,
    full: (lastSync?: string, tables?: string) => ['deltaSync', 'full', lastSync, tables] as const,
  },
  // Analytics
  analytics: {
    overview: (startDate?: string, endDate?: string) => ['analytics', 'overview', startDate, endDate] as const,
  },
};

export default queryClient;
