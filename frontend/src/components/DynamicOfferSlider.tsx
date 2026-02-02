/**
 * Dynamic Offer Slider - Fetches from Marketing API
 * Displays both Promotions and Bundle Offers
 */
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ImageBackground,
  Platform,
  ActivityIndicator,
  useWindowDimensions, // Use the hook for responsive width
} from 'react-native';
import { FlashList } from '@shopify/flash-list'; // Import FlashList for performance
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../hooks/useTranslation';
import { useTheme } from '../hooks/useTheme';
import { marketingApi } from '../services/api';

// Fallback images
const FALLBACK_IMAGES = [
  'https://customer-assets.emergentagent.com/job_run-al-project/artifacts/04kxu3h3_car-brake-parts-and-components-displayed-on-a-whit-2025-12-08-16-53-24-utc.jpg',
  'https://customer-assets.emergentagent.com/job_run-al-project/artifacts/e0wpx2r9_car-parts-2025-02-25-15-02-08-utc.jpg',
  'https://customer-assets.emergentagent.com/job_run-al-project/artifacts/yt3zfrnf_car-parts-2025-02-24-20-10-48-utc%20%282%29.jpg',
];

// Color palettes for slides - NEW PROFESSIONAL BLUE THEME
const COLOR_PALETTES = [
  // 1. Classic Navy & Gold: Deep, elegant, and high-contrast.
  { 
    gradient: ['#FFD700', '#FFA500'], // Gold to Orange gradient for the discount badge
    accent: '#00529B', // A strong, classic navy blue for accents
    icon: '#FFD700'    // Bright gold for the icon and new price to attract attention
  },
  // 2. Electric Blue & Yellow: Vibrant, modern, and energetic.
  { 
    gradient: ['#F0E68C', '#FFD700'], // Pale Yellow to Gold gradient
    accent: '#007BFF', // A bright, electric blue
    icon: '#F0E68C'    // Neon-like pale yellow for highlight
  },
  // 3. Pacific Teal & Coral: Calm, sophisticated, with a warm touch.
  { 
    gradient: ['#FF7F50', '#FF6347'], // Coral to Tomato Red gradient
    accent: '#008080', // Deep Teal (blue-green) for a unique feel
    icon: '#FF7F50'    // Warm Coral for the icon and price
  },
  // 4. Night Sky & Sunset Orange: Dramatic, bold, and striking.
  { 
    gradient: ['#FFA500', '#FF4500'], // Orange to Orange-Red gradient
    accent: '#000080', // Very dark navy, almost like a night sky
    icon: '#FFA500'    // Bright, pure orange for the highlight
  },
  // 5. Arctic Ice & Magenta: Cool, futuristic, and distinctive.
  { 
    gradient: ['#FF00FF', '#DA70D6'], // Magenta to Orchid gradient
    accent: '#87CEEB', // A cool, light sky blue
    icon: '#FF00FF'    // Bold Magenta for a surprising and modern pop of color
  },
];

interface SliderItem {
  id: string;
  type: 'promotion' | 'bundle_offer' | 'bundle';
  title: string;
  title_ar?: string;
  subtitle?: string;
  subtitle_ar?: string;
  image?: string;
  discount_percentage?: number;
  original_total?: number;
  discounted_total?: number;
  product_count?: number;
  product_ids?: string[];
  products?: any[];
  target_product?: any;
  target_product_id?: string;
  target_car_model?: any;
  target_car_model_id?: string;
  is_active: boolean;
  sort_order?: number;
}

interface DynamicOfferSliderProps {
  compact?: boolean;
  showArrows?: boolean;
  hideIcon?: boolean;
  onOfferChange?: (index: number) => void;
  initialIndex?: number;
}

export const DynamicOfferSlider: React.FC<DynamicOfferSliderProps> = ({ 
  compact = false, 
  showArrows = false,
  hideIcon = false,
  onOfferChange,
  initialIndex = 0,
}) => {
  const router = useRouter();
  const { language } = useTranslation();
  const { colors, isDark } = useTheme();
  const scrollRef = useRef<FlashList<SliderItem>>(null); // Update ref type for FlashList
  const { width: screenWidth } = useWindowDimensions(); // Use the hook for responsive width
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [sliderItems, setSliderItems] = useState<SliderItem[]>([]);
  const [loading, setLoading] = useState(true);

  // --- NEW: Centralized and precise layout calculation ---
  const layoutConfig = useMemo(() => {
    const PADDING_HORIZONTAL = 16; // Space on the left of the first card
    const PEEK_AREA = 24;          // How much of the next card is visible to hint at scrolling
    const GAP = 12;                // Space between cards

    const cardWidth = screenWidth - (PADDING_HORIZONTAL + PEEK_AREA);
    // The correct snap interval is the card's width plus the gap that follows it.
    const snapInterval = cardWidth + GAP;

    return { cardWidth, snapInterval, gap: GAP, paddingHorizontal: PADDING_HORIZONTAL };
  }, [screenWidth]);

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const arrowLeftAnim = useRef(new Animated.Value(0)).current;
  const arrowRightAnim = useRef(new Animated.Value(0)).current;

  // Fetch marketing data
  const fetchSliderData = useCallback(async () => {
    try {
      const response = await marketingApi.getHomeSlider();
      const items = response.data || [];
      if (items.length > 0) {
        setSliderItems(items);
      } else {
        // Use fallback static offers if no dynamic data
        setSliderItems(getStaticOffers());
      }
    } catch (error) {
      console.error('Error fetching slider data:', error);
      setSliderItems(getStaticOffers());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSliderData();
  }, [fetchSliderData]);

  // Auto-scroll only on home page (not compact)
  useEffect(() => {
    if (compact || sliderItems.length === 0) return;
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % sliderItems.length;
      // Use the new goToSlide function which is more reliable
      goToSlide(nextIndex);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentIndex, compact, sliderItems.length]);
  
  // Pulse animation for icon
  useEffect(() => {
    if (hideIcon) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [hideIcon]);

  // Glow animation
  useEffect(() => {
    if (hideIcon) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [hideIcon]);

  // Rotation animation for icon
  useEffect(() => {
    if (hideIcon) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [hideIcon]);

  const handleScroll = (event: any) => {
    const x = event.nativeEvent.contentOffset.x;
    // Use the precise snapInterval from our layout config for accurate index calculation
    const index = Math.round(x / layoutConfig.snapInterval);
    if (index !== currentIndex && index >= 0 && index < sliderItems.length) {
      setCurrentIndex(index);
      onOfferChange?.(index);
    }
  };

  const goToSlide = (index: number) => {
    // FlashList has a more direct and reliable method: scrollToIndex
    scrollRef.current?.scrollToIndex({ index, animated: true });
    // The onScroll handler will update the currentIndex, so we don't set it manually.
  };

  const handlePrevious = () => {
    const prevIndex = currentIndex === 0 ? sliderItems.length - 1 : currentIndex - 1;
    goToSlide(prevIndex);
    Animated.sequence([
      Animated.timing(arrowLeftAnim, { toValue: -8, duration: 120, useNativeDriver: true }),
      Animated.timing(arrowLeftAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const handleNext = () => {
    const nextIndex = (currentIndex + 1) % sliderItems.length;
    goToSlide(nextIndex);
    Animated.sequence([
      Animated.timing(arrowRightAnim, { toValue: 8, duration: 120, useNativeDriver: true }),
      Animated.timing(arrowRightAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const handleItemPress = (item: SliderItem) => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.1, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start(() => {
      // Handle bundle offers (both 'bundle_offer' and 'bundle' types)
      if (item.type === 'bundle_offer' || item.type === 'bundle') {
        // Navigate to bundle offer details
        router.push(`/offer/${item.id}`);
      } else if (item.type === 'promotion') {
        // Smart navigation based on target
        if (item.target_product) {
          router.push(`/product/${item.target_product.id}`);
        } else if (item.target_car_model) {
          router.push(`/car/${item.target_car_model.id}`);
        }
      }
    });
  };

  const getTitle = useCallback((item: SliderItem) => 
    language === 'ar' ? (item.title_ar || item.title) : item.title, [language]);
  
  const getColorPalette = useCallback((index: number) => 
    COLOR_PALETTES[index % COLOR_PALETTES.length], []);
  
  const getImage = useCallback((item: SliderItem, index: number) => 
    item.image || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length], []);

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.9],
  });

  const slideHeight = 300;

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (sliderItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* Navigation Arrows */}
      {showArrows && sliderItems.length > 1 && (
        <TouchableOpacity 
          style={[styles.arrowButton, styles.arrowLeft, { backgroundColor: getColorPalette(currentIndex).accent }]}
          onPress={handlePrevious}
          activeOpacity={0.8}
        >
          <Animated.View style={{ transform: [{ translateX: arrowLeftAnim }] }}>
            <Ionicons name="chevron-back" size={22} color="#FFF" />
          </Animated.View>
        </TouchableOpacity>
      )}

      <FlashList
        ref={scrollRef}
        data={sliderItems}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        
        // --- Apply the new, correct configuration ---
        snapToInterval={layoutConfig.snapInterval}
        decelerationRate="fast"
        
        // Use contentContainerStyle to manage padding and gaps centrally
        contentContainerStyle={{
          paddingHorizontal: layoutConfig.paddingHorizontal,
          gap: layoutConfig.gap,
        }}
        
        onScroll={handleScroll}
        scrollEventThrottle={16}
        
        estimatedItemSize={layoutConfig.cardWidth}
        // The render logic from the old .map() is now inside renderItem
        renderItem={({ item, index }) => {
          const palette = getColorPalette(index);
          const isBundle = item.type === 'bundle_offer' || item.type === 'bundle';
          const discount = isBundle ? (item.discount_percentage || 0) : 
                          (item.original_total && item.discounted_total ? 
                            Math.round((1 - item.discounted_total / item.original_total) * 100) : (item.discount_percentage || 0));
          
          return (
            <TouchableOpacity 
              key={item.id} 
              style={{ width: layoutConfig.cardWidth }} // Use the new dynamic width
              activeOpacity={hideIcon ? 1 : 0.95}
              onPress={hideIcon ? undefined : () => handleItemPress(item)}
            >
              <ImageBackground
                source={{ uri: getImage(item, index) }}
                style={[styles.slide, { height: slideHeight }]}
                imageStyle={styles.slideImage}
                resizeMode="cover"
              >
                {/* Gradient Overlay */}
                <LinearGradient
                  colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.3)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.2, y: 1 }}
                  style={styles.gradientOverlay}
                >
                  {/* Accent Strip */}
                  <View style={[styles.accentStrip, { backgroundColor: palette.accent }]} />

                  {/* Type Badge */}
                  <View 
                    style={[
                      styles.typeBadge, 
                      isBundle 
                        ? { 
                            backgroundColor: '#000000', // Black background for bundles
                            borderColor: '#FFD700',     // Luminous gold border
                            borderWidth: 1,             // Border width
                          } 
                        : { 
                            backgroundColor: palette.accent // Keep original color for promos
                          }
                    ]}
                  >
                    <Ionicons 
                      name={isBundle ? 'gift' : 'megaphone'} 
                      size={15} 
                      color={isBundle ? '#FFD700' : '#FFF'} // Gold icon for bundles, white for promos 
                    />
                    <Text style={[styles.typeBadgeText, isBundle && { color: '#FFD700' }]}>
                      {isBundle 
                        ? (language === 'ar' ? 'عرض مجمع' : 'Bundle')
                        : (language === 'ar' ? 'عرض' : 'Promo')}
                    </Text>
                  </View>
                  
                  {/* Content Container */}
                  <View style={styles.contentContainer}>
                    {/* Center Section - Title & Info */}
                    <View style={styles.centerSection}>
                      {/* Title */}
                      <Text style={styles.titleText} numberOfLines={2}>
                        {getTitle(item)}
                      </Text>
                      
                      {/* Target Badge */}
                      {(item.target_car_model || item.target_product) && (
                        <View style={[styles.carBadge, { backgroundColor: palette.accent }]}>
                          <MaterialCommunityIcons 
                            name={item.target_car_model ? 'car-sports' : 'cube'} 
                            size={15} 
                            color="#FFF" 
                          />
                          <Text style={styles.carText} numberOfLines={1}>
                            {item.target_car_model?.name || item.target_product?.name || ''}
                          </Text>
                        </View>
                      )}
                      
                      {/* Product Count for bundles */}
                      {isBundle && item.product_count && (
                        <Text style={styles.subtitleText}>
                          {item.product_count} {language === 'ar' ? 'منتجات' : 'products'}
                        </Text>
                      )}
                    </View>

                    {/* Right Side - Discount at top, Pulse indicator in middle, Price at bottom */}
                    <View style={styles.actionSection}>
                      {/* Discount Badge - TOP */}
                      {discount > 0 && (
                        <LinearGradient
                          colors={[palette.accent, palette.icon]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.discountBadge}
                        >
                          <Text style={styles.discountNum}>{discount}%</Text>
                          <Text style={styles.discountLabel}>{language === 'ar' ? 'خصم' : 'OFF'}</Text>
                        </LinearGradient>
                      )}

                      {/* Interactive Pulse Icon - MIDDLE (centered between discount and price) */}
                      {!hideIcon && (item.type === 'bundle_offer' || item.type === 'bundle') && (
                        <TouchableOpacity
                          onPress={() => handleItemPress(item)}
                          activeOpacity={0.5}
                          style={styles.iconWrapper}
                        >
                          <Animated.View 
                            style={[
                              styles.actionIcon,
                              { 
                                backgroundColor: palette.icon,
                                transform: [
                                  { scale: index === currentIndex ? pulseAnim : 1 },
                                ],
                              }
                            ]}
                          >
                            {/* Glow Effect */}
                            <Animated.View 
                              style={[
                                styles.iconGlow,
                                { 
                                  backgroundColor: palette.icon,
                                  opacity: glowOpacity,
                                }
                              ]} 
                            />
                            {/* Icon - size reduced by 10% */}
                            <Animated.View style={{ transform: [{ rotate: spin }] }}>
                              <MaterialCommunityIcons 
                                name="lightning-bolt-circle" 
                                size={19}
                                color="#1a1a2e" 
                              />
                            </Animated.View>
                          </Animated.View>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {/* Price Row - For bundle offers */}
                  {item.type === 'bundle_offer' && item.original_total && item.discounted_total && (
                    <View style={styles.priceRow}>
                      <Text style={styles.oldPrice}>{item.original_total.toFixed(2)} ج.م</Text>
                      <View style={styles.arrowIcon}>
                        <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.6)" />
                      </View>
                      <Text style={[styles.newPrice, { color: palette.icon }]}>
                        {item.discounted_total.toFixed(2)} <Text style={styles.currency}>ج.م</Text>
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </ImageBackground>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Navigation Arrows - Right */}
      {showArrows && sliderItems.length > 1 && (
        <TouchableOpacity 
          style={[styles.arrowButton, styles.arrowRight, { backgroundColor: getColorPalette(currentIndex).accent }]}
          onPress={handleNext}
          activeOpacity={0.8}
        >
          <Animated.View style={{ transform: [{ translateX: arrowRightAnim }] }}>
            <Ionicons name="chevron-forward" size={22} color="#FFF" />
          </Animated.View>
        </TouchableOpacity>
      )}

      {/* Pagination Dots */}
      {sliderItems.length > 1 && (
        <View style={styles.dotsRow}>
          {sliderItems.map((item, i) => (
            <TouchableOpacity key={i} onPress={() => goToSlide(i)}>
              <View 
                style={[
                  styles.singleDot, 
                  { backgroundColor: isDark ? '#555' : '#AAA' },
                  i === currentIndex && { 
                    width: 30, 
                    backgroundColor: getColorPalette(i).accent,
                  }
                ]} 
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

// Static fallback offers
function getStaticOffers(): SliderItem[] {
  return [
    {
      id: 'static-offer-1',
      type: 'bundle_offer',
      title: 'Brake System Bundle',
      title_ar: 'حزمة نظام الفرامل',
      image: FALLBACK_IMAGES[0],
      discount_percentage: 10,
      original_total: 171.48,
      discounted_total: 154.33,
      product_count: 3,
      is_active: true,
    },
    {
      id: 'static-offer-2',
      type: 'bundle_offer',
      title: 'Power Pack Bundle',
      title_ar: 'حزمة الطاقة المتكاملة',
      image: FALLBACK_IMAGES[1],
      discount_percentage: 10,
      original_total: 355.99,
      discounted_total: 320.39,
      product_count: 3,
      is_active: true,
    },
    {
      id: 'static-offer-3',
      type: 'bundle_offer',
      title: 'Premium Combo Deal',
      title_ar: 'صفقة الكومبو المميزة',
      image: FALLBACK_IMAGES[2],
      discount_percentage: 10,
      original_total: 310.49,
      discounted_total: 279.44,
      product_count: 3,
      is_active: true,
    },
  ];
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 9,
    position: 'relative',
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    // This is no longer needed; layout is handled by contentContainerStyle inline.
    // paddingHorizontal: 20,
  },
  slideWrapper: {
    // This is no longer needed; width is inline and marginRight is replaced by gap.
    // marginRight: 12,
  },
  slide: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  slideImage: {
    borderRadius: 18,
  },
  gradientOverlay: {
    flex: 1,
    borderRadius: 18,
    position: 'relative',
  },
  accentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 7,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  typeBadge: {
    position: 'absolute',
    top: 13,
    left: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 5,
  },
  typeBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 15,
    paddingLeft: 17,
    paddingTop: 39,
  },
  centerSection: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingRight: 13,
  },
  titleText: {
    color: '#FFD93D',
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 7,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  subtitleText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 5,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,  
  },
  carBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 15,
    gap: 7,
  },
  carText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    bottom: 16,
    right: 17,
    gap: 7,
  },
  oldPrice: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textDecorationLine: 'line-through',
  },
  arrowIcon: {
    opacity: 0.5,
  },
  newPrice: {
    fontSize: 19,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,  
  },
  currency: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionSection: {
    alignItems: 'center',
    justifyContent: 'space-between', // Distribute: discount at top, icon in middle
    minWidth: 59,
    height: '100%',
    paddingTop: 0,
    paddingBottom: 35, // Space for price row
  },
  discountBadge: {
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 13,
    alignItems: 'center',
    minWidth: 50,
    marginBottom: 0, // Remove margin - space-between handles spacing
    ...Platform.select({
      web: {
        boxShadow: '0 3px 11px rgba(0,0,0,0.19)',
      },
      default: {
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.17,
        shadowRadius: 7 
      }  
    }),
  },
  discountNum: {
    color: '#1a1a2e',
    fontSize: 19,
    fontWeight: '900',
  },
  discountLabel: {
    color: '#1a1a2e',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 1,
  },
  iconWrapper: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 36,  // Reduced by 10% from 40
    height: 36, // Reduced by 10% from 40
    borderRadius: 18, // Half of width/height
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...Platform.select({
      web: {
        boxShadow: '0 5px 19px rgba(0,0,0,0.39)',
      },
      default: {
        elevation: 9,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
    }),
  },
  iconGlow: {
    position: 'absolute',
    width: 45,  // Reduced by 10% from 50
    height: 45, // Reduced by 10% from 50
    borderRadius: 22.5, // Half of width/height
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
    gap: 11.5,
  },
  singleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  arrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 3px 15px rgba(0,0,0,0.3)',
      },
      default: {
        elevation: 7,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 7,
      },
    }),
  },
  arrowLeft: {
    left: 7,
  },
  arrowRight: {
    right: 7,
  },
});

export default DynamicOfferSlider;
