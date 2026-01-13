/**
 * useShoppingHubData - Main data fetching and state management hook
 * Handles loading data for both customer and admin views
 */
import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { cartApi, favoriteApi, orderApi } from '../../services/api';
import api from '../../services/api';

export interface ShoppingHubState {
  loading: boolean;
  refreshing: boolean;
  favorites: any[];
  cartItems: any[];
  orders: any[];
  profileData: any;
}

export interface UseShoppingHubDataProps {
  customerId?: string;
  customerData?: any;
  isAdminView: boolean;
}

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

export const useShoppingHubData = ({
  customerId,
  customerData,
  isAdminView,
}: UseShoppingHubDataProps) => {
  const user = useAppStore((state) => state.user);
  const setCartItems = useAppStore((state) => state.setCartItems);

  const [state, setState] = useState<ShoppingHubState>({
    loading: true,
    refreshing: false,
    favorites: [],
    cartItems: [],
    orders: [],
    profileData: null,
  });

  // Determine target user
  const targetUserId = customerId || user?.id;
  const isOwnProfile = !isAdminView && !customerId;

  /**
   * Load data based on view type (admin vs customer)
   */
  const loadData = useCallback(async () => {
    if (!targetUserId && !isOwnProfile) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));

    try {
      if (isAdminView && customerId) {
        // Admin viewing customer data
        const [favRes, cartRes, ordersRes] = await Promise.all([
          api
            .get(`/customers/admin/customer/${customerId}/favorites`)
            .catch(() => ({ data: { favorites: [] } })),
          api
            .get(`/customers/admin/customer/${customerId}/cart`)
            .catch(() => ({ data: { items: [] } })),
          api
            .get(`/customers/admin/customer/${customerId}/orders`)
            .catch(() => ({ data: { orders: [] } })),
        ]);

        const processedFavorites = processFavoritesData(
          favRes.data?.favorites || []
        );

        setState((prev) => ({
          ...prev,
          favorites: processedFavorites,
          cartItems: cartRes.data?.items || [],
          orders: ordersRes.data?.orders || [],
          profileData: customerData,
          loading: false,
          refreshing: false,
        }));
      } else {
        // User viewing own data
        const [favRes, cartRes, ordersRes] = await Promise.all([
          favoriteApi.getAll().catch(() => ({ data: [] })),
          cartApi.get().catch(() => ({ data: { items: [] } })),
          orderApi.getAll().catch(() => ({ data: [] })),
        ]);

        const favoritesData = Array.isArray(favRes.data)
          ? favRes.data
          : favRes.data?.favorites || [];
        const processedFavorites = processFavoritesData(favoritesData);
        const items = cartRes.data?.items || [];
        const ordersData = Array.isArray(ordersRes.data)
          ? ordersRes.data
          : ordersRes.data?.orders || [];

        // Sync cart with global store
        setCartItems(items);

        setState((prev) => ({
          ...prev,
          favorites: processedFavorites,
          cartItems: items,
          orders: ordersData,
          profileData: user,
          loading: false,
          refreshing: false,
        }));
      }
    } catch (error) {
      console.error('[useShoppingHubData] Error loading data:', error);
      setState((prev) => ({ ...prev, loading: false, refreshing: false }));
    }
  }, [targetUserId, isAdminView, customerId, customerData, user, setCartItems, isOwnProfile]);

  /**
   * Refresh data with pull-to-refresh support
   */
  const onRefresh = useCallback(() => {
    setState((prev) => ({ ...prev, refreshing: true }));
    loadData();
  }, [loadData]);

  // Initial data load
  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Update favorites locally
   */
  const setFavorites = useCallback((favorites: any[]) => {
    setState((prev) => ({ ...prev, favorites }));
  }, []);

  /**
   * Update cart items locally
   */
  const setLocalCartItems = useCallback((cartItems: any[]) => {
    setState((prev) => ({ ...prev, cartItems }));
  }, []);

  /**
   * Update orders locally
   */
  const setOrders = useCallback((orders: any[]) => {
    setState((prev) => ({ ...prev, orders }));
  }, []);

  return {
    ...state,
    targetUserId,
    isOwnProfile,
    loadData,
    onRefresh,
    setFavorites,
    setLocalCartItems,
    setOrders,
  };
};

export default useShoppingHubData;
