import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAppStore, NEON_NIGHT_THEME } from '../../src/store/appStore';
import { cartApi } from '../../src/services/api';

// Simple Cart Item Component
const CartItem = ({ 
  item, 
  onUpdateQuantity, 
  onRemove, 
  colors, 
  language, 
  isRTL 
}: any) => {
  const originalPrice = item.original_unit_price || item.product?.price || 0;
  const finalPrice = item.final_unit_price || item.discountedPrice || item.product?.price || 0;
  const hasDiscount = originalPrice > finalPrice;
  const lineTotal = finalPrice * item.quantity;

  return (
    <View style={[styles.cartItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Product Image */}
      <View style={styles.itemImageContainer}>
        {item.product?.image ? (
          <Image source={{ uri: item.product.image }} style={styles.itemImage} resizeMode="cover" />
        ) : (
          <View style={[styles.itemImagePlaceholder, { backgroundColor: colors.border }]}>
            <Ionicons name="cube-outline" size={28} color={colors.textSecondary} />
          </View>
        )}
        {/* Bundle Badge */}
        {item.bundle_group_id && (
          <View style={[styles.bundleBadge, { backgroundColor: NEON_NIGHT_THEME.accent }]}>
            <Ionicons name="gift" size={12} color="#FFF" />
          </View>
        )}
      </View>

      {/* Product Info */}
      <View style={[styles.itemInfo, isRTL && { alignItems: 'flex-end' }]}>
        <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
          {language === 'ar' ? item.product?.name_ar || item.product?.name : item.product?.name || 'Product'}
        </Text>
        
        {/* SKU */}
        {item.product?.sku && (
          <Text style={[styles.itemSku, { color: colors.textSecondary }]}>
            SKU: {item.product.sku}
          </Text>
        )}

        {/* Price */}
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
            <View style={[styles.discountBadge, { backgroundColor: NEON_NIGHT_THEME.accent }]}>
              <Text style={styles.discountText}>
                -{Math.round(((originalPrice - finalPrice) / originalPrice) * 100)}%
              </Text>
            </View>
          )}
        </View>

        {/* Quantity Controls */}
        <View style={[styles.quantityRow, isRTL && styles.rowReverse]}>
          <View style={[styles.quantityControls, { borderColor: colors.border }]}>
            <TouchableOpacity 
              style={styles.qtyButton} 
              onPress={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
            >
              <Ionicons name="remove" size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.qtyText, { color: colors.text }]}>{item.quantity}</Text>
            <TouchableOpacity 
              style={styles.qtyButton}
              onPress={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
            >
              <Ionicons name="add" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity 
            style={[styles.removeButton, { borderColor: '#ef4444' }]}
            onPress={() => onRemove(item.product_id)}
          >
            <Ionicons name="trash-outline" size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {/* Line Total */}
        <Text style={[styles.lineTotal, { color: colors.text }]}>
          {language === 'ar' ? 'الإجمالي:' : 'Total:'} {lineTotal.toFixed(0)} ج.م
        </Text>
      </View>
    </View>
  );
};

export default function CartScreen() {
  const { colors } = useTheme();
  const { isRTL, language } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setCartItems } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<any[]>([]);

  // Fetch cart from server
  const fetchCart = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const response = await cartApi.get();
      const cartItems = response.data.items || [];
      setItems(cartItems);
      setCartItems(cartItems);
    } catch (error) {
      console.error('Error fetching cart:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, setCartItems]);

  // Fetch on focus
  useFocusEffect(
    useCallback(() => {
      fetchCart();
    }, [fetchCart])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchCart();
  }, [fetchCart]);

  // Update item quantity
  const updateQuantity = async (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(productId);
      return;
    }
    try {
      await cartApi.updateItem(productId, newQuantity);
      fetchCart();
    } catch (error) {
      console.error('Error updating cart:', error);
      Alert.alert(language === 'ar' ? 'خطأ' : 'Error', language === 'ar' ? 'فشل تحديث الكمية' : 'Failed to update quantity');
    }
  };

  // Remove item
  const removeItem = async (productId: string) => {
    try {
      await cartApi.updateItem(productId, 0);
      setItems(prev => prev.filter(item => item.product_id !== productId));
    } catch (error) {
      console.error('Error removing item:', error);
      Alert.alert(language === 'ar' ? 'خطأ' : 'Error', language === 'ar' ? 'فشل حذف المنتج' : 'Failed to remove item');
    }
  };

  // Calculate totals
  const getSubtotal = () => {
    return items.reduce((sum, item) => {
      const price = item.final_unit_price || item.discountedPrice || item.product?.price || 0;
      return sum + price * item.quantity;
    }, 0);
  };

  const getOriginalTotal = () => {
    return items.reduce((sum, item) => {
      const price = item.original_unit_price || item.product?.price || 0;
      return sum + price * item.quantity;
    }, 0);
  };

  const getTotalSavings = () => {
    return getOriginalTotal() - getSubtotal();
  };

  const getItemCount = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {language === 'ar' ? 'سلة التسوق' : 'Shopping Cart'}
          </Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={NEON_NIGHT_THEME.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
          </Text>
        </View>
      </View>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {language === 'ar' ? 'سلة التسوق' : 'Shopping Cart'}
          </Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="person-outline" size={80} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {language === 'ar' ? 'يجب تسجيل الدخول' : 'Please login'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'سجل دخولك لعرض سلة التسوق' : 'Login to view your cart'}
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: NEON_NIGHT_THEME.primary }]}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.actionButtonText}>
              {language === 'ar' ? 'تسجيل الدخول' : 'Login'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Empty cart
  if (items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {language === 'ar' ? 'سلة التسوق' : 'Shopping Cart'}
          </Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={80} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {language === 'ar' ? 'السلة فارغة' : 'Your cart is empty'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'أضف منتجات لبدء التسوق' : 'Add items to start shopping'}
          </Text>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: NEON_NIGHT_THEME.primary }]}
            onPress={() => router.push('/')}
          >
            <Text style={styles.actionButtonText}>
              {language === 'ar' ? 'تصفح المنتجات' : 'Browse Products'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Cart with items
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {language === 'ar' ? 'سلة التسوق' : 'Shopping Cart'}
        </Text>
        <View style={[styles.itemCountBadge, { backgroundColor: NEON_NIGHT_THEME.primary }]}>
          <Text style={styles.itemCountText}>{getItemCount()}</Text>
        </View>
      </View>

      {/* Cart Items */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={NEON_NIGHT_THEME.primary} />
        }
      >
        {items.map((item, index) => (
          <CartItem
            key={item.product_id || index}
            item={item}
            onUpdateQuantity={updateQuantity}
            onRemove={removeItem}
            colors={colors}
            language={language}
            isRTL={isRTL}
          />
        ))}

        {/* Order Summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.text }]}>
            {language === 'ar' ? 'ملخص الطلب' : 'Order Summary'}
          </Text>

          {getTotalSavings() > 0 && (
            <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'المجموع الأصلي:' : 'Original Total:'}
              </Text>
              <Text style={[styles.summaryOriginal, { color: colors.textSecondary }]}>
                {getOriginalTotal().toFixed(0)} ج.م
              </Text>
            </View>
          )}

          {getTotalSavings() > 0 && (
            <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
              <View style={[styles.savingsRow, isRTL && styles.rowReverse]}>
                <Ionicons name="sparkles" size={16} color={NEON_NIGHT_THEME.accent} />
                <Text style={[styles.savingsLabel, { color: NEON_NIGHT_THEME.accent }]}>
                  {language === 'ar' ? 'التوفير:' : 'You Save:'}
                </Text>
              </View>
              <Text style={[styles.savingsValue, { color: NEON_NIGHT_THEME.accent }]}>
                -{getTotalSavings().toFixed(0)} ج.م
              </Text>
            </View>
          )}

          <View style={[styles.totalRow, { borderTopColor: colors.border }, isRTL && styles.rowReverse]}>
            <Text style={[styles.totalLabel, { color: colors.text }]}>
              {language === 'ar' ? 'الإجمالي:' : 'Total:'}
            </Text>
            <Text style={[styles.totalValue, { color: NEON_NIGHT_THEME.primary }]}>
              {getSubtotal().toFixed(0)} ج.م
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Checkout Footer */}
      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.footerInfo}>
          <Text style={[styles.footerLabel, { color: colors.textSecondary }]}>
            {language === 'ar' ? `${getItemCount()} منتج` : `${getItemCount()} items`}
          </Text>
          <Text style={[styles.footerTotal, { color: colors.text }]}>
            {getSubtotal().toFixed(0)} ج.م
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.checkoutButton, { backgroundColor: NEON_NIGHT_THEME.primary }]}
          onPress={() => router.push('/checkout')}
        >
          <Ionicons name="card-outline" size={20} color="#FFF" />
          <Text style={styles.checkoutButtonText}>
            {language === 'ar' ? 'إتمام الشراء' : 'Checkout'}
          </Text>
          <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  itemCountBadge: {
    position: 'absolute',
    right: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  itemCountText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
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
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    marginTop: 8,
    textAlign: 'center',
  },
  actionButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  cartItem: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  itemImageContainer: {
    width: 90,
    height: 90,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  itemImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bundleBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemSku: {
    fontSize: 12,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  originalPrice: {
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  finalPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  discountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  qtyButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 8,
  },
  removeButton: {
    padding: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
  lineTotal: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryOriginal: {
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
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
  },
  footerInfo: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 13,
  },
  footerTotal: {
    fontSize: 18,
    fontWeight: '700',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  checkoutButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
