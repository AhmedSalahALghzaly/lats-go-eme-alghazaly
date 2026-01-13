/**
 * useFavoriteOperations - Favorites management hook
 * Handles toggling favorites and adding to cart
 */
import { useCallback } from 'react';
import { favoriteApi } from '../../services/api';

interface UseFavoriteOperationsProps {
  setFavorites: (favorites: any[]) => void;
  isAdminView: boolean;
}

export const useFavoriteOperations = ({
  setFavorites,
  isAdminView,
}: UseFavoriteOperationsProps) => {
  /**
   * Toggle favorite status
   */
  const toggleFavorite = useCallback(
    async (productId: string) => {
      if (isAdminView) return;

      try {
        await favoriteApi.toggle(productId);
        // Refresh favorites
        const favRes = await favoriteApi.getAll();
        setFavorites(favRes.data || []);
      } catch (error) {
        console.error('[useFavoriteOperations] Error toggling favorite:', error);
      }
    },
    [isAdminView, setFavorites]
  );

  return {
    toggleFavorite,
  };
};

export default useFavoriteOperations;
