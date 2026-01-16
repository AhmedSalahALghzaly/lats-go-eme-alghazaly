/**
 * Orders Hook with React Query
 * Implements optimistic status updates
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryClient';
import { orderApi } from '../services/api';
import { useAppStore } from '../store/appStore';

// User's orders
export function useOrders() {
  const { isAuthenticated, setOrders } = useAppStore();
  
  return useQuery({
    queryKey: queryKeys.orders.all,
    queryFn: async () => {
      const response = await orderApi.getAll();
      const orders = response.data?.orders || [];
      setOrders(orders);
      return orders;
    },
    enabled: isAuthenticated,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Admin orders
export function useAdminOrders(status?: string) {
  const { userRole, setOrders } = useAppStore();
  const isAdmin = ['owner', 'partner', 'admin'].includes(userRole);
  
  return useQuery({
    queryKey: [...queryKeys.orders.admin, status],
    queryFn: async () => {
      const response = await orderApi.getAllAdmin();
      const orders = response.data?.orders || [];
      setOrders(orders);
      return orders;
    },
    enabled: isAdmin,
    staleTime: 30 * 1000,
  });
}

// Single order detail
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: async () => {
      const response = await orderApi.getById(orderId);
      return response.data;
    },
    enabled: !!orderId,
  });
}

// Order mutations with optimistic updates
export function useOrderMutations() {
  const queryClient = useQueryClient();
  
  // Update status (optimistic)
  const updateStatus = useMutation({
    mutationFn: ({ orderId, status }: { orderId: string; status: string }) => 
      orderApi.updateStatus(orderId, status),
    onMutate: async ({ orderId, status }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.admin });
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.detail(orderId) });
      
      const previousOrders = queryClient.getQueryData(queryKeys.orders.admin);
      const previousOrder = queryClient.getQueryData(queryKeys.orders.detail(orderId));
      
      // Optimistic update in list
      queryClient.setQueryData(queryKeys.orders.admin, (old: any[]) => 
        old?.map((o: any) => o.id === orderId ? { ...o, status } : o)
      );
      
      // Optimistic update in detail
      queryClient.setQueryData(queryKeys.orders.detail(orderId), (old: any) => 
        old ? { ...old, status } : old
      );
      
      return { previousOrders, previousOrder };
    },
    onError: (err, { orderId }, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(queryKeys.orders.admin, context.previousOrders);
      }
      if (context?.previousOrder) {
        queryClient.setQueryData(queryKeys.orders.detail(orderId), context.previousOrder);
      }
    },
    onSettled: (data, error, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.admin });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
    },
  });
  
  // Create order
  const createOrder = useMutation({
    mutationFn: (data: any) => orderApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.current });
    },
  });
  
  // Delete order (Owner only)
  const deleteOrder = useMutation({
    mutationFn: (orderId: string) => orderApi.delete(orderId),
    onMutate: async (orderId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.admin });
      
      const previousOrders = queryClient.getQueryData(queryKeys.orders.admin);
      
      // Optimistic removal
      queryClient.setQueryData(queryKeys.orders.admin, (old: any[]) => 
        old?.filter((o: any) => o.id !== orderId)
      );
      
      return { previousOrders };
    },
    onError: (err, orderId, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(queryKeys.orders.admin, context.previousOrders);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.admin });
    },
  });
  
  return {
    updateStatus,
    createOrder,
    deleteOrder,
  };
}
