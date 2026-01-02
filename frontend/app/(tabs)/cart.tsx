import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Animated as RNAnimated,
  Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  FadeIn,
  FadeInDown,
  FadeOutUp,
  Layout,
  SlideInRight,
} from 'react-native-reanimated';
import { Header } from '../../src/components/Header';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAppStore, NEON_NIGHT_THEME } from '../../src/store/appStore';
import { cartApi } from '../../src/services/api';
import ConfettiEffect from '../../src/components/ui/ConfettiEffect';

const { width: screenWidth } = Dimensions.get('window');

// Bundle Group Card component
const BundleGroupCard = ({ bundleName, items, discount, onRemove, colors, language, isRTL }: any) => {
  const scale = useSharedValue(1);
  const savings = items.reduce((sum: number, item: any) => {
    const originalPrice = item.product?.price || 0;
    const discountedPrice = originalPrice * (1 - (discount || 0) / 100);
    return sum + (originalPrice - discountedPrice) * item.quantity;
  }, 0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSequence(
      withSpring(0.95),
      withSpring(1)
    );
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(400).springify()}
      layout={Layout.springify()}
      style={animatedStyle}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={handlePress}
        style={[
          styles.bundleCard,
          {
            backgroundColor: `${NEON_NIGHT_THEME.primary}15`,
            borderColor: NEON_NIGHT_THEME.primary,
          },
        ]}
      >
        {/* Bundle Header */}
        <View style={[styles.bundleHeader, isRTL && styles.rowReverse]}>
          <View style={[styles.bundleBadge, { backgroundColor: NEON_NIGHT_THEME.primary }]}>
            <Ionicons name="gift" size={16} color="#FFF" />
            <Text style={styles.bundleBadgeText}>
              {language === 'ar' ? 'عرض حزمة' : 'Bundle Deal'}
            </Text>
          </View>
          <View style={[styles.discountBadge, { backgroundColor: NEON_NIGHT_THEME.accent }]}>
            <Text style={styles.discountText}>-{discount}%</Text>
          </View>
        </View>

        <Text style={[styles.bundleName, { color: colors.text }, isRTL && styles.textRight]}>
          {bundleName}
        </Text>

        {/* Bundle Items */}
        {items.map((item: any, index: number) => (
          <View key={item.product_id} style={[styles.bundleItem, isRTL && styles.rowReverse]}>
            <View style={styles.bundleItemImage}>
              {item.product?.image ? (
                <Image
                  source={{ uri: item.product.image }}
                  style={styles.bundleItemImg}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.bundleItemPlaceholder, { backgroundColor: colors.border }]}>
                  <Ionicons name="cube-outline" size={20} color={colors.textSecondary} />
                </View>
              )}
            </View>
            <View style={styles.bundleItemInfo}>
              <Text style={[styles.bundleItemName, { color: colors.text }]} numberOfLines={1}>
                {language === 'ar' ? item.product?.name_ar || item.product?.name : item.product?.name}
              </Text>
              <Text style={[styles.bundleItemQty, { color: colors.textSecondary }]}>
                x{item.quantity}
              </Text>
            </View>
            <View style={styles.bundleItemPrices}>
              <Text style={[styles.originalPrice, { color: colors.textSecondary }]}>
                {(item.product?.price * item.quantity).toFixed(0)} ج.م
              </Text>
              <Text style={[styles.discountedPrice, { color: NEON_NIGHT_THEME.accent }]}>
                {((item.product?.price || 0) * (1 - discount / 100) * item.quantity).toFixed(0)} ج.م
              </Text>
            </View>
          </View>
        ))}

        {/* Savings Footer */}
        <View style={[styles.savingsFooter, { borderTopColor: `${NEON_NIGHT_THEME.primary}30` }]}>
          <View style={[styles.savingsRow, isRTL && styles.rowReverse]}>
            <Ionicons name="sparkles" size={18} color={NEON_NIGHT_THEME.primary} />
            <Text style={[styles.savingsText, { color: NEON_NIGHT_THEME.primary }]}>
              {language === 'ar' ? `توفير: ${savings.toFixed(0)} ج.م` : `Savings: ${savings.toFixed(0)} EGP`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onRemove}
            style={[styles.voidBundleBtn, { backgroundColor: `${colors.error}15` }]}
          >
            <Ionicons name="close-circle" size={16} color={colors.error} />
            <Text style={[styles.voidBundleText, { color: colors.error }]}>
              {language === 'ar' ? 'إلغاء العرض' : 'Void Bundle'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Regular Cart Item Card with Enhanced Pricing Display
const CartItemCard = ({ item, onUpdate, onRemove, colors, language, isRTL }: any) => {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);

  // Get pricing from server-side cart data
  const originalPrice = item.original_unit_price || item.product?.price || 0;
  const finalPrice = item.final_unit_price || item.product?.price || 0;
  const hasDiscount = originalPrice > finalPrice;
  const itemSavings = (originalPrice - finalPrice) * item.quantity;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: translateX.value }],
  }));

  const handleQuantityChange = (delta: number) => {
    scale.value = withSequence(
      withSpring(1.05),
      withSpring(1)
    );
    onUpdate(item.product_id, item.quantity + delta);
  };

  const handleRemove = () => {
    translateX.value = withTiming(screenWidth, { duration: 300 }, () => {
      onRemove(item.product_id);
    });
  };

  return (
    <Animated.View
      entering={SlideInRight.duration(300).springify()}
      layout={Layout.springify()}
      style={animatedStyle}
    >
      <View style={[styles.cartItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.cartItemContent, isRTL && styles.rowReverse]}>
          {/* Image */}
          <View style={styles.itemImageContainer}>
            {item.product?.image ? (
              <Image
                source={{ uri: item.product.image }}
                style={styles.itemImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: colors.border }]}>
                <Ionicons name="cube-outline" size={30} color={colors.textSecondary} />
              </View>
            )}
          </View>

          {/* Info */}
          <View style={[styles.itemInfo, isRTL && { alignItems: 'flex-end' }]}>
            <Text style={[styles.itemName, { color: colors.text }, isRTL && styles.textRight]} numberOfLines={2}>
              {language === 'ar' ? item.product?.name_ar || item.product?.name : item.product?.name}
            </Text>
            
            {item.product?.part_number && (
              <Text style={[styles.partNumber, { color: colors.textSecondary }]}>
                #{item.product.part_number}
              </Text>
            )}

            {/* Enhanced Pricing Display */}
            <View style={styles.priceContainer}>
              {hasDiscount && (
                <Text style={[styles.originalUnitPrice, { color: colors.textSecondary }]}>
                  {originalPrice.toFixed(0)} ج.م
                </Text>
              )}
              <Text style={[styles.itemPrice, { color: NEON_NIGHT_THEME.primary }]}>
                {finalPrice.toFixed(0)} ج.م
              </Text>
              {hasDiscount && item.discount_details?.discount_type === 'bundle' && (
                <View style={[styles.discountTag, { backgroundColor: NEON_NIGHT_THEME.accent }]}>
                  <Text style={styles.discountTagText}>
                    -{item.discount_details.discount_value}%
                  </Text>
                </View>
              )}
            </View>

            {/* Quantity Controls */}
            <View style={[styles.quantityRow, isRTL && styles.rowReverse]}>
              <View style={[styles.quantityControls, { backgroundColor: colors.background }]}>
                <TouchableOpacity
                  onPress={() => handleQuantityChange(-1)}
                  style={[styles.qtyBtn, { backgroundColor: colors.surface }]}
                  disabled={item.quantity <= 1}
                >
                  <Ionicons name="remove" size={18} color={item.quantity <= 1 ? colors.border : colors.text} />
                </TouchableOpacity>
                <Text style={[styles.qtyText, { color: colors.text }]}>{item.quantity}</Text>
                <TouchableOpacity
                  onPress={() => handleQuantityChange(1)}
                  style={[styles.qtyBtn, { backgroundColor: NEON_NIGHT_THEME.primary }]}
                >
                  <Ionicons name="add" size={18} color="#FFF" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={handleRemove} style={styles.removeBtn}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Subtotal with Savings */}
        <View style={[styles.subtotalRow, { borderTopColor: colors.border }, isRTL && styles.rowReverse]}>
          <View>
            <Text style={[styles.subtotalLabel, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'المجموع الفرعي:' : 'Subtotal:'}
            </Text>
            {itemSavings > 0 && (
              <Text style={[styles.savingsLabel, { color: NEON_NIGHT_THEME.accent }]}>
                {language === 'ar' ? `توفير: ${itemSavings.toFixed(0)} ج.م` : `Save: ${itemSavings.toFixed(0)} EGP`}
              </Text>
            )}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {hasDiscount && (
              <Text style={[styles.originalSubtotal, { color: colors.textSecondary }]}>
                {(originalPrice * item.quantity).toFixed(0)} ج.م
              </Text>
            )}
            <Text style={[styles.subtotalValue, { color: colors.text }]}>
              {(finalPrice * item.quantity).toFixed(0)} ج.م
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

export default function CartScreen() {
  const { colors } = useTheme();
  const { t, isRTL, language } = useTranslation();
  const router = useRouter();
  const { user, setCartItems, cartItems, voidBundleDiscount } = useAppStore();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiTimeout = useRef<any>(null);

  const fetchCart = async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const response = await cartApi.get();
      setItems(response.data.items || []);
      setCartItems(response.data.items || []);
    } catch (error) {
      console.error('Error fetching cart:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCart();
      return () => {
        if (confettiTimeout.current) {
          clearTimeout(confettiTimeout.current);
        }
      };
    }, [user])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchCart();
  };

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
    }
  };

  const removeItem = async (productId: string) => {
    try {
      await cartApi.updateItem(productId, 0);
      setItems((prev) => prev.filter(item => item.product_id !== productId));
      setCartItems(items.filter(item => item.product_id !== productId));
    } catch (error) {
      console.error('Error removing item from cart:', error);
    }
  };

  const handleVoidBundle = (bundleGroupId: string) => {
    voidBundleDiscount(bundleGroupId);
    fetchCart();
  };

  // Group items by bundle
  const groupedItems = React.useMemo(() => {
    const bundles = new Map<string, any[]>();
    const regular: any[] = [];

    items.forEach(item => {
      if (item.bundleGroupId) {
        const existing = bundles.get(item.bundleGroupId) || [];
        bundles.set(item.bundleGroupId, [...existing, item]);
      } else {
        regular.push(item);
      }
    });

    return { bundles, regular };
  }, [items]);

  const getTotal = () => {
    return items.reduce((sum, item) => {
      const price = item.discountedPrice || item.product?.price || 0;
      return sum + price * item.quantity;
    }, 0);
  };

  const getTotalSavings = () => {
    return items.reduce((sum, item) => {
      if (item.bundleDiscount && item.product?.price) {
        const originalPrice = item.product.price;
        const discountedPrice = originalPrice * (1 - item.bundleDiscount / 100);
        return sum + (originalPrice - discountedPrice) * item.quantity;
      }
      return sum;
    }, 0);
  };

  const handleCheckout = () => {
    setShowConfetti(true);
    confettiTimeout.current = setTimeout(() => {
      setShowConfetti(false);
      router.push('/checkout');
    }, 1500);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title={t('myCart')} showBack={false} showCart={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={NEON_NIGHT_THEME.primary} />
        </View>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title={t('myCart')} showBack={false} showCart={false} />
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: `${NEON_NIGHT_THEME.primary}20` }]}>
            <Ionicons name="person-outline" size={48} color={NEON_NIGHT_THEME.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {language === 'ar' ? 'سجل الدخول لعرض سلتك' : 'Sign in to view your cart'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'احفظ منتجاتك وتابع طلباتك' : 'Save your items and track your orders'}
          </Text>
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: NEON_NIGHT_THEME.primary }]}
            onPress={() => router.push('/profile')}
          >
            <Ionicons name="log-in-outline" size={20} color="#FFF" />
            <Text style={styles.loginBtnText}>
              {language === 'ar' ? 'تسجيل الدخول' : 'Sign In'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title={t('myCart')} showBack={false} showCart={false} />
        <View style={styles.emptyContainer}>
          <Animated.View
            entering={FadeIn.duration(500)}
            style={[styles.emptyIcon, { backgroundColor: `${NEON_NIGHT_THEME.primary}20` }]}
          >
            <Ionicons name="cart-outline" size={48} color={NEON_NIGHT_THEME.primary} />
          </Animated.View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {language === 'ar' ? 'سلتك فارغة' : 'Your cart is empty'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'تصفح منتجاتنا وأضف ما يعجبك' : 'Browse our products and add your favorites'}
          </Text>
          <TouchableOpacity
            style={[styles.shopBtn, { backgroundColor: NEON_NIGHT_THEME.primary }]}
            onPress={() => router.push('/')}
          >
            <Ionicons name="storefront-outline" size={20} color="#FFF" />
            <Text style={styles.shopBtnText}>
              {language === 'ar' ? 'تصفح المنتجات' : 'Browse Products'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const totalSavings = getTotalSavings();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title={t('myCart')} showBack={false} showCart={false} />
      
      {/* Confetti Effect */}
      {showConfetti && <ConfettiEffect />}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[NEON_NIGHT_THEME.primary]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Cart Summary Bar */}
        <Animated.View
          entering={FadeInDown.delay(100)}
          style={[styles.summaryBar, { backgroundColor: `${NEON_NIGHT_THEME.primary}15` }]}
        >
          <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
            <View style={[styles.summaryItem, isRTL && styles.rowReverse]}>
              <Ionicons name="cart" size={20} color={NEON_NIGHT_THEME.primary} />
              <Text style={[styles.summaryText, { color: colors.text }]}>
                {items.length} {language === 'ar' ? 'منتج' : 'items'}
              </Text>
            </View>
            {totalSavings > 0 && (
              <View style={[styles.savingsBadge, { backgroundColor: NEON_NIGHT_THEME.accent }]}>
                <Ionicons name="sparkles" size={14} color="#FFF" />
                <Text style={styles.savingsBadgeText}>
                  {language === 'ar' ? `توفير ${totalSavings.toFixed(0)} ج.م` : `Save ${totalSavings.toFixed(0)} EGP`}
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Bundle Groups */}
        {Array.from(groupedItems.bundles.entries()).map(([bundleId, bundleItems]) => (
          <BundleGroupCard
            key={bundleId}
            bundleName={bundleItems[0]?.bundleOfferName || 'Bundle Deal'}
            items={bundleItems}
            discount={bundleItems[0]?.bundleDiscount || 0}
            onRemove={() => handleVoidBundle(bundleId)}
            colors={colors}
            language={language}
            isRTL={isRTL}
          />
        ))}

        {/* Regular Items */}
        {groupedItems.regular.map((item) => (
          <CartItemCard
            key={item.product_id}
            item={item}
            onUpdate={updateQuantity}
            onRemove={removeItem}
            colors={colors}
            language={language}
            isRTL={isRTL}
          />
        ))}

        {/* Bottom spacing for footer */}
        <View style={{ height: 150 }} />
      </ScrollView>

      {/* Checkout Footer */}
      <Animated.View
        entering={FadeInDown.delay(300)}
        style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}
      >
        <View style={[styles.totalRow, isRTL && styles.rowReverse]}>
          <Text style={[styles.totalLabel, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'الإجمالي:' : 'Total:'}
          </Text>
          <View>
            {totalSavings > 0 && (
              <Text style={[styles.originalTotal, { color: colors.textSecondary }]}>
                {(getTotal() + totalSavings).toFixed(0)} ج.م
              </Text>
            )}
            <Text style={[styles.totalValue, { color: NEON_NIGHT_THEME.primary }]}>
              {getTotal().toFixed(0)} ج.م
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.checkoutBtn, { backgroundColor: NEON_NIGHT_THEME.primary }]}
          onPress={handleCheckout}
          activeOpacity={0.85}
        >
          <Text style={styles.checkoutText}>
            {language === 'ar' ? 'إتمام الشراء' : 'Checkout'}
          </Text>
          <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={20} color="#FFF" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  loginBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  shopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  shopBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryBar: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  summaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  savingsBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  bundleCard: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  bundleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bundleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  bundleBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  discountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  discountText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  bundleName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  bundleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  bundleItemImage: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    marginRight: 12,
  },
  bundleItemImg: {
    width: '100%',
    height: '100%',
  },
  bundleItemPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bundleItemInfo: {
    flex: 1,
  },
  bundleItemName: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  bundleItemQty: {
    fontSize: 12,
  },
  bundleItemPrices: {
    alignItems: 'flex-end',
  },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  discountedPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
  savingsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  savingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  savingsText: {
    fontSize: 14,
    fontWeight: '700',
  },
  voidBundleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  voidBundleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cartItem: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },
  cartItemContent: {
    flexDirection: 'row',
    padding: 12,
  },
  itemImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    lineHeight: 20,
  },
  partNumber: {
    fontSize: 12,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 4,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyText: {
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 16,
  },
  removeBtn: {
    padding: 8,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  subtotalLabel: {
    fontSize: 13,
  },
  subtotalValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    paddingBottom: 32,
    borderTopWidth: 1,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
  },
  originalTotal: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    textAlign: 'right',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  checkoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  checkoutText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  textRight: {
    textAlign: 'right',
  },
});
