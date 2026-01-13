/**
 * useOrderOperations - Order management operations hook
 * Handles order submission and status updates
 */
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useAppStore } from '../../store/appStore';
import { orderApi } from '../../services/api';
import api from '../../services/api';

export interface CheckoutForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  country: string;
  deliveryInstructions: string;
  paymentMethod: string;
}

interface UseOrderOperationsProps {
  cartItems: any[];
  setLocalCartItems: (items: any[]) => void;
  setOrders: (orders: any[]) => void;
  customerId?: string;
  isAdminView: boolean;
  language: string;
}

export const useOrderOperations = ({
  cartItems,
  setLocalCartItems,
  setOrders,
  customerId,
  isAdminView,
  language,
}: UseOrderOperationsProps) => {
  const setCartItems = useAppStore((state) => state.setCartItems);
  const userRole = useAppStore((state) => state.userRole);

  const [checkoutForm, setCheckoutForm] = useState<CheckoutForm>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    streetAddress: '',
    city: '',
    state: '',
    country: 'Egypt',
    deliveryInstructions: '',
    paymentMethod: 'cash_on_delivery',
  });
  const [submittingOrder, setSubmittingOrder] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  const safeCartItems = Array.isArray(cartItems) ? cartItems : [];

  // Check if user can edit order status
  const canEditOrderStatus = ['owner', 'partner', 'admin'].includes(userRole);

  /**
   * Pre-fill checkout form with user data
   */
  const prefillForm = useCallback((userData: any) => {
    if (userData) {
      setCheckoutForm((prev) => ({
        ...prev,
        firstName: userData.name?.split(' ')[0] || '',
        lastName: userData.name?.split(' ').slice(1).join(' ') || '',
        email: userData.email || '',
        phone: userData.phone || '',
      }));
    }
  }, []);

  /**
   * Submit order
   */
  const handleSubmitOrder = useCallback(async () => {
    if (
      !checkoutForm.firstName ||
      !checkoutForm.phone ||
      !checkoutForm.streetAddress ||
      !checkoutForm.city
    ) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar'
          ? 'يرجى ملء جميع الحقول المطلوبة'
          : 'Please fill all required fields'
      );
      return false;
    }

    if (safeCartItems.length === 0) {
      Alert.alert(
        language === 'ar' ? 'السلة فارغة' : 'Cart Empty',
        language === 'ar'
          ? 'أضف منتجات للسلة أولاً'
          : 'Add products to cart first'
      );
      return false;
    }

    setSubmittingOrder(true);
    try {
      let response;

      if (isAdminView && customerId) {
        // Admin creating order for customer
        const orderPayload = {
          user_id: customerId,
          first_name: checkoutForm.firstName,
          last_name: checkoutForm.lastName,
          email: checkoutForm.email,
          phone: checkoutForm.phone,
          street_address: checkoutForm.streetAddress,
          city: checkoutForm.city,
          state: checkoutForm.state,
          country: checkoutForm.country,
          delivery_instructions: checkoutForm.deliveryInstructions,
          payment_method: checkoutForm.paymentMethod,
          items: safeCartItems.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
          })),
        };
        response = await api.post('/orders/admin/create', orderPayload);
      } else {
        // Customer placing own order
        response = await orderApi.create({
          first_name: checkoutForm.firstName,
          last_name: checkoutForm.lastName,
          email: checkoutForm.email,
          phone: checkoutForm.phone,
          street_address: checkoutForm.streetAddress,
          city: checkoutForm.city,
          state: checkoutForm.state,
          country: checkoutForm.country,
          delivery_instructions: checkoutForm.deliveryInstructions,
          payment_method: checkoutForm.paymentMethod,
        });
      }

      setConfirmedOrder(response.data);
      setShowOrderConfirmation(true);
      setLocalCartItems([]);

      if (!isAdminView) {
        setCartItems([]);
      }

      // Refresh orders
      const ordersRes =
        isAdminView && customerId
          ? await api.get(`/customers/admin/customer/${customerId}/orders`)
          : await orderApi.getAll();
      setOrders(ordersRes.data?.orders || ordersRes.data || []);

      return true;
    } catch (error) {
      console.error('[useOrderOperations] Error submitting order:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'فشل إنشاء الطلب' : 'Failed to create order'
      );
      return false;
    } finally {
      setSubmittingOrder(false);
    }
  }, [checkoutForm, safeCartItems, isAdminView, customerId, language, setLocalCartItems, setCartItems, setOrders]);

  /**
   * Update order status (admin only)
   */
  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: string, orders: any[]) => {
      setUpdatingOrderId(orderId + '_' + newStatus);
      try {
        // 1 second loading feedback as per requirement
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await api.patch(`/orders/${orderId}/status?status=${newStatus}`);
        
        // Update local state immediately
        const updatedOrders = orders.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        );
        setOrders(updatedOrders);
      } catch (error) {
        console.error('[useOrderOperations] Error updating order status:', error);
      } finally {
        setUpdatingOrderId(null);
      }
    },
    [setOrders]
  );

  /**
   * Close confirmation modal
   */
  const closeOrderConfirmation = useCallback(() => {
    setShowOrderConfirmation(false);
  }, []);

  return {
    checkoutForm,
    setCheckoutForm,
    submittingOrder,
    updatingOrderId,
    showOrderConfirmation,
    confirmedOrder,
    canEditOrderStatus,
    prefillForm,
    handleSubmitOrder,
    updateOrderStatus,
    closeOrderConfirmation,
  };
};

export default useOrderOperations;
