import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../src/hooks/useTheme';
import { useTranslation } from '../../../src/hooks/useTranslation';
import { Header } from '../../../src/components/Header';
import api, { orderApi } from '../../../src/services/api';
import { useIsOwner, useCanAccessAdminPanel } from '../../../src/store/appStore';

const SHIPPING_COST = 150;

// Status flow configuration
const STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'shipped', 'out_for_delivery', 'delivered'];
const STATUS_COLORS = {
  pending: '#F59E0B',
  confirmed: '#EF4444',
  preparing: '#FBBF24',
  shipped: '#10B981',
  out_for_delivery: '#3B82F6',
  delivered: '#6B7280',
  cancelled: '#EF4444',
};

export default function OrderDetailAdmin() {
  const { colors } = useTheme();
  const { language, isRTL } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const isOwner = useIsOwner();
  const isAdmin = useCanAccessAdminPanel();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [discountInput, setDiscountInput] = useState('');
  const [applyingDiscount, setApplyingDiscount] = useState(false);
  const [discountApplied, setDiscountApplied] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchOrder();
  }, [id]);

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/admin/orders/${id}`);
      setOrder(response.data);
      if (response.data?.discount > 0) {
        setDiscountInput(response.data.discount.toString());
        setDiscountApplied(true);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = useCallback(async (newStatus) => {
    setUpdatingStatus(newStatus);
    try {
      // Show loading for 1 second as per requirement
      await new Promise(resolve => setTimeout(resolve, 1000));
      await orderApi.updateStatus(id, newStatus);
      setOrder((prev) => ({ ...prev, status: newStatus }));
    } catch (error) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        error.response?.data?.detail || 'Failed to update status'
      );
    } finally {
      setUpdatingStatus(null);
    }
  }, [id, language]);

  const handleCancelOrder = useCallback(async () => {
    Alert.alert(
      language === 'ar' ? 'إلغاء الطلب' : 'Cancel Order',
      language === 'ar' ? 'هل أنت متأكد من إلغاء هذا الطلب؟' : 'Are you sure you want to cancel this order?',
      [
        { text: language === 'ar' ? 'لا' : 'No', style: 'cancel' },
        {
          text: language === 'ar' ? 'نعم' : 'Yes',
          style: 'destructive',
          onPress: async () => {
            setUpdatingStatus('cancelled');
            try {
              await new Promise(resolve => setTimeout(resolve, 1000));
              await orderApi.updateStatus(id, 'cancelled');
              setOrder((prev) => ({ ...prev, status: 'cancelled' }));
            } catch (error) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to cancel order');
            } finally {
              setUpdatingStatus(null);
            }
          }
        }
      ]
    );
  }, [id, language]);

  const handleDeleteOrder = useCallback(async () => {
    Alert.alert(
      language === 'ar' ? 'حذف الطلب نهائياً' : 'Delete Order Permanently',
      language === 'ar' ? 'سيتم حذف هذا الطلب نهائياً ولا يمكن استرجاعه. هل أنت متأكد؟' : 'This order will be permanently deleted and cannot be recovered. Are you sure?',
      [
        { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await orderApi.delete(id);
              Alert.alert(
                language === 'ar' ? 'تم' : 'Done',
                language === 'ar' ? 'تم حذف الطلب بنجاح' : 'Order deleted successfully',
                [{ text: 'OK', onPress: () => router.back() }]
              );
            } catch (error) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete order');
              setDeleting(false);
            }
          }
        }
      ]
    );
  }, [id, language, router]);

  const applyDiscount = async () => {
    const discountAmount = parseFloat(discountInput);
    if (isNaN(discountAmount) || discountAmount < 0) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'يرجى إدخال قيمة خصم صحيحة' : 'Please enter a valid discount amount'
      );
      return;
    }

    setApplyingDiscount(true);
    try {
      const response = await api.patch(`/orders/${id}/discount`, { discount: discountAmount });
      setOrder((prev) => ({
        ...prev,
        discount: discountAmount,
        total: response.data.total,
      }));
      setDiscountApplied(true);
    } catch (error) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        error.response?.data?.detail || 'Error applying discount'
      );
    } finally {
      setApplyingDiscount(false);
    }
  };

  const clearDiscount = async () => {
    setApplyingDiscount(true);
    try {
      const response = await api.patch(`/orders/${id}/discount`, { discount: 0 });
      setOrder((prev) => ({
        ...prev,
        discount: 0,
        total: response.data.total,
      }));
      setDiscountInput('');
      setDiscountApplied(false);
    } catch (error) {
      console.error('Error clearing discount:', error);
    } finally {
      setApplyingDiscount(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Check if cancel button should be visible (hidden after shipped)
  const canCancel = !['shipped', 'out_for_delivery', 'delivered', 'cancelled'].includes(order?.status);

  // Status buttons configuration
  const statusButtons = [
    { status: 'preparing', label: language === 'ar' ? 'تحضير' : 'Preparing', icon: 'restaurant' },
    { status: 'shipped', label: language === 'ar' ? 'شحن' : 'Shipped', icon: 'cube' },
    { status: 'out_for_delivery', label: language === 'ar' ? 'في الطريق' : 'Out for Delivery', icon: 'bicycle' },
    { status: 'delivered', label: language === 'ar' ? 'تم التوصيل' : 'Delivered', icon: 'checkmark-circle' },
  ];

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <Header title={language === 'ar' ? 'تفاصيل الطلب' : 'Order Details'} showBack showSearch={false} showCart={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <Header title={language === 'ar' ? 'تفاصيل الطلب' : 'Order Details'} showBack showSearch={false} showCart={false} />
        <View style={styles.loadingContainer}>
          <Text style={[styles.errorText, { color: colors.error }]}>
            {language === 'ar' ? 'لم يتم العثور على الطلب' : 'Order not found'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const subtotal = order.subtotal || 0;
  const shipping = order.shipping_cost || SHIPPING_COST;
  const discount = order.discount || 0;
  const total = order.total || (subtotal + shipping - discount);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Header title={language === 'ar' ? 'تفاصيل الطلب' : 'Order Details'} showBack showSearch={false} showCart={false} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Order Number & Status with Delete Button (Owner Only) */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.orderHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.orderNumber, { color: colors.primary }]}>
                {order.order_number}
              </Text>
              <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
                {formatDate(order.created_at)}
              </Text>
            </View>
            <View style={[styles.statusBadge, { 
              backgroundColor: STATUS_COLORS[order.status] || colors.primary 
            }]}>
              <Text style={styles.statusText}>
                {order.status === 'pending' ? (language === 'ar' ? 'قيد الانتظار' : 'Pending') :
                 order.status === 'confirmed' ? (language === 'ar' ? 'مؤكد' : 'Confirmed') :
                 order.status === 'preparing' ? (language === 'ar' ? 'تحضير' : 'Preparing') :
                 order.status === 'shipped' ? (language === 'ar' ? 'شحن' : 'Shipped') :
                 order.status === 'out_for_delivery' ? (language === 'ar' ? 'في الطريق' : 'Out for Delivery') :
                 order.status === 'delivered' ? (language === 'ar' ? 'تم التوصيل' : 'Delivered') :
                 order.status === 'cancelled' ? (language === 'ar' ? 'ملغي' : 'Cancelled') :
                 order.status}
              </Text>
            </View>
            {/* Owner-Only Delete Button */}
            {isOwner && (
              <TouchableOpacity
                style={styles.deleteOrderBtn}
                onPress={handleDeleteOrder}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <Ionicons name="trash" size={20} color="#EF4444" />
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Order Status Action Buttons (Admin/Owner) */}
        {isAdmin && order.status !== 'cancelled' && order.status !== 'delivered' && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>
              <Ionicons name="sync" size={16} /> {language === 'ar' ? 'تحديث الحالة' : 'Update Status'}
            </Text>
            <View style={styles.statusButtonsRow}>
              {statusButtons.map((btn) => {
                const isCurrentStatus = order.status === btn.status;
                const isUpdating = updatingStatus === btn.status;
                return (
                  <TouchableOpacity
                    key={btn.status}
                    style={[
                      styles.statusBtn,
                      { backgroundColor: isCurrentStatus ? STATUS_COLORS[btn.status] : colors.surface },
                    ]}
                    onPress={() => updateOrderStatus(btn.status)}
                    disabled={isCurrentStatus || updatingStatus !== null}
                  >
                    {isUpdating ? (
                      <ActivityIndicator size="small" color={isCurrentStatus ? '#FFF' : colors.text} />
                    ) : (
                      <>
                        <Ionicons 
                          name={btn.icon} 
                          size={18} 
                          color={isCurrentStatus ? '#FFF' : STATUS_COLORS[btn.status]} 
                        />
                        <Text style={[
                          styles.statusBtnText, 
                          { color: isCurrentStatus ? '#FFF' : colors.text }
                        ]}>
                          {btn.label}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            
            {/* Cancel Button - Hidden after Shipped */}
            {canCancel && (
              <TouchableOpacity
                style={[styles.cancelOrderBtn, { borderColor: '#EF4444' }]}
                onPress={handleCancelOrder}
                disabled={updatingStatus !== null}
              >
                {updatingStatus === 'cancelled' ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <>
                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                    <Text style={styles.cancelOrderText}>
                      {language === 'ar' ? 'إلغاء الطلب' : 'Cancel Order'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Customer Information */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            <Ionicons name="person" size={16} /> {language === 'ar' ? 'معلومات العميل' : 'Customer Information'}
          </Text>
          
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'الاسم:' : 'Name:'}
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {order.customer_name || '-'}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'البريد:' : 'Email:'}
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {order.customer_email || '-'}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'الهاتف:' : 'Phone:'}
            </Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>
              {order.phone || '-'}
            </Text>
          </View>
        </View>

        {/* Delivery Address */}
        {order.delivery_address && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>
              <Ionicons name="location" size={16} /> {language === 'ar' ? 'عنوان التوصيل' : 'Delivery Address'}
            </Text>
            
            <Text style={[styles.addressText, { color: colors.text }]}>
              {order.delivery_address.street_address}
            </Text>
            <Text style={[styles.addressText, { color: colors.text }]}>
              {order.delivery_address.city}, {order.delivery_address.state}
            </Text>
            <Text style={[styles.addressText, { color: colors.text }]}>
              {order.delivery_address.country}
            </Text>
            {order.delivery_address.delivery_instructions && (
              <Text style={[styles.instructionsText, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'التعليمات:' : 'Instructions:'} {order.delivery_address.delivery_instructions}
              </Text>
            )}
          </View>
        )}

        {/* Order Items */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            <Ionicons name="cube" size={16} /> {language === 'ar' ? 'المنتجات' : 'Order Items'}
          </Text>
          
          {(order.items || []).map((item, index) => (
            <View key={index} style={[styles.itemRow, { borderColor: colors.border }]}>
              <View style={[styles.itemThumb, { backgroundColor: colors.surface }]}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={styles.itemImage} />
                ) : (
                  <Ionicons name="cube" size={20} color={colors.textSecondary} />
                )}
              </View>
              <View style={styles.itemInfo}>
                <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
                  {language === 'ar' ? item.product_name_ar || item.product_name : item.product_name}
                </Text>
                <Text style={[styles.itemQty, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'الكمية:' : 'Qty:'} {item.quantity}
                </Text>
                {/* Show bundle info if item is from a bundle */}
                {item.bundle_group_id && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Ionicons name="gift" size={12} color="#10b981" />
                    <Text style={{ color: '#10b981', fontSize: 11, marginLeft: 4 }}>
                      {language === 'ar' ? 'عرض حزمة' : 'Bundle Offer'}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.itemPricing}>
                {/* Show original price if discounted */}
                {item.original_unit_price && item.original_unit_price > (item.final_unit_price || item.price) && (
                  <Text style={{ color: colors.textSecondary, fontSize: 11, textDecorationLine: 'line-through' }}>
                    {item.original_unit_price?.toFixed(2)} ج.م
                  </Text>
                )}
                <Text style={[styles.itemUnitPrice, { color: item.original_unit_price && item.original_unit_price > (item.final_unit_price || item.price) ? '#10b981' : colors.textSecondary }]}>
                  {(item.final_unit_price || item.price)?.toFixed(2)} ج.م
                </Text>
                <Text style={[styles.itemTotalPrice, { color: colors.text }]}>
                  {((item.final_unit_price || item.price) * item.quantity).toFixed(2)} ج.م
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Order Summary with Discount */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            <Ionicons name="calculator" size={16} /> {language === 'ar' ? 'ملخص الطلب' : 'Order Summary'}
          </Text>
          
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'المجموع الفرعي:' : 'Subtotal:'}
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {subtotal.toFixed(2)} ج.م
            </Text>
          </View>
          
          {/* Bundle/Promotional Discount from items - if any */}
          {order.total_discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: '#10b981' }]}>
                {language === 'ar' ? 'خصم العروض:' : 'Promotional Discount:'}
              </Text>
              <Text style={[styles.summaryValue, { color: '#10b981' }]}>
                -{order.total_discount.toFixed(2)} ج.م
              </Text>
            </View>
          )}
          
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'الشحن:' : 'Shipping:'}
            </Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>
              {shipping.toFixed(2)} ج.م
            </Text>
          </View>
          
          {/* Discount Section - Editing for Owner Only */}
          <View style={[styles.discountSection, { borderColor: colors.border }]}>
            <Text style={[styles.discountLabel, { color: colors.text }]}>
              {language === 'ar' ? 'الخصم (ج.م):' : 'Discount (EGP):'}
            </Text>
            {isOwner ? (
              // Owner can edit discount
              <View style={styles.discountInputRow}>
                <TextInput
                  style={[styles.discountInput, { 
                    backgroundColor: colors.surface, 
                    borderColor: colors.border, 
                    color: colors.text 
                  }]}
                  value={discountInput}
                  onChangeText={setDiscountInput}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                />
                <TouchableOpacity
                  style={[styles.applyDiscountBtn, { backgroundColor: '#10b981' }]}
                  onPress={applyDiscount}
                  disabled={applyingDiscount}
                >
                  {applyingDiscount ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Ionicons name="checkmark" size={18} color="#FFF" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.clearDiscountBtn, { backgroundColor: colors.error }]}
                  onPress={clearDiscount}
                  disabled={applyingDiscount}
                >
                  <Ionicons name="close" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>
            ) : (
              // Others see only the discount value (read-only)
              <Text style={[styles.discountDisplayValue, { color: discount > 0 ? '#10b981' : colors.textSecondary }]}>
                {discount > 0 ? `-${discount.toFixed(2)} ج.م` : (language === 'ar' ? 'لا يوجد خصم' : 'No discount')}
              </Text>
            )}
          </View>

          {discount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: '#10b981' }]}>
                {language === 'ar' ? 'الخصم:' : 'Discount:'}
              </Text>
              <Text style={[styles.summaryValue, { color: '#10b981' }]}>
                -{discount.toFixed(2)} ج.م
              </Text>
            </View>
          )}
          
          <View style={[styles.totalRow, { borderColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>
              {language === 'ar' ? 'الإجمالي:' : 'Total:'}
            </Text>
            <Text style={[
              styles.totalValue, 
              { color: discountApplied && discount > 0 ? '#10b981' : colors.text },
              discountApplied && discount > 0 && styles.glowingText
            ]}>
              {total.toFixed(2)} ج.م
            </Text>
          </View>
        </View>

        {/* Payment Method */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            <Ionicons name="card" size={16} /> {language === 'ar' ? 'طريقة الدفع' : 'Payment Method'}
          </Text>
          <Text style={[styles.paymentText, { color: colors.text }]}>
            {order.payment_method === 'cash_on_delivery' 
              ? (language === 'ar' ? 'الدفع عند الاستلام' : 'Cash on Delivery')
              : order.payment_method}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  contentContainer: { padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, textAlign: 'center' },
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  orderNumber: { fontSize: 18, fontWeight: '700' },
  orderDate: { fontSize: 13, marginTop: 4 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  statusText: { color: '#FFF', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  deleteOrderBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    minWidth: 100,
    justifyContent: 'center',
  },
  statusBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cancelOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
    marginTop: 4,
  },
  cancelOrderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  infoRow: { flexDirection: 'row', marginBottom: 8 },
  infoLabel: { fontSize: 14, width: 80 },
  infoValue: { fontSize: 14, flex: 1, fontWeight: '500' },
  addressText: { fontSize: 14, marginBottom: 4 },
  instructionsText: { fontSize: 13, marginTop: 8, fontStyle: 'italic' },
  itemRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
  itemThumb: { width: 50, height: 50, borderRadius: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  itemImage: { width: 50, height: 50 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600' },
  itemQty: { fontSize: 12, marginTop: 4 },
  itemPricing: { alignItems: 'flex-end' },
  itemUnitPrice: { fontSize: 12 },
  itemTotalPrice: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: '500' },
  discountSection: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 12, marginVertical: 8 },
  discountLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  discountInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  discountInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, textAlign: 'center' },
  discountDisplayValue: { fontSize: 16, fontWeight: '600' },
  applyDiscountBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  clearDiscountBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, paddingTop: 12, marginTop: 8 },
  totalLabel: { fontSize: 18, fontWeight: '700' },
  totalValue: { fontSize: 20, fontWeight: '700' },
  glowingText: { textShadowColor: '#10b981', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  paymentText: { fontSize: 14, fontWeight: '500' },
});
