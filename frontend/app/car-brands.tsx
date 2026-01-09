import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/hooks/useTheme';
import { useTranslation } from '../src/hooks/useTranslation';
import { Header } from '../src/components/Header';
import { carBrandsApi, carModelsApi } from '../src/services/api';

export default function CarBrandsPage() {
  const { colors } = useTheme();
  const { language, isRTL } = useTranslation();
  const router = useRouter();

  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [filteredBrands, setFilteredBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchBrands();
  }, []);

  useEffect(() => {
    filterBrands();
  }, [searchQuery, brands]);

  const fetchBrands = async () => {
    try {
      const [brandsRes, modelsRes] = await Promise.all([
        carBrandsApi.getAll(),
        carModelsApi.getAll(),
      ]);
      setBrands(brandsRes.data || []);
      setModels(modelsRes.data || []);
    } catch (error) {
      console.error('Error fetching car brands:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterBrands = () => {
    if (!searchQuery.trim()) {
      setFilteredBrands(brands);
      return;
    }
    const query = searchQuery.toLowerCase();
    const filtered = brands.filter(brand => 
      brand.name?.toLowerCase().includes(query) ||
      brand.name_ar?.includes(query)
    );
    setFilteredBrands(filtered);
  };

  const getModelsCount = (brandId: string) => {
    return models.filter(m => m.brand_id === brandId).length;
  };

  const getName = (item: any) => {
    return language === 'ar' && item.name_ar ? item.name_ar : item.name;
  };

  const navigateToBrand = (brandId: string) => {
    router.push(`/brand/${brandId}`);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Header 
        title={language === 'ar' ? 'ماركات السيارات' : 'Car Brands'} 
        showBack 
        showSearch={false}
        showCart
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {/* Page Header */}
        <View style={[styles.pageHeader, { backgroundColor: colors.primary }]}>
          <View style={styles.headerIcon}>
            <Ionicons name="car-sport" size={32} color="#FFF" />
          </View>
          <Text style={styles.pageTitle}>
            {language === 'ar' ? 'ماركات السيارات' : 'Car Brands'}
          </Text>
          <Text style={styles.pageSubtitle}>
            {language === 'ar' 
              ? 'تصفح جميع ماركات السيارات المتوفرة'
              : 'Browse all available car brands'}
          </Text>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.searchInputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={language === 'ar' ? 'ابحث عن ماركة...' : 'Search brands...'}
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
        </View>

        {/* Results Count */}
        <View style={styles.resultsInfo}>
          <Text style={[styles.resultsText, { color: colors.textSecondary }]}>
            {language === 'ar' 
              ? `عرض ${filteredBrands.length} ماركة`
              : `Showing ${filteredBrands.length} brands`}
          </Text>
        </View>

        {/* Brands Grid */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : filteredBrands.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={60} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'لم يتم العثور على ماركات' : 'No brands found'}
            </Text>
          </View>
        ) : (
          <View style={styles.brandsGrid}>
            {filteredBrands.map((brand) => {
              const modelsCount = getModelsCount(brand.id);
              return (
                <TouchableOpacity
                  key={brand.id}
                  style={[styles.brandCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => navigateToBrand(brand.id)}
                  activeOpacity={0.7}
                >
                  {/* Brand Logo */}
                  <View style={[styles.brandLogoContainer, { backgroundColor: colors.primary + '15' }]}>
                    {(brand.image || brand.logo) ? (
                      <Image 
                        source={{ uri: brand.image || brand.logo }} 
                        style={styles.brandLogo} 
                        contentFit="contain"
                        cachePolicy="disk"
                        transition={200}
                      />
                    ) : (
                      <Ionicons name="car-sport" size={40} color={colors.primary} />
                    )}
                  </View>

                  {/* Brand Info */}
                  <View style={styles.brandInfo}>
                    <Text style={[styles.brandName, { color: colors.text }]} numberOfLines={2}>
                      {getName(brand)}
                    </Text>
                    {modelsCount > 0 && (
                      <View style={styles.modelsRow}>
                        <Ionicons name="car" size={12} color={colors.textSecondary} />
                        <Text style={[styles.modelsText, { color: colors.textSecondary }]}>
                          {modelsCount} {language === 'ar' ? 'موديل' : 'models'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Arrow Icon */}
                  <View style={[styles.arrowContainer, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.primary} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  contentContainer: { paddingBottom: 32 },
  pageHeader: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  pageSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  searchCard: {
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  resultsInfo: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  resultsText: {
    fontSize: 13,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
  brandsGrid: {
    paddingHorizontal: 16,
  },
  brandCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  brandLogoContainer: {
    width: 70,
    height: 70,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  brandLogo: {
    width: 60,
    height: 60,
  },
  brandInfo: {
    flex: 1,
    marginLeft: 16,
  },
  brandName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  modelsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  modelsText: {
    fontSize: 12,
  },
  arrowContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
