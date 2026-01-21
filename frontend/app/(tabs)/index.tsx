/**
 * Home Screen - Optimized with React Query and FlashList
 * Main landing page with car brands, offers, products, and search
 */
import React, { useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Animated,
  Keyboard,
  Dimensions,
  Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../src/components/Header';
import { DynamicOfferSlider } from '../../src/components/DynamicOfferSlider';
import { InteractiveCarSelector } from '../../src/components/InteractiveCarSelector';
import { AnimatedBrandCard } from '../../src/components/AnimatedBrandCard';
import { ProductCard } from '../../src/components/ProductCard';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAppStore } from '../../src/store/appStore';
import { cartApi, favoritesApi } from '../../src/services/api';
import { Skeleton, ProductCardSkeleton, CategoryCardSkeleton } from '../../src/components/ui/Skeleton';
import { syncService } from '../../src/services/syncService';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useHomeScreenQuery } from '../../src/hooks/queries';
import { useEffect } from 'react';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Product card sizing with dynamic screen-based calculation
const BASE_CARD_WIDTH = 150;
const MAX_ENLARGEMENT_PERCENT = 0.19;
const MAX_CARD_WIDTH = Math.floor(BASE_CARD_WIDTH * (1 + MAX_ENLARGEMENT_PERCENT));

const calculateCardWidth = () => {
  const horizontalPadding = 16 * 2;
  const cardGap = 12;
  const availableWidth = SCREEN_WIDTH - horizontalPadding;
  const minCardsPerRow = Math.floor(availableWidth / (BASE_CARD_WIDTH + cardGap));
  const optimalWidth = Math.floor((availableWidth - (cardGap * (minCardsPerRow - 1))) / minCardsPerRow);
  return Math.min(optimalWidth, MAX_CARD_WIDTH);
};

const HOME_PRODUCT_CARD_WIDTH = calculateCardWidth();

// Memoized horizontal list item components for performance
const MemoizedBrandCard = memo(AnimatedBrandCard);
const MemoizedProductCard = memo(ProductCard);

// Memoized Car Model Card component
const CarModelCard = memo(({ model, colors, getName, onPress }: any) => (
  <TouchableOpacity
    style={[styles.carModelCard, { backgroundColor: colors.card, borderColor: colors.border }]}
    onPress={onPress}
  >
    <View style={[styles.carModelImageContainer, { backgroundColor: colors.surface }]}>
      {model.image_url ? (
        <Image
          source={{ uri: model.image_url }}
          style={styles.carModelImage}
          contentFit="cover"
          cachePolicy="disk"
          transition={200}
        />
      ) : (
        <Ionicons name="car-sport" size={36} color={colors.textSecondary} />
      )}
    </View>
    <View style={styles.carModelInfo}>
      <Text style={[styles.carModelName, { color: colors.text }]} numberOfLines={1}>
        {getName(model)}
      </Text>
      {model.year_start && model.year_end && (
        <Text style={[styles.carModelYear, { color: colors.textSecondary }]}>
          {model.year_start} - {model.year_end}
        </Text>
      )}
    </View>
  </TouchableOpacity>
));

export default function HomeScreen() {
  const { colors, isDark } = useTheme();
  const { t, isRTL, language } = useTranslation();
  const router = useRouter();
  const { user, addToLocalCart } = useAppStore();

  // Use React Query for all data fetching
  const {
    categories,
    carBrands,
    carModels,
    productBrands,
    products,
    favorites: favoritesSet,
    banners,
    isLoading,
    isRefetching,
    refetch,
  } = useHomeScreenQuery();

  // Local state for search and UI interactions
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchAnim = useRef(new Animated.Value(0)).current;
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});
  const [cartLoadingStates, setCartLoadingStates] = useState<Record<string, boolean>>({});
  const [addedToCartStates, setAddedToCartStates] = useState<Record<string, boolean>>({});

  // Sync favorites from query
  useEffect(() => {
    setFavorites(favoritesSet);
  }, [favoritesSet]);

  // Start sync service
  useEffect(() => {
    syncService.start();
    return () => syncService.stop();
  }, []);

  // Search filter with useMemo for performance
  const filteredProducts = useMemo(() => {
    if (searchQuery.trim() === '') {
      return products;
    }
    const query = searchQuery.toLowerCase();
    return products.filter((product: any) => {
      const name = (product.name || '').toLowerCase();
      const nameAr = (product.name_ar || '').toLowerCase();
      const sku = (product.sku || '').toLowerCase();
      return name.includes(query) || nameAr.includes(query) || sku.includes(query);
    });
  }, [searchQuery, products]);

  // Search focus animation
  useEffect(() => {
    Animated.timing(searchAnim, {
      toValue: isSearchFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isSearchFocused]);

  const getName = useCallback((item: any) => {
    return language === 'ar' && item.name_ar ? item.name_ar : item.name;
  }, [language]);

  const handleAddToCart = useCallback(async (product: any, quantity: number = 1) => {
    if (!user) {
      router.push('/login');
      return;
    }
    
    setCartLoadingStates(prev => ({ ...prev, [product.id]: true }));
    
    try {
      await cartApi.addItem(product.id, quantity);
      addToLocalCart({ product_id: product.id, quantity: quantity, product });
      setAddedToCartStates(prev => ({ ...prev, [product.id]: true }));
      setProductQuantities(prev => ({ ...prev, [product.id]: 1 }));
      
      setTimeout(() => {
        setAddedToCartStates(prev => ({ ...prev, [product.id]: false }));
      }, 1500);
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setCartLoadingStates(prev => ({ ...prev, [product.id]: false }));
    }
  }, [user, router, addToLocalCart]);

  const handleIncreaseQuantity = useCallback((productId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProductQuantities(prev => ({
      ...prev,
      [productId]: (prev[productId] || 1) + 1
    }));
  }, []);

  const handleDecreaseQuantity = useCallback((productId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProductQuantities(prev => {
      const current = prev[productId] || 1;
      if (current > 1) {
        return { ...prev, [productId]: current - 1 };
      }
      return prev;
    });
  }, []);

  const handleToggleFavorite = useCallback(async (productId: string) => {
    if (!user) {
      router.push('/login');
      return;
    }
    try {
      const response = await favoritesApi.toggle(productId);
      setFavorites((prev) => {
        const newSet = new Set(prev);
        if (response.data.is_favorite) {
          newSet.add(productId);
        } else {
          newSet.delete(productId);
        }
        return newSet;
      });
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  }, [user, router]);

  // Render product item for FlashList
  const renderProductItem = useCallback(({ item: product }: { item: any }) => (
    <MemoizedProductCard
      product={product}
      cardWidth={HOME_PRODUCT_CARD_WIDTH}
      onAddToCart={(quantity: number) => handleAddToCart(product, quantity)}
    />
  ), [handleAddToCart]);

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header showBack={false} />
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Car Brands Skeleton */}
          <View style={styles.section}>
            <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
              <Skeleton width={120} height={20} />
              <Skeleton width={60} height={16} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={[styles.brandCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Skeleton width={50} height={50} borderRadius={25} style={{ marginBottom: 8 }} />
                  <Skeleton width={60} height={14} />
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Offers Skeleton */}
          <View style={styles.sliderSection}>
            <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
              <Skeleton width={140} height={20} />
            </View>
            <Skeleton height={160} borderRadius={12} style={{ marginHorizontal: 16 }} />
          </View>

          {/* Products Skeleton */}
          <View style={styles.section}>
            <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
              <Skeleton width={80} height={20} />
              <Skeleton width={60} height={16} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {[1, 2, 3].map((i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </ScrollView>
          </View>
        </ScrollView>
      </View>
    );
  }

  const searchBorderColor = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.border, colors.primary],
  });

  return (
    <View style={styles.container}>
      {/* Glassblur Background Effect */}
      <LinearGradient
        colors={isDark 
          ? ['#0a1628', '#152238', '#1a2744', '#0d1b2a']
          : ['#f0f4f8', '#e2e8f0', '#cbd5e1', '#f8fafc']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {Platform.OS !== 'web' && (
        <BlurView
          intensity={15}
          tint={isDark ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, styles.blurOverlay]}
        />
      )}
      <View style={[styles.glassOverlay, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)' }]} />
      
      <Header showBack={false} />
      
      <ScrollView
        style={[styles.scrollView, { backgroundColor: 'transparent' }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#fff" />
        }
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Car Brands Section */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('carBrands')}
            </Text>
            <TouchableOpacity onPress={() => router.push('/car-brands')}>
              <Text style={[styles.viewAll, { color: colors.primary }]}>
                {t('viewAll')}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.horizontalListWrapper}>
            <FlashList
              data={carBrands}
              renderItem={({ item: brand }) => {
                const brandModels = carModels.filter((m: any) => m.brand_id === brand.id);
                return (
                  <MemoizedBrandCard
                    brand={brand}
                    type="car"
                    modelsCount={brandModels.length}
                    onPress={() => router.push(`/brand/${brand.id}`)}
                  />
                );
              }}
              keyExtractor={(item) => item.id}
              horizontal
              estimatedItemSize={112}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            />
          </View>
        </View>

        {/* 2. Dynamic Marketing Slider */}
        <View style={styles.sliderSection}>
          <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {language === 'ar' ? 'العروض الخاصة' : 'Special Offers'}
            </Text>
            <View style={[styles.liveBadge, { backgroundColor: colors.error + '20' }]}>
              <View style={[styles.liveDot, { backgroundColor: colors.error }]} />
              <Text style={[styles.liveText, { color: colors.error }]}>
                {language === 'ar' ? 'حصري' : 'EXCLUSIVE'}
              </Text>
            </View>
          </View>
          <DynamicOfferSlider />
        </View>

        {/* 3. Car Models Section */}
        {carModels.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {language === 'ar' ? 'موديلات السيارات' : 'Car Models'}
              </Text>
              <TouchableOpacity onPress={() => router.push('/models')}>
                <Text style={[styles.viewAll, { color: colors.primary }]}>
                  {t('viewAll')}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.horizontalListWrapper}>
              <FlashList
                data={carModels}
                renderItem={({ item: model }) => (
                  <CarModelCard
                    model={model}
                    colors={colors}
                    getName={getName}
                    onPress={() => router.push(`/car/${model.id}`)}
                  />
                )}
                keyExtractor={(item) => item.id}
                horizontal
                estimatedItemSize={146}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
              />
            </View>
          </View>
        )}

        {/* 4. Product Brands Section */}
        <View style={styles.section}>
          <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {t('productBrands')}
            </Text>
          </View>
          <View style={styles.horizontalListWrapper}>
            <FlashList
              data={productBrands}
              renderItem={({ item: brand }) => (
                <MemoizedBrandCard
                  brand={{
                    ...brand,
                    country_of_origin: brand.country_of_origin || 'Japan',
                  }}
                  type="product"
                  onPress={() => router.push(`/search?product_brand_id=${brand.id}`)}
                />
              )}
              keyExtractor={(item) => item.id}
              horizontal
              estimatedItemSize={112}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalScroll}
            />
          </View>
        </View>

        {/* 5. Products Section with FlashList */}
        {filteredProducts.length > 0 && (
          <View style={styles.section}>
            <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('products')}
                {searchQuery && (
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                    {' '}({filteredProducts.length})
                  </Text>
                )}
              </Text>
              <TouchableOpacity onPress={() => router.push('/search')}>
                <Text style={[styles.viewAll, { color: colors.primary }]}>
                  {t('viewAll')}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.horizontalListWrapper}>
              <FlashList
                data={filteredProducts}
                renderItem={renderProductItem}
                keyExtractor={(item) => item.id}
                horizontal
                estimatedItemSize={HOME_PRODUCT_CARD_WIDTH + 12}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalScroll}
              />
            </View>
          </View>
        )}

        {/* 6. Product Search Bar */}
        <View style={styles.searchSection}>
          <Text style={[styles.searchLabel, { color: colors.text }]}>
            {language === 'ar' ? 'ابحث عن منتج' : 'Search Products'}
          </Text>
          <Animated.View
            style={[
              styles.searchInputContainer,
              {
                backgroundColor: colors.surface,
                borderColor: searchBorderColor,
              },
            ]}
          >
            <Ionicons
              name="search"
              size={20}
              color={isSearchFocused ? colors.primary : colors.textSecondary}
            />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={language === 'ar' ? 'ادخل اسم المنتج أو SKU...' : 'Enter product name or SKU...'}
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  Keyboard.dismiss();
                }}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </Animated.View>
          
          {searchQuery.length > 0 && (
            <View style={styles.searchResults}>
              <Ionicons
                name={filteredProducts.length > 0 ? 'checkmark-circle' : 'alert-circle'}
                size={16}
                color={filteredProducts.length > 0 ? colors.success : colors.error}
              />
              <Text
                style={[
                  styles.searchResultsText,
                  { color: filteredProducts.length > 0 ? colors.success : colors.error },
                ]}
              >
                {filteredProducts.length > 0
                  ? language === 'ar'
                    ? `تم العثور على ${filteredProducts.length} منتج`
                    : `Found ${filteredProducts.length} products`
                  : language === 'ar'
                  ? 'لا توجد نتائج'
                  : 'No results found'}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 20 }} />

        {/* 7. Promotional Banners */}
        {banners.length > 0 && (
          <View style={styles.bannersSection}>
            <View style={[styles.sectionHeader, isRTL && styles.sectionHeaderRTL]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {language === 'ar' ? 'عروض خاصة' : 'Special Offers'}
              </Text>
            </View>
            {banners.map((banner: any) => (
              <TouchableOpacity
                key={banner.id}
                style={styles.bannerCard}
                onPress={() => {
                  if (banner.target_product_id) {
                    router.push(`/product/${banner.target_product_id}`);
                  } else if (banner.target_car_model_id) {
                    router.push(`/car/${banner.target_car_model_id}`);
                  }
                }}
                activeOpacity={0.9}
              >
                {banner.image ? (
                  <Image
                    source={{ uri: banner.image }}
                    style={styles.bannerImage}
                    contentFit="cover"
                    cachePolicy="disk"
                    transition={200}
                  />
                ) : (
                  <LinearGradient
                    colors={['#3B82F6', '#8B5CF6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.bannerGradient}
                  >
                    <Ionicons name="megaphone" size={40} color="rgba(255,255,255,0.3)" />
                  </LinearGradient>
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.7)']}
                  style={styles.bannerOverlay}
                >
                  <View style={styles.bannerContent}>
                    <Text style={styles.bannerTitle}>
                      {language === 'ar' ? (banner.title_ar || banner.title) : banner.title}
                    </Text>
                    <View style={styles.bannerBadge}>
                      <Ionicons name="arrow-forward" size={14} color="#FFF" />
                      <Text style={styles.bannerBadgeText}>
                        {language === 'ar' ? 'اكتشف المزيد' : 'Learn More'}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 140 }} />
      </ScrollView>
      
      <InteractiveCarSelector />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a1628',
  },
  blurOverlay: {
    zIndex: 0,
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  section: {
    marginTop: 16,
  },
  sliderSection: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionHeaderRTL: {
    flexDirection: 'row-reverse',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  viewAll: {
    fontSize: 14,
    fontWeight: '600',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  liveText: {
    fontSize: 11,
    fontWeight: '700',
  },
  horizontalScroll: {
    paddingHorizontal: 16,
  },
  horizontalListWrapper: {
    height: 160,
  },
  brandCard: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 6,
  },
  carModelCard: {
    width: 140,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 6,
    overflow: 'hidden',
  },
  carModelImageContainer: {
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carModelImage: {
    width: '100%',
    height: '100%',
  },
  carModelInfo: {
    padding: 10,
  },
  carModelName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  carModelYear: {
    fontSize: 11,
  },
  searchSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  searchLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  clearButton: {
    padding: 4,
  },
  searchResults: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  searchResultsText: {
    fontSize: 13,
    fontWeight: '500',
  },
  bannersSection: {
    marginTop: 24,
    paddingHorizontal: 0,
  },
  bannerCard: {
    height: 160,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  bannerGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    justifyContent: 'flex-end',
    padding: 16,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  bannerBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
