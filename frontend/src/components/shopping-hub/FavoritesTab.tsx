/**
 * FavoritesTab - Favorites list display tab
 * Shows user's favorite products with actions
 * OPTIMIZED: Uses FlashList for superior memory and rendering performance
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { GlassCard } from '../ui/GlassCard';
import { EmptyState } from '../ui/EmptyState';
import { useTheme } from '../../hooks/useTheme';
import { useTranslation } from '../../hooks/useTranslation';
import { NEON_NIGHT_THEME } from '../../store/appStore';

interface FavoritesTabProps {
  favorites: any[];
  isRTL: boolean;
  isAdminView: boolean;
  onAddToCart: (product: any) => void;
  onToggleFavorite: (productId: string) => void;
}

export const FavoritesTab: React.FC<FavoritesTabProps> = ({
  favorites,
  isRTL,
  isAdminView,
  onAddToCart,
  onToggleFavorite,
}) => {
  const { colors } = useTheme();
  const { language } = useTranslation();
  const router = useRouter();

  const safeFavorites = Array.isArray(favorites) ? favorites : [];

  // Memoized render item for FlashList
  const renderFavoriteItem = useCallback(({ item }: { item: any }) => (
    <TouchableOpacity
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
            onAddToCart(item.product);
          }}
        >
          <Ionicons name="cart-outline" size={18} color="#FFF" />
        </TouchableOpacity>
        {!isAdminView && (
          <TouchableOpacity
            style={[styles.iconActionBtn, { backgroundColor: '#EF4444' }]}
            onPress={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.product_id || item.product?.id);
            }}
          >
            <Ionicons name="heart-dislike-outline" size={18} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  ), [colors, language, isAdminView, router, onAddToCart, onToggleFavorite]);

  const keyExtractor = useCallback((item: any) => item.product_id || item.id || String(Math.random()), []);

  return (
    <GlassCard>
      <View style={[styles.sectionHeader, isRTL && styles.rowReverse]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {language === 'ar' ? 'المنتجات المفضلة' : 'Favorite Products'}
        </Text>
        <View style={[styles.countBadge, { backgroundColor: NEON_NIGHT_THEME.primary }]}>
          <Text style={styles.countBadgeText}>{safeFavorites.length}</Text>
        </View>
      </View>

      {safeFavorites.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title={language === 'ar' ? 'لا توجد منتجات مفضلة' : 'No favorites yet'}
        />
      ) : (
        <View style={styles.listContainer}>
          <FlashList
            data={safeFavorites}
            renderItem={renderFavoriteItem}
            keyExtractor={keyExtractor}
            estimatedItemSize={80}
            scrollEnabled={false}
          />
        </View>
      )}
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
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
});

export default FavoritesTab;
