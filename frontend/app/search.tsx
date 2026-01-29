import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCard } from '../src/components/ProductCard';
import { DriftLoader } from '../src/components/ui/DriftLoader';
import { useTheme } from '../src/hooks/useTheme';
import { useTranslation } from '../src/hooks/useTranslation';
import { useAppStore } from '../src/store/appStore';
import { useInfiniteProducts } from '../src/hooks/useInfiniteProducts';
import { carBrandsApi, carModelsApi, productBrandsApi, categoriesApi, cartApi } from '../src/services/api';

// Constants for responsive grid layout
const HORIZONTAL_PADDING = 10; // Total horizontal padding (5px left + 5px right)
const CARD_MARGIN = 6; // Legacy - kept for compatibility
const MAX_CARD_WIDTH = 203; // Maximum card width
const MIN_CARD_WIDTH = 173; // Minimum card width for readability

export default function SearchScreen() {
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const { t, isRTL, language } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, addToLocalCart } = useAppStore();
  const { width: screenWidth } = useWindowDimensions();

  const [carBrands, setCarBrands] = useState<any[]>([]);
  const [carModels, setCarModels] = useState<any[]>([]);
  const [filteredCarModels, setFilteredCarModels] = useState<any[]>([]);
  const [productBrands, setProductBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Calculate responsive card width and number of columns based on screen width
  // Precision grid alignment with fixed horizontal gaps
  const { cardWidth, numColumns } = useMemo(() => {
    // For web, use inner width minus padding
    const availableWidth = screenWidth - HORIZONTAL_PADDING;
    
    // Debug logging for development
    if (__DEV__ && Platform.OS === 'web') {
      console.log('[Search Grid Debug] screenWidth:', screenWidth, 'availableWidth:', availableWidth);
    }
    
    // Desktop web (>768px): Fixed card width of 179px, 15px horizontal gap
    if (Platform.OS === 'web' && screenWidth > 768) {
      const FIXED_CARD_WIDTH = 179;
      const WEB_GAP = 15;
      
      // Calculate how many columns can fit
      const calculatedCols = Math.floor(availableWidth / (FIXED_CARD_WIDTH + WEB_GAP));
      const cols = Math.max(2, calculatedCols); // Minimum 2 columns, unlimited maximum
      
      if (__DEV__) {
        console.log('[Search Grid Debug] Desktop: cols:', cols, 'cardWidth:', FIXED_CARD_WIDTH, 'gap:', WEB_GAP);
      }
      
      return { cardWidth: FIXED_CARD_WIDTH, numColumns: cols };
    }
    
    // Mobile: Fixed 2-column layout with 15px horizontal gap
    const MOBILE_GAP = 15;
    const mobileCardWidth = Math.floor((availableWidth - MOBILE_GAP) / 2);
    
    return { cardWidth: mobileCardWidth, numColumns: 2 };
  }, [screenWidth]);

  // Filters
  const [selectedCarBrand, setSelectedCarBrand] = useState<string | null>(params.car_brand_id as string || null);
  const [selectedCarModel, setSelectedCarModel] = useState<string | null>(params.car_model_id as string || null);
  const [selectedProductBrand, setSelectedProductBrand] = useState<string | null>(params.product_brand_id as string || null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(params.category_id as string || null);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Build filters object for infinite products hook
  // Memoized with stable reference to prevent re-render loops
  const prevFiltersRef = useRef<string>('');
  const filters = useMemo(() => {
    const newFilters = {
      car_brand_id: selectedCarBrand && !selectedCarModel ? selectedCarBrand : undefined,
      car_model_id: selectedCarModel || undefined,
      product_brand_id: selectedProductBrand || undefined,
      category_id: selectedCategory || undefined,
      min_price: minPrice ? parseFloat(minPrice) : undefined,
      max_price: maxPrice ? parseFloat(maxPrice) : undefined,
    };
    
    // Only return new object if values actually changed
    const newFiltersStr = JSON.stringify(newFilters);
    if (newFiltersStr === prevFiltersRef.current) {
      return JSON.parse(prevFiltersRef.current);
    }
    prevFiltersRef.current = newFiltersStr;
    return newFilters;
  }, [selectedCarBrand, selectedCarModel, selectedProductBrand, selectedCategory, minPrice, maxPrice]);

  // Use infinite products hook with cursor-based pagination
  const {
    products,
    isLoading: loading,
    isLoadingMore,
    isRefreshing,
    hasMore,
    total,
    fetchNextPage,
    refresh,
  } = useInfiniteProducts({
    pageSize: 20,
    filters,
  });

  const fetchFilters = async () => {
    try {
      const [carBrandsRes, carModelsRes, prodBrandsRes, catsRes] = await Promise.all([
        carBrandsApi.getAll(),
        carModelsApi.getAll(),
        productBrandsApi.getAll(),
        categoriesApi.getAll(),
      ]);
      setCarBrands(carBrandsRes.data);
      setCarModels(carModelsRes.data);
      setFilteredCarModels(carModelsRes.data);
      setProductBrands(prodBrandsRes.data);
      setCategories(catsRes.data);
    } catch (error) {
      console.error('Error fetching filters:', error);
    }
  };

  // Filter car models when brand changes - with loop prevention
  const prevBrandRef = useRef<string | null>(null);
  useEffect(() => {
    // Skip if brand hasn't actually changed
    if (prevBrandRef.current === selectedCarBrand) {
      return;
    }
    prevBrandRef.current = selectedCarBrand;
    
    if (selectedCarBrand) {
      setFilteredCarModels(carModels.filter((m) => m.brand_id === selectedCarBrand));
      // Clear selected model if it doesn't belong to the selected brand
      if (selectedCarModel) {
        const model = carModels.find((m) => m.id === selectedCarModel);
        if (model && model.brand_id !== selectedCarBrand) {
          setSelectedCarModel(null);
        }
      }
    } else {
      setFilteredCarModels(carModels);
    }
  }, [selectedCarBrand, carModels, selectedCarModel]);

  useEffect(() => {
    fetchFilters();
  }, []);

  const handleAddToCart = async (product: any) => {
    if (!user) {
      router.push('/login');
      return;
    }

    try {
      await cartApi.addItem(product.id, 1);
      addToLocalCart({ product_id: product.id, quantity: 1, product });
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  // Handle infinite scroll - load more when reaching end
  const handleEndReached = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchNextPage();
    }
  }, [isLoadingMore, hasMore, fetchNextPage]);

  const clearFilters = () => {
    setSelectedCarBrand(null);
    setSelectedCarModel(null);
    setSelectedProductBrand(null);
    setSelectedCategory(null);
    setMinPrice('');
    setMaxPrice('');
  };

  const getName = (item: any) => {
    return language === 'ar' && item?.name_ar ? item.name_ar : item?.name || '';
  };

  const hasActiveFilters = selectedCarBrand || selectedCarModel || selectedProductBrand || selectedCategory || minPrice || maxPrice;

  // Footer component for loading more indicator
  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          {language === 'ar' ? 'جاري التحميل...' : 'Loading more...'}
        </Text>
      </View>
    );
  }, [isLoadingMore, colors, language]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[
        styles.header, 
        { backgroundColor: colors.background, borderBottomColor: colors.border, paddingTop: insets.top + 10 }
      ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons 
            name={isRTL ? 'arrow-forward' : 'arrow-back'} 
            size={24} 
            color={colors.text} 
          />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {t('advancedSearch')}
        </Text>
        <TouchableOpacity 
          onPress={() => setShowFilters(!showFilters)} 
          style={styles.filterButton}
        >
          <Ionicons 
            name={showFilters ? 'options' : 'options-outline'} 
            size={24} 
            color={hasActiveFilters ? colors.primary : colors.text} 
          />
        </TouchableOpacity>
      </View>

      {/* Filters Panel */}
      {showFilters && (
        <ScrollView 
          style={[styles.filtersPanel, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Car Brands */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              {t('filterByBrand')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {carBrands.map((brand) => {
                // Car brands use 'logo' field for images (base64 format from admin panel)
                const brandImage = brand.logo;
                return (
                  <TouchableOpacity
                    key={brand.id}
                    style={[
                      styles.imageFilterCard,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      selectedCarBrand === brand.id && { borderColor: colors.primary, borderWidth: 2 },
                    ]}
                    onPress={() => setSelectedCarBrand(selectedCarBrand === brand.id ? null : brand.id)}
                  >
                    <View style={[styles.imageFilterImageContainer, { backgroundColor: colors.background }]}>
                      {brandImage ? (
                        <Image
                          source={{ uri: brandImage }}
                          style={styles.carBrandImage}
                          contentFit="contain"
                          transition={200}
                        />
                      ) : (
                        <Ionicons name="car-sport" size={40} color={colors.textSecondary} />
                      )}
                    </View>
                    <Text style={[
                      styles.imageFilterLabel,
                      { color: selectedCarBrand === brand.id ? colors.primary : colors.text },
                    ]} numberOfLines={1}>
                      {getName(brand)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Car Models */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              {language === 'ar' ? 'فلتر حسب موديل السيارة' : 'Filter by Car Model'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {filteredCarModels.map((model) => {
                // Car models use 'image_url' field for images (base64 format from admin panel)
                const modelImage = model.image_url;
                return (
                  <TouchableOpacity
                    key={model.id}
                    style={[
                      styles.imageFilterCardLarge,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      selectedCarModel === model.id && { borderColor: colors.secondary, borderWidth: 2 },
                    ]}
                    onPress={() => setSelectedCarModel(selectedCarModel === model.id ? null : model.id)}
                  >
                    <View style={[styles.imageFilterImageContainerLarge, { backgroundColor: colors.background }]}>
                      {modelImage ? (
                        <Image
                          source={{ uri: modelImage }}
                          style={styles.carModelImage}
                          contentFit="cover"
                          transition={200}
                        />
                      ) : (
                        <Ionicons name="car" size={50} color={colors.textSecondary} />
                      )}
                    </View>
                    <Text style={[
                      styles.imageFilterLabel,
                      { color: selectedCarModel === model.id ? colors.secondary : colors.text },
                    ]} numberOfLines={1}>
                      {getName(model)}{model.year_start && model.year_end ? ` ${model.year_start}-${model.year_end}` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            {filteredCarModels.length === 0 && (
              <Text style={[styles.noModelsText, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'اختر ماركة لعرض الموديلات' : 'Select a brand to show models'}
              </Text>
            )}
          </View>

          {/* Product Brands */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              {t('filterByProductBrand')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {productBrands.map((brand) => {
                // Product brands use 'logo' field for images (base64 format from admin panel)
                const brandLogo = brand.logo;
                return (
                  <TouchableOpacity
                    key={brand.id}
                    style={[
                      styles.imageFilterCard,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      selectedProductBrand === brand.id && { borderColor: colors.primary, borderWidth: 2 },
                    ]}
                    onPress={() => setSelectedProductBrand(selectedProductBrand === brand.id ? null : brand.id)}
                  >
                    <View style={[styles.imageFilterImageContainer, { backgroundColor: colors.background }]}>
                      {brandLogo ? (
                        <Image
                          source={{ uri: brandLogo }}
                          style={styles.productBrandImage}
                          contentFit="contain"
                          transition={200}
                        />
                      ) : (
                        <Ionicons name="pricetag" size={40} color={colors.textSecondary} />
                      )}
                    </View>
                    <Text style={[
                      styles.imageFilterLabel,
                      { color: selectedProductBrand === brand.id ? colors.primary : colors.text },
                    ]} numberOfLines={1}>
                      {brand.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Categories */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              {t('filterByCategory')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categories.map((cat) => {
                // Categories use 'image_data' field for images (base64 format from admin panel)
                const categoryImage = cat.image_data;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.imageFilterCardSmall,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      selectedCategory === cat.id && { borderColor: colors.primary, borderWidth: 2 },
                    ]}
                    onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                  >
                    <View style={[styles.imageFilterImageContainerSmall, { backgroundColor: colors.background }]}>
                      {categoryImage ? (
                        <Image
                          source={{ uri: categoryImage }}
                          style={styles.categoryImage}
                          contentFit="contain"
                          transition={200}
                        />
                      ) : (
                        <Ionicons name="grid" size={30} color={colors.textSecondary} />
                      )}
                    </View>
                    <Text style={[
                      styles.imageFilterLabelSmall,
                      { color: selectedCategory === cat.id ? colors.primary : colors.text },
                    ]} numberOfLines={1}>
                      {getName(cat)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Price Range */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              {t('priceRange')}
            </Text>
            <View style={styles.priceInputs}>
              <TextInput
                style={[
                  styles.priceInput,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="Min"
                placeholderTextColor={colors.textSecondary}
                value={minPrice}
                onChangeText={setMinPrice}
                keyboardType="numeric"
              />
              <Text style={[styles.priceSeparator, { color: colors.textSecondary }]}>-</Text>
              <TextInput
                style={[
                  styles.priceInput,
                  { backgroundColor: colors.card, borderColor: colors.border, color: colors.text },
                ]}
                placeholder="Max"
                placeholderTextColor={colors.textSecondary}
                value={maxPrice}
                onChangeText={setMaxPrice}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <TouchableOpacity
              style={[styles.clearButton, { borderColor: colors.error }]}
              onPress={clearFilters}
            >
              <Ionicons name="close-circle-outline" size={18} color={colors.error} />
              <Text style={[styles.clearButtonText, { color: colors.error }]}>
                {t('clearFilters')}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <DriftLoader size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={[
          styles.flashListContainer, 
          // On web, explicitly set width to ensure FlashList calculates columns correctly
          Platform.OS === 'web' && { width: screenWidth }
        ]}>
          <FlashList
            data={products}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            key={`${numColumns}-${screenWidth}`} // Force re-render when columns or width change
            estimatedItemSize={250}
            contentContainerStyle={styles.listContent}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            refreshing={isRefreshing}
            onRefresh={refresh}
            ListHeaderComponent={
              <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
                {t('searchResults')}: {products.length} {total > products.length ? `/ ${total}` : ''}
              </Text>
            }
            ListFooterComponent={renderFooter}
            renderItem={({ item }) => (
              <View style={[styles.cardWrapper, { width: cardWidth + 15 }]}>
                <ProductCard
                  product={item}
                  cardWidth={cardWidth}
                  onAddToCart={() => handleAddToCart(item)}
                />
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search-outline" size={60} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {t('noProducts')}
                </Text>
              </View>
            }
          />
        </View>
      )}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  filterButton: {
    padding: 8,
  },
  filtersPanel: {
    padding: 16,
    borderBottomWidth: 1,
    maxHeight: 337,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  priceInputs: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceInput: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  priceSeparator: {
    marginHorizontal: 12,
    fontSize: 16,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flashListContainer: {
    flex: 1,
    // Ensure full width on web for proper FlashList grid calculation
    ...(Platform.OS === 'web' ? { width: '100%' } : {}),
  },
  listContent: {
    paddingHorizontal: 5, // Half of HORIZONTAL_PADDING (10/2 = 5px each side)
    paddingVertical: 12,
  },
  cardWrapper: {
    // Uniform 15px gap for both platforms (7.5px margin each side)
    marginHorizontal: 7.5,
    alignItems: 'center',
    marginBottom: 12,
  },
  row: {
    justifyContent: 'flex-start',
  },
  noModelsText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
  },
  resultsCount: {
    fontSize: 14,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
  footerLoader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  footerText: {
    fontSize: 14,
  },
  // Image Filter Card Styles - Premium design with image-first layout
  imageFilterCard: {
    width: 110,
    marginRight: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    padding: 10,
    alignItems: 'center',
  },
  imageFilterCardLarge: {
    width: 140,
    marginRight: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    padding: 10,
    alignItems: 'center',
  },
  imageFilterCardSmall: {
    width: 95,
    marginRight: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
    padding: 8,
    alignItems: 'center',
  },
  imageFilterLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  imageFilterLabelSmall: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
  },
  imageFilterImageContainer: {
    width: 90,
    height: 90,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageFilterImageContainerLarge: {
    width: 120,
    height: 90,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  imageFilterImageContainerSmall: {
    width: 80,
    height: 80,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  carBrandImage: {
    width: '100%',
    height: '100%',
  },
  carModelImage: {
    width: '100%',
    height: '100%',
  },
  productBrandImage: {
    width: '100%',
    height: '100%',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
});
