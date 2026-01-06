import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAppStore } from '../../src/store/appStore';
import { cartApi, productsApi } from '../../src/services/api';
import { offers } from '../../src/data/staticOffers';
import { DynamicOfferSlider } from '../../src/components/DynamicOfferSlider';
import { Header } from '../../src/components/Header';

const { width } = Dimensions.get('window');

// Placeholder product images
const PRODUCT_IMAGES = [
  'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
  'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400',
  'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=400',
  'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=400',
];

export default function OfferDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { t, language, isRTL } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user, addToLocalCart } = useAppStore();

  // Find offer from imported offers
  const offerIndex = offers.findIndex(o => o.id === id);
  const [currentOfferIndex, setCurrentOfferIndex] = useState(offerIndex >= 0 ? offerIndex : 0);
  const offer = offers[currentOfferIndex];
  
  // Product data from API
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const cartIconAnim = useRef(new Animated.Value(1)).current;
  const rgbAnim = useRef(new Animated.Value(0)).current;
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());

  // Fetch specific products for this offer
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        // Get the specific product IDs for this offer
        const offerProductIds = offer.products || [];
        
        // Fetch each product by ID
        const productPromises = offerProductIds.map(async (productId: string) => {
          try {
            const res = await productsApi.getById(productId);
            return res.data;
          } catch (error) {
            console.error(`Error fetching product ${productId}:`, error);
            return null;
          }
        });
        
        const fetchedProducts = await Promise.all(productPromises);
        // Filter out any null results from failed fetches
        const validProducts = fetchedProducts.filter(p => p !== null);
        setProducts(validProducts);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [currentOfferIndex, offer.products]);

  useEffect(() => {
    // Entry animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // RGB color animation for total price
    Animated.loop(
      Animated.timing(rgbAnim, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: false,
      })
    ).start();
  }, []);

  // Calculate discount based on total
  const calculateDiscount = (total: number) => {
    if (total > 1000) return 15;
    if (total > 500) return 13;
    if (total > 100) return 10;
    return 0;
  };

  // Calculate totals from actual products
  const originalTotal = products.reduce((sum, p) => sum + (p.price || 0), 0);
  const discount = calculateDiscount(originalTotal);
  const discountAmount = (originalTotal * discount) / 100;
  const finalTotal = originalTotal - discountAmount;

  const getName = (item: any) => {
    return language === 'ar' && item.name_ar ? item.name_ar : item.name;
  };

  const handleOfferChange = (index: number) => {
    setCurrentOfferIndex(index);
    // Reset animations
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    scaleAnim.setValue(0.95);
    setAddedProducts(new Set());
    
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();
  };

  const handleAddToCart = async (product: any) => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Animate cart icon
    Animated.sequence([
      Animated.timing(cartIconAnim, { toValue: 1.25, duration: 120, useNativeDriver: true }),
      Animated.timing(cartIconAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();

    setAddingToCart(true);
    try {
      await cartApi.addItem(product.id, 1);
      addToLocalCart({ product_id: product.id, quantity: 1, product });
      setAddedProducts(prev => new Set(prev).add(product.id));
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setAddingToCart(false);
    }
  };

  const handleAddAllToCart = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    setAddingToCart(true);
    try {
      for (const product of products) {
        await cartApi.addItem(product.id, 1);
        addToLocalCart({ product_id: product.id, quantity: 1, product });
      }
      setAddedProducts(new Set(products.map(p => p.id)));
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setAddingToCart(false);
    }
  };

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  // RGB color animation for total price - cycles through rainbow colors
  const rgbColor = rgbAnim.interpolate({
    inputRange: [0, 0.14, 0.28, 0.42, 0.57, 0.71, 0.85, 1],
    outputRange: [
      '#FF0000', // Red
      '#FF7F00', // Orange
      '#FFFF00', // Yellow
      '#00FF00', // Green
      '#00FFFF', // Cyan
      '#0000FF', // Blue
      '#8B00FF', // Violet
      '#FF0000', // Back to Red
    ],
  });

  // Get a placeholder image for each product
  const getProductImage = (index: number) => {
    return PRODUCT_IMAGES[index % PRODUCT_IMAGES.length];
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <Header showBack={true} title={language === 'ar' ? 'تفاصيل العرض' : 'Offer Details'} />

      {/* Offer Slider at Top */}
      <View style={styles.sliderContainer}>
        <DynamicOfferSlider 
          compact={true} 
          showArrows={true}
          hideIcon={true}
          onOfferChange={handleOfferChange}
          initialIndex={currentOfferIndex}
        />
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Car Model Badge - Modern Style */}
        <Animated.View style={[styles.carBadgeSection, { opacity: fadeAnim }]}>
          <TouchableOpacity
            style={[styles.carModelBadge, { backgroundColor: isDark ? '#2a2a3e' : '#FFF' }]}
            onPress={() => router.push(`/car/${offer.car_model_id}`)}
            activeOpacity={0.8}
          >
            <View style={[styles.carIconContainer, { backgroundColor: offer.accentColor + '20' }]}>
              <MaterialCommunityIcons name="car-sports" size={22} color={offer.accentColor} />
            </View>
            <View style={styles.carTextContainer}>
              <Text style={[styles.carLabel, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'متوافق مع' : 'Compatible with'}
              </Text>
              <Text style={[styles.carModelText, { color: colors.text }]}>
                {language === 'ar' ? offer.car_ar : offer.car}
              </Text>
            </View>
            <View style={[styles.carArrowContainer, { backgroundColor: offer.accentColor }]}>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color="#FFF" />
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Discount Banner - Premium Design */}
        <Animated.View 
          style={[
            styles.discountBanner,
            { transform: [{ scale: scaleAnim }] }
          ]}
        >
          <LinearGradient
            colors={[offer.accentColor, offer.iconBg]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.discountGradient}
          >
            {/* Decorative Elements */}
            <View style={styles.discountDecoLeft} />
            <View style={styles.discountDecoRight} />
            
            <View style={styles.discountContent}>
              <View style={styles.discountLeft}>
                <View style={styles.discountTitleRow}>
                  <Ionicons name="gift" size={20} color="#1a1a2e" />
                  <Text style={styles.discountTitle}>
                    {language === 'ar' ? 'عرض حصري' : 'Exclusive Offer'}
                  </Text>
                </View>
                <Text style={styles.discountSubtitle}>
                  {language === 'ar' 
                    ? `وفر حتى ${discount}% على مشترياتك`
                    : `Save up to ${discount}% on your purchase`
                  }
                </Text>
                <View style={styles.discountCondition}>
                  <Ionicons name="information-circle" size={14} color="rgba(26,26,46,0.7)" />
                  <Text style={styles.conditionText}>
                    {language === 'ar' 
                      ? `للطلبات أكثر من ${discount === 10 ? '100' : discount === 13 ? '500' : '1000'} ج.م`
                      : `Orders over ${discount === 10 ? '100' : discount === 13 ? '500' : '1000'} EGP`
                    }
                  </Text>
                </View>
              </View>
              
              <Animated.View style={[styles.discountCircle, { transform: [{ scale: pulseAnim }] }]}>
                <Text style={styles.discountPercentage}>{discount}%</Text>
                <Text style={styles.discountOff}>{language === 'ar' ? 'خصم' : 'OFF'}</Text>
              </Animated.View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Products Section - Modern Cards */}
        <View style={styles.productsSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <View style={[styles.sectionIcon, { backgroundColor: offer.accentColor + '20' }]}>
                <Ionicons name="cube" size={18} color={offer.accentColor} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {language === 'ar' ? 'منتجات العرض' : 'Offer Products'}
              </Text>
            </View>
            <View style={[styles.productCount, { backgroundColor: offer.accentColor + '15' }]}>
              <Text style={[styles.productCountText, { color: offer.accentColor }]}>
                {products.length} {language === 'ar' ? 'منتجات' : 'items'}
              </Text>
            </View>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={offer.accentColor} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'جاري التحميل...' : 'Loading...'}
              </Text>
            </View>
          ) : (
            products.map((product, index) => (
              <Animated.View
                key={product.id}
                style={[
                  styles.productCard,
                  { 
                    backgroundColor: isDark ? '#1e1e2e' : '#FFFFFF',
                    opacity: fadeAnim,
                    transform: [{ translateY: Animated.multiply(slideAnim, new Animated.Value(0.3 * (index + 1))) }],
                  }
                ]}
              >
                {/* Product Number Badge */}
                <View style={[styles.productNumberBadge, { backgroundColor: offer.accentColor }]}>
                  <Text style={styles.productNumber}>{index + 1}</Text>
                </View>

                {/* Product Image */}
                <TouchableOpacity 
                  style={styles.productImageContainer}
                  onPress={() => router.push(`/product/${product.id}`)}
                  activeOpacity={0.8}
                >
                  <Image 
                    source={{ uri: getProductImage(index) }}
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.3)']}
                    style={styles.imageGradient}
                  />
                  <View style={styles.viewProductBadge}>
                    <Ionicons name="eye" size={12} color="#FFF" />
                    <Text style={styles.viewProductText}>
                      {language === 'ar' ? 'عرض' : 'View'}
                    </Text>
                  </View>
                </TouchableOpacity>
                
                {/* Product Info */}
                <View style={styles.productInfo}>
                  <TouchableOpacity onPress={() => router.push(`/product/${product.id}`)}>
                    <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
                      {getName(product)}
                    </Text>
                  </TouchableOpacity>
                  
                  <View style={styles.productMeta}>
                    <View style={[styles.skuBadge, { backgroundColor: isDark ? '#2a2a3e' : '#f0f0f0' }]}>
                      <Ionicons name="barcode-outline" size={12} color={colors.textSecondary} />
                      <Text style={[styles.productSku, { color: colors.textSecondary }]}>
                        {product.sku || 'N/A'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.priceContainer}>
                    <Text style={[styles.productPrice, { color: offer.accentColor }]}>
                      {product.price?.toFixed(2)}
                    </Text>
                    <Text style={[styles.priceCurrency, { color: offer.accentColor }]}>
                      ج.م
                    </Text>
                  </View>
                </View>

                {/* Add to Cart Button */}
                <TouchableOpacity
                  style={[
                    styles.addButton,
                    { 
                      backgroundColor: addedProducts.has(product.id) ? '#4CAF50' : offer.accentColor,
                    }
                  ]}
                  onPress={() => handleAddToCart(product)}
                  disabled={addingToCart || addedProducts.has(product.id)}
                  activeOpacity={0.7}
                >
                  <Animated.View style={{ transform: [{ scale: cartIconAnim }] }}>
                    {addedProducts.has(product.id) ? (
                      <Ionicons name="checkmark" size={24} color="#FFF" />
                    ) : (
                      <Ionicons name="cart" size={22} color="#FFF" />
                    )}
                  </Animated.View>
                </TouchableOpacity>
              </Animated.View>
            ))
          )}
        </View>

        {/* Price Summary - Premium Card */}
        <Animated.View 
          style={[
            styles.summarySection,
            { 
              backgroundColor: isDark ? '#1e1e2e' : '#FFFFFF',
              transform: [{ scale: scaleAnim }],
            }
          ]}
        >
        </Animated.View>

        {/* Add All to Cart Button - Professional Design */}
        <TouchableOpacity
          style={styles.addAllButton}
          onPress={handleAddAllToCart}
          disabled={addingToCart || products.length === 0}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[offer.accentColor, offer.iconBg]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addAllGradient}
          >
            {addingToCart ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color="#FFF" size="small" />
              </View>
            ) : (
              <>
                {/* Price Info Section at Top */}
                <View style={styles.priceInfoSection}>
                  {/* Original Price Row */}
                  <View style={styles.priceInfoRow}>
                    <View style={styles.priceInfoLeft}>
                      <Ionicons name="pricetag-outline" size={14} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.priceInfoLabel}>
                        {language === 'ar' ? 'السعر الأصلي' : 'Original Price'}
                      </Text>
                    </View>
                    <Text style={styles.originalPriceValue}>
                      {originalTotal.toFixed(2)} ج.م
                    </Text>
                  </View>

                  {/* Discount Row */}
                  <View style={styles.priceInfoRow}>
                    <View style={styles.priceInfoLeft}>
                      <View style={styles.animatedIconContainer}>
                        {/* Layered icons for RGB animation effect */}
                        <Animated.View style={[styles.animatedIcon, { opacity: rgbAnim.interpolate({ inputRange: [0, 0.14, 0.28], outputRange: [1, 0, 0], extrapolate: 'clamp' }) }]}>
                          <Ionicons name="gift" size={14} color="#FF0000" />
                        </Animated.View>
                        <Animated.View style={[styles.animatedIcon, { opacity: rgbAnim.interpolate({ inputRange: [0.07, 0.21, 0.35], outputRange: [0, 1, 0], extrapolate: 'clamp' }) }]}>
                          <Ionicons name="gift" size={14} color="#FF7F00" />
                        </Animated.View>
                        <Animated.View style={[styles.animatedIcon, { opacity: rgbAnim.interpolate({ inputRange: [0.21, 0.35, 0.49], outputRange: [0, 1, 0], extrapolate: 'clamp' }) }]}>
                          <Ionicons name="gift" size={14} color="#FFFF00" />
                        </Animated.View>
                        <Animated.View style={[styles.animatedIcon, { opacity: rgbAnim.interpolate({ inputRange: [0.35, 0.49, 0.63], outputRange: [0, 1, 0], extrapolate: 'clamp' }) }]}>
                          <Ionicons name="gift" size={14} color="#00FF00" />
                        </Animated.View>
                        <Animated.View style={[styles.animatedIcon, { opacity: rgbAnim.interpolate({ inputRange: [0.49, 0.63, 0.77], outputRange: [0, 1, 0], extrapolate: 'clamp' }) }]}>
                          <Ionicons name="gift" size={14} color="#00FFFF" />
                        </Animated.View>
                        <Animated.View style={[styles.animatedIcon, { opacity: rgbAnim.interpolate({ inputRange: [0.63, 0.77, 0.91], outputRange: [0, 1, 0], extrapolate: 'clamp' }) }]}>
                          <Ionicons name="gift" size={14} color="#0000FF" />
                        </Animated.View>
                        <Animated.View style={[styles.animatedIcon, { opacity: rgbAnim.interpolate({ inputRange: [0.77, 0.91, 1], outputRange: [0, 1, 0], extrapolate: 'clamp' }) }]}>
                          <Ionicons name="gift" size={14} color="#8B00FF" />
                        </Animated.View>
                      </View>
                      <Animated.Text style={[styles.priceInfoLabel, { color: rgbColor }]}>
                        {language === 'ar' ? `خصم ${discount}%` : `${discount}% Discount`}
                      </Animated.Text>
                    </View>
                    <Animated.Text style={[styles.discountValue, { color: rgbColor }]}>
                      -{discountAmount.toFixed(2)} ج.م
                    </Animated.Text>
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.barDivider} />

                {/* Main Action Section */}
                <View style={styles.mainActionSection}>
                  {/* Animated Cart Icon Section */}
                  <Animated.View 
                    style={[
                      styles.addAllIconContainer,
                      { transform: [{ scale: pulseAnim }] }
                    ]}
                  >
                    <View style={styles.cartIconCircle}>
                      <Ionicons name="cart" size={24} color="#FFF" />
                    </View>
                    {/* Glow ring effect */}
                    <Animated.View 
                      style={[
                        styles.cartIconRing,
                        { 
                          borderColor: '#FFF',
                          opacity: glowOpacity,
                        }
                      ]} 
                    />
                  </Animated.View>

                  {/* Text Section */}
                  <View style={styles.addAllCenterContent}>
                    <Text style={styles.addAllText}>
                      {language === 'ar' ? 'إضافة الكل للسلة' : 'Add All to Cart'}
                    </Text>
                    <Text style={styles.addAllSubtext}>
                      {products.length} {language === 'ar' ? 'منتجات' : 'products'}
                    </Text>
                  </View>

                  {/* Total Price Section */}
                  <View style={styles.addAllPriceSection}>
                    <Text style={styles.addAllTotalLabel}>
                      {language === 'ar' ? 'الإجمالي' : 'Total'}
                    </Text>
                    <View style={styles.addAllPriceRow}>
                      <Animated.Text style={[styles.addAllPrice, { color: rgbColor }]}>
                        {finalTotal.toFixed(2)}
                      </Animated.Text>
                      <Animated.Text style={[styles.addAllCurrency, { color: rgbColor }]}>
                        ج.م
                      </Animated.Text>
                    </View>
                  </View>
                </View>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Footer / Bottom Navigation */}
      <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TouchableOpacity style={styles.footerItem} onPress={() => router.push('/')}>
          <Ionicons name="home-outline" size={22} color={colors.textSecondary} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'الرئيسية' : 'Home'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerItem} onPress={() => router.push('/(tabs)/categories')}>
          <Ionicons name="grid-outline" size={22} color={colors.textSecondary} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'الفئات' : 'Categories'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerItem} onPress={() => router.push('/(tabs)/cart')}>
          <Ionicons name="cart-outline" size={22} color={colors.textSecondary} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'السلة' : 'Cart'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerItem} onPress={() => router.push('/(tabs)/profile')}>
          <Ionicons name="person-outline" size={22} color={colors.textSecondary} />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'الملف' : 'Profile'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sliderContainer: {
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  
  // Car Model Badge - Modern
  carBadgeSection: {
    marginBottom: 16,
  },
  carModelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
      },
      default: {
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
    }),
  },
  carIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carTextContainer: {
    flex: 1,
    marginLeft: 14,
  },
  carLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  carModelText: {
    fontSize: 15,
    fontWeight: '700',
  },
  carArrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Discount Banner - Premium
  discountBanner: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  discountGradient: {
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  discountDecoLeft: {
    position: 'absolute',
    left: -30,
    top: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  discountDecoRight: {
    position: 'absolute',
    right: -20,
    bottom: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  discountContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  discountLeft: {
    flex: 1,
    paddingRight: 16,
  },
  discountTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  discountTitle: {
    color: '#1a1a2e',
    fontSize: 18,
    fontWeight: '800',
  },
  discountSubtitle: {
    color: '#1a1a2e',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
    opacity: 0.9,
  },
  discountCondition: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  conditionText: {
    color: 'rgba(26,26,46,0.7)',
    fontSize: 11,
    fontWeight: '600',
  },
  discountCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
      },
      default: {
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
    }),
  },
  discountPercentage: {
    color: '#FFD93D',
    fontSize: 22,
    fontWeight: '900',
  },
  discountOff: {
    color: '#FFD93D',
    fontSize: 10,
    fontWeight: '700',
    marginTop: -2,
  },

  // Products Section
  productsSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  productCount: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  productCountText: {
    fontSize: 12,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },

  // Product Card - Modern
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 15px rgba(0,0,0,0.06)',
      },
      default: {
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
    }),
  },
  productNumberBadge: {
    position: 'absolute',
    top: -6,
    left: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  productNumber: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
  productImageContainer: {
    width: 85,
    height: 85,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 30,
  },
  viewProductBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  viewProductText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  productInfo: {
    flex: 1,
    marginLeft: 14,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 20,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  skuBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  productSku: {
    fontSize: 11,
    fontWeight: '500',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  productPrice: {
    fontSize: 20,
    fontWeight: '800',
  },
  priceCurrency: {
    fontSize: 12,
    fontWeight: '700',
  },
  addButton: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
      },
      default: {
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
      },
    }),
  },

  // Summary Section - Premium
  summarySection: {
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
      },
      default: {
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
    }),
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  summaryDivider: {
    height: 1,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  discountRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  discountTag: {
    padding: 4,
    borderRadius: 6,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  summaryValueStrike: {
    fontSize: 14,
    fontWeight: '500',
    textDecorationLine: 'line-through',
  },
  summaryDividerDashed: {
    borderWidth: 1,
    borderStyle: 'dashed',
    marginVertical: 14,
  },
  finalPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  finalLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  finalPriceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  finalValue: {
    fontSize: 28,
    fontWeight: '900',
  },
  finalCurrency: {
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  savingsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  savingsText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '600',
  },

  // Add All Button - Professional Design
  addAllButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
      },
      default: {
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
    }),
  },
  addAllGradient: {
    flexDirection: 'column',
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  // Price Info Section
  priceInfoSection: {
    marginBottom: 12,
  },
  priceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  priceInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  animatedIconContainer: {
    width: 14,
    height: 14,
    position: 'relative',
  },
  animatedIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  priceInfoLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  originalPriceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    textDecorationLine: 'line-through',
  },
  discountValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Divider
  barDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 12,
  },
  // Main Action Section
  mainActionSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addAllIconContainer: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartIconRing: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
  },
  addAllCenterContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAllText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  addAllSubtext: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    textAlign: 'center',
  },
  addAllPriceSection: {
    alignItems: 'flex-end',
  },
  addAllTotalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 4,
  },
  addAllPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  addAllPrice: {
    fontSize: 22,
    fontWeight: '900',
  },
  addAllCurrency: {
    fontSize: 12,
    fontWeight: '700',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  footerItem: {
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});
