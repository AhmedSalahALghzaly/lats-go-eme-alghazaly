import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Dimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProductCard } from '../src/components/ProductCard';
import { useTheme } from '../src/hooks/useTheme';
import { useTranslation } from '../src/hooks/useTranslation';
import { useAppStore } from '../src/store/appStore';
import { productsApi, carBrandsApi, carModelsApi, productBrandsApi, categoriesApi, cartApi } from '../src/services/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HORIZONTAL_PADDING = 24; // Total horizontal padding (12 left + 12 right)
const GAP_BETWEEN_CARDS = 12; // Gap between cards
const NUM_COLUMNS = 2;

// Calculate card width: max 15% increase from original 160 = max 184
// Formula: (screenWidth - padding - gap) / 2
const calculateCardWidth = () => {
  const availableWidth = SCREEN_WIDTH - HORIZONTAL_PADDING - GAP_BETWEEN_CARDS;
  const calculatedWidth = Math.floor(availableWidth / NUM_COLUMNS);
  const maxAllowedWidth = 184; // 160 * 1.15 = 184 (15% max increase)
  return Math.min(calculatedWidth, maxAllowedWidth);
};

export default function SearchScreen() {
  const params = useLocalSearchParams();
  const { colors } = useTheme();
  const { t, isRTL, language } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, addToLocalCart } = useAppStore();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [carBrands, setCarBrands] = useState<any[]>([]);
  const [carModels, setCarModels] = useState<any[]>([]);
  const [filteredCarModels, setFilteredCarModels] = useState<any[]>([]);
  const [productBrands, setProductBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Calculate card width dynamically (max 15% increase from 160 = max 184)
  const cardWidth = useMemo(() => calculateCardWidth(), []);

  // Filters
  const [selectedCarBrand, setSelectedCarBrand] = useState<string | null>(params.car_brand_id as string || null);
  const [selectedCarModel, setSelectedCarModel] = useState<string | null>(params.car_model_id as string || null);
  const [selectedProductBrand, setSelectedProductBrand] = useState<string | null>(params.product_brand_id as string || null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(params.category_id as string || null);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [showFilters, setShowFilters] = useState(false);

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

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (selectedCarBrand && !selectedCarModel) params.car_brand_id = selectedCarBrand;
      if (selectedCarModel) params.car_model_id = selectedCarModel;
      if (selectedProductBrand) params.product_brand_id = selectedProductBrand;
      if (selectedCategory) params.category_id = selectedCategory;
      if (minPrice) params.min_price = parseFloat(minPrice);
      if (maxPrice) params.max_price = parseFloat(maxPrice);

      const response = await productsApi.getAll(params);
      setProducts(response.data.products || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCarBrand, selectedCarModel, selectedProductBrand, selectedCategory, minPrice, maxPrice]);

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
        <FlatList
          data={products}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.row}
          ListHeaderComponent={
            <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
              {t('searchResults')}: {products.length}
            </Text>
          }
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onAddToCart={() => handleAddToCart(item)}
            />
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
  listContent: {
    padding: 12,
  },
  row: {
    justifyContent: 'flex-start',
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
});
