/**
 * Shopping Hub Query Hooks with React Query
 * Provides data fetching for cart, favorites, and orders
 * Uses centralized query keys for cache management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useAppStore } from '../../store/appStore';
import { cartApi, favoriteApi, orderApi } from '../../services/api';
import api from '../../services/api';
import { queryKeys } from '../../lib/queryClient';

// Extended query keys for shopping hub
export const shoppingHubKeys = {
  all: ['shoppingHub'] as const,
  favorites: queryKeys.favorites.all,
  cart: queryKeys.cart.current,
  orders: queryKeys.orders.all,
  customerFavorites: (customerId: string) => ['shoppingHub', 'customerFavorites', customerId] as const,
  customerCart: (customerId: string) => ['shoppingHub', 'customerCart', customerId] as const,
  customerOrders: (customerId: string) => ['shoppingHub', 'customerOrders', customerId] as const,
};

/**
 * Processes favorites data to ensure consistent structure
 */
const processFavoritesData = (favoritesData: any[]): any[] => {
  return favoritesData.map((fav: any) => ({
    ...fav,
    product_id: fav.product_id || fav.product?.id,
    product: fav.product || {
      id: fav.product_id,
      name: fav.name,
      name_ar: fav.name_ar,
      price: fav.price,
      image_url: fav.image_url,
      sku: fav.sku,
    },
  }));
};

/**
 * Hook to fetch user's favorites
 */
export function useFavoritesQuery(enabled = true) {
  return useQuery({
    queryKey: shoppingHubKeys.favorites,
    queryFn: async () => {
      const response = await favoriteApi.getAll();
      const favoritesData = Array.isArray(response.data)
        ? response.data
        : response.data?.favorites || [];
      return processFavoritesData(favoritesData);
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch user's cart
 */
export function useCartQuery(enabled = true) {
  const setCartItems = useAppStore((state) => state.setCartItems);

  return useQuery({
    queryKey: shoppingHubKeys.cart,
    queryFn: async () => {
      const response = await cartApi.get();
      const items = response.data?.items || [];
      // Sync with global store
      setCartItems(items);
      return items;
    },
    enabled,
    staleTime: 60 * 1000, // 1 minute
  });
}

/**
 * Hook to fetch user's orders
 */
export function useOrdersQuery(enabled = true) {
  return useQuery({
    queryKey: shoppingHubKeys.orders,
    queryFn: async () => {
      const response = await orderApi.getAll();
      return Array.isArray(response.data)
        ? response.data
        : response.data?.orders || [];
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch customer data for admin view
 */
export function useCustomerShoppingDataQuery(customerId: string | undefined, enabled = true) {
  const favoritesQuery = useQuery({
    queryKey: shoppingHubKeys.customerFavorites(customerId || ''),
    queryFn: async () => {
      if (!customerId) return [];
      const response = await api.get(`/customers/admin/customer/${customerId}/favorites`);
      return processFavoritesData(response.data?.favorites || []);
    },
    enabled: enabled && !!customerId,
    staleTime: 2 * 60 * 1000,
  });

  const cartQuery = useQuery({
    queryKey: shoppingHubKeys.customerCart(customerId || ''),
    queryFn: async () => {
      if (!customerId) return [];
      const response = await api.get(`/customers/admin/customer/${customerId}/cart`);
      return response.data?.items || [];
    },
    enabled: enabled && !!customerId,
    staleTime: 60 * 1000,
  });

  const ordersQuery = useQuery({
    queryKey: shoppingHubKeys.customerOrders(customerId || ''),
    queryFn: async () => {
      if (!customerId) return [];
      const response = await api.get(`/customers/admin/customer/${customerId}/orders`);
      return response.data?.orders || [];
    },
    enabled: enabled && !!customerId,
    staleTime: 2 * 60 * 1000,
  });

  return {
    favorites: favoritesQuery.data || [],
    cart: cartQuery.data || [],
    orders: ordersQuery.data || [],
    isLoading: favoritesQuery.isLoading || cartQuery.isLoading || ordersQuery.isLoading,
    isError: favoritesQuery.isError || cartQuery.isError || ordersQuery.isError,
    refetch: async () => {
      await Promise.all([
        favoritesQuery.refetch(),
        cartQuery.refetch(),
        ordersQuery.refetch(),
      ]);
    },
    isRefetching: favoritesQuery.isRefetching || cartQuery.isRefetching || ordersQuery.isRefetching,
  };
}

/**
 * Combined hook for shopping hub data (user's own data)
 */
export function useShoppingHubQuery(enabled = true) {
  const user = useAppStore((state) => state.user);
  const favoritesQuery = useFavoritesQuery(enabled && !!user);
  const cartQuery = useCartQuery(enabled && !!user);
  const ordersQuery = useOrdersQuery(enabled && !!user);

  const isLoading = favoritesQuery.isLoading || cartQuery.isLoading || ordersQuery.isLoading;
  const isRefetching = favoritesQuery.isRefetching || cartQuery.isRefetching || ordersQuery.isRefetching;

  const refetch = useCallback(async () => {
    await Promise.all([
      favoritesQuery.refetch(),
      cartQuery.refetch(),
      ordersQuery.refetch(),
    ]);
  }, [favoritesQuery, cartQuery, ordersQuery]);

  return {
    favorites: favoritesQuery.data || [],
    cartItems: cartQuery.data || [],
    orders: ordersQuery.data || [],
    isLoading,
    isRefetching,
    isError: favoritesQuery.isError || cartQuery.isError || ordersQuery.isError,
    refetch,
    profileData: user,
  };
}

/**
 * Hook for cart mutations (add, update, remove)
 */
export function useCartMutations() {
  const queryClient = useQueryClient();
  const setCartItems = useAppStore((state) => state.setCartItems);

  const addToCart = useMutation({
    mutationFn: async (productId: string) => {
      return cartApi.add(productId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: shoppingHubKeys.cart });
    },
  });

  const updateQuantity = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      return cartApi.update(productId, quantity);
    },
    onMutate: async ({ productId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: shoppingHubKeys.cart });
      const previousCart = queryClient.getQueryData<any[]>(shoppingHubKeys.cart);
      
      // Optimistic update
      queryClient.setQueryData(shoppingHubKeys.cart, (old: any[]) => {
        if (!old) return old;
        if (quantity <= 0) {
          return old.filter(item => item.product_id !== productId);
        }
        return old.map(item => 
          item.product_id === productId ? { ...item, quantity } : item
        );
      });
      
      return { previousCart };
    },
    onError: (err, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(shoppingHubKeys.cart, context.previousCart);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: shoppingHubKeys.cart });
    },
  });

  const removeFromCart = useMutation({
    mutationFn: async (productId: string) => {
      return cartApi.remove(productId);
    },
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: shoppingHubKeys.cart });
      const previousCart = queryClient.getQueryData<any[]>(shoppingHubKeys.cart);
      
      // Optimistic removal
      queryClient.setQueryData(shoppingHubKeys.cart, (old: any[]) => {
        if (!old) return old;
        return old.filter(item => item.product_id !== productId);
      });
      
      return { previousCart };
    },
    onError: (err, productId, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(shoppingHubKeys.cart, context.previousCart);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: shoppingHubKeys.cart });
    },
  });

  const clearCart = useMutation({
    mutationFn: async () => {
      return cartApi.clear();
    },
    onSuccess: () => {
      queryClient.setQueryData(shoppingHubKeys.cart, []);
      setCartItems([]);
    },
  });

  return {
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
  };
}

/**
 * Hook for favorites mutations
 */
export function useFavoritesMutations() {
  const queryClient = useQueryClient();

  const toggleFavorite = useMutation({
    mutationFn: async (productId: string) => {
      return favoriteApi.toggle(productId);
    },
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: shoppingHubKeys.favorites });
      const previousFavorites = queryClient.getQueryData<any[]>(shoppingHubKeys.favorites);
      
      // Optimistic toggle - remove if exists
      queryClient.setQueryData(shoppingHubKeys.favorites, (old: any[]) => {
        if (!old) return old;
        const exists = old.some(f => f.product_id === productId);
        if (exists) {
          return old.filter(f => f.product_id !== productId);
        }
        return old;
      });
      
      return { previousFavorites };
    },
    onError: (err, productId, context) => {
      if (context?.previousFavorites) {
        queryClient.setQueryData(shoppingHubKeys.favorites, context.previousFavorites);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: shoppingHubKeys.favorites });
    },
  });

  return {
    toggleFavorite,
  };
}

export default useShoppingHubQuery;
