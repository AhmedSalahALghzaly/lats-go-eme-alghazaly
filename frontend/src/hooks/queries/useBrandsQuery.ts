/**
 * Product Brands Query Hook with React Query
 * Provides data fetching for product brands with caching and loading states
 */
import { useQuery } from '@tanstack/react-query';
import { productBrandsApi } from '../../services/api';

// Query key for product brands
export const productBrandsKeys = {
  all: ['productBrands'] as const,
  filtered: (filters: { country?: string; search?: string }) => 
    ['productBrands', 'filtered', filters] as const,
};

/**
 * Hook to fetch all product brands
 */
export function useBrandsQuery() {
  return useQuery({
    queryKey: productBrandsKeys.all,
    queryFn: async () => {
      const response = await productBrandsApi.getAll();
      return response.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export default useBrandsQuery;
