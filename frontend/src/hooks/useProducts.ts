/**
 * Products Hook with React Query
 * Implements smart delta sync and optimistic updates
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { productApi } from '../services/api';
import { useAppStore } from '../store/appStore';
import { useCallback } from 'react';

// Products list with filters
export function useProducts(filters?: {
  category_id?: string;
  product_brand_id?: string;
  car_model_id?: string;
  min_price?: number;
  max_price?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: queryKeys.products.list(filters),
    queryFn: async () => {
      const response = await productApi.getAll(filters);
      return response.data;
    },
    staleTime: 3 * 60 * 1000, // 3 minutes for products
  });
}

// All products for admin
export function useAllProducts() {
  const { setProducts } = useAppStore.getState();
  
  return useQuery({
    queryKey: queryKeys.products.all,
    queryFn: async () => {
      const response = await productApi.getAllAdmin();
      const products = response.data?.products || [];
      // Sync to Zustand for offline access
      setProducts(products);
      return products;
    },
    staleTime: 2 * 60 * 1000,
  });
}

// Single product detail
export function useProduct(productId: string) {
  return useQuery({
    queryKey: queryKeys.products.detail(productId),
    queryFn: async () => {
      const response = await productApi.getById(productId);
      return response.data;
    },
    enabled: !!productId,
  });
}

// Product search
export function useProductSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.products.search(query),
    queryFn: async () => {
      const response = await productApi.search(query);
      return response.data;
    },
    enabled: query.length >= 1,
    staleTime: 30 * 1000, // 30 seconds for search
  });
}

// Product mutations with optimistic updates
export function useProductMutations() {
  const queryClient = useQueryClient();
  
  // Create product
  const createProduct = useMutation({
    mutationFn: (data: any) => productApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
  
  // Update product
  const updateProduct = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productApi.update(id, data),
    onMutate: async ({ id, data }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.products.detail(id) });
      
      // Snapshot previous value
      const previousProduct = queryClient.getQueryData(queryKeys.products.detail(id));
      
      // Optimistically update
      queryClient.setQueryData(queryKeys.products.detail(id), (old: any) => ({
        ...old,
        ...data,
      }));
      
      return { previousProduct };
    },
    onError: (err, { id }, context) => {
      // Rollback on error
      if (context?.previousProduct) {
        queryClient.setQueryData(queryKeys.products.detail(id), context.previousProduct);
      }
    },
    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.detail(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
  
  // Update price (optimistic)
  const updatePrice = useMutation({
    mutationFn: ({ id, price }: { id: string; price: number }) => productApi.updatePrice(id, price),
    onMutate: async ({ id, price }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products.all });
      
      const previousProducts = queryClient.getQueryData(queryKeys.products.all);
      
      // Optimistic update in list
      queryClient.setQueryData(queryKeys.products.all, (old: any[]) => 
        old?.map((p: any) => p.id === id ? { ...p, price } : p)
      );
      
      return { previousProducts };
    },
    onError: (err, variables, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(queryKeys.products.all, context.previousProducts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
  
  // Delete product
  const deleteProduct = useMutation({
    mutationFn: (id: string) => productApi.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products.all });
      
      const previousProducts = queryClient.getQueryData(queryKeys.products.all);
      
      // Optimistic removal
      queryClient.setQueryData(queryKeys.products.all, (old: any[]) => 
        old?.filter((p: any) => p.id !== id)
      );
      
      return { previousProducts };
    },
    onError: (err, id, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(queryKeys.products.all, context.previousProducts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
  
  return {
    createProduct,
    updateProduct,
    updatePrice,
    deleteProduct,
  };
}
