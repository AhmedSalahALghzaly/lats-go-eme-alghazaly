/**
 * CartTab - Shopping cart display and management tab
 * REDESIGNED: Larger product cards with SKU and compatible car models
 * FIXED: Proper list spacing and FlashList configuration
 */
import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Image, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { EmptyState } from '../ui/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { NEON_NIGHT_THEME } from '../../store/appStore';

const SHIPPING_COST = 150;

interface CartTabProps {
  cartItems: any[];
  isRTL: boolean;
  getSubtotal: () => number;
  getOriginalTotal: () => number;
  getTotalSavings: () => number;
  getItemCount: () => number;
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onCheckout: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export const CartTab: React.FC<CartTabProps> = ({
  cartItems,
  isRTL,
  getSubtotal,
  getOriginalTotal,
  getTotalSavings,
  getItemCount,
  onUpdateQuantity,
  onRemove,
  onCheckout,
  onRefresh,
  refreshing = false,
}) => {
  const { colors } = useTheme();
  const { language } = useTranslation();
  const router = useRouter();

  const safeCartItems = useMemo(() => 
    Array.isArray(cartItems) ? cartItems : [], 
    [cartItems]
  );

  // Format compatible car models for display
  const formatCarModels = useCallback((product: any) => {
    if (!product?.compatible_car_models || product.compatible_car_models.length === 0) {
      return null;
    }
    const models = product.compatible_car_models;
    if (models.length <= 2) {
      return models.map((m: any) => m.name || m).join(', ');
    }
    const firstTwo = models.slice(0, 2).map((m: any) => m.name || m).join(', ');
    return `${firstTwo} +${models.length - 2} ${language === 'ar' ? 'أخرى' : 'more'}`;
  }, [language]);

  // Render professional cart item card
  const renderCartItem = useCallback(({ item }: { item: any }) => {
    const product = item.product || {};
    const originalPrice = item.original_unit_price || product.price || 0;
    const finalPrice = item.final_unit_price || product.price || 0;
    const hasDiscount = originalPrice > finalPrice;
    const lineTotal = finalPrice * item.quantity;
    const carModelsDisplay = formatCarModels(product);
    const sku = product.sku || item.sku || 'N/A';

    return (
      <View style={[styles.cartItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Product Image Section */}
        <Pressable
          style={[styles.productThumb, { backgroundColor: colors.surface }]}
          onPress={() => router.push(`/product/${item.product_id}`)}
        >
          {product.image_url || (product.images && product.images[0]) ? (
            <Image 
              source={{ uri: product.images?.[0] || product.image_url }} 
              style={styles.productImage} 
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="cube-outline" size={32} color={colors.textSecondary} />
          )}
          {item.bundle_group_id && (
            <View style={[styles.bundleBadge, { backgroundColor: NEON_NIGHT_THEME.accent }]}>
              <Ionicons name="gift" size={10} color="#FFF" />
            </View>
          )}
        </Pressable>

        {/* Product Info Section */}
        <View style={styles.cartItemInfo}>
          {/* Product Name */}
          <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
            {language === 'ar' ? product.name_ar : product.name}
          </Text>

          {/* SKU Badge */}
          <View style={[styles.skuContainer, { backgroundColor: colors.surface }]}>
            <Ionicons name="barcode-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.skuText, { color: colors.textSecondary }]}>
              SKU: {sku}
            </Text>
          </View>

          {/* Compatible Car Models */}
          {carModelsDisplay && (
            <View style={[styles.carModelsContainer, { backgroundColor: '#3B82F6' + '15' }]}>
              <Ionicons name="car-outline" size={12} color="#3B82F6" />
              <Text style={[styles.carModelsText, { color: '#3B82F6' }]} numberOfLines={1}>
                {carModelsDisplay}
              </Text>
            </View>
          )}

          {/* Price Row */}
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
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>
                  -{Math.round(((originalPrice - finalPrice) / originalPrice) * 100)}%
                </Text>
              </View>
            )}
          </View>

          {/* Line Total */}
          <View style={[styles.lineTotalRow, isRTL && styles.rowReverse]}>
            <Text style={[styles.lineTotalLabel, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'الإجمالي:' : 'Total:'}
            </Text>
            <Text style={[styles.lineTotalValue, { color: colors.text }]}>
              {lineTotal.toFixed(0)} ج.م
            </Text>
          </View>
        </View>

        {/* Actions Section */}
        <View style={styles.actionsSection}>
          {/* Quantity Controls */}
          <View style={[styles.quantityControls, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
              style={[styles.qtyBtn, { backgroundColor: colors.card }]}
              onPress={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
            >
              <Ionicons name="remove" size={16} color={colors.text} />
            </Pressable>
            <Text style={[styles.qtyText, { color: colors.text }]}>{item.quantity}</Text>
            <Pressable
              style={[styles.qtyBtn, { backgroundColor: colors.card }]}
              onPress={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
            >
              <Ionicons name="add" size={16} color={colors.text} />
            </Pressable>
          </View>

          {/* Remove Button */}
          <Pressable
            style={[styles.removeBtn, { backgroundColor: '#EF4444' + '15' }]}
            onPress={() => onRemove(item.product_id)}
          >
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </Pressable>
        </View>
      </View>
    );
  }, [colors, language, isRTL, router, onUpdateQuantity, onRemove, formatCarModels]);

  // Order Summary Component
  const OrderSummary = useMemo(() => {
    if (safeCartItems.length === 0) return null;
    
    return (
      <View style={[styles.summaryContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {language === 'ar' ? 'ملخص الطلب' : 'Order Summary'}
        </Text>

        {getTotalSavings() > 0 && (
          <View style={[styles.summaryRow, isRTL && styles.rowReverse]}>
            <View style={[styles.savingsRow, isRTL && styles.rowReverse]}>
              <Ionicons name="sparkles" size={14} color="#10B981" />
              <Text style={[styles.savingsLabel, { color: '#10B981' }]}>
                {language === 'ar' ? 'التوفير' : 'You Save'}
              </Text>
            </View>
            <Text style={[styles.savingsValue, { color: '#10B981' }]}>
              -{getTotalSavings().toFixed(0)} ج.م
            </Text>
          </View>
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

        <Pressable
          style={[styles.checkoutBtn, { backgroundColor: NEON_NIGHT_THEME.primary }]}
          onPress={onCheckout}
        >
          <Ionicons name="card-outline" size={20} color="#FFF" />
          <Text style={styles.checkoutBtnText}>
            {language === 'ar' ? 'المتابعة للدفع' : 'Proceed to Checkout'}
          </Text>
          <Ionicons name={isRTL ? 'arrow-back' : 'arrow-forward'} size={20} color="#FFF" />
        </Pressable>
      </View>
    );
  }, [colors, language, isRTL, getSubtotal, getTotalSavings, onCheckout, safeCartItems.length]);

  // List Header - minimal padding
  const ListHeaderComponent = useCallback(() => (
    <View style={styles.sectionHeader}>
      <View style={[styles.headerRow, isRTL && styles.rowReverse]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {language === 'ar' ? 'سلة التسوق' : 'Shopping Cart'}
        </Text>
        <View style={[styles.countBadge, { backgroundColor: NEON_NIGHT_THEME.primary }]}>
          <Text style={styles.countBadgeText}>{getItemCount()}</Text>
        </View>
      </View>
    </View>
  ), [colors, language, isRTL, getItemCount]);

  // List Footer with summary
  const ListFooterComponent = useCallback(() => (
    <View style={styles.footerContainer}>
      {OrderSummary}
      <View style={{ height: 100 }} />
    </View>
  ), [OrderSummary]);

  // Empty state
  const ListEmptyComponent = useCallback(() => (
    <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <EmptyState
        icon="cart-outline"
        title={language === 'ar' ? 'السلة فارغة' : 'Cart is empty'}
        actionLabel={language === 'ar' ? 'تصفح المنتجات' : 'Browse Products'}
        onAction={() => router.push('/')}
      />
    </View>
  ), [language, router, colors]);

  return (
    <FlashList
      data={safeCartItems}
      renderItem={renderCartItem}
      keyExtractor={(item, index) => item.product_id || `cart-item-${index}`}
      estimatedItemSize={180}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerStyle={styles.listContainer}
      showsVerticalScrollIndicator={false}
      extraData={safeCartItems.length}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={NEON_NIGHT_THEME.primary}
          />
        ) : undefined
      }
    />
  );
};

const styles = StyleSheet.create({
  listContainer: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    paddingTop: 8,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  countBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  countBadgeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  footerContainer: {
    marginTop: 8,
  },
  emptyContainer: {
    marginTop: 8,
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  cartItem: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  productThumb: {
    width: 90,
    height: 90,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  productImage: {
    width: 90,
    height: 90,
    borderRadius: 12,
  },
  bundleBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartItemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'space-between',
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 20,
  },
  skuContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
    marginBottom: 4,
  },
  skuText: {
    fontSize: 11,
    fontWeight: '500',
  },
  carModelsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    marginBottom: 6,
    maxWidth: '100%',
  },
  carModelsText: {
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  originalPrice: {
    fontSize: 12,
    textDecorationLine: 'line-through',
  },
  finalPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  discountBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  lineTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lineTotalLabel: {
    fontSize: 12,
  },
  lineTotalValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionsSection: {
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingLeft: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  qtyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 8,
    minWidth: 30,
    textAlign: 'center',
  },
  removeBtn: {
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  summaryContainer: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
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
    paddingTop: 14,
    marginTop: 10,
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
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  checkoutBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default CartTab;
