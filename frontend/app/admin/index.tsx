import React, { useEffect, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAppStore, useCanAccessAdminPanel, NEON_NIGHT_THEME } from '../../src/store/appStore';
import { Header } from '../../src/components/Header';
import { authApi, analyticsApi, productsApi, orderApi } from '../../src/services/api';

const { width } = Dimensions.get('window');
const GRID_ITEM_SIZE = (width - 64) / 4; // 4 items per row

// Hardcoded admin emails as fallback
const FALLBACK_ADMIN_EMAILS = [
  'ahmed.salah.ghazaly.91@gmail.com',
  'ahmed.salah.mohamed.ai2025@gmail.com',
  'pc.2025.ai@gmail.com',
];

// Grid 1: Management Icons (RTL order - Right to Left)
// Row 1: Customers → Admins → Suppliers → Distributors
// Row 2: Analytics → Collection → Subscriptions → Settings
const MANAGEMENT_ICONS = [
  // Row 1 (RTL order)
  { id: 'customers', title: 'Customers', titleAr: 'العملاء', icon: 'people', route: '/admin/customers', color: '#EC4899', row: 1, order: 1 },
  { id: 'admins', title: 'Admins', titleAr: 'المسؤولين', icon: 'shield-checkmark', route: '/admin/admins', color: '#8B5CF6', row: 1, order: 2 },
  { id: 'suppliers', title: 'Suppliers', titleAr: 'الموردون', icon: 'cube', route: '/admin/suppliers', color: '#3B82F6', row: 1, order: 3 },
  { id: 'distributors', title: 'Distributors', titleAr: 'الموزعون', icon: 'git-branch', route: '/admin/distributors', color: '#06B6D4', row: 1, order: 4 },
  // Row 2 (RTL order)
  { id: 'analytics', title: 'Analytics', titleAr: 'التحليلات', icon: 'bar-chart', route: '/admin/dashboard', color: '#10B981', row: 2, order: 1 },
  { id: 'collection', title: 'Collection', titleAr: 'المجموعة', icon: 'albums', route: '/admin/products', color: '#F59E0B', row: 2, order: 2 },
  { id: 'subscriptions', title: 'Subscriptions', titleAr: 'الاشتراكات', icon: 'card', route: '/admin/subscriptions', color: '#EF4444', row: 2, order: 3 },
  { id: 'settings', title: 'Settings', titleAr: 'الإعدادات', icon: 'settings', route: '/admin/settings', color: '#6366F1', row: 2, order: 4 },
];

// Partners Icon (visible separately)
const PARTNERS_ICON = { 
  id: 'partners', 
  title: 'Partners', 
  titleAr: 'الشركاء', 
  icon: 'handshake', 
  route: '/admin/partners', 
  color: '#14B8A6',
  gradient: ['#14B8A6', '#0D9488'],
};

// Grid 2: Live Metrics (RTL order - Right to Left)
// Row 1: Products → Low Stock → Revenue
// Row 2: Customers → Today's Orders → Pending
interface MetricItem {
  id: string;
  title: string;
  titleAr: string;
  icon: string;
  color: string;
  gradient: string[];
  row: number;
  order: number;
  valueKey: string;
  suffix?: string;
}

const LIVE_METRICS: MetricItem[] = [
  // Row 1 (RTL order)
  { id: 'products', title: 'Products', titleAr: 'المنتجات', icon: 'cube', color: '#3B82F6', gradient: ['#3B82F6', '#60A5FA'], row: 1, order: 1, valueKey: 'totalProducts' },
  { id: 'low_stock', title: 'Low Stock', titleAr: 'مخزون منخفض', icon: 'warning', color: '#F59E0B', gradient: ['#F59E0B', '#FBBF24'], row: 1, order: 2, valueKey: 'lowStock' },
  { id: 'revenue', title: 'Revenue', titleAr: 'الإيرادات', icon: 'cash', color: '#10B981', gradient: ['#10B981', '#34D399'], row: 1, order: 3, valueKey: 'revenue', suffix: 'EGP' },
  // Row 2 (RTL order)
  { id: 'customers_count', title: 'Customers', titleAr: 'العملاء', icon: 'people', color: '#EC4899', gradient: ['#EC4899', '#F472B6'], row: 2, order: 1, valueKey: 'customers' },
  { id: 'today_orders', title: "Today's Orders", titleAr: 'طلبات اليوم', icon: 'today', color: '#8B5CF6', gradient: ['#8B5CF6', '#A78BFA'], row: 2, order: 2, valueKey: 'todayOrders' },
  { id: 'pending', title: 'Pending', titleAr: 'قيد الانتظار', icon: 'time', color: '#EF4444', gradient: ['#EF4444', '#F87171'], row: 2, order: 3, valueKey: 'pending' },
];

export default function AdminPanel() {
  const { colors, isDark } = useTheme();
  const { language, isRTL } = useTranslation();
  const router = useRouter();
  const { user, userRole, setUserRole, admins } = useAppStore();
  const canAccessAdminPanel = useCanAccessAdminPanel();
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Live metrics state
  const [metrics, setMetrics] = useState({
    totalProducts: 0,
    lowStock: 0,
    revenue: 0,
    customers: 0,
    todayOrders: 0,
    pending: 0,
  });

  // Fetch live metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const [analyticsRes, productsRes, ordersRes] = await Promise.all([
        analyticsApi.getOverview().catch(() => ({ data: {} })),
        productsApi.getAll({ limit: 1000 }).catch(() => ({ data: { products: [] } })),
        orderApi.getAll({ limit: 100 }).catch(() => ({ data: { orders: [] } })),
      ]);

      const analytics = analyticsRes.data || {};
      const products = productsRes.data?.products || [];
      const orders = ordersRes.data?.orders || ordersRes.data || [];

      const today = new Date().toDateString();
      const todayOrders = orders.filter((o: any) => 
        o.created_at && new Date(o.created_at).toDateString() === today
      ).length;

      setMetrics({
        totalProducts: products.length,
        lowStock: products.filter((p: any) => p.stock_quantity && p.stock_quantity < 10).length,
        revenue: analytics.month_revenue || analytics.total_revenue || 0,
        customers: analytics.total_customers || 0,
        todayOrders,
        pending: orders.filter((o: any) => o.status === 'pending').length,
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  }, []);

  // Check access on mount
  useEffect(() => {
    const checkAccess = async () => {
      // For development/preview: allow access without login
      // In production, remove this block
      if (!user) {
        setHasAccess(true);
        await fetchMetrics();
        setLoading(false);
        return;
      }

      try {
        if (canAccessAdminPanel) {
          setHasAccess(true);
          await fetchMetrics();
          setLoading(false);
          return;
        }

        const email = user.email?.toLowerCase();
        if (FALLBACK_ADMIN_EMAILS.includes(email)) {
          setHasAccess(true);
          await fetchMetrics();
          setLoading(false);
          return;
        }

        const isInAdminsList = admins.some(
          (a: any) => a.email?.toLowerCase() === email
        );
        if (isInAdminsList) {
          setHasAccess(true);
          setUserRole('admin');
          await fetchMetrics();
          setLoading(false);
          return;
        }

        const response = await authApi.getMe();
        if (response.data?.role && ['owner', 'partner', 'admin'].includes(response.data.role)) {
          setHasAccess(true);
          setUserRole(response.data.role);
          await fetchMetrics();
        }
      } catch (error) {
        console.log('Error checking admin access:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAccess();
  }, [user, canAccessAdminPanel, admins, setUserRole, fetchMetrics]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMetrics();
    setRefreshing(false);
  };

  const getMetricValue = (valueKey: string) => {
    return (metrics as any)[valueKey] || 0;
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: NEON_NIGHT_THEME.background }]}>
        <Header title={language === 'ar' ? 'لوحة المالك المتقدمة' : 'Advanced Owner Dashboard'} showBack showSearch={false} showCart={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={NEON_NIGHT_THEME.primary} />
          <Text style={[styles.loadingText, { color: NEON_NIGHT_THEME.textSecondary }]}>
            {language === 'ar' ? 'جاري التحقق...' : 'Checking access...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Access denied
  if (!hasAccess) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: NEON_NIGHT_THEME.background }]}>
        <Header title={language === 'ar' ? 'لوحة المالك المتقدمة' : 'Advanced Owner Dashboard'} showBack showSearch={false} showCart={false} />
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color={NEON_NIGHT_THEME.error} />
          <Text style={[styles.accessDeniedText, { color: NEON_NIGHT_THEME.text }]}>
            {language === 'ar' ? 'غير مصرح بالدخول' : 'Access Denied'}
          </Text>
          <Text style={[styles.accessDeniedSubtext, { color: NEON_NIGHT_THEME.textSecondary }]}>
            {language === 'ar' ? 'ليس لديك صلاحية الوصول لهذه الصفحة' : 'You do not have permission to access this page'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Sort management icons by row and order for RTL
  const row1Management = MANAGEMENT_ICONS.filter(i => i.row === 1).sort((a, b) => a.order - b.order);
  const row2Management = MANAGEMENT_ICONS.filter(i => i.row === 2).sort((a, b) => a.order - b.order);
  
  // Sort metrics by row and order for RTL
  const row1Metrics = LIVE_METRICS.filter(m => m.row === 1).sort((a, b) => a.order - b.order);
  const row2Metrics = LIVE_METRICS.filter(m => m.row === 2).sort((a, b) => a.order - b.order);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: NEON_NIGHT_THEME.background }]} edges={['bottom']}>
      <Header title={language === 'ar' ? 'لوحة المالك المتقدمة' : 'Advanced Owner Dashboard'} showBack showSearch={false} showCart={false} />
      
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NEON_NIGHT_THEME.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Card with Neon Effect */}
        <LinearGradient
          colors={[NEON_NIGHT_THEME.primary, '#6366F1']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.welcomeCard}
        >
          <View style={styles.welcomeIconContainer}>
            <Ionicons name="shield-checkmark" size={36} color="#FFF" />
          </View>
          <View style={styles.welcomeText}>
            <Text style={styles.welcomeTitle}>
              {language === 'ar' ? 'مرحباً بك في لوحة المالك' : 'Welcome to Owner Dashboard'}
            </Text>
            <Text style={styles.welcomeSubtitle}>
              {user?.name || user?.email}
            </Text>
            <Text style={styles.welcomeRole}>
              {language === 'ar' ? `الدور: ${userRole === 'owner' ? 'المالك' : userRole === 'partner' ? 'شريك' : 'مسؤول'}` : `Role: ${userRole}`}
            </Text>
          </View>
        </LinearGradient>

        {/* Partners Card - Prominent Display */}
        <TouchableOpacity 
          style={styles.partnersCard}
          onPress={() => router.push(PARTNERS_ICON.route as any)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={PARTNERS_ICON.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.partnersGradient}
          >
            <MaterialCommunityIcons name="handshake" size={32} color="#FFF" />
            <Text style={styles.partnersTitle}>
              {language === 'ar' ? PARTNERS_ICON.titleAr : PARTNERS_ICON.title}
            </Text>
            <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={24} color="rgba(255,255,255,0.8)" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Grid 1: Management Section */}
        <View style={styles.sectionContainer}>
          <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
            <Ionicons name="briefcase" size={22} color={NEON_NIGHT_THEME.primary} />
            <Text style={[styles.sectionTitle, { color: NEON_NIGHT_THEME.text }]}>
              {language === 'ar' ? 'الإدارة' : 'Management'}
            </Text>
          </View>
          
          <View style={[styles.glassCard, { backgroundColor: 'rgba(30, 41, 59, 0.8)', borderColor: 'rgba(255,255,255,0.1)' }]}>
            {/* Row 1 */}
            <View style={[styles.iconRow, isRTL && styles.iconRowRTL]}>
              {row1Management.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.iconItem}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconCircle, { backgroundColor: item.color + '25', borderColor: item.color + '50' }]}>
                    <Ionicons name={item.icon as any} size={24} color={item.color} />
                  </View>
                  <Text style={[styles.iconLabel, { color: NEON_NIGHT_THEME.text }]} numberOfLines={1}>
                    {language === 'ar' ? item.titleAr : item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Row 2 */}
            <View style={[styles.iconRow, isRTL && styles.iconRowRTL]}>
              {row2Management.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.iconItem}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.iconCircle, { backgroundColor: item.color + '25', borderColor: item.color + '50' }]}>
                    <Ionicons name={item.icon as any} size={24} color={item.color} />
                  </View>
                  <Text style={[styles.iconLabel, { color: NEON_NIGHT_THEME.text }]} numberOfLines={1}>
                    {language === 'ar' ? item.titleAr : item.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Grid 2: Live Metrics Section */}
        <View style={styles.sectionContainer}>
          <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
            <Ionicons name="pulse" size={22} color={NEON_NIGHT_THEME.success} />
            <Text style={[styles.sectionTitle, { color: NEON_NIGHT_THEME.text }]}>
              {language === 'ar' ? 'المقاييس الحية' : 'Live Metrics'}
            </Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
          
          <View style={[styles.glassCard, { backgroundColor: 'rgba(30, 41, 59, 0.8)', borderColor: 'rgba(255,255,255,0.1)' }]}>
            {/* Row 1 */}
            <View style={[styles.metricRow, isRTL && styles.metricRowRTL]}>
              {row1Metrics.map((metric) => (
                <View key={metric.id} style={styles.metricItem}>
                  <LinearGradient
                    colors={metric.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.metricGradient}
                  >
                    <Ionicons name={metric.icon as any} size={20} color="#FFF" />
                    <Text style={styles.metricValue}>
                      {getMetricValue(metric.valueKey).toLocaleString()}
                      {metric.suffix && <Text style={styles.metricSuffix}> {metric.suffix}</Text>}
                    </Text>
                    <Text style={styles.metricLabel} numberOfLines={1}>
                      {language === 'ar' ? metric.titleAr : metric.title}
                    </Text>
                  </LinearGradient>
                </View>
              ))}
            </View>
            
            {/* Row 2 */}
            <View style={[styles.metricRow, isRTL && styles.metricRowRTL]}>
              {row2Metrics.map((metric) => (
                <View key={metric.id} style={styles.metricItem}>
                  <LinearGradient
                    colors={metric.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.metricGradient}
                  >
                    <Ionicons name={metric.icon as any} size={20} color="#FFF" />
                    <Text style={styles.metricValue}>
                      {getMetricValue(metric.valueKey).toLocaleString()}
                      {metric.suffix && <Text style={styles.metricSuffix}> {metric.suffix}</Text>}
                    </Text>
                    <Text style={styles.metricLabel} numberOfLines={1}>
                      {language === 'ar' ? metric.titleAr : metric.title}
                    </Text>
                  </LinearGradient>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionContainer}>
          <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
            <Ionicons name="flash" size={22} color={NEON_NIGHT_THEME.warning} />
            <Text style={[styles.sectionTitle, { color: NEON_NIGHT_THEME.text }]}>
              {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
            </Text>
          </View>
          
          <View style={styles.quickActionsRow}>
            <TouchableOpacity 
              style={[styles.quickActionCard, { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' }]}
              onPress={() => router.push('/admin/products' as any)}
            >
              <Ionicons name="add-circle" size={28} color="#3B82F6" />
              <Text style={[styles.quickActionText, { color: '#3B82F6' }]}>
                {language === 'ar' ? 'إضافة منتج' : 'Add Product'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.quickActionCard, { backgroundColor: 'rgba(236, 72, 153, 0.15)', borderColor: 'rgba(236, 72, 153, 0.3)' }]}
              onPress={() => router.push('/admin/customers' as any)}
            >
              <Ionicons name="person-add" size={28} color="#EC4899" />
              <Text style={[styles.quickActionText, { color: '#EC4899' }]}>
                {language === 'ar' ? 'إضافة عميل' : 'Add Customer'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.quickActionCard, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}
              onPress={() => router.push('/admin/marketing' as any)}
            >
              <Ionicons name="megaphone" size={28} color="#10B981" />
              <Text style={[styles.quickActionText, { color: '#10B981' }]}>
                {language === 'ar' ? 'تسويق' : 'Marketing'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
  },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  accessDeniedText: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  accessDeniedSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  // Welcome Card
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: NEON_NIGHT_THEME.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  welcomeIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeText: {
    marginLeft: 16,
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 2,
  },
  welcomeRole: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
  },
  // Partners Card
  partnersCard: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: PARTNERS_ICON.color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  partnersGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 14,
  },
  partnersTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  // Section Container
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EF4444',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EF4444',
  },
  // Glass Card
  glassCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  // Icon Grid
  iconRow: {
    flexDirection: 'row-reverse', // RTL by default
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  iconRowRTL: {
    flexDirection: 'row-reverse',
  },
  iconItem: {
    width: GRID_ITEM_SIZE,
    alignItems: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 8,
  },
  iconLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Metric Grid
  metricRow: {
    flexDirection: 'row-reverse', // RTL by default
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  metricRowRTL: {
    flexDirection: 'row-reverse',
  },
  metricItem: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  metricGradient: {
    padding: 12,
    alignItems: 'center',
    minHeight: 90,
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
    marginTop: 6,
  },
  metricSuffix: {
    fontSize: 10,
    fontWeight: '600',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
    textAlign: 'center',
  },
  // Quick Actions
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
});
