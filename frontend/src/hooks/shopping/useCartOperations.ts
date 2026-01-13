/**
 * useCartOperations - Cart manipulation operations hook
 * Handles add, update, remove operations with optimistic updates
 */
import { useCallback } from 'react';
import { useAppStore } from '../../store/appStore';
import { cartApi } from '../../services/api';

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
  const setCartItems = useAppStore((state) => state.setCartItems);

  // Safe array helper
  const safeCartItems = Array.isArray(cartItems) ? cartItems : [];

  /**
   * Update cart item quantity
   */
  const updateCartQuantity = useCallback(
    async (productId: string, newQuantity: number) => {
      if (newQuantity < 1) {
        removeFromCart(productId);
        return;
      }

      // Optimistic update
      setLocalCartItems(
        safeCartItems.map((item) =>
          item.product_id === productId
            ? { ...item, quantity: newQuantity }
            : item
        )
      );

      if (!isAdminView) {
        try {
          await cartApi.updateItem(productId, newQuantity);
          const cartRes = await cartApi.get();
          const items = cartRes.data?.items || [];
          setLocalCartItems(items);
          setCartItems(items);
        } catch (error) {
          console.error('[useCartOperations] Error updating cart:', error);
          loadData(); // Revert on error
        }
      }
    },
    [safeCartItems, setLocalCartItems, isAdminView, setCartItems, loadData]
  );

  /**
   * Remove item from cart
   */
  const removeFromCart = useCallback(
    async (productId: string) => {
      // Optimistic update
      setLocalCartItems(
        safeCartItems.filter((item) => item.product_id !== productId)
      );

      if (!isAdminView) {
        try {
          await cartApi.updateItem(productId, 0);
          const cartRes = await cartApi.get();
          const items = cartRes.data?.items || [];
          setCartItems(items);
        } catch (error) {
          console.error('[useCartOperations] Error removing from cart:', error);
          loadData();
        }
      }
    },
    [safeCartItems, setLocalCartItems, isAdminView, setCartItems, loadData]
  );

  /**
   * Add product to cart
   */
  const addToCart = useCallback(
    async (product: any, quantity: number = 1) => {
      const existing = safeCartItems.find(
        (item) => item.product_id === product.id
      );

      if (existing) {
        await updateCartQuantity(product.id, existing.quantity + quantity);
      } else {
        const newItem = {
          product_id: product.id,
          product: product,
          quantity: quantity,
          original_unit_price: product.price,
          final_unit_price: product.price,
        };

        setLocalCartItems([...safeCartItems, newItem]);

        if (!isAdminView) {
          try {
            await cartApi.addItem(product.id, quantity);
            const cartRes = await cartApi.get();
            const items = cartRes.data?.items || [];
            setLocalCartItems(items);
            setCartItems(items);
          } catch (error) {
            console.error('[useCartOperations] Error adding to cart:', error);
          }
        }
      }
    },
    [safeCartItems, setLocalCartItems, isAdminView, setCartItems, updateCartQuantity]
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
