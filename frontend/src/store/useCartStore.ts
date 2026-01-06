/**
 * Cart Store - Handles shopping cart state
 * Split from monolithic appStore for better performance
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cartApi } from '../services/api';

export interface CartItemData {
  productId: string;
  quantity: number;
  product?: any;
  // Bundle support
  bundleGroupId?: string;
  bundleOfferId?: string;
  bundleOfferName?: string;
  bundleDiscount?: number;
  originalPrice?: number;
  discountedPrice?: number;
}

interface CartState {
  cartItems: CartItemData[];

  // Actions
  addToCart: (item: CartItemData | string, quantity?: number) => void;
  addToLocalCart: (item: { product_id: string; quantity: number; product?: any }) => void;
  updateCartItem: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string, voidBundle?: boolean) => void;
  clearCart: () => void;
  clearLocalCart: () => void;
  getCartTotal: () => number;
  getCartSubtotal: () => number;
  getBundleGroups: () => Map<string, CartItemData[]>;
  voidBundleDiscount: (bundleGroupId: string, syncToBackend?: boolean) => void;
  setCartItems: (items: any[]) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cartItems: [],

      addToCart: (item, quantity = 1) => {
        const { cartItems } = get();

        if (typeof item === 'string') {
          const productId = item;
          const existingIndex = cartItems.findIndex(
            (ci) => ci.productId === productId && !ci.bundleGroupId
          );
          if (existingIndex >= 0) {
            const updated = [...cartItems];
            updated[existingIndex].quantity += quantity;
            set({ cartItems: updated });
          } else {
            set({ cartItems: [...cartItems, { productId, quantity }] });
          }
        } else {
          const cartItem = item as CartItemData;
          const existingIndex = cartItems.findIndex(
            (ci) =>
              ci.productId === cartItem.productId &&
              ci.bundleGroupId === cartItem.bundleGroupId
          );
          if (existingIndex >= 0) {
            const updated = [...cartItems];
            updated[existingIndex].quantity += cartItem.quantity || 1;
            set({ cartItems: updated });
          } else {
            set({
              cartItems: [...cartItems, { ...cartItem, quantity: cartItem.quantity || 1 }],
            });
          }
        }
      },

      addToLocalCart: (item) => {
        const { cartItems } = get();
        const existingIndex = cartItems.findIndex(
          (ci) => ci.productId === item.product_id && !ci.bundleGroupId
        );

        if (existingIndex >= 0) {
          const updated = [...cartItems];
          updated[existingIndex].quantity += item.quantity;
          updated[existingIndex].product = item.product;
          set({ cartItems: updated });
        } else {
          set({
            cartItems: [
              ...cartItems,
              {
                productId: item.product_id,
                quantity: item.quantity,
                product: item.product,
              },
            ],
          });
        }
      },

      updateCartItem: (productId, quantity) => {
        const { cartItems } = get();
        if (quantity <= 0) {
          const item = cartItems.find((i) => i.productId === productId);
          if (item?.bundleGroupId) {
            get().voidBundleDiscount(item.bundleGroupId);
          }
          set({ cartItems: cartItems.filter((item) => item.productId !== productId) });
        } else {
          set({
            cartItems: cartItems.map((item) =>
              item.productId === productId ? { ...item, quantity } : item
            ),
          });
        }
      },

      removeFromCart: (productId, voidBundle = true) => {
        const { cartItems } = get();
        const itemToRemove = cartItems.find((item) => item.productId === productId);

        // CRITICAL: If removing an item that belongs to a bundle, 
        // void ALL discounts for remaining items in that bundle
        if (itemToRemove?.bundleGroupId && voidBundle) {
          // Always void the bundle discount when removing any bundle item
          // because the bundle is no longer complete
          get().voidBundleDiscount(itemToRemove.bundleGroupId);
        }

        // Remove the item from cart
        set({ cartItems: cartItems.filter((item) => item.productId !== productId) });
      },

      clearCart: () => set({ cartItems: [] }),
      clearLocalCart: () => set({ cartItems: [] }),

      getCartTotal: () =>
        get().cartItems.reduce((total, item) => total + item.quantity, 0),

      getCartSubtotal: () =>
        get().cartItems.reduce((total, item) => {
          const price = item.discountedPrice || item.product?.price || 0;
          return total + price * item.quantity;
        }, 0),

      getBundleGroups: () => {
        const { cartItems } = get();
        const groups = new Map<string, CartItemData[]>();
        cartItems.forEach((item) => {
          if (item.bundleGroupId) {
            const existing = groups.get(item.bundleGroupId) || [];
            groups.set(item.bundleGroupId, [...existing, item]);
          }
        });
        return groups;
      },

      voidBundleDiscount: (bundleGroupId, syncToBackend = true) => {
        const { cartItems } = get();
        const updatedItems = cartItems.map((item) => {
          if (item.bundleGroupId === bundleGroupId) {
            // Reset discounted price to original price
            const originalPrice = item.originalPrice || item.product?.price || item.discountedPrice;
            return {
              ...item,
              bundleGroupId: undefined,
              bundleOfferId: undefined,
              bundleOfferName: undefined,
              bundleDiscount: undefined,
              discountedPrice: originalPrice, // Reset to original price
            };
          }
          return item;
        });
        set({ cartItems: updatedItems });
        
        // Sync with backend to void bundle discount on server-side cart
        if (syncToBackend) {
          cartApi.voidBundle(bundleGroupId).catch((error) => {
            console.error('Failed to sync bundle void to backend:', error);
          });
        }
      },

      setCartItems: (items) => {
        const cartItems = items.map((item: any) => ({
          productId: item.product_id || item.productId,
          quantity: item.quantity,
          product: item.product,
          bundleGroupId: item.bundleGroupId,
          bundleOfferId: item.bundleOfferId,
          bundleOfferName: item.bundleOfferName,
          bundleDiscount: item.bundleDiscount,
          originalPrice: item.originalPrice,
          discountedPrice: item.discountedPrice,
        }));
        set({ cartItems });
      },
    }),
    {
      name: 'alghazaly-cart-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        cartItems: state.cartItems,
      }),
    }
  )
);

// Selectors
export const useCartItems = () => useCartStore((state) => state.cartItems);
export const useCartTotal = () => useCartStore((state) => state.getCartTotal());
export const useCartSubtotal = () => useCartStore((state) => state.getCartSubtotal());

export default useCartStore;
