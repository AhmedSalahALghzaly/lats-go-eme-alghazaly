/**
 * Customers Management Screen - With Toggle Logic & Real-Time Status Indicators
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAppStore } from '../../src/store/appStore';
import { customerApi, ordersApi } from '../../src/services/api';
import { ListItemSkeleton } from '../../src/components/ui/Skeleton';
import { OrderStatusIndicator } from '../../src/components/ui/OrderStatusIndicator';
import api from '../../src/services/api';

export default function CustomersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const language = useAppStore((state) => state.language);
  const customers = useAppStore((state) => state.customers);
  const setCustomers = useAppStore((state) => state.setCustomers);
  const isRTL = language === 'ar';

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sortMode, setSortMode] = useState('most_purchased');
  // Store order status info per customer
  const [customerOrderStatus, setCustomerOrderStatus] = useState({});

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await customerApi.getAll();
      const customersList = res.data?.customers || res.data || [];
      setCustomers(customersList);
      
      // Fetch order status for each customer
      const statusMap = {};
      for (const customer of customersList) {
        const userId = customer.user_id || customer.id;
        try {
          const ordersRes = await api.get(`/admin/customer/${userId}/orders`);
          const orders = ordersRes.data?.orders || [];
          
          // Find most recent active order (not delivered/cancelled)
          const activeStatuses = ['pending', 'confirmed', 'preparing', 'shipped', 'out_for_delivery'];
          const activeOrders = orders.filter((o) => activeStatuses.includes(o.status));
          
          if (activeOrders.length > 0) {
            // Sort by created_at to get most recent
            activeOrders.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            statusMap[userId] = {
              status: activeOrders[0].status,
              activeCount: activeOrders.length,
            };
          } else {
            // Check if any orders at all
            const latestOrder = orders[0];
            statusMap[userId] = {
              status: latestOrder?.status || 'no_active_order',
              activeCount: 0,
            };
          }
        } catch (e) {
          statusMap[userId] = { status: 'no_active_order', activeCount: 0 };
        }
      }
      setCustomerOrderStatus(statusMap);
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCustomers();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Sort customers based on mode
  const sortedCustomers = useMemo(() => {
    // Ensure customers is an array
    const safeCustomers = Array.isArray(customers) ? customers : [];
    const customerList = [...safeCustomers];
    
    if (sortMode === 'most_purchased') {
      return customerList.sort((a, b) => {
        const aCount = a.order_count || a.total_orders || 0;
        const bCount = b.order_count || b.total_orders || 0;
        return bCount - aCount;
      });
    } else {
      return customerList.sort((a, b) => {
        const aValue = a.total_spent || a.total_value || 0;
        const bValue = b.total_spent || b.total_value || 0;
        return bValue - aValue;
      });
    }
  }, [customers, sortMode]);

  // Calculate totals
  const totals = useMemo(() => {
    const safeCustomers = Array.isArray(customers) ? customers : [];
    return {
      totalCustomers: safeCustomers.length,
      totalOrders: safeCustomers.reduce((sum, c) => sum + (c.order_count || c.total_orders || 0), 0),
      totalValue: safeCustomers.reduce((sum, c) => sum + (c.total_spent || c.total_value || 0), 0),
    };
  }, [customers]);

  // Navigate to customer profile with user_id
  const handleCustomerPress = (customer) => {
    const userId = customer.user_id || customer.id;
    router.push(`/admin/customers?customerId=${userId}`);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#1E3A5F', '#2D5A8F', '#3D7ABF']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />
        }
      >
        {/* Header */}
        <View style={[styles.header, isRTL && styles.headerRTL]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isRTL ? 'العملاء' : 'Customers'}
          </Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{customers.length}</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Ionicons name="people" size={24} color="#3B82F6" />
            <Text style={styles.statValue}>{totals.totalCustomers}</Text>
            <Text style={styles.statLabel}>{isRTL ? 'العملاء' : 'Customers'}</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="receipt" size={24} color="#10B981" />
            <Text style={styles.statValue}>{totals.totalOrders}</Text>
            <Text style={styles.statLabel}>{isRTL ? 'الطلبات' : 'Orders'}</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="cash" size={24} color="#F59E0B" />
            <Text style={styles.statValue}>{(totals.totalValue / 1000).toFixed(1)}K</Text>
            <Text style={styles.statLabel}>{isRTL ? 'ج.م' : 'EGP'}</Text>
          </View>
        </View>

        {/* Sort Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              sortMode === 'most_purchased' && styles.toggleActive,
            ]}
            onPress={() => setSortMode('most_purchased')}
          >
            <Ionicons 
              name="cart" 
              size={18} 
              color={sortMode === 'most_purchased' ? '#FFF' : 'rgba(255,255,255,0.6)'} 
            />
            <Text style={[
              styles.toggleText,
              sortMode === 'most_purchased' && styles.toggleTextActive,
            ]}>
              {isRTL ? 'الأكثر شراءً' : 'Most Purchased'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              sortMode === 'highest_value' && styles.toggleActive,
            ]}
            onPress={() => setSortMode('highest_value')}
          >
            <Ionicons 
              name="trending-up" 
              size={18} 
              color={sortMode === 'highest_value' ? '#FFF' : 'rgba(255,255,255,0.6)'} 
            />
            <Text style={[
              styles.toggleText,
              sortMode === 'highest_value' && styles.toggleTextActive,
            ]}>
              {isRTL ? 'أعلى قيمة' : 'Highest Value'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Customer List */}
        <View style={styles.listContainer}>
          {loading ? (
            [1, 2, 3, 4, 5].map(i => (
              <View key={i} style={styles.skeletonCard}>
                <ListItemSkeleton />
              </View>
            ))
          ) : sortedCustomers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color="rgba(255,255,255,0.5)" />
              <Text style={styles.emptyText}>
                {isRTL ? 'لا يوجد عملاء بعد' : 'No customers yet'}
              </Text>
            </View>
          ) : (
            sortedCustomers.map((customer, index) => {
              const userId = customer.user_id || customer.id;
              const orderInfo = customerOrderStatus[userId] || { status: 'no_active_order', activeCount: 0 };
              
              return (
                <TouchableOpacity 
                  key={customer.id || index} 
                  style={styles.customerCard}
                  onPress={() => handleCustomerPress(customer)}
                  activeOpacity={0.7}
                >
                  <BlurView intensity={15} tint="light" style={styles.cardBlur}>
                    {/* Rank Badge */}
                    <View style={[
                      styles.rankBadge,
                      index === 0 && styles.rankGold,
                      index === 1 && styles.rankSilver,
                      index === 2 && styles.rankBronze,
                    ]}>
                      <Text style={styles.rankText}>#{index + 1}</Text>
                    </View>

                    {/* Real-Time Status Indicator */}
                    <View style={styles.statusIndicatorContainer}>
                      <OrderStatusIndicator 
                        status={orderInfo.status}
                        activeOrderCount={orderInfo.activeCount}
                        size={24}
                      />
                    </View>

                    <View style={styles.customerAvatar}>
                      <Ionicons name="person" size={24} color="#3B82F6" />
                    </View>
                    
                    <View style={styles.customerInfo}>
                      <Text style={styles.customerName}>{customer.name || customer.email}</Text>
                      <Text style={styles.customerEmail}>{customer.email}</Text>
                      <View style={styles.customerStats}>
                        <View style={styles.customerStat}>
                          <Ionicons name="cart" size={12} color="#10B981" />
                          <Text style={styles.customerStatText}>
                            {customer.order_count || customer.total_orders || 0} {isRTL ? 'طلبات' : 'orders'}
                          </Text>
                        </View>
                        <View style={styles.customerStat}>
                          <Ionicons name="cash" size={12} color="#F59E0B" />
                          <Text style={styles.customerStatText}>
                            {(customer.total_spent || customer.total_value || 0).toLocaleString()} {isRTL ? 'ج.م' : 'EGP'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
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
  statsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#FFF', marginTop: 8 },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 },
  toggleContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: 4, marginTop: 20 },
  toggleButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 10, gap: 6 },
  toggleActive: { backgroundColor: 'rgba(59,130,246,0.8)' },
  toggleText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  toggleTextActive: { color: '#FFF' },
  listContainer: { marginTop: 20 },
  skeletonCard: { marginBottom: 12 },
  customerCard: { marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  cardBlur: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  rankBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  rankGold: { backgroundColor: 'rgba(234,179,8,0.5)' },
  rankSilver: { backgroundColor: 'rgba(156,163,175,0.5)' },
  rankBronze: { backgroundColor: 'rgba(180,83,9,0.5)' },
  rankText: { fontSize: 10, fontWeight: '700', color: '#FFF' },
  statusIndicatorContainer: { position: 'absolute', top: 8, right: 8 },
  customerAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(59,130,246,0.2)', alignItems: 'center', justifyContent: 'center' },
  customerInfo: { flex: 1, marginLeft: 12 },
  customerName: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  customerEmail: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  customerStats: { flexDirection: 'row', marginTop: 8, gap: 16 },
  customerStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  customerStatText: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, marginTop: 16 },
});
