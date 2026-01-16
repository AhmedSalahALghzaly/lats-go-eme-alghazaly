/**
 * Cart Hook with React Query
 * Implements optimistic updates for instant UI feedback
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { cartApi } from '../services/api';
import { useAppStore } from '../store/appStore';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Fetch cart
export function useCart() {
  const { setCartItems, isAuthenticated } = useAppStore();
  
  return useQuery({
    queryKey: queryKeys.cart.current,
    queryFn: async () => {
      const response = await cartApi.get();
      const items = response.data?.items || [];
      // Sync to Zustand
      setCartItems(items);
      return response.data;
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Cart mutations with optimistic updates
export function useCartMutations() {
  const queryClient = useQueryClient();
  const { cartItems, setCartItems } = useAppStore();
  
  // Add to cart (optimistic)
  const addToCart = useMutation({
    mutationFn: ({ productId, quantity, options }: { 
      productId: string; 
      quantity: number;
      options?: { bundle_group_id?: string; bundle_offer_id?: string; bundle_discount_percentage?: number };
    }) => cartApi.add(productId, quantity, options),
    onMutate: async ({ productId, quantity }) => {
      // Haptic feedback
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      await queryClient.cancelQueries({ queryKey: queryKeys.cart.current });
      
      const previousCart = queryClient.getQueryData(queryKeys.cart.current);
      
      // Optimistic update - add to existing or create new item
      const existingIndex = cartItems.findIndex(item => item.productId === productId);
      let newItems;
      
      if (existingIndex >= 0) {
        newItems = cartItems.map((item, i) => 
          i === existingIndex ? { ...item, quantity: item.quantity + quantity } : item
        );
      } else {
        newItems = [...cartItems, { productId, quantity, product_id: productId }];
      }
      
      setCartItems(newItems);
      
      return { previousCart };
    },
    onError: (err, variables, context) => {
      // Rollback
      if (context?.previousCart) {
        queryClient.setQueryData(queryKeys.cart.current, context.previousCart);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.current });
    },
  });
  
  // Update quantity (optimistic)
  const updateQuantity = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) => 
      cartApi.update(productId, quantity),
    onMutate: async ({ productId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.cart.current });
      
      const previousCart = queryClient.getQueryData(queryKeys.cart.current);
      
      // Optimistic update
      const newItems = quantity <= 0
        ? cartItems.filter(item => item.productId !== productId)
        : cartItems.map(item => 
            item.productId === productId ? { ...item, quantity } : item
          );
      
      setCartItems(newItems);
      
      return { previousCart };
    },
    onError: (err, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(queryKeys.cart.current, context.previousCart);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.current });
    },
  });
  
  // Clear cart
  const clearCart = useMutation({
    mutationFn: () => cartApi.clear(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: queryKeys.cart.current });
      const previousCart = queryClient.getQueryData(queryKeys.cart.current);
      setCartItems([]);
      return { previousCart };
    },
    onError: (err, variables, context) => {
      if (context?.previousCart) {
        queryClient.setQueryData(queryKeys.cart.current, context.previousCart);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.current });
    },
  });
  
  return {
    addToCart,
    updateQuantity,
    clearCart,
  };
}
