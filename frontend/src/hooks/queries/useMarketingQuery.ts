/**
 * Marketing Query Hook with React Query
 * Provides data fetching for promotions and bundle offers
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { promotionApi, bundleOfferApi, productApi, carModelApi } from '../../services/api';

// Query keys for marketing
export const marketingKeys = {
  promotions: ['promotions'] as const,
  bundles: ['bundles'] as const,
  products: ['marketingProducts'] as const,
  carModels: ['marketingCarModels'] as const,
  all: ['marketing'] as const,
};

/**
 * Hook to fetch all marketing data (promotions, bundles, products, car models)
 */
export function useMarketingQuery() {
  return useQuery({
    queryKey: marketingKeys.all,
    queryFn: async () => {
      const [promosRes, bundlesRes, productsRes, modelsRes] = await Promise.all([
        promotionApi.getAllForAdmin(),
        bundleOfferApi.getAllForAdmin(),
        productApi.getAll({ limit: 1000 }),
        carModelApi.getAll(),
      ]);

      return {
        promotions: promosRes.data || [],
        bundles: bundlesRes.data || [],
        products: productsRes.data?.products || [],
        carModels: modelsRes.data || [],
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch promotions only
 */
export function usePromotionsQuery() {
  return useQuery({
    queryKey: marketingKeys.promotions,
    queryFn: async () => {
      const response = await promotionApi.getAllForAdmin();
      return response.data || [];
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook to fetch bundles only
 */
export function useBundlesQuery() {
  return useQuery({
    queryKey: marketingKeys.bundles,
    queryFn: async () => {
      const response = await bundleOfferApi.getAllForAdmin();
      return response.data || [];
    },
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Hook for promotion mutations
 */
export function usePromotionMutations() {
  const queryClient = useQueryClient();

  const createPromotion = useMutation({
    mutationFn: (data: any) => promotionApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketingKeys.promotions });
      queryClient.invalidateQueries({ queryKey: marketingKeys.all });
    },
  });

  const updatePromotion = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      promotionApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketingKeys.promotions });
      queryClient.invalidateQueries({ queryKey: marketingKeys.all });
    },
  });

  const deletePromotion = useMutation({
    mutationFn: (id: string) => promotionApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: marketingKeys.promotions });
      const previousPromotions = queryClient.getQueryData(marketingKeys.promotions);
      
      // Optimistic removal
      queryClient.setQueryData(marketingKeys.promotions, (old: any[]) =>
        old?.filter((p) => p.id !== id)
      );
      
      return { previousPromotions };
    },
    onError: (err, id, context) => {
      if (context?.previousPromotions) {
        queryClient.setQueryData(marketingKeys.promotions, context.previousPromotions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: marketingKeys.promotions });
      queryClient.invalidateQueries({ queryKey: marketingKeys.all });
    },
  });

  const reorderPromotions = useMutation({
    mutationFn: async (newOrder: any[]) => {
      await Promise.all(
        newOrder.map((promo, index) =>
          promotionApi.update(promo.id, { ...promo, sort_order: index })
        )
      );
    },
    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({ queryKey: marketingKeys.promotions });
      const previousPromotions = queryClient.getQueryData(marketingKeys.promotions);
      
      // Optimistic update
      queryClient.setQueryData(marketingKeys.promotions, newOrder);
      
      return { previousPromotions };
    },
    onError: (err, newOrder, context) => {
      if (context?.previousPromotions) {
        queryClient.setQueryData(marketingKeys.promotions, context.previousPromotions);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: marketingKeys.promotions });
      queryClient.invalidateQueries({ queryKey: marketingKeys.all });
    },
  });

  return {
    createPromotion,
    updatePromotion,
    deletePromotion,
    reorderPromotions,
  };
}

/**
 * Hook for bundle mutations
 */
export function useBundleMutations() {
  const queryClient = useQueryClient();

  const createBundle = useMutation({
    mutationFn: (data: any) => bundleOfferApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketingKeys.bundles });
      queryClient.invalidateQueries({ queryKey: marketingKeys.all });
    },
  });

  const updateBundle = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      bundleOfferApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: marketingKeys.bundles });
      queryClient.invalidateQueries({ queryKey: marketingKeys.all });
    },
  });

  const deleteBundle = useMutation({
    mutationFn: (id: string) => bundleOfferApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: marketingKeys.bundles });
      const previousBundles = queryClient.getQueryData(marketingKeys.bundles);
      
      // Optimistic removal
      queryClient.setQueryData(marketingKeys.bundles, (old: any[]) =>
        old?.filter((b) => b.id !== id)
      );
      
      return { previousBundles };
    },
    onError: (err, id, context) => {
      if (context?.previousBundles) {
        queryClient.setQueryData(marketingKeys.bundles, context.previousBundles);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: marketingKeys.bundles });
      queryClient.invalidateQueries({ queryKey: marketingKeys.all });
    },
  });

  return {
    createBundle,
    updateBundle,
    deleteBundle,
  };
}

export default useMarketingQuery;
