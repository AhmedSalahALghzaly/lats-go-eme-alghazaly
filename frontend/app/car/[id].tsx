import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../../src/components/Header';
import { Footer } from '../../src/components/Footer';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAppStore } from '../../src/store/appStore';
import { carModelsApi, cartApi } from '../../src/services/api';

export default function CarModelDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t, isRTL, language } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, addToLocalCart } = useAppStore();
  const subscriptionStatus = useAppStore((state) => state.subscriptionStatus);

  // Check if user should see subscribe button (not a subscriber and no pending request)
  const showSubscribeButton = subscriptionStatus === 'none';

  const [carModel, setCarModel] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCarModel();
  }, [id]);

  const fetchCarModel = async () => {
    try {
      const response = await carModelsApi.getById(id as string);
      setCarModel(response.data);
    } catch (error) {
      console.error('Error fetching car model:', error);
    } finally {
      setLoading(false);
    }
  };

  const getName = (item: any, field: string = 'name') => {
    if (!item) return '';
    const arField = `${field}_ar`;
    return language === 'ar' && item?.[arField] ? item[arField] : item?.[field] || '';
  };

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

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title="" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <Footer />
      </View>
    );
  }

  if (!carModel) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title={t('error')} showBack={true} />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            {t('error')}
          </Text>
        </View>
        <Footer />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Header title={getName(carModel)} showBack={true} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Car Image */}
        <View style={[styles.imageContainer, { backgroundColor: colors.surface }]}>
          {carModel.image_url ? (
            <Image
              source={{ uri: carModel.image_url }}
              style={styles.carImage}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name="car-sport" size={100} color={colors.textSecondary} />
          )}
        </View>

        {/* Distributor Contact Button - Only visible if distributor is linked */}
        {carModel.distributor && (
          <TouchableOpacity
            style={[styles.distributorButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(`/owner/distributors?viewMode=profile&id=${carModel.distributor.id}`)}
            activeOpacity={0.85}
          >
            <View style={styles.distributorContent}>
              <View style={[styles.distributorImageContainer, { backgroundColor: colors.surface }]}>
                {carModel.distributor.profile_image ? (
                  <Image
                    source={{ uri: carModel.distributor.profile_image }}
                    style={styles.distributorProfileImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Ionicons name="person-circle" size={44} color={colors.primary} />
                )}
              </View>
              <View style={styles.distributorTextContainer}>
                <Text style={[styles.distributorLabel, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'موزع هذه السيارة' : 'Car Distributor'}
                </Text>
                <Text style={[styles.distributorName, { color: colors.text }]}>
                  {language === 'ar' && carModel.distributor.name_ar 
                    ? carModel.distributor.name_ar 
                    : carModel.distributor.name}
                </Text>
              </View>
              <View style={[styles.distributorArrowContainer, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
              </View>
            </View>
            {/* Subscribe CTA Banner - Only for non-subscribers */}
            {showSubscribeButton && (
              <View style={styles.subscribeBannerContainer}>
                <LinearGradient
                  colors={['#1a1a2e', '#2d2d44']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.subscribeBanner}
                >
                  <View style={styles.subscribeBannerGoldBorder} />
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <Text style={styles.subscribeBannerText}>
                    {language === 'ar' 
                      ? 'اشترك للتواصل وظهور البيانات والكتالوج' 
                      : 'Subscribe to contact & view data & catalog'}
                  </Text>
                  <Ionicons name="star" size={16} color="#FFD700" />
                  <View style={styles.subscribeBannerGoldBorderRight} />
                </LinearGradient>
              </View>
            )}
          </TouchableOpacity>
        )}

        {/* Premium Subscribe Button - Only visible for non-subscribers */}
        {showSubscribeButton && (
          <TouchableOpacity
            style={styles.subscribeButtonContainer}
            onPress={() => router.push('/subscription-request')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#FFD700', '#FFA500', '#FF8C00']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.subscribeGradient}
            >
              <View style={styles.subscribeContent}>
                <View style={styles.subscribeIconContainer}>
                  <Ionicons name="star" size={28} color="#FFF" />
                </View>
                <View style={styles.subscribeTextContainer}>
                  <Text style={styles.subscribeTitle}>
                    {language === 'ar' ? 'اشترك الآن' : 'Subscribe Now'}
                  </Text>
                  <Text style={styles.subscribeSubtitle}>
                    {language === 'ar' ? 'احصل على مزايا حصرية' : 'Get exclusive benefits'}
                  </Text>
                </View>
                <View style={styles.subscribeArrowContainer}>
                  <Ionicons name="chevron-forward" size={20} color="#FFF" />
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Car Info */}
        <View style={styles.infoContainer}>
          {/* Brand Badge - Clickable */}
          {carModel.brand && (
            <TouchableOpacity 
              style={[styles.brandBadge, { backgroundColor: colors.primary + '15' }]}
              onPress={() => router.push(`/brand/${carModel.brand.id}`)}
            >
              <Ionicons name="car-sport" size={16} color={colors.primary} />
              <Text style={[styles.brandText, { color: colors.primary }]}>
                {getName(carModel.brand)}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}

          {/* Name & Year */}
          <Text style={[styles.carName, { color: colors.text }]}>
            {getName(carModel)}
          </Text>
          <Text style={[styles.yearRange, { color: colors.textSecondary }]}>
            {carModel.year_start} - {carModel.year_end}
          </Text>

          {/* Chassis Number Display */}
          {carModel.chassis_number && (
            <View style={[styles.chassisSection, { backgroundColor: colors.secondary + '10', borderColor: colors.secondary + '30' }]}>
              <View style={styles.chassisHeader}>
                <Ionicons name="key-outline" size={18} color={colors.secondary} />
                <Text style={[styles.chassisLabel, { color: colors.secondary }]}>
                  {language === 'ar' ? 'رقم الشاسيه' : 'Chassis Number'}
                </Text>
              </View>
              <Text style={[styles.chassisNumber, { color: colors.text }]}>
                {carModel.chassis_number}
              </Text>
            </View>
          )}

          {/* Description */}
          {(carModel.description || carModel.description_ar) && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('description')}
              </Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {getName(carModel, 'description')}
              </Text>
            </View>
          )}

          {/* Variants */}
          {carModel.variants && carModel.variants.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {language === 'ar' ? 'الفئات والمحركات' : 'Variants & Engines'}
              </Text>
              {carModel.variants.map((variant: any, index: number) => (
                <View 
                  key={index} 
                  style={[styles.variantCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <Text style={[styles.variantName, { color: colors.text }]}>
                    {getName(variant)}
                  </Text>
                  <View style={styles.variantDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="speedometer-outline" size={16} color={colors.primary} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                        {getName(variant, 'engine')}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="cog-outline" size={16} color={colors.primary} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                        {getName(variant, 'transmission')}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="water-outline" size={16} color={colors.primary} />
                      <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                        {getName(variant, 'fuel_type')}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Compatible Products */}
          {carModel.compatible_products && carModel.compatible_products.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {language === 'ar' ? 'المنتجات المتوافقة' : 'Compatible Products'}
                </Text>
                <View style={[styles.countBadge, { backgroundColor: colors.success + '20' }]}>
                  <Text style={[styles.countText, { color: colors.success }]}>
                    {carModel.compatible_products_count}
                  </Text>
                </View>
              </View>
              
              {carModel.compatible_products.map((product: any) => (
                <TouchableOpacity
                  key={product.id}
                  style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => router.push(`/product/${product.id}`)}
                >
                  <View style={[styles.productImageContainer, { backgroundColor: colors.surface }]}>
                    {product.image_url ? (
                      <Image
                        source={{ uri: product.image_url }}
                        style={styles.productImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="cube-outline" size={30} color={colors.textSecondary} />
                    )}
                  </View>
                  <View style={styles.productInfo}>
                    <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
                      {getName(product)}
                    </Text>
                    {product.category && (
                      <Text style={[styles.productCategory, { color: colors.textSecondary }]}>
                        {getName(product.category)}
                      </Text>
                    )}
                    <View style={styles.productFooter}>
                      <Text style={[styles.productPrice, { color: colors.primary }]}>
                        {product.price?.toFixed(2)} ج.م
                      </Text>
                      <View style={[styles.compatibleBadge, { backgroundColor: colors.success + '15' }]}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={[styles.compatibleText, { color: colors.success }]}>
                          {language === 'ar' ? 'متوافق' : 'Compatible'}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.addToCartBtn, { backgroundColor: colors.primary }]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleAddToCart(product);
                    }}
                  >
                    <Ionicons name="cart-outline" size={18} color="#FFF" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* No Compatible Products */}
          {(!carModel.compatible_products || carModel.compatible_products.length === 0) && (
            <View style={styles.emptyProducts}>
              <Ionicons name="cube-outline" size={48} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'لا توجد منتجات متوافقة حالياً' : 'No compatible products yet'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
      
      {/* Footer */}
      <Footer />
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  imageContainer: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carImage: {
    width: '100%',
    height: '100%',
  },
  infoContainer: {
    padding: 20,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
    gap: 6,
  },
  brandText: {
    fontSize: 13,
    fontWeight: '600',
  },
  carName: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 4,
  },
  yearRange: {
    fontSize: 16,
    marginBottom: 16,
  },
  chassisSection: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  chassisHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  chassisLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  chassisNumber: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
  },
  variantCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  variantName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  variantDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    flex: 1,
  },
  productCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  productImageContainer: {
    width: 70,
    height: 70,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  productCategory: {
    fontSize: 12,
    marginBottom: 6,
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
  },
  compatibleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  compatibleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  addToCartBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  emptyProducts: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  // Distributor Button Styles
  distributorButton: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  distributorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  distributorImageContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  distributorProfileImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  distributorTextContainer: {
    flex: 1,
  },
  distributorLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  distributorName: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  distributorArrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Subscribe Button Styles
  subscribeButtonContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  subscribeGradient: {
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  subscribeContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subscribeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  subscribeTextContainer: {
    flex: 1,
  },
  subscribeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  subscribeSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  subscribeArrowContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
