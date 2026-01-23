/**
 * useCartOperations - Cart manipulation operations hook
 * FIXED: Uses React Query mutations for real-time UI updates
 * ENHANCED: Optimistic updates with haptic feedback for instant UI response
 * Handles add, update, remove operations with immediate feedback
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../../store/appStore';
import { cartApi } from '../../services/api';
import { shoppingHubKeys, useCartMutations } from '../queries/useShoppingHubQuery';

interface UseCartOperationsProps {
  cartItems: any[];
  setLocalCartItems: (items: any[]) => void;
  isAdminView: boolean;
  loadData: () => void;
}

export const useCartOperations = ({
  cartItems,
  setLocalCartItems,
  isAdminView,
  loadData,
}: UseCartOperationsProps) => {
  const queryClient = useQueryClient();
  const setCartItems = useAppStore((state) => state.setCartItems);
  
  // Use React Query mutations for real-time updates
  const { updateQuantity: updateQuantityMutation, removeFromCart: removeFromCartMutation, addToCart: addToCartMutation } = useCartMutations();

  // Safe array helper
  const safeCartItems = Array.isArray(cartItems) ? cartItems : [];

  /**
   * Remove item from cart - uses React Query mutation for instant UI update
   * Includes haptic feedback for better UX
   */
  const removeFromCart = useCallback(
    async (productId: string) => {
      if (isAdminView) {
        // Admin view - just update local state with haptic feedback
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setLocalCartItems(
          safeCartItems.filter((item) => item.product_id !== productId)
        );
        return;
      }

      // Use mutation for optimistic update - haptic already triggered in CartTab
      try {
        await removeFromCartMutation.mutateAsync(productId);
      } catch (error) {
        console.error('[useCartOperations] Error removing from cart:', error);
        // Haptic feedback for error
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [safeCartItems, setLocalCartItems, isAdminView, removeFromCartMutation]
  );

  /**
   * Update cart item quantity - uses React Query mutation for instant UI update
   */
  const updateCartQuantity = useCallback(
    async (productId: string, newQuantity: number) => {
      if (newQuantity < 1) {
        removeFromCart(productId);
        return;
      }

      if (isAdminView) {
        // Admin view - just update local state
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setLocalCartItems(
          safeCartItems.map((item) =>
            item.product_id === productId
              ? { ...item, quantity: newQuantity }
              : item
          )
        );
        return;
      }

      // Use mutation for optimistic update
      try {
        await updateQuantityMutation.mutateAsync({ productId, quantity: newQuantity });
      } catch (error) {
        console.error('[useCartOperations] Error updating cart:', error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [safeCartItems, setLocalCartItems, isAdminView, updateQuantityMutation, removeFromCart]
  );

  /**
   * Add product to cart - uses React Query mutation for instant UI update
   */
  const addToCart = useCallback(
    async (product: any, quantity: number = 1) => {
      const existing = safeCartItems.find(
        (item) => item.product_id === product.id
      );

      if (existing) {
        await updateCartQuantity(product.id, existing.quantity + quantity);
      } else {
        if (isAdminView) {
          const newItem = {
            product_id: product.id,
            product: product,
            quantity: quantity,
            original_unit_price: product.price,
            final_unit_price: product.price,
          };
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setLocalCartItems([...safeCartItems, newItem]);
          return;
        }

        // Use mutation for optimistic update
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await addToCartMutation.mutateAsync(product.id);
        } catch (error) {
          console.error('[useCartOperations] Error adding to cart:', error);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      }
    },
    [safeCartItems, setLocalCartItems, isAdminView, updateCartQuantity, addToCartMutation]
  );

  /**
   * Calculate cart totals
   */
  const getSubtotal = useCallback(() => {
    return safeCartItems.reduce((sum, item) => {
      const price = item.final_unit_price || item.product?.price || 0;
      return sum + price * item.quantity;
    }, 0);
  }, [safeCartItems]);

  const getOriginalTotal = useCallback(() => {
    return safeCartItems.reduce((sum, item) => {
      const price = item.original_unit_price || item.product?.price || 0;
      return sum + price * item.quantity;
    }, 0);
  }, [safeCartItems]);

  const getTotalSavings = useCallback(() => {
    return getOriginalTotal() - getSubtotal();
  }, [getOriginalTotal, getSubtotal]);

  const getItemCount = useCallback(() => {
    return safeCartItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [safeCartItems]);

  return {
    safeCartItems,
    updateCartQuantity,
    removeFromCart,
    addToCart,
    getSubtotal,
    getOriginalTotal,
    getTotalSavings,
    getItemCount,
  };
};

export default useCartOperations;
