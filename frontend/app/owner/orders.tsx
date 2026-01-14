/**
 * Orders Screen with Status Filtering
 * Deep-linked from Dashboard metrics
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../../src/store/appStore';
import { ordersApi } from '../../src/services/api';

type FilterType = 'all' | 'today' | 'pending' | 'shipped' | 'delivered' | 'cancelled';

const STATUS_CONFIG: Record<string, { color: string; icon: string; labelEn: string; labelAr: string }> = {
  pending: { color: '#F59E0B', icon: 'time', labelEn: 'Pending', labelAr: 'قيد الانتظار' },
  processing: { color: '#3B82F6', icon: 'cog', labelEn: 'Processing', labelAr: 'قيد المعالجة' },
  shipped: { color: '#8B5CF6', icon: 'airplane', labelEn: 'Shipped', labelAr: 'تم الشحن' },
  out_for_delivery: { color: '#06B6D4', icon: 'bicycle', labelEn: 'Out for Delivery', labelAr: 'قيد التوصيل' },
  delivered: { color: '#10B981', icon: 'checkmark-circle', labelEn: 'Delivered', labelAr: 'تم التسليم' },
  cancelled: { color: '#EF4444', icon: 'close-circle', labelEn: 'Cancelled', labelAr: 'ملغي' },
};

export default function OrdersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const language = useAppStore((state) => state.language);
  const storeOrders = useAppStore((state) => state.orders);
  const setOrders = useAppStore((state) => state.setOrders);
  const isRTL = language === 'ar';

  // CRITICAL FIX: Ensure orders is always an array to prevent "orders is not iterable" error
  const orders = Array.isArray(storeOrders) ? storeOrders : [];

  // Get initial filter from URL params
  const initialFilter = (params.filter as FilterType) || 'all';
  const [activeFilter, setActiveFilter] = useState<FilterType>(initialFilter);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch orders on mount and when filter changes via URL
  useEffect(() => {
    fetchOrders();
  }, []);

  useEffect(() => {
    if (params.filter) {
      setActiveFilter(params.filter as FilterType);
    }
  }, [params.filter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // CRITICAL FIX: Use getAllAdmin for owner/admin to get ALL orders
      // getAll() only returns current user's orders
      const response = await ordersApi.getAllAdmin();
      const ordersData = response.data?.orders || [];
      setOrders(ordersData);
      console.log('[OrdersScreen] Fetched orders:', ordersData.length);
    } catch (error) {
      console.error('Error fetching orders:', error);
      // If getAllAdmin fails (permission denied), try getAll as fallback
      try {
        const fallbackResponse = await ordersApi.getAll();
        setOrders(fallbackResponse.data?.orders || fallbackResponse.data || []);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        setOrders([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchOrders();
    setRefreshing(false);
  }, []);

  const handleFilterChange = (filter: FilterType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveFilter(filter);
  };

  // Filter orders
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    switch (activeFilter) {
      case 'today':
        const today = new Date().toDateString();
        result = result.filter((o: any) => new Date(o.created_at).toDateString() === today);
        break;
      case 'pending':
        result = result.filter((o: any) => o.status === 'pending');
        break;
      case 'shipped':
        result = result.filter((o: any) => o.status === 'shipped');
        break;
      case 'delivered':
        result = result.filter((o: any) => o.status === 'delivered');
        break;
      case 'cancelled':
        result = result.filter((o: any) => o.status === 'cancelled');
        break;
    }

    return result.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [orders, activeFilter]);

  // Count by status
  const statusCounts = useMemo(() => ({
    all: orders.length,
    today: orders.filter((o: any) => new Date(o.created_at).toDateString() === new Date().toDateString()).length,
    pending: orders.filter((o: any) => o.status === 'pending').length,
    shipped: orders.filter((o: any) => o.status === 'shipped').length,
    delivered: orders.filter((o: any) => o.status === 'delivered').length,
    cancelled: orders.filter((o: any) => o.status === 'cancelled').length,
  }), [orders]);

  const filters: { id: FilterType; labelEn: string; labelAr: string; color: string }[] = [
    { id: 'all', labelEn: 'All', labelAr: 'الكل', color: '#6B7280' },
    { id: 'today', labelEn: 'Today', labelAr: 'اليوم', color: '#3B82F6' },
    { id: 'pending', labelEn: 'Pending', labelAr: 'انتظار', color: '#F59E0B' },
    { id: 'shipped', labelEn: 'Shipped', labelAr: 'شحن', color: '#8B5CF6' },
    { id: 'delivered', labelEn: 'Delivered', labelAr: 'تسليم', color: '#10B981' },
    { id: 'cancelled', labelEn: 'Cancelled', labelAr: 'ملغي', color: '#EF4444' },
  ];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1E1E3F', '#2D2D5F', '#3D3D7F']} style={StyleSheet.absoluteFill} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
      >
        {/* Header */}
        <View style={[styles.header, isRTL && styles.headerRTL]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isRTL ? 'الطلبات' : 'Orders'}</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{filteredOrders.length}</Text>
          </View>
        </View>

        {/* Filter Pills */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.filterContainer}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.id}
              style={[
                styles.filterPill,
                activeFilter === filter.id && { backgroundColor: filter.color },
              ]}
              onPress={() => handleFilterChange(filter.id)}
            >
              <Text style={[
                styles.filterText,
                activeFilter === filter.id && styles.filterTextActive,
              ]}>
                {isRTL ? filter.labelAr : filter.labelEn}
              </Text>
              <View style={[
                styles.filterBadge,
                activeFilter === filter.id && styles.filterBadgeActive,
              ]}>
                <Text style={[
                  styles.filterBadgeText,
                  activeFilter === filter.id && styles.filterBadgeTextActive,
                ]}>
                  {statusCounts[filter.id]}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Orders List */}
        <View style={styles.listContainer}>
          {filteredOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={64} color="rgba(255,255,255,0.5)" />
              <Text style={styles.emptyText}>
                {isRTL ? 'لا توجد طلبات' : 'No orders found'}
              </Text>
            </View>
          ) : (
            filteredOrders.map((order: any) => {
              const statusConfig = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
              return (
                <TouchableOpacity 
                  key={order.id} 
                  style={styles.orderCard}
                  onPress={() => router.push(`/admin/order/${order.id}`)}
                  activeOpacity={0.7}
                >
                  <BlurView intensity={15} tint="light" style={styles.orderBlur}>
                    {/* Status Badge */}
                    <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '30' }]}>
                      <Ionicons name={statusConfig.icon as any} size={16} color={statusConfig.color} />
                      <Text style={[styles.statusText, { color: statusConfig.color }]}>
                        {isRTL ? statusConfig.labelAr : statusConfig.labelEn}
                      </Text>
                    </View>

                    {/* Order Info */}
                    <View style={styles.orderInfo}>
                      <View style={styles.orderHeader}>
                        <Text style={styles.orderId}>#{order.id?.slice(-8) || 'N/A'}</Text>
                        <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
                      </View>
                      
                      <Text style={styles.customerName} numberOfLines={1}>
                        {order.customer_name || order.customer_email || (isRTL ? 'عميل' : 'Customer')}
                      </Text>

                      <View style={styles.orderFooter}>
                        <Text style={styles.itemCount}>
                          {order.items?.length || 0} {isRTL ? 'منتجات' : 'items'}
                        </Text>
                        <Text style={styles.orderTotal}>
                          {(order.total || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                        </Text>
                      </View>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" />
                  </BlurView>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
  headerRTL: { flexDirection: 'row-reverse' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 24, fontWeight: '700', color: '#FFF' },
  headerBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  headerBadgeText: { color: '#FFF', fontWeight: '600' },
  filterContainer: { paddingVertical: 8, gap: 8 },
  filterPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, gap: 6 },
  filterText: { fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },
  filterTextActive: { color: '#FFF' },
  filterBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  filterBadgeText: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '700' },
  filterBadgeTextActive: { color: '#FFF' },
  listContainer: { marginTop: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, marginTop: 16 },
  orderCard: { marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  orderBlur: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusText: { fontSize: 11, fontWeight: '600' },
  orderInfo: { flex: 1, marginLeft: 12 },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  orderDate: { fontSize: 11, color: 'rgba(255,255,255,0.5)' },
  customerName: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  orderFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  itemCount: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  orderTotal: { fontSize: 15, fontWeight: '700', color: '#10B981' },
});
