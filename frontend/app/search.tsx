import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCard } from '../src/components/ProductCard';
import { useTheme } from '../src/hooks/useTheme';
import { useTranslation } from '../src/hooks/useTranslation';
import { useAppStore } from '../src/store/appStore';
import { useInfiniteProducts } from '../src/hooks/useInfiniteProducts';
import { carBrandsApi, carModelsApi, productBrandsApi, categoriesApi, cartApi } from '../src/services/api';

// Constants for responsive grid layout
const HORIZONTAL_PADDING = 24; // Total horizontal padding (12 left + 12 right)
const CARD_MARGIN = 6; // Margin on each side of the card
const MAX_CARD_WIDTH = 193; // Maximum card width (5% increase from 184: 184 * 1.05 = 193)
const MIN_CARD_WIDTH = 158; // Minimum card width for readability (5% increase from 150)

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
  const { cardWidth, numColumns } = useMemo(() => {
    const availableWidth = screenWidth - HORIZONTAL_PADDING;
    // Calculate how many cards can fit with max width
    let cols = Math.floor(availableWidth / (MAX_CARD_WIDTH + CARD_MARGIN * 2));
    cols = Math.max(cols, 2); // Minimum 2 columns
    
    // Calculate actual card width to fill available space evenly
    const totalMargin = cols * CARD_MARGIN * 2;
    let width = Math.floor((availableWidth - totalMargin) / cols);
    
    // Ensure width is within bounds
    width = Math.min(width, MAX_CARD_WIDTH);
    width = Math.max(width, MIN_CARD_WIDTH);
    
    return { cardWidth: width, numColumns: cols };
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
  const filters = useMemo(() => ({
    car_brand_id: selectedCarBrand && !selectedCarModel ? selectedCarBrand : undefined,
    car_model_id: selectedCarModel || undefined,
    product_brand_id: selectedProductBrand || undefined,
    category_id: selectedCategory || undefined,
    min_price: minPrice ? parseFloat(minPrice) : undefined,
    max_price: maxPrice ? parseFloat(maxPrice) : undefined,
  }), [selectedCarBrand, selectedCarModel, selectedProductBrand, selectedCategory, minPrice, maxPrice]);

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

  // Filter car models when brand changes
  useEffect(() => {
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
  }, [selectedCarBrand, carModels]);

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
              {carBrands.map((brand) => (
                <TouchableOpacity
                  key={brand.id}
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border },
                    selectedCarBrand === brand.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setSelectedCarBrand(selectedCarBrand === brand.id ? null : brand.id)}
                >
                  <Ionicons 
                    name="car-sport" 
                    size={14} 
                    color={selectedCarBrand === brand.id ? '#FFF' : colors.primary} 
                  />
                  <Text style={[
                    styles.filterChipText,
                    { color: selectedCarBrand === brand.id ? '#FFF' : colors.text },
                  ]}>
                    {getName(brand)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Car Models */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              {language === 'ar' ? 'فلتر حسب موديل السيارة' : 'Filter by Car Model'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {filteredCarModels.map((model) => (
                <TouchableOpacity
                  key={model.id}
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border },
                    selectedCarModel === model.id && { backgroundColor: colors.secondary, borderColor: colors.secondary },
                  ]}
                  onPress={() => setSelectedCarModel(selectedCarModel === model.id ? null : model.id)}
                >
                  <Ionicons 
                    name="car" 
                    size={14} 
                    color={selectedCarModel === model.id ? '#FFF' : colors.secondary} 
                  />
                  <Text style={[
                    styles.filterChipText,
                    { color: selectedCarModel === model.id ? '#FFF' : colors.text },
                  ]}>
                    {getName(model)}
                    {model.year_start && model.year_end && ` (${model.year_start}-${model.year_end})`}
                  </Text>
                </TouchableOpacity>
              ))}
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
              {productBrands.map((brand) => (
                <TouchableOpacity
                  key={brand.id}
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border },
                    selectedProductBrand === brand.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setSelectedProductBrand(selectedProductBrand === brand.id ? null : brand.id)}
                >
                  <Ionicons 
                    name="pricetag" 
                    size={14} 
                    color={selectedProductBrand === brand.id ? '#FFF' : colors.primary} 
                  />
                  <Text style={[
                    styles.filterChipText,
                    { color: selectedProductBrand === brand.id ? '#FFF' : colors.text },
                  ]}>
                    {brand.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Categories */}
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.text }]}>
              {t('filterByCategory')}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.filterChip,
                    { borderColor: colors.border },
                    selectedCategory === cat.id && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                >
                  <Text style={[
                    styles.filterChipText,
                    { color: selectedCategory === cat.id ? '#FFF' : colors.text },
                  ]}>
                    {getName(cat)}
                  </Text>
                </TouchableOpacity>
              ))}
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
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.flashListContainer}>
          <FlashList
            data={products}
            keyExtractor={(item) => item.id}
            numColumns={numColumns}
            key={numColumns} // Force re-render when columns change
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
              <View style={[styles.cardWrapper, { width: cardWidth + CARD_MARGIN * 2 }]}>
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
    maxHeight: 300,
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
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cardWrapper: {
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
});
