import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../src/hooks/useTheme';
import { useTranslation } from '../src/hooks/useTranslation';
import { carBrandsApi, carModelsApi } from '../src/services/api';

export default function AllModelsScreen() {
  const { colors } = useTheme();
  const { t, isRTL, language } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [filteredModels, setFilteredModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [brandsRes, modelsRes] = await Promise.all([
        carBrandsApi.getAll(),
        carModelsApi.getAll(),
      ]);
      setBrands(brandsRes.data || []);
      setModels(modelsRes.data || []);
      setFilteredModels(modelsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterModels();
  }, [searchQuery, selectedBrand, models]);

  const filterModels = () => {
    let filtered = [...models];
    
    // Filter by brand
    if (selectedBrand) {
      filtered = filtered.filter((m) => m.brand_id === selectedBrand);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((m) => 
        m.name?.toLowerCase().includes(query) ||
        m.name_ar?.includes(query)
      );
    }
    
    setFilteredModels(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getName = (item: any, field: string = 'name') => {
    if (!item) return '';
    const arField = `${field}_ar`;
    return language === 'ar' && item?.[arField] ? item[arField] : item?.[field] || '';
  };

  const getBrandName = (brandId: string) => {
    const brand = brands.find((b) => b.id === brandId);
    return getName(brand);
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

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
          {language === 'ar' ? 'جميع موديلات السيارات' : 'All Car Models'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      {/* Search Bar */}
      <View style={[styles.searchSection, { backgroundColor: colors.surface }]}>
        <View style={[styles.searchContainer, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
            placeholder={language === 'ar' ? 'ابحث عن موديل...' : 'Search models...'}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Brand Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.brandsFilter}
        >
          <TouchableOpacity
            style={[
              styles.brandChip,
              { borderColor: colors.border },
              !selectedBrand && { backgroundColor: colors.primary, borderColor: colors.primary },
            ]}
            onPress={() => setSelectedBrand(null)}
          >
            <Text style={[
              styles.brandChipText,
              { color: !selectedBrand ? '#FFF' : colors.text },
            ]}>
              {language === 'ar' ? 'الكل' : 'All'}
            </Text>
          </TouchableOpacity>
          {brands.map((brand) => (
            <TouchableOpacity
              key={brand.id}
              style={[
                styles.brandChip,
                { borderColor: colors.border },
                selectedBrand === brand.id && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setSelectedBrand(selectedBrand === brand.id ? null : brand.id)}
            >
              <Ionicons 
                name="car-sport" 
                size={14} 
                color={selectedBrand === brand.id ? '#FFF' : colors.primary} 
              />
              <Text style={[
                styles.brandChipText,
                { color: selectedBrand === brand.id ? '#FFF' : colors.text },
              ]}>
                {getName(brand)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Results Count */}
      <View style={styles.resultsHeader}>
        <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>
          {filteredModels.length} {language === 'ar' ? 'موديل' : 'models'}
        </Text>
      </View>

      {/* Models List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredModels.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="car-outline" size={60} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'لا توجد موديلات' : 'No models found'}
            </Text>
          </View>
        ) : (
          filteredModels.map((model) => (
            <TouchableOpacity
              key={model.id}
              style={[styles.modelCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(`/car/${model.id}`)}
            >
              <View style={[styles.modelImageContainer, { backgroundColor: colors.surface }]}>
                {model.image_url ? (
                  <Image
                    source={{ uri: model.image_url }}
                    style={styles.modelImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="car-sport" size={40} color={colors.textSecondary} />
                )}
              </View>
              <View style={styles.modelInfo}>
                <View style={[styles.brandTag, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.brandTagText, { color: colors.primary }]}>
                    {getBrandName(model.brand_id)}
                  </Text>
                </View>
                <Text style={[styles.modelName, { color: colors.text }]}>
                  {getName(model)}
                </Text>
                {model.year_start && model.year_end && (
                  <Text style={[styles.modelYear, { color: colors.textSecondary }]}>
                    {model.year_start} - {model.year_end}
                  </Text>
                )}
                {/* Chassis Number Display */}
                {model.chassis_number && (
                  <View style={[styles.chassisInfo, { backgroundColor: colors.secondary + '15' }]}>
                    <Ionicons name="key-outline" size={12} color={colors.secondary} />
                    <Text style={[styles.chassisText, { color: colors.secondary }]}>
                      {model.chassis_number}
                    </Text>
                  </View>
                )}
                {model.variants && model.variants.length > 0 && (
                  <View style={styles.variantsInfo}>
                    <Ionicons name="speedometer-outline" size={14} color={colors.secondary} />
                    <Text style={[styles.variantsText, { color: colors.secondary }]}>
                      {model.variants.length} {language === 'ar' ? 'فئات' : 'variants'}
                    </Text>
                  </View>
                )}
              </View>
              <Ionicons 
                name={isRTL ? 'chevron-back' : 'chevron-forward'} 
                size={22} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  searchSection: {
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  brandsFilter: {
    paddingVertical: 4,
    gap: 8,
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    gap: 6,
  },
  brandChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultsCount: {
    fontSize: 13,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  modelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  modelImageContainer: {
    width: 80,
    height: 60,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  modelImage: {
    width: '100%',
    height: '100%',
  },
  modelInfo: {
    flex: 1,
    marginLeft: 14,
  },
  brandTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 4,
  },
  brandTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  modelName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  modelYear: {
    fontSize: 12,
    marginBottom: 4,
  },
  variantsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  variantsText: {
    fontSize: 11,
    fontWeight: '500',
  },
  chassisInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  chassisText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
