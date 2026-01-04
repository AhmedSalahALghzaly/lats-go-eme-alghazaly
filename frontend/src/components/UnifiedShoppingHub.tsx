/**
 * UnifiedShoppingHub - The Universal Shopping & Management Hub
 * A "Living Profile" where Customer, Admin, and Owner view synchronized data
 * Glassmorphism design with real-time updates
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
  Animated,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore, NEON_NIGHT_THEME, UserRole } from '../store/appStore';
import { useCartStore } from '../store/useCartStore';
import { cartApi, favoriteApi, orderApi, customerApi } from '../services/api';
import api from '../services/api';

const SHIPPING_COST = 150;

// Skeleton Loading Component
const SkeletonLoader = ({ width, height, style }: { width: number | string; height: number; style?: any }) => {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        { width, height, backgroundColor: '#3B82F6', borderRadius: 8, opacity: pulseAnim },
        style,
      ]}
    />
  );
};

// Glass Card Component
const GlassCard = ({ children, style }: { children: React.ReactNode; style?: any }) => {
  const { colors, isDark } = useTheme();
  
  return (
    <View style={[styles.glassCard, { backgroundColor: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(255, 255, 255, 0.9)' }, style]}>
      {children}
    </View>
  );
};

// Tab Badge Component
const TabBadge = ({ count, color }: { count: number; color: string }) => {
  if (count <= 0) return null;
  return (
    <View style={[styles.tabBadge, { backgroundColor: color }]}>
      <Text style={styles.tabBadgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
};

interface UnifiedShoppingHubProps {
  // For admin viewing customer data
  customerId?: string;
  customerData?: any;
  isAdminView?: boolean;
  onClose?: () => void;
  initialTab?: 'profile' | 'favorites' | 'cart' | 'checkout' | 'orders';
}

export const UnifiedShoppingHub: React.FC<UnifiedShoppingHubProps> = ({
  customerId,
  customerData,
  isAdminView = false,
  onClose,
  initialTab = 'cart',
}) => {
  const { colors, isDark } = useTheme();
  const { language, isRTL, t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Store hooks
  const user = useAppStore((state) => state.user);
  const userRole = useAppStore((state) => state.userRole);
  const setCartItems = useAppStore((state) => state.setCartItems);
  const appCartItems = useAppStore((state) => state.cartItems);

  // Local state
  const [activeTab, setActiveTab] = useState<'profile' | 'favorites' | 'cart' | 'checkout' | 'orders'>(initialTab);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [favorites, setFavorites] = useState<any[]>([]);
  const [cartItems, setLocalCartItems] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [profileData, setProfileData] = useState<any>(null);

  // Checkout form state
  const [checkoutForm, setCheckoutForm] = useState({
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

  // Order confirmation modal
  const [showOrderConfirmation, setShowOrderConfirmation] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  // Animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Determine target user (self or customer being viewed by admin)
  const targetUserId = customerId || user?.id;
  const targetUserData = customerData || user;
  const isOwnProfile = !isAdminView && !customerId;
  const canEdit = isOwnProfile || ['owner', 'partner', 'admin'].includes(userRole);
  const canEditOrderStatus = ['owner', 'partner', 'admin'].includes(userRole);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  // Load data based on view type
  const loadData = useCallback(async () => {
    if (!targetUserId && !isOwnProfile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (isAdminView && customerId) {
        // Admin viewing customer data
        const [favRes, cartRes, ordersRes] = await Promise.all([
          api.get(`/admin/customer/${customerId}/favorites`).catch(() => ({ data: { favorites: [] } })),
          api.get(`/admin/customer/${customerId}/cart`).catch(() => ({ data: { items: [] } })),
          api.get(`/admin/customer/${customerId}/orders`).catch(() => ({ data: { orders: [] } })),
        ]);

        // Ensure favorites have proper structure with product data
        const favoritesData = favRes.data?.favorites || [];
        const processedFavorites = favoritesData.map((fav: any) => ({
          ...fav,
          product_id: fav.product_id || fav.product?.id,
          product: fav.product || {
            id: fav.product_id,
            name: fav.name,
            name_ar: fav.name_ar,
            price: fav.price,
            image_url: fav.image_url,
            sku: fav.sku,
          }
        }));

        setFavorites(processedFavorites);
        setLocalCartItems(cartRes.data?.items || []);
        setOrders(ordersRes.data?.orders || []);
        setProfileData(customerData);

        // Pre-fill checkout form
        if (customerData) {
          setCheckoutForm(prev => ({
            ...prev,
            firstName: customerData.name?.split(' ')[0] || '',
            lastName: customerData.name?.split(' ').slice(1).join(' ') || '',
            email: customerData.email || '',
            phone: customerData.phone || '',
          }));
        }
      } else {
        // User viewing own data
        const [favRes, cartRes, ordersRes] = await Promise.all([
          favoriteApi.getAll().catch(() => ({ data: [] })),
          cartApi.get().catch(() => ({ data: { items: [] } })),
          orderApi.getAll().catch(() => ({ data: [] })),
        ]);

        // Process favorites data
        const favoritesData = Array.isArray(favRes.data) ? favRes.data : (favRes.data?.favorites || []);
        const processedFavorites = favoritesData.map((fav: any) => ({
          ...fav,
          product_id: fav.product_id || fav.product?.id,
          product: fav.product || {
            id: fav.product_id,
            name: fav.name,
            name_ar: fav.name_ar,
            price: fav.price,
            image_url: fav.image_url,
            sku: fav.sku,
          }
        }));

        setFavorites(processedFavorites);
        const items = cartRes.data?.items || [];
        setLocalCartItems(items);
        setCartItems(items); // Sync with global store
        setOrders(Array.isArray(ordersRes.data) ? ordersRes.data : (ordersRes.data?.orders || []));
        setProfileData(user);

        // Pre-fill checkout form with user data
        if (user) {
          setCheckoutForm(prev => ({
            ...prev,
            firstName: user.name?.split(' ')[0] || '',
            lastName: user.name?.split(' ').slice(1).join(' ') || '',
            email: user.email || '',
          }));
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [targetUserId, isAdminView, customerId, customerData, user, setCartItems, isOwnProfile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync local cart with global store when not in admin view
  useEffect(() => {
    if (!isAdminView && appCartItems.length > 0) {
      setLocalCartItems(appCartItems.map(item => ({
        product_id: item.productId || item.product_id,
        quantity: item.quantity,
        product: item.product,
        original_unit_price: item.originalPrice || item.original_unit_price,
        final_unit_price: item.discountedPrice || item.final_unit_price,
        bundle_group_id: item.bundleGroupId || item.bundle_group_id,
        discount_details: item.discount_details,
      })));
    }
  }, [appCartItems, isAdminView]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  // Cart operations
  const updateCartQuantity = async (productId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }

    // Optimistic update
    setLocalCartItems(prev => prev.map(item =>
      item.product_id === productId ? { ...item, quantity: newQuantity } : item
    ));

    if (!isAdminView) {
      try {
        await cartApi.updateItem(productId, newQuantity);
        // Refresh to get server state
        const cartRes = await cartApi.get();
        const items = cartRes.data?.items || [];
        setLocalCartItems(items);
        setCartItems(items);
      } catch (error) {
        console.error('Error updating cart:', error);
        loadData(); // Revert on error
      }
    }
  };

  const removeFromCart = async (productId: string) => {
    // Optimistic update
    setLocalCartItems(prev => prev.filter(item => item.product_id !== productId));

    if (!isAdminView) {
      try {
        await cartApi.updateItem(productId, 0);
        const cartRes = await cartApi.get();
        const items = cartRes.data?.items || [];
        setCartItems(items);
      } catch (error) {
        console.error('Error removing from cart:', error);
        loadData();
      }
    }
  };

  const addFavoriteToCart = async (product: any) => {
    const existing = cartItems.find(item => item.product_id === product.id);
    
    if (existing) {
      updateCartQuantity(product.id, existing.quantity + 1);
    } else {
      const newItem = {
        product_id: product.id,
        product: product,
        quantity: 1,
        original_unit_price: product.price,
        final_unit_price: product.price,
      };

      setLocalCartItems(prev => [...prev, newItem]);

      if (!isAdminView) {
        try {
          await cartApi.addItem(product.id, 1);
          const cartRes = await cartApi.get();
          const items = cartRes.data?.items || [];
          setLocalCartItems(items);
          setCartItems(items);
        } catch (error) {
          console.error('Error adding to cart:', error);
        }
      }
    }

    setActiveTab('cart');
  };

  const toggleFavorite = async (productId: string) => {
    if (isAdminView) return;

    try {
      await favoriteApi.toggle(productId);
      // Refresh favorites
      const favRes = await favoriteApi.getAll();
      setFavorites(favRes.data || []);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  // Calculate totals
  const getSubtotal = () => {
    return cartItems.reduce((sum, item) => {
      const price = item.final_unit_price || item.product?.price || 0;
      return sum + price * item.quantity;
    }, 0);
  };

  const getOriginalTotal = () => {
    return cartItems.reduce((sum, item) => {
      const price = item.original_unit_price || item.product?.price || 0;
      return sum + price * item.quantity;
    }, 0);
  };

  const getTotalSavings = () => getOriginalTotal() - getSubtotal();

  const getItemCount = () => cartItems.reduce((sum, item) => sum + item.quantity, 0);

  // Submit order
  const handleSubmitOrder = async () => {
    if (!checkoutForm.firstName || !checkoutForm.phone || !checkoutForm.streetAddress || !checkoutForm.city) {
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields'
      );
      return;
    }

    if (cartItems.length === 0) {
      Alert.alert(
        language === 'ar' ? 'السلة فارغة' : 'Cart Empty',
        language === 'ar' ? 'أضف منتجات للسلة أولاً' : 'Add products to cart first'
      );
      return;
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
          items: cartItems.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
          })),
        };
        response = await api.post('/admin/orders/create', orderPayload);
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
      const ordersRes = isAdminView && customerId
        ? await api.get(`/admin/customer/${customerId}/orders`)
        : await orderApi.getAll();
      setOrders(ordersRes.data?.orders || ordersRes.data || []);
    } catch (error) {
      console.error('Error submitting order:', error);
      Alert.alert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'فشل إنشاء الطلب' : 'Failed to create order'
      );
    } finally {
      setSubmittingOrder(false);
    }
  };

  // Update order status (admin only)
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.patch(`/orders/${orderId}/status?status=${newStatus}`);
      loadData();
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  // Get status info
  const getStatusInfo = (status: string) => {
    const statusMap: { [key: string]: { label: string; labelAr: string; color: string; icon: string } } = {
      'pending': { label: 'Pending', labelAr: 'قيد الانتظار', color: '#f59e0b', icon: 'time-outline' },
      'preparing': { label: 'Preparing', labelAr: 'قيد التحضير', color: '#3b82f6', icon: 'construct-outline' },
      'shipped': { label: 'Shipped', labelAr: 'تم الشحن', color: '#eab308', icon: 'airplane-outline' },
      'out_for_delivery': { label: 'Out for Delivery', labelAr: 'في الطريق', color: '#6b7280', icon: 'car-outline' },
      'delivered': { label: 'Delivered', labelAr: 'تم التسليم', color: '#10b981', icon: 'checkmark-circle' },
      'cancelled': { label: 'Cancelled', labelAr: 'ملغي', color: '#ef4444', icon: 'close-circle' },
    };
    return statusMap[status] || statusMap['pending'];
  };

  const formatDate = (dateStr: string) => {
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

  // Tab configuration
  const tabs = [
    { key: 'profile', icon: 'person', label: language === 'ar' ? 'الملف' : 'Profile', count: 0 },
    { key: 'favorites', icon: 'heart', label: language === 'ar' ? 'المفضلة' : 'Favorites', count: favorites.length },
    { key: 'cart', icon: 'cart', label: language === 'ar' ? 'السلة' : 'Cart', count: getItemCount() },
    { key: 'checkout', icon: 'card', label: language === 'ar' ? 'الدفع' : 'Checkout', count: 0 },
    { key: 'orders', icon: 'receipt', label: language === 'ar' ? 'الطلبات' : 'Orders', count: orders.filter((o: any) => o.status === 'pending').length },
  ];

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={NEON_NIGHT_THEME.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
          </Text>
        </View>
      </View>
    );
  }

  // Not logged in (only for self view)
  if (!targetUserId && isOwnProfile) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.surface }]}>
            <Ionicons name="person-outline" size={60} color={NEON_NIGHT_THEME.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {language === 'ar' ? 'يجب تسجيل الدخول' : 'Please Login'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'سجل دخولك للوصول إلى حسابك' : 'Login to access your account'}
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: NEON_NIGHT_THEME.primary }]}
            onPress={() => router.push('/login')}
          >
            <Ionicons name="log-in-outline" size={20} color="#FFF" />
            <Text style={styles.actionButtonText}>
              {language === 'ar' ? 'تسجيل الدخول' : 'Login'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container, 
        { backgroundColor: colors.background, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
      ]}
    >
      {/* Profile Header */}
      <GlassCard style={[styles.profileHeader, { marginTop: isAdminView ? 0 : insets.top }]}>
        <View style={[styles.profileRow, isRTL && styles.rowReverse]}>
          <View style={[styles.avatarContainer, { backgroundColor: NEON_NIGHT_THEME.primary }]}>
            {profileData?.picture ? (
              <Image source={{ uri: profileData.picture }} style={styles.avatar} />
            ) : (
              <Text style={styles.avatarText}>
                {(profileData?.name || profileData?.email || '?')[0].toUpperCase()}
              </Text>
            )}
            {isAdminView && (
              <View style={[styles.adminBadge, { backgroundColor: '#8B5CF6' }]}>
                <Ionicons name="eye" size={10} color="#FFF" />
              </View>
            )}
          </View>

          <View style={[styles.profileInfo, isRTL && { alignItems: 'flex-end' }]}>
            <Text style={[styles.profileName, { color: colors.text }]}>
              {profileData?.name || language === 'ar' ? 'مستخدم' : 'User'}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
              {profileData?.email}
            </Text>
            {profileData?.phone && (
              <View style={[styles.profileMeta, isRTL && styles.rowReverse]}>
                <Ionicons name="call-outline" size={12} color={colors.textSecondary} />
                <Text style={[styles.profileMetaText, { color: colors.textSecondary }]}>
                  {profileData.phone}
                </Text>
              </View>
            )}
          </View>

          {isAdminView && onClose && (
            <TouchableOpacity
              style={[styles.closeButton, { backgroundColor: colors.surface }]}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Role Badge */}
        {isAdminView && (
          <View style={styles.roleBadgeContainer}>
            <View style={[styles.roleBadge, { backgroundColor: '#8B5CF6' }]}>
              <Ionicons name="shield-checkmark" size={12} color="#FFF" />
              <Text style={styles.roleBadgeText}>
                {language === 'ar' ? 'عرض المسؤول' : 'Admin View'}
              </Text>
            </View>
          </View>
        )}
      </GlassCard>

      {/* Navigation Tabs */}
      <View style={[styles.tabsWrapper, { backgroundColor: colors.surface }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tabsContainer, isRTL && styles.rowReverse]}
        >
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && { backgroundColor: NEON_NIGHT_THEME.primary + '20' },
              ]}
              onPress={() => setActiveTab(tab.key as any)}
            >
              <View style={styles.tabContent}>
                <Ionicons
                  name={tab.icon as any}
                  size={18}
                  color={activeTab === tab.key ? NEON_NIGHT_THEME.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.tabLabel,
                    { color: activeTab === tab.key ? NEON_NIGHT_THEME.primary : colors.textSecondary },
                  ]}
                >
                  {tab.label}
                </Text>
                <TabBadge count={tab.count} color={activeTab === tab.key ? NEON_NIGHT_THEME.primary : '#6B7280'} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content Area */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NEON_NIGHT_THEME.primary} />
        }
      >
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <GlassCard>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {language === 'ar' ? 'معلومات الحساب' : 'Account Information'}
            </Text>

            <View style={styles.profileDetails}>
              <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="person-outline" size={20} color={NEON_NIGHT_THEME.primary} />
                <View style={styles.detailInfo}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {language === 'ar' ? 'الاسم' : 'Name'}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {profileData?.name || '-'}
                  </Text>
                </View>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="mail-outline" size={20} color={NEON_NIGHT_THEME.primary} />
                <View style={styles.detailInfo}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {profileData?.email || '-'}
                  </Text>
                </View>
              </View>

              <View style={[styles.detailRow, { borderBottomColor: colors.border }]}>
                <Ionicons name="call-outline" size={20} color={NEON_NIGHT_THEME.primary} />
                <View style={styles.detailInfo}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {language === 'ar' ? 'رقم الهاتف' : 'Phone'}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {profileData?.phone || '-'}
                  </Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={20} color={NEON_NIGHT_THEME.primary} />
                <View style={styles.detailInfo}>
                  <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                    {language === 'ar' ? 'تاريخ الانضمام' : 'Joined'}
                  </Text>
                  <Text style={[styles.detailValue, { color: colors.text }]}>
                    {formatDate(profileData?.created_at) || '-'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick Stats */}
            <View style={[styles.statsGrid, { marginTop: 16 }]}>
              <View style={[styles.statCard, { backgroundColor: '#3B82F6' + '20' }]}>
                <Text style={[styles.statValue, { color: '#3B82F6' }]}>{orders.length}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'الطلبات' : 'Orders'}
                </Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#EF4444' + '20' }]}>
                <Text style={[styles.statValue, { color: '#EF4444' }]}>{favorites.length}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'المفضلة' : 'Favorites'}
                </Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: '#10B981' + '20' }]}>
                <Text style={[styles.statValue, { color: '#10B981' }]}>{getItemCount()}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'السلة' : 'In Cart'}
                </Text>
              </View>
            </View>
          </GlassCard>
        )}

        {/* Favorites Tab */}
        {activeTab === 'favorites' && (
          <GlassCard>
            <View style={[styles.sectionHeader, isRTL && styles.rowReverse]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {language === 'ar' ? 'المنتجات المفضلة' : 'Favorite Products'}
              </Text>
              <View style={[styles.countBadge, { backgroundColor: NEON_NIGHT_THEME.primary }]}>
                <Text style={styles.countBadgeText}>{favorites.length}</Text>
              </View>
            </View>

            {favorites.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="heart-outline" size={48} color={colors.border} />
                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'لا توجد منتجات مفضلة' : 'No favorites yet'}
                </Text>
              </View>
            ) : (
              favorites.map((item) => (
                <TouchableOpacity
                  key={item.product_id || item.id}
                  style={[styles.productCard, { borderColor: colors.border }]}
                  onPress={() => router.push(`/product/${item.product_id || item.product?.id}`)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.productThumb, { backgroundColor: colors.surface }]}>
                    {item.product?.image_url ? (
                      <Image source={{ uri: item.product.image_url }} style={styles.productImage} />
                    ) : (
                      <Ionicons name="cube-outline" size={24} color={colors.textSecondary} />
                    )}
                  </View>

                  <View style={styles.productInfo}>
                    <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
                      {language === 'ar' ? item.product?.name_ar : item.product?.name}
                    </Text>
                    {item.product?.sku && (
                      <Text style={[styles.productSku, { color: colors.textSecondary }]}>
                        SKU: {item.product.sku}
                      </Text>
                    )}
                    <Text style={[styles.productPrice, { color: NEON_NIGHT_THEME.primary }]}>
                      {item.product?.price?.toFixed(0)} ج.م
                    </Text>
                  </View>

                  <View style={styles.productActions}>
                    <TouchableOpacity
                      style={[styles.iconActionBtn, { backgroundColor: NEON_NIGHT_THEME.primary }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        addFavoriteToCart(item.product);
                      }}
                    >
                      <Ionicons name="cart-outline" size={18} color="#FFF" />
                    </TouchableOpacity>
                    {!isAdminView && (
                      <TouchableOpacity
                        style={[styles.iconActionBtn, { backgroundColor: '#EF4444' }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          toggleFavorite(item.product_id || item.product?.id);
                        }}
                      >
                        <Ionicons name="heart-dislike-outline" size={18} color="#FFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              ))
            )}
          </GlassCard>
        )}

        {/* Cart Tab */}
        {activeTab === 'cart' && (
          <>
            <GlassCard>
              <View style={[styles.sectionHeader, isRTL && styles.rowReverse]}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {language === 'ar' ? 'سلة التسوق' : 'Shopping Cart'}
                </Text>
                <View style={[styles.countBadge, { backgroundColor: NEON_NIGHT_THEME.primary }]}>
                  <Text style={styles.countBadgeText}>{getItemCount()}</Text>
                </View>
              </View>

              {cartItems.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="cart-outline" size={48} color={colors.border} />
                  <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                    {language === 'ar' ? 'السلة فارغة' : 'Cart is empty'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.browseButton, { backgroundColor: NEON_NIGHT_THEME.primary }]}
                    onPress={() => router.push('/')}
                  >
                    <Text style={styles.browseButtonText}>
                      {language === 'ar' ? 'تصفح المنتجات' : 'Browse Products'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                cartItems.map((item, index) => {
                  const originalPrice = item.original_unit_price || item.product?.price || 0;
                  const finalPrice = item.final_unit_price || item.product?.price || 0;
                  const hasDiscount = originalPrice > finalPrice;
                  const lineTotal = finalPrice * item.quantity;

                  return (
                    <View
                      key={item.product_id || index}
                      style={[styles.cartItem, { borderColor: colors.border }]}
                    >
                      <TouchableOpacity
                        style={[styles.productThumb, { backgroundColor: colors.surface }]}
                        onPress={() => router.push(`/product/${item.product_id}`)}
                      >
                        {item.product?.image_url ? (
                          <Image source={{ uri: item.product.image_url }} style={styles.productImage} />
                        ) : (
                          <Ionicons name="cube-outline" size={24} color={colors.textSecondary} />
                        )}
                        {item.bundle_group_id && (
                          <View style={[styles.bundleBadge, { backgroundColor: NEON_NIGHT_THEME.accent }]}>
                            <Ionicons name="gift" size={10} color="#FFF" />
                          </View>
                        )}
                      </TouchableOpacity>

                      <View style={styles.cartItemInfo}>
                        <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
                          {language === 'ar' ? item.product?.name_ar : item.product?.name}
                        </Text>
                        {item.product?.sku && (
                          <Text style={[styles.productSku, { color: colors.textSecondary }]}>
                            SKU: {item.product.sku}
                          </Text>
                        )}

                        <View style={[styles.priceRow, isRTL && styles.rowReverse]}>
                          {hasDiscount && (
                            <Text style={[styles.originalPrice, { color: colors.textSecondary }]}>
                              {originalPrice.toFixed(0)} ج.م
                            </Text>
                          )}
                          <Text style={[styles.finalPrice, { color: NEON_NIGHT_THEME.primary }]}>
                            {finalPrice.toFixed(0)} ج.م
                          </Text>
                          {hasDiscount && (
                            <View style={[styles.discountTag, { backgroundColor: '#10B981' }]}>
                              <Text style={styles.discountTagText}>
                                -{Math.round(((originalPrice - finalPrice) / originalPrice) * 100)}%
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={[styles.quantityRow, isRTL && styles.rowReverse]}>
                          <View style={[styles.quantityControls, { borderColor: colors.border }]}>
                            <TouchableOpacity
                              style={styles.qtyBtn}
                              onPress={() => updateCartQuantity(item.product_id, item.quantity - 1)}
                            >
                              <Ionicons name="remove" size={16} color={colors.text} />
                            </TouchableOpacity>
                            <Text style={[styles.qtyText, { color: colors.text }]}>{item.quantity}</Text>
                            <TouchableOpacity
                              style={styles.qtyBtn}
                              onPress={() => updateCartQuantity(item.product_id, item.quantity + 1)}
                            >
                              <Ionicons name="add" size={16} color={colors.text} />
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity
                            style={[styles.removeBtn, { borderColor: '#EF4444' }]}
                            onPress={() => removeFromCart(item.product_id)}
                          >
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>

                        <Text style={[styles.lineTotal, { color: colors.text }]}>
                          {language === 'ar' ? 'الإجمالي:' : 'Total:'} {lineTotal.toFixed(0)} ج.م
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </GlassCard>

            {/* Order Summary */}
            {cartItems.length > 0 && (
              <GlassCard style={{ marginTop: 12 }}>
                <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 12 }]}>
                  {language === 'ar' ? 'ملخص الطلب' : 'Order Summary'}
                </Text>

                {getTotalSavings() > 0 && (
                  <>
                    <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                        {language === 'ar' ? 'المجموع الأصلي' : 'Original Total'}
                      </Text>
                      <Text style={[styles.summaryValueStrike, { color: colors.textSecondary }]}>
                        {getOriginalTotal().toFixed(0)} ج.م
                      </Text>
                    </View>
                    <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                      <View style={[styles.savingsRow, isRTL && styles.rowReverse]}>
                        <Ionicons name="sparkles" size={16} color="#10B981" />
                        <Text style={[styles.savingsLabel, { color: '#10B981' }]}>
                          {language === 'ar' ? 'التوفير' : 'You Save'}
                        </Text>
                      </View>
                      <Text style={[styles.savingsValue, { color: '#10B981' }]}>
                        -{getTotalSavings().toFixed(0)} ج.م
                      </Text>
                    </View>
                  </>
                )}

                <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                    {language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}
                  </Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>
                    {getSubtotal().toFixed(0)} ج.م
                  </Text>
                </View>

                <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                    {language === 'ar' ? 'الشحن' : 'Shipping'}
                  </Text>
                  <Text style={[styles.summaryValue, { color: colors.text }]}>
                    {SHIPPING_COST.toFixed(0)} ج.م
                  </Text>
                </View>

                <View style={[styles.totalRow, { borderTopColor: colors.border }, isRTL && styles.rowReverse]}>
                  <Text style={[styles.totalLabel, { color: colors.text }]}>
                    {language === 'ar' ? 'الإجمالي' : 'Total'}
                  </Text>
                  <Text style={[styles.totalValue, { color: NEON_NIGHT_THEME.primary }]}>
                    {(getSubtotal() + SHIPPING_COST).toFixed(0)} ج.م
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.checkoutBtn, { backgroundColor: NEON_NIGHT_THEME.primary }]}
                  onPress={() => setActiveTab('checkout')}
                >
                  <Ionicons name="card-outline" size={20} color="#FFF" />
                  <Text style={styles.checkoutBtnText}>
                    {language === 'ar' ? 'المتابعة للدفع' : 'Proceed to Checkout'}
                  </Text>
                  <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={20} color="#FFF" />
                </TouchableOpacity>
              </GlassCard>
            )}
          </>
        )}

        {/* Checkout Tab */}
        {activeTab === 'checkout' && (
          <GlassCard>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {language === 'ar' ? 'إتمام الطلب' : 'Checkout'}
            </Text>

            {/* Customer Information */}
            <View style={styles.formSection}>
              <Text style={[styles.formSectionTitle, { color: NEON_NIGHT_THEME.primary }]}>
                {language === 'ar' ? 'معلومات العميل' : 'Customer Information'}
              </Text>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>
                    {language === 'ar' ? 'الاسم الأول *' : 'First Name *'}
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={checkoutForm.firstName}
                    onChangeText={(t) => setCheckoutForm({ ...checkoutForm, firstName: t })}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>
                    {language === 'ar' ? 'الاسم الأخير' : 'Last Name'}
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={checkoutForm.lastName}
                    onChangeText={(t) => setCheckoutForm({ ...checkoutForm, lastName: t })}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {language === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={checkoutForm.email}
                  onChangeText={(t) => setCheckoutForm({ ...checkoutForm, email: t })}
                  keyboardType="email-address"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {language === 'ar' ? 'رقم الهاتف *' : 'Phone *'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={checkoutForm.phone}
                  onChangeText={(t) => setCheckoutForm({ ...checkoutForm, phone: t })}
                  keyboardType="phone-pad"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            {/* Delivery Address */}
            <View style={styles.formSection}>
              <Text style={[styles.formSectionTitle, { color: NEON_NIGHT_THEME.primary }]}>
                {language === 'ar' ? 'عنوان التوصيل' : 'Delivery Address'}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {language === 'ar' ? 'العنوان *' : 'Street Address *'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={checkoutForm.streetAddress}
                  onChangeText={(t) => setCheckoutForm({ ...checkoutForm, streetAddress: t })}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>
                    {language === 'ar' ? 'المدينة *' : 'City *'}
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={checkoutForm.city}
                    onChangeText={(t) => setCheckoutForm({ ...checkoutForm, city: t })}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.inputLabel, { color: colors.text }]}>
                    {language === 'ar' ? 'المحافظة' : 'State'}
                  </Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                    value={checkoutForm.state}
                    onChangeText={(t) => setCheckoutForm({ ...checkoutForm, state: t })}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.text }]}>
                  {language === 'ar' ? 'تعليمات التوصيل' : 'Delivery Instructions'}
                </Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={checkoutForm.deliveryInstructions}
                  onChangeText={(t) => setCheckoutForm({ ...checkoutForm, deliveryInstructions: t })}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            {/* Order Summary in Checkout */}
            <View style={[styles.checkoutSummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.formSectionTitle, { color: NEON_NIGHT_THEME.primary }]}>
                {language === 'ar' ? 'ملخص الطلب' : 'Order Summary'}
              </Text>
              <Text style={[styles.summaryDetail, { color: colors.textSecondary }]}>
                {language === 'ar' ? `${getItemCount()} منتج` : `${getItemCount()} items`}
              </Text>
              <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'المجموع الفرعي' : 'Subtotal'}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {getSubtotal().toFixed(0)} ج.م
                </Text>
              </View>
              <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'الشحن' : 'Shipping'}
                </Text>
                <Text style={[styles.summaryValue, { color: colors.text }]}>
                  {SHIPPING_COST.toFixed(0)} ج.م
                </Text>
              </View>
              <View style={[styles.totalRow, { borderTopColor: colors.border }, isRTL && styles.rowReverse]}>
                <Text style={[styles.totalLabel, { color: colors.text }]}>
                  {language === 'ar' ? 'الإجمالي' : 'Total'}
                </Text>
                <Text style={[styles.totalValue, { color: NEON_NIGHT_THEME.primary }]}>
                  {(getSubtotal() + SHIPPING_COST).toFixed(0)} ج.م
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitOrderBtn, { backgroundColor: NEON_NIGHT_THEME.primary }]}
              onPress={handleSubmitOrder}
              disabled={submittingOrder || cartItems.length === 0}
            >
              {submittingOrder ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                  <Text style={styles.submitOrderBtnText}>
                    {language === 'ar' ? 'تأكيد الطلب' : 'Confirm Order'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </GlassCard>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <GlassCard>
            <View style={[styles.sectionHeader, isRTL && styles.rowReverse]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {language === 'ar' ? 'سجل الطلبات' : 'Order History'}
              </Text>
              <View style={[styles.countBadge, { backgroundColor: NEON_NIGHT_THEME.primary }]}>
                <Text style={styles.countBadgeText}>{orders.length}</Text>
              </View>
            </View>

            {orders.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color={colors.border} />
                <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'لا توجد طلبات' : 'No orders yet'}
                </Text>
              </View>
            ) : (
              orders.map((order: any) => {
                const statusInfo = getStatusInfo(order.status);
                return (
                  <View key={order.id} style={[styles.orderCard, { borderColor: colors.border }]}>
                    <View style={[styles.orderHeader, isRTL && styles.rowReverse]}>
                      <TouchableOpacity onPress={() => router.push(`/admin/order/${order.id}`)}>
                        <Text style={[styles.orderNumber, { color: NEON_NIGHT_THEME.primary }]}>
                          {order.order_number}
                        </Text>
                      </TouchableOpacity>
                      <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
                        <Ionicons name={statusInfo.icon as any} size={12} color="#FFF" />
                        <Text style={styles.statusText}>
                          {language === 'ar' ? statusInfo.labelAr : statusInfo.label}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.orderDate, { color: colors.textSecondary }]}>
                      {formatDate(order.created_at)}
                    </Text>

                    <View style={[styles.orderDetails, isRTL && styles.rowReverse]}>
                      <Text style={[styles.orderItems, { color: colors.textSecondary }]}>
                        {language === 'ar' ? `${order.items?.length || 0} منتج` : `${order.items?.length || 0} items`}
                      </Text>
                      <Text style={[styles.orderTotal, { color: colors.text }]}>
                        {order.total?.toFixed(0)} ج.م
                      </Text>
                    </View>

                    {/* Admin Status Actions */}
                    {canEditOrderStatus && order.status !== 'delivered' && order.status !== 'cancelled' && (
                      <View style={styles.orderActions}>
                        {order.status === 'pending' && (
                          <TouchableOpacity
                            style={[styles.statusActionBtn, { backgroundColor: '#3B82F6' }]}
                            onPress={() => updateOrderStatus(order.id, 'preparing')}
                          >
                            <Ionicons name="construct-outline" size={14} color="#FFF" />
                            <Text style={styles.statusActionText}>
                              {language === 'ar' ? 'تحضير' : 'Prepare'}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {order.status === 'preparing' && (
                          <TouchableOpacity
                            style={[styles.statusActionBtn, { backgroundColor: '#EAB308' }]}
                            onPress={() => updateOrderStatus(order.id, 'shipped')}
                          >
                            <Ionicons name="airplane-outline" size={14} color="#FFF" />
                            <Text style={styles.statusActionText}>
                              {language === 'ar' ? 'شحن' : 'Ship'}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {order.status === 'shipped' && (
                          <TouchableOpacity
                            style={[styles.statusActionBtn, { backgroundColor: '#6B7280' }]}
                            onPress={() => updateOrderStatus(order.id, 'out_for_delivery')}
                          >
                            <Ionicons name="car-outline" size={14} color="#FFF" />
                            <Text style={styles.statusActionText}>
                              {language === 'ar' ? 'في الطريق' : 'Out'}
                            </Text>
                          </TouchableOpacity>
                        )}
                        {order.status === 'out_for_delivery' && (
                          <TouchableOpacity
                            style={[styles.statusActionBtn, { backgroundColor: '#10B981' }]}
                            onPress={() => updateOrderStatus(order.id, 'delivered')}
                          >
                            <Ionicons name="checkmark-circle" size={14} color="#FFF" />
                            <Text style={styles.statusActionText}>
                              {language === 'ar' ? 'تسليم' : 'Deliver'}
                            </Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[styles.statusActionBtn, { backgroundColor: '#EF4444' }]}
                          onPress={() => updateOrderStatus(order.id, 'cancelled')}
                        >
                          <Ionicons name="close-circle" size={14} color="#FFF" />
                          <Text style={styles.statusActionText}>
                            {language === 'ar' ? 'إلغاء' : 'Cancel'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </GlassCard>
        )}

        {/* Bottom Spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Order Confirmation Modal */}
      <Modal
        visible={showOrderConfirmation}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOrderConfirmation(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.confirmationModal, { backgroundColor: colors.card }]}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.confirmationIconContainer}
            >
              <Ionicons name="checkmark" size={48} color="#FFF" />
            </LinearGradient>

            <Text style={[styles.confirmationTitle, { color: colors.text }]}>
              {language === 'ar' ? 'تم تأكيد الطلب!' : 'Order Confirmed!'}
            </Text>

            <Text style={[styles.confirmationOrderNumber, { color: NEON_NIGHT_THEME.primary }]}>
              {confirmedOrder?.order_number}
            </Text>

            <View style={styles.confirmationDetails}>
              <Text style={[styles.confirmationDetail, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'الإجمالي:' : 'Total:'} {confirmedOrder?.total?.toFixed(0)} ج.م
              </Text>
              <Text style={[styles.confirmationDetail, { color: colors.textSecondary }]}>
                {formatDate(confirmedOrder?.created_at)}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.confirmationBtn, { backgroundColor: NEON_NIGHT_THEME.primary }]}
              onPress={() => {
                setShowOrderConfirmation(false);
                setActiveTab('orders');
              }}
            >
              <Text style={styles.confirmationBtnText}>
                {language === 'ar' ? 'عرض الطلبات' : 'View Orders'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  // Glass Card
  glassCard: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },

  // Profile Header
  profileHeader: {
    marginTop: 0,
    marginBottom: 8,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
  },
  adminBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
  },
  profileEmail: {
    fontSize: 13,
    marginTop: 2,
  },
  profileMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  profileMetaText: {
    fontSize: 12,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleBadgeContainer: {
    marginTop: 12,
    alignItems: 'flex-start',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },

  // Tabs
  tabsWrapper: {
    marginHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  tabsContainer: {
    flexDirection: 'row',
    padding: 6,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 6,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 4,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // Profile Details
  profileDetails: {},
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  detailInfo: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: '500',
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 15,
  },
  browseButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  browseButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },

  // Product Card
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  productThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productImage: {
    width: 56,
    height: 56,
  },
  bundleBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  productSku: {
    fontSize: 11,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
  productActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Cart Item
  cartItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  cartItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  originalPrice: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  finalPrice: {
    fontSize: 15,
    fontWeight: '700',
  },
  discountTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountTagText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  qtyBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  removeBtn: {
    padding: 6,
    borderWidth: 1,
    borderRadius: 6,
  },
  lineTotal: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },

  // Summary
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryValueStrike: {
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savingsLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  savingsValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 8,
    borderTopWidth: 1,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  checkoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  checkoutBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Form
  formSection: {
    marginBottom: 20,
  },
  formSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  checkoutSummary: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  summaryDetail: {
    fontSize: 12,
    marginBottom: 8,
  },
  submitOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitOrderBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // Orders
  orderCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  orderDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderItems: {
    fontSize: 13,
  },
  orderTotal: {
    fontSize: 15,
    fontWeight: '700',
  },
  orderActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  statusActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusActionText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmationModal: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  confirmationIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmationTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  confirmationOrderNumber: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  confirmationDetails: {
    alignItems: 'center',
    marginBottom: 20,
  },
  confirmationDetail: {
    fontSize: 14,
    marginBottom: 4,
  },
  confirmationBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  confirmationBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default UnifiedShoppingHub;
