/**
 * Customers Admin - Using Unified Shopping Hub
 * Displays customer list with integrated profile view via UnifiedShoppingHub
 * With Real-Time Status Indicators (High-Performance Reanimated-based)
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { customersApi, ordersApi } from '../../src/services/api';
import api from '../../src/services/api';
import { Header } from '../../src/components/Header';
import { UnifiedShoppingHub } from '../../src/components/UnifiedShoppingHub';
import { NEON_NIGHT_THEME } from '../../src/store/appStore';
import { OrderStatusIndicator } from '../../src/components/ui/OrderStatusIndicator';

export default function CustomersAdmin() {
  const { colors } = useTheme();
  const { language, isRTL } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();

  const [customers, setCustomers] = useState([]);
  const [pendingOrderCounts, setPendingOrderCounts] = useState({});
  const [customerOrderStatus, setCustomerOrderStatus] = useState({});
  const [loading, setLoading] = useState(true);

  // Customer Profile State
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [initialTab, setInitialTab] = useState('favorites');

  // Note: Removed manual pulseAnim - OrderStatusIndicator now handles its own high-performance animation
  // using react-native-reanimated with withRepeat and withSequence

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Handle customerId query param for direct navigation
  useEffect(() => {
    if (params.customerId && customers.length > 0) {
      const customer = customers.find(c => c.user_id === params.customerId || c.id === params.customerId);
      if (customer) {
        openCustomerProfile(customer, 'profile');
      }
    }
  }, [params.customerId, customers]);

  const fetchCustomers = useCallback(async () => {
    try {
      const response = await customersApi.getAll();
      const customersList = response.data?.customers || [];
      setCustomers(customersList);

      // Fetch pending order counts and status for each customer
      const counts = {};
      const statusMap = {};
      
      for (const customer of customersList) {
        // Use customer.id as the user_id (backend returns 'id' from serialize_doc)
        const userId = customer.id;
        if (!userId) continue;
        
        try {
          const countRes = await ordersApi.getPendingCount(userId);
          counts[userId] = countRes.data?.count || 0;
          
          // Also fetch order status info
          const ordersRes = await api.get(`/customers/admin/customer/${userId}/orders`);
          const orders = ordersRes.data?.orders || [];
          
          const activeStatuses = ['pending', 'confirmed', 'preparing', 'shipped', 'out_for_delivery'];
          const activeOrders = orders.filter((o) => activeStatuses.includes(o.status));
          
          if (activeOrders.length > 0) {
            activeOrders.sort((a, b) => 
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            statusMap[userId] = {
              status: activeOrders[0].status,
              activeCount: activeOrders.length,
            };
          } else {
            const latestOrder = orders[0];
            statusMap[userId] = {
              status: latestOrder?.status || 'no_active_order',
              activeCount: 0,
            };
          }
        } catch (e) {
          counts[userId] = 0;
          statusMap[userId] = { status: 'no_active_order', activeCount: 0 };
        }
      }
      setPendingOrderCounts(counts);
      setCustomerOrderStatus(statusMap);
    } catch (error) {
      console.error('Error fetching customers:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const openCustomerProfile = useCallback((customer, tab = 'profile') => {
    setSelectedCustomer(customer);
    setInitialTab(tab);
    setShowProfile(true);
  }, []);

  const handleViewOrders = useCallback((customer) => {
    openCustomerProfile(customer, 'orders');
    // Reset pending count for this customer - use customer.id
    setPendingOrderCounts(prev => ({ ...prev, [customer.id]: 0 }));
  }, [openCustomerProfile]);

  const handleDelete = useCallback(async (id) => {
    try {
      await customersApi.delete(id);
      fetchCustomers();
    } catch (error) {
      console.error('Error deleting customer:', error);
    }
  }, [fetchCustomers]);

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }, [language]);

  // Customer Profile Modal using UnifiedShoppingHub
  if (showProfile && selectedCustomer) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
        <Header 
          title={selectedCustomer?.name || (language === 'ar' ? 'ملف العميل' : 'Customer Profile')} 
          showBack 
          showSearch={false} 
          showCart={false} 
        />
        <UnifiedShoppingHub
          customerId={selectedCustomer.id}
          customerData={selectedCustomer}
          isAdminView={true}
          onClose={() => {
            setShowProfile(false);
            setSelectedCustomer(null);
            fetchCustomers(); // Refresh list on close
          }}
          initialTab={initialTab}
        />
      </SafeAreaView>
    );
  }

  // Main Customer List View
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Header title={language === 'ar' ? 'العملاء' : 'Customers'} showBack showSearch={false} showCart={false} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Breadcrumb */}
        <View style={[styles.breadcrumb, isRTL && styles.breadcrumbRTL]}>
          <TouchableOpacity onPress={() => router.push('/admin')}>
            <Text style={[styles.breadcrumbText, { color: colors.primary }]}>
              {language === 'ar' ? 'لوحة التحكم' : 'Admin'}
            </Text>
          </TouchableOpacity>
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textSecondary} />
          <Text style={[styles.breadcrumbText, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'العملاء' : 'Customers'}
          </Text>
        </View>

        {/* Stats Card */}
        <View style={[styles.statsCard, { backgroundColor: NEON_NIGHT_THEME.primary }]}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{customers.length}</Text>
            <Text style={styles.statLabel}>
              {language === 'ar' ? 'إجمالي العملاء' : 'Total Customers'}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {Object.values(pendingOrderCounts).reduce((a, b) => a + b, 0)}
            </Text>
            <Text style={styles.statLabel}>
              {language === 'ar' ? 'طلبات معلقة' : 'Pending Orders'}
            </Text>
          </View>
        </View>

        {/* Customers List */}
        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.listHeader, isRTL && styles.listHeaderRTL]}>
            <Text style={[styles.listTitle, { color: colors.text }]}>
              {language === 'ar' ? 'قائمة العملاء' : 'Customer List'}
            </Text>
            <TouchableOpacity onPress={fetchCustomers}>
              <Ionicons name="refresh" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 40 }} />
          ) : customers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'لا يوجد عملاء' : 'No customers found'}
              </Text>
            </View>
          ) : (
            customers.map((customer) => (
              <TouchableOpacity 
                key={customer.user_id} 
                style={[styles.customerItem, { borderColor: colors.border }]}
                onPress={() => openCustomerProfile(customer, 'profile')}
                activeOpacity={0.7}
              >
                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: NEON_NIGHT_THEME.primary + '20' }]}>
                  {customer.picture ? (
                    <Image source={{ uri: customer.picture }} style={styles.avatarImage} />
                  ) : (
                    <Text style={[styles.avatarText, { color: NEON_NIGHT_THEME.primary }]}>
                      {(customer.name || customer.email || '?')[0].toUpperCase()}
                    </Text>
                  )}
                </View>

                {/* Customer Info */}
                <View style={styles.customerInfo}>
                  <Text style={[styles.customerName, { color: colors.text }]}>
                    {customer.name || customer.email?.split('@')[0] || 'Unknown'}
                  </Text>
                  <View style={[styles.customerMeta, isRTL && styles.rowReverse]}>
                    <Ionicons name="mail-outline" size={12} color={colors.textSecondary} />
                    <Text style={[styles.customerEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                      {customer.email}
                    </Text>
                  </View>
                  {customer.phone && (
                    <View style={[styles.customerMeta, isRTL && styles.rowReverse]}>
                      <Ionicons name="call-outline" size={12} color={colors.textSecondary} />
                      <Text style={[styles.customerPhone, { color: colors.textSecondary }]}>
                        {customer.phone}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.customerDate, { color: colors.textSecondary }]}>
                    {language === 'ar' ? 'انضم:' : 'Joined:'} {formatDate(customer.created_at)}
                  </Text>
                </View>

                {/* Action Icons */}
                <View style={styles.actionIcons}>
                  {/* Real-Time Order Status Indicator */}
                  <View style={styles.statusIndicatorWrapper}>
                    <OrderStatusIndicator 
                      status={customerOrderStatus[customer.id]?.status || 'no_active_order'}
                      activeOrderCount={customerOrderStatus[customer.id]?.activeCount || 0}
                      size={24}
                    />
                  </View>

                  {/* Quick Actions */}
                  <TouchableOpacity 
                    style={[styles.iconBtn, { backgroundColor: '#EF4444' + '20' }]}
                    onPress={(e) => { e.stopPropagation(); openCustomerProfile(customer, 'favorites'); }}
                  >
                    <Ionicons name="heart" size={16} color="#EF4444" />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.iconBtn, { backgroundColor: NEON_NIGHT_THEME.primary + '20' }]}
                    onPress={(e) => { e.stopPropagation(); openCustomerProfile(customer, 'cart'); }}
                  >
                    <Ionicons name="cart" size={16} color={NEON_NIGHT_THEME.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.iconBtn, { backgroundColor: '#10B981' + '20' }]}
                    onPress={(e) => { e.stopPropagation(); handleViewOrders(customer); }}
                  >
                    <Ionicons name="receipt" size={16} color="#10B981" />
                  </TouchableOpacity>

                  {/* View Details */}
                  <TouchableOpacity 
                    style={[styles.iconBtn, { backgroundColor: colors.surface }]}
                    onPress={(e) => { e.stopPropagation(); openCustomerProfile(customer, 'profile'); }}
                  >
                    <Ionicons name="eye" size={18} color={colors.text} />
                  </TouchableOpacity>

                  {/* Delete */}
                  <TouchableOpacity
                    style={[styles.iconBtn, { backgroundColor: colors.error + '20' }]}
                    onPress={(e) => { e.stopPropagation(); handleDelete(customer.user_id); }}
                  >
                    <Ionicons name="trash" size={16} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  contentContainer: { padding: 16 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  breadcrumbRTL: { flexDirection: 'row-reverse' },
  breadcrumbText: { fontSize: 14 },
  statsCard: { 
    borderRadius: 16, 
    padding: 20, 
    marginBottom: 16, 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 32, fontWeight: '700', color: '#FFF' },
  statLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.3)' },
  listCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  listHeaderRTL: { flexDirection: 'row-reverse' },
  listTitle: { fontSize: 18, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { textAlign: 'center', marginTop: 12, fontSize: 15 },
  customerItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 14, 
    borderBottomWidth: 1, 
    gap: 12 
  },
  avatar: { 
    width: 52, 
    height: 52, 
    borderRadius: 26, 
    alignItems: 'center', 
    justifyContent: 'center', 
    overflow: 'hidden' 
  },
  avatarImage: { width: 52, height: 52, borderRadius: 26 },
  avatarText: { fontSize: 20, fontWeight: '700' },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  customerMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  rowReverse: { flexDirection: 'row-reverse' },
  customerEmail: { fontSize: 12, flex: 1 },
  customerPhone: { fontSize: 12 },
  customerDate: { fontSize: 11, marginTop: 4 },
  actionIcons: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', maxWidth: 200, justifyContent: 'flex-end' },
  iconBtn: { 
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  statusIndicatorWrapper: {
    marginRight: 4,
  },
  orderIndicator: { 
    width: 28, 
    height: 28, 
    borderRadius: 14, 
    alignItems: 'center', 
    justifyContent: 'center', 
    elevation: 4 
  },
  orderCountBadge: { 
    position: 'absolute', 
    top: -4, 
    right: -4, 
    backgroundColor: '#ef4444', 
    width: 16, 
    height: 16, 
    borderRadius: 8, 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  orderCountText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
});
