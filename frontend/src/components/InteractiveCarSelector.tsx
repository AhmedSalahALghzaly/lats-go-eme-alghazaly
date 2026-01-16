/**
 * Interactive Car Selector - Futuristic Edition with Chassis Number Search
 * Features: Morphing vehicle icons, Glassmorphism UI, haptic feedback,
 * Image-based selection, advanced animations with react-native-reanimated
 * NEW: Dual selector buttons - Choose Your Car & Chassis Number Search
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  interpolate,
  Extrapolation,
  runOnJS,
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown,
  Layout,
  cancelAnimation,
} from 'react-native-reanimated';

import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore, useColorMood } from '../store/appStore';
import { productsApi } from '../services/api';
import { DURATIONS, SPRINGS, HAPTIC_PATTERNS } from '../constants/animations';
import { Skeleton, ProductCardSkeleton } from './ui/Skeleton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GRID_COLUMNS = 5;
const GRID_ROWS = 2;

// Vehicle icon sequence for morphing animation
const VEHICLE_ICONS: Array<keyof typeof MaterialCommunityIcons.glyphMap> = [
  'car-sports',
  'car-side',
  'car-hatchback',
  'car-estate',
  'truck',
  'truck-plus',
  'van-passenger',
  'bus',
  'truck-cargo-container',
  'tow-truck',
  'excavator',
  'bulldozer',
];

// Chassis/VIN animation characters
const VIN_CHARS = ['1', 'H', 'G', 'B', 'H', '4', '1', 'J', 'X', 'M', 'N', '0', '1', '5', '6', '7', '8'];

interface CarBrand {
  id: string;
  name: string;
  name_ar?: string;
  logo_url?: string;
  logo?: string;
}

interface CarModel {
  id: string;
  name: string;
  name_ar?: string;
  brand_id: string;
  year_start?: number;
  year_end?: number;
  image_url?: string;
  chassis_number?: string;
}

interface Product {
  id: string;
  name: string;
  name_ar?: string;
  price: number;
  image_url?: string;
  sku?: string;
}

type SelectorState = 'collapsed' | 'brands' | 'models' | 'products' | 'chassis_search';
type PriceFilter = 'all' | 'low' | 'medium' | 'high';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

// CRITICAL FIX: Separate component for product cards to avoid hooks-in-renderItem violation
interface ProductCardItemProps {
  item: Product;
  index: number;
  isDark: boolean;
  mood: { primary?: string } | null;
  colors: { text: string; textSecondary: string; primary: string };
  language: string;
  onPress: (id: string) => void;
}

const ProductCardItem: React.FC<ProductCardItemProps> = React.memo(({
  item,
  index,
  isDark,
  mood,
  colors,
  language,
  onPress,
}) => {
  const itemScale = useSharedValue(1);
  
  const productCardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: itemScale.value }],
  }));

  const getName = (i: { name: string; name_ar?: string }) =>
    language === 'ar' ? (i.name_ar || i.name) : i.name;

  return (
    <Animated.View
      entering={FadeIn.delay(Math.min(index * 40, 300)).duration(250).springify()}
      layout={Layout.springify()}
      style={[productCardItemStyles.wrapper, productCardStyle]}
    >
      <TouchableOpacity
        style={[
          productCardItemStyles.card,
          { 
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)', 
            borderColor: (mood?.primary || '#009688') + '30',
            shadowColor: mood?.primary || '#009688',
          },
        ]}
        onPressIn={() => {
          itemScale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
        }}
        onPressOut={() => {
          itemScale.value = withSpring(1, { damping: 12, stiffness: 200 });
        }}
        onPress={() => onPress(item.id)}
        activeOpacity={0.9}
      >
        {item.image_url ? (
          <Image 
            source={{ uri: item.image_url }} 
            style={productCardItemStyles.image}
            contentFit="cover"
            cachePolicy="disk"
            transition={200}
          />
        ) : (
          <View style={[productCardItemStyles.placeholder, { backgroundColor: (mood?.primary || '#009688') + '15' }]}>
            <Ionicons name="cube-outline" size={36} color={mood?.primary || colors.textSecondary} />
          </View>
        )}
        <View style={productCardItemStyles.info}>
          <Text style={[productCardItemStyles.name, { color: colors.text }]} numberOfLines={2}>
            {getName(item)}
          </Text>
          <View style={[productCardItemStyles.priceTag, { backgroundColor: (mood?.primary || '#009688') + '20' }]}>
            <Text style={[productCardItemStyles.price, { color: mood?.primary || colors.primary }]}>
              {item.price?.toFixed(2)} {language === 'ar' ? 'ج.م' : 'EGP'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

const productCardItemStyles = StyleSheet.create({
  wrapper: {
    width: (SCREEN_WIDTH - 30) / 3,
    marginHorizontal: 2,
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  image: {
    width: '100%',
    height: 130,
    backgroundColor: 'transparent',
  },
  placeholder: {
    width: '100%',
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    padding: 10,
    gap: 6,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  priceTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export const InteractiveCarSelector: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { language, isRTL } = useTranslation();
  const router = useRouter();
  const mood = useColorMood();

  // Get data from store with memoized selectors
  const carBrands = useAppStore(useCallback((state) => state.carBrands, []));
  const carModels = useAppStore(useCallback((state) => state.carModels, []));

  // Local state
  const [selectorState, setSelectorState] = useState<SelectorState>('collapsed');
  const [selectedBrand, setSelectedBrand] = useState<CarBrand | null>(null);
  const [selectedModel, setSelectedModel] = useState<CarModel | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chassisSearchQuery, setChassisSearchQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  
  // Morphing icon state
  const [currentIconIndex, setCurrentIconIndex] = useState(0);
  const [currentVinIndex, setCurrentVinIndex] = useState(0);

  // Animations
  const expandAnim = useSharedValue(0);
  const carIconRotate = useSharedValue(0);
  const carIconScale = useSharedValue(1);
  const carIconGlow = useSharedValue(0);
  const chassisIconGlow = useSharedValue(0);
  const vinShiftAnim = useSharedValue(0);
  const gridOpacity = useSharedValue(0);
  const productsSlideAnim = useSharedValue(SCREEN_HEIGHT);
  const pulseAnim = useSharedValue(1);
  const glassOpacity = useSharedValue(0);
  const morphProgress = useSharedValue(0);

  // Haptic feedback helper
  const triggerHaptic = useCallback((type: keyof typeof HAPTIC_PATTERNS = 'selection') => {
    if (Platform.OS !== 'web') {
      switch (type) {
        case 'selection':
          Haptics.selectionAsync();
          break;
        case 'light':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          break;
        case 'medium':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          break;
        case 'heavy':
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          break;
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
      }
    }
  }, []);

  // Morphing vehicle icon animation - cycle through vehicle types
  useEffect(() => {
    let morphInterval: NodeJS.Timeout;
    
    if (selectorState === 'collapsed') {
      morphInterval = setInterval(() => {
        setCurrentIconIndex((prev) => (prev + 1) % VEHICLE_ICONS.length);
        morphProgress.value = withSequence(
          withTiming(1, { duration: 150 }),
          withTiming(0, { duration: 150 })
        );
      }, 2000);
      
      carIconGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500 }),
          withTiming(0.3, { duration: 1500 })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(carIconGlow);
      carIconGlow.value = withTiming(0.8, { duration: 300 });
    }
    
    return () => {
      if (morphInterval) clearInterval(morphInterval);
    };
  }, [selectorState]);

  // Chassis number animation - shifting VIN characters
  useEffect(() => {
    let vinInterval: NodeJS.Timeout;
    
    if (selectorState === 'collapsed') {
      vinInterval = setInterval(() => {
        setCurrentVinIndex((prev) => (prev + 1) % VIN_CHARS.length);
        vinShiftAnim.value = withSequence(
          withTiming(1, { duration: 100 }),
          withTiming(0, { duration: 100 })
        );
      }, 800);
      
      chassisIconGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1200 }),
          withTiming(0.4, { duration: 1200 })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(chassisIconGlow);
      chassisIconGlow.value = withTiming(0.8, { duration: 300 });
    }
    
    return () => {
      if (vinInterval) clearInterval(vinInterval);
    };
  }, [selectorState]);

  // Expand animation with Glassmorphism
  useEffect(() => {
    if (selectorState !== 'collapsed') {
      carIconRotate.value = withSequence(
        withSpring(180, { damping: 12, stiffness: 100 }),
        withSpring(360, { damping: 15, stiffness: 80 })
      );
      carIconScale.value = withSequence(
        withSpring(1.3, { damping: 10, stiffness: 120 }),
        withSpring(1.1, { damping: 15, stiffness: 100 })
      );
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1200 }),
          withTiming(1, { duration: 1200 })
        ),
        -1,
        true
      );
      glassOpacity.value = withTiming(1, { duration: 400 });
    } else {
      carIconRotate.value = withSpring(0, { damping: 15, stiffness: 80 });
      carIconScale.value = withSpring(1, { damping: 15, stiffness: 80 });
      cancelAnimation(pulseAnim);
      pulseAnim.value = 1;
      glassOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [selectorState]);

  // Expand/collapse animation
  useEffect(() => {
    if (selectorState === 'collapsed') {
      expandAnim.value = withTiming(0, { duration: DURATIONS.transition });
      gridOpacity.value = withTiming(0, { duration: DURATIONS.fast });
    } else if (selectorState === 'brands' || selectorState === 'models' || selectorState === 'chassis_search') {
      expandAnim.value = withSpring(1, { damping: 15, stiffness: 90 });
      gridOpacity.value = withDelay(100, withTiming(1, { duration: DURATIONS.normal }));
    }
  }, [selectorState]);

  // Products slide animation
  useEffect(() => {
    if (selectorState === 'products') {
      productsSlideAnim.value = withSpring(0, { damping: 18, stiffness: 90 });
    } else {
      productsSlideAnim.value = withTiming(SCREEN_HEIGHT, { duration: DURATIONS.transition });
    }
  }, [selectorState]);

  // Fetch products when model is selected
  const fetchProductsForModel = useCallback(async (modelId: string) => {
    setLoadingProducts(true);
    try {
      const response = await productsApi.getAll({ car_model_id: modelId, limit: 100 });
      setProducts(response.data?.products || []);
      triggerHaptic('success');
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
      triggerHaptic('error');
    } finally {
      setLoadingProducts(false);
    }
  }, [triggerHaptic]);

  const handleCarAnchorPress = () => {
    triggerHaptic('medium');
    
    if (selectorState === 'collapsed') {
      setSelectorState('brands');
    } else {
      // Collapse back with reset
      setSelectorState('collapsed');
      setSelectedBrand(null);
      setSelectedModel(null);
      setProducts([]);
      setSearchQuery('');
      setChassisSearchQuery('');
      setPriceFilter('all');
    }
  };

  const handleChassisAnchorPress = () => {
    triggerHaptic('medium');
    
    if (selectorState === 'collapsed') {
      setSelectorState('chassis_search');
      setChassisSearchQuery('');
    } else {
      // Collapse back with reset
      setSelectorState('collapsed');
      setSelectedBrand(null);
      setSelectedModel(null);
      setProducts([]);
      setSearchQuery('');
      setChassisSearchQuery('');
      setPriceFilter('all');
    }
  };

  const handleBrandSelect = (brand: CarBrand) => {
    triggerHaptic('light');
    setSelectedBrand(brand);
    setSelectorState('models');
  };

  const handleModelSelect = (model: CarModel) => {
    triggerHaptic('medium');
    setSelectedModel(model);
    setSelectorState('products');
    fetchProductsForModel(model.id);
  };

  const handleBackToModels = () => {
    triggerHaptic('selection');
    setSelectorState('models');
    setSelectedModel(null);
    setProducts([]);
  };

  const handleBackToBrands = () => {
    triggerHaptic('selection');
    setSelectorState('brands');
    setSelectedBrand(null);
    setSelectedModel(null);
  };

  const handleProductPress = (productId: string) => {
    triggerHaptic('light');
    router.push(`/product/${productId}`);
    // Collapse after navigation
    setSelectorState('collapsed');
    setSelectedBrand(null);
    setSelectedModel(null);
    setProducts([]);
  };

  const getName = useCallback((item: { name: string; name_ar?: string }) =>
    language === 'ar' ? (item.name_ar || item.name) : item.name, [language]);

  // Memoized filter products
  const filteredProducts = useMemo(() => products.filter((p) => {
    const matchesSearch =
      searchQuery === '' ||
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.name_ar?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesPrice = true;
    if (priceFilter === 'low') matchesPrice = p.price < 100;
    else if (priceFilter === 'medium') matchesPrice = p.price >= 100 && p.price < 500;
    else if (priceFilter === 'high') matchesPrice = p.price >= 500;

    return matchesSearch && matchesPrice;
  }), [products, searchQuery, priceFilter]);

  // Memoized filtered brands/models for grid
  const displayBrands = useMemo(() => carBrands.slice(0, GRID_COLUMNS * GRID_ROWS), [carBrands]);
  const filteredModels = useMemo(() => selectedBrand
    ? carModels.filter((m) => m.brand_id === selectedBrand.id).slice(0, GRID_COLUMNS * GRID_ROWS)
    : [], [carModels, selectedBrand]);

  // Chassis search - filter all models by name or chassis number
  const chassisFilteredModels = useMemo(() => {
    if (!chassisSearchQuery.trim()) return carModels;
    const query = chassisSearchQuery.toLowerCase();
    return carModels.filter((m) => 
      m.name?.toLowerCase().includes(query) ||
      m.name_ar?.toLowerCase().includes(query) ||
      m.chassis_number?.toLowerCase().includes(query)
    );
  }, [carModels, chassisSearchQuery]);

  // Animated styles
  const carRotationStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${carIconRotate.value}deg` },
      { scale: carIconScale.value * pulseAnim.value },
    ],
  }));

  const iconGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(carIconGlow.value, [0, 1], [0.3, 0.9]),
    shadowRadius: interpolate(carIconGlow.value, [0, 1], [4, 16]),
  }));

  const chassisGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(chassisIconGlow.value, [0, 1], [0.3, 0.9]),
    shadowRadius: interpolate(chassisIconGlow.value, [0, 1], [4, 16]),
  }));

  const vinAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(vinShiftAnim.value, [0, 0.5, 1], [1, 0.6, 1]),
    transform: [
      { scale: interpolate(vinShiftAnim.value, [0, 0.5, 1], [1, 0.9, 1]) },
    ],
  }));

  const morphStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morphProgress.value, [0, 0.5, 1], [1, 0.5, 1]),
    transform: [
      { scale: interpolate(morphProgress.value, [0, 0.5, 1], [1, 0.85, 1]) },
    ],
  }));

  const containerHeight = useAnimatedStyle(() => ({
    height: interpolate(expandAnim.value, [0, 1], [70, SCREEN_HEIGHT * 0.30], Extrapolation.CLAMP),
  }));

  const glassStyle = useAnimatedStyle(() => ({
    opacity: glassOpacity.value,
  }));

  const gridStyle = useAnimatedStyle(() => ({
    opacity: gridOpacity.value,
    transform: [
      {
        translateY: interpolate(gridOpacity.value, [0, 1], [30, 0], Extrapolation.CLAMP),
      },
    ],
  }));

  const productsPanelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: productsSlideAnim.value }],
  }));

  // Grid item component with animations
  const GridItem = ({ item, index, isBrand }: { item: CarBrand | CarModel; index: number; isBrand: boolean }) => {
    const itemScale = useSharedValue(1);
    const glowAnim = useSharedValue(0);
    
    const itemAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: itemScale.value }],
    }));

    const itemGlowStyle = useAnimatedStyle(() => ({
      shadowOpacity: interpolate(glowAnim.value, [0, 1], [0, 0.6]),
      shadowRadius: interpolate(glowAnim.value, [0, 1], [0, 12]),
    }));

    const handlePress = () => {
      triggerHaptic('selection');
      itemScale.value = withSequence(
        withSpring(0.9, { damping: 10, stiffness: 400 }),
        withSpring(1.05, { damping: 8, stiffness: 300 }),
        withSpring(1, { damping: 12, stiffness: 200 })
      );
      glowAnim.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(0, { duration: 300 })
      );
      
      setTimeout(() => {
        isBrand
          ? handleBrandSelect(item as CarBrand)
          : handleModelSelect(item as CarModel);
      }, 100);
    };

    const brand = item as CarBrand;
    const model = item as CarModel;
    const hasImage = isBrand ? (brand.logo_url || brand.logo) : model.image_url;

    return (
      <Animated.View
        entering={FadeIn.delay(index * 60).duration(300).springify()}
        layout={Layout.springify()}
        style={[itemAnimatedStyle, itemGlowStyle]}
      >
        <TouchableOpacity
          style={[
            styles.gridItem,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)',
              borderColor: mood?.primary + '40',
              shadowColor: mood?.primary || colors.primary,
            },
          ]}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          {hasImage ? (
            <Image
              source={{ uri: isBrand ? (brand.logo_url || brand.logo) : model.image_url }}
              style={isBrand ? styles.brandLogo : styles.modelImage}
              contentFit="contain"
              backgroundColor="transparent"
              transition={200}
            />
          ) : (
            <View style={[styles.placeholderIcon, { backgroundColor: mood?.primary + '20' }]}>
              <MaterialCommunityIcons
                name={isBrand ? 'car' : 'car-side'}
                size={isBrand ? 24 : 28}
                color={mood?.primary || colors.primary}
              />
            </View>
          )}
          <Text
            style={[styles.gridItemText, { color: colors.text }]}
            numberOfLines={1}
          >
            {getName(item)}
          </Text>
          {!isBrand && model.year_start && (
            <Text style={[styles.gridItemSubtext, { color: mood?.primary || colors.textSecondary }]}>
              {model.year_start}{model.year_end ? ` - ${model.year_end}` : '+'}
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Model card for chassis search
  const ChassisModelCard = ({ model, index }: { model: CarModel; index: number }) => {
    const itemScale = useSharedValue(1);
    
    const itemAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: itemScale.value }],
    }));

    const brand = carBrands.find(b => b.id === model.brand_id);

    return (
      <Animated.View
        entering={FadeIn.delay(index * 50).duration(250).springify()}
        layout={Layout.springify()}
        style={itemAnimatedStyle}
      >
        <TouchableOpacity
          style={[
            styles.chassisModelCard,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)',
              borderColor: mood?.primary + '40',
            },
          ]}
          onPressIn={() => {
            itemScale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
          }}
          onPressOut={() => {
            itemScale.value = withSpring(1, { damping: 12, stiffness: 200 });
          }}
          onPress={() => handleModelSelect(model)}
          activeOpacity={0.8}
        >
          {model.image_url ? (
            <Image
              source={{ uri: model.image_url }}
              style={styles.chassisModelImage}
              contentFit="contain"
              transition={200}
            />
          ) : (
            <View style={[styles.chassisModelPlaceholder, { backgroundColor: mood?.primary + '15' }]}>
              <MaterialCommunityIcons name="car-side" size={32} color={mood?.primary || colors.primary} />
            </View>
          )}
          <View style={styles.chassisModelInfo}>
            <Text style={[styles.chassisModelName, { color: colors.text }]} numberOfLines={1}>
              {getName(model)}
            </Text>
            {brand && (
              <Text style={[styles.chassisModelBrand, { color: mood?.primary || colors.primary }]} numberOfLines={1}>
                {getName(brand)}
              </Text>
            )}
            {model.chassis_number && (
              <View style={[styles.chassisTag, { backgroundColor: mood?.primary + '20' }]}>
                <MaterialCommunityIcons name="barcode" size={12} color={mood?.primary || colors.primary} />
                <Text style={[styles.chassisTagText, { color: mood?.primary || colors.primary }]} numberOfLines={1}>
                  {model.chassis_number}
                </Text>
              </View>
            )}
            {model.year_start && (
              <Text style={[styles.chassisModelYear, { color: colors.textSecondary }]}>
                {model.year_start}{model.year_end ? ` - ${model.year_end}` : '+'}
              </Text>
            )}
          </View>
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={mood?.primary || colors.textSecondary} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (carBrands.length === 0) {
    return null;
  }

  const currentIcon = VEHICLE_ICONS[currentIconIndex];
  const displayVin = VIN_CHARS.slice(currentVinIndex, currentVinIndex + 5).join('');

  return (
    <>
      {/* Main Anchor/Footer Bar */}
      <Animated.View
        style={[
          styles.container,
          containerHeight,
          {
            borderTopColor: mood?.primary + '50' || colors.border,
          },
        ]}
      >
        {/* Glassmorphism Background */}
        <Animated.View style={[StyleSheet.absoluteFill, glassStyle]}>
          <BlurView
            intensity={isDark ? 40 : 60}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[
              mood?.primary + '15' || 'rgba(0,150,136,0.08)',
              'transparent',
              mood?.primary + '10' || 'rgba(0,150,136,0.05)',
            ]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        </Animated.View>

        {/* Collapsed state background */}
        {selectorState === 'collapsed' && (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.95)' },
            ]}
          />
        )}

        {/* Neon border glow effect */}
        <Animated.View
          style={[
            styles.neonBorder,
            {
              backgroundColor: mood?.primary || colors.primary,
              shadowColor: mood?.primary || colors.primary,
            },
            iconGlowStyle,
          ]}
        />

        {/* Dual Anchor Button Row - RTL aware */}
        <View style={styles.anchorRow}>
          {/* Left Button: Car Selector (in LTR) / Chassis (in RTL) */}
          {isRTL ? (
            /* Chassis Button for RTL - shows on LEFT */
            <AnimatedTouchable
              style={[
                styles.anchorButton,
                {
                  backgroundColor: selectorState === 'chassis_search'
                    ? '#00A8FF'
                    : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  borderColor: '#00A8FF',
                  shadowColor: '#00A8FF',
                },
                chassisGlowStyle,
              ]}
              onPress={handleChassisAnchorPress}
              activeOpacity={0.8}
            >
              <Animated.View style={vinAnimStyle}>
                {selectorState === 'chassis_search' ? (
                  <Ionicons name="close" size={26} color="#FFF" />
                ) : (
                  <MaterialCommunityIcons
                    name="barcode"
                    size={26}
                    color={'#00A8FF'}
                  />
                )}
              </Animated.View>
            </AnimatedTouchable>
          ) : (
            /* Car Selector Button for LTR - shows on LEFT */
            <AnimatedTouchable
              style={[
                styles.anchorButton,
                {
                  backgroundColor: selectorState === 'brands' || selectorState === 'models' || selectorState === 'products' 
                    ? mood?.primary || colors.primary 
                    : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  borderColor: mood?.primary || colors.primary,
                  shadowColor: mood?.primary || colors.primary,
                },
                iconGlowStyle,
              ]}
              onPress={handleCarAnchorPress}
              activeOpacity={0.8}
            >
              <Animated.View style={[carRotationStyle, morphStyle]}>
                <MaterialCommunityIcons
                  name={selectorState !== 'collapsed' && selectorState !== 'chassis_search' ? 'close' : currentIcon}
                  size={26}
                  color={selectorState === 'brands' || selectorState === 'models' || selectorState === 'products' ? '#FFF' : mood?.primary || colors.primary}
                />
              </Animated.View>
            </AnimatedTouchable>
          )}

          {/* Center Content - Hints or Breadcrumbs */}
          {selectorState === 'collapsed' ? (
            <Animated.View 
              style={styles.hintContainer} 
              entering={FadeIn.duration(300)} 
              exiting={FadeOut.duration(200)}
            >
              <View style={[styles.dualHintRow, isRTL && styles.dualHintRowRTL]}>
                <TouchableOpacity style={styles.hintTouchable} onPress={isRTL ? handleChassisAnchorPress : handleCarAnchorPress}>
                  <Text style={[styles.hintText, { color: colors.text }]}>
                    {isRTL 
                      ? (language === 'ar' ? 'رقم الشاسيه' : 'Chassis No.')
                      : (language === 'ar' ? 'اختر سيارتك' : 'Choose Car')
                    }
                  </Text>
                </TouchableOpacity>
                <View style={[styles.hintDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity style={styles.hintTouchable} onPress={isRTL ? handleCarAnchorPress : handleChassisAnchorPress}>
                  <Text style={[styles.hintText, { color: colors.text }]}>
                    {isRTL 
                      ? (language === 'ar' ? 'اختر سيارتك' : 'Choose Car')
                      : (language === 'ar' ? 'رقم الشاسيه' : 'Chassis No.')
                    }
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          ) : selectorState === 'chassis_search' ? (
            <Animated.View
              style={[styles.chassisSearchContainer, gridStyle]}
              entering={FadeIn.duration(250).springify()}
              exiting={FadeOut.duration(150)}
            >
              <View style={[styles.chassisSearchBox, { 
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', 
                borderColor: mood?.primary + '50',
              }]}>
                <MaterialCommunityIcons name="barcode-scan" size={20} color={mood?.primary || colors.primary} />
                <TextInput
                  style={[styles.chassisSearchInput, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
                  placeholder={language === 'ar' ? 'ابحث برقم الشاسيه أو اسم الموديل...' : 'Search by chassis number or model...'}
                  placeholderTextColor={colors.textSecondary}
                  value={chassisSearchQuery}
                  onChangeText={setChassisSearchQuery}
                  autoCapitalize="characters"
                  autoFocus
                />
                {chassisSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setChassisSearchQuery('')}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          ) : (
            <Animated.View
              style={[styles.breadcrumb, gridStyle, isRTL && styles.breadcrumbRTL]}
              entering={FadeIn.duration(250).springify()}
              exiting={FadeOut.duration(150)}
            >
              {selectedBrand && (
                <TouchableOpacity
                  style={[styles.breadcrumbItem, { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    borderColor: mood?.primary + '40',
                  }]}
                  onPress={handleBackToBrands}
                >
                  {(selectedBrand.logo_url || selectedBrand.logo) ? (
                    <Image
                      source={{ uri: selectedBrand.logo_url || selectedBrand.logo }}
                      style={styles.breadcrumbLogo}
                      contentFit="contain"
                    />
                  ) : (
                    <MaterialCommunityIcons
                      name="car"
                      size={14}
                      color={mood?.primary || colors.primary}
                    />
                  )}
                  <Text style={[styles.breadcrumbText, { color: mood?.primary || colors.primary }]}>
                    {getName(selectedBrand)}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={mood?.primary || colors.primary} />
                </TouchableOpacity>
              )}
              {selectedModel && (
                <TouchableOpacity
                  style={[styles.breadcrumbItem, { 
                    backgroundColor: mood?.primary + '25',
                    borderColor: mood?.primary + '60',
                  }]}
                  onPress={handleBackToModels}
                >
                  <Text style={[styles.breadcrumbText, { color: mood?.primary || colors.primary }]}>
                    {getName(selectedModel)}
                  </Text>
                </TouchableOpacity>
              )}
            </Animated.View>
          )}

          {/* Right Button: Chassis Selector (in LTR) / Car (in RTL) */}
          {isRTL ? (
            /* Car Selector Button for RTL - shows on RIGHT */
            <AnimatedTouchable
              style={[
                styles.anchorButton,
                {
                  backgroundColor: selectorState === 'brands' || selectorState === 'models' || selectorState === 'products' 
                    ? mood?.primary || colors.primary 
                    : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  borderColor: mood?.primary || colors.primary,
                  shadowColor: mood?.primary || colors.primary,
                },
                iconGlowStyle,
              ]}
              onPress={handleCarAnchorPress}
              activeOpacity={0.8}
            >
              <Animated.View style={[carRotationStyle, morphStyle]}>
                <MaterialCommunityIcons
                  name={selectorState !== 'collapsed' && selectorState !== 'chassis_search' ? 'close' : currentIcon}
                  size={26}
                  color={selectorState === 'brands' || selectorState === 'models' || selectorState === 'products' ? '#FFF' : mood?.primary || colors.primary}
                />
              </Animated.View>
            </AnimatedTouchable>
          ) : (
            /* Chassis Number Selector Button for LTR - Electric Blue - shows on RIGHT */
            <AnimatedTouchable
              style={[
                styles.anchorButton,
                {
                  backgroundColor: selectorState === 'chassis_search'
                    ? '#00A8FF'
                    : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  borderColor: '#00A8FF',
                  shadowColor: '#00A8FF',
                },
                chassisGlowStyle,
              ]}
              onPress={handleChassisAnchorPress}
              activeOpacity={0.8}
            >
              <Animated.View style={vinAnimStyle}>
                {selectorState === 'chassis_search' ? (
                  <Ionicons name="close" size={26} color="#FFF" />
                ) : (
                  <MaterialCommunityIcons
                    name="barcode"
                    size={26}
                    color={'#00A8FF'}
                  />
                )}
              </Animated.View>
            </AnimatedTouchable>
          )}
        </View>

        {/* Grid Container for Brands/Models */}
        {(selectorState === 'brands' || selectorState === 'models') && (
          <Animated.View style={[styles.gridContainer, gridStyle]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.gridScroll}
            >
              <View style={styles.grid}>
                {(selectorState === 'brands' ? displayBrands : filteredModels).map((item, index) => (
                  <GridItem
                    key={item.id}
                    item={item}
                    index={index}
                    isBrand={selectorState === 'brands'}
                  />
                ))}

                {/* View All button */}
                <Animated.View entering={FadeIn.delay(500).duration(300).springify()}>
                  <TouchableOpacity
                    style={[
                      styles.gridItem,
                      styles.viewAllItem,
                      { 
                        backgroundColor: mood?.primary + '15', 
                        borderColor: mood?.primary,
                        shadowColor: mood?.primary,
                      },
                    ]}
                    onPress={() => {
                      triggerHaptic('light');
                      if (selectorState === 'brands') {
                        router.push('/car-brands');
                      } else if (selectedBrand) {
                        router.push(`/brand/${selectedBrand.id}`);
                      }
                      setSelectorState('collapsed');
                    }}
                  >
                    <View style={[styles.placeholderIcon, { backgroundColor: mood?.primary + '25' }]}>
                      <Ionicons name="grid" size={22} color={mood?.primary || colors.primary} />
                    </View>
                    <Text style={[styles.gridItemText, { color: mood?.primary || colors.primary, fontWeight: '700' }]}>
                      {language === 'ar' ? 'عرض الكل' : 'View All'}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </ScrollView>
          </Animated.View>
        )}

        {/* Chassis Search Results */}
        {selectorState === 'chassis_search' && (
          <Animated.View style={[styles.chassisResultsContainer, gridStyle]}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.chassisResultsScroll}
            >
              {chassisFilteredModels.length === 0 ? (
                <View style={styles.chassisEmptyState}>
                  <MaterialCommunityIcons name="car-off" size={40} color={colors.textSecondary} />
                  <Text style={[styles.chassisEmptyText, { color: colors.textSecondary }]}>
                    {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
                  </Text>
                </View>
              ) : (
                chassisFilteredModels.slice(0, 10).map((model, index) => (
                  <ChassisModelCard key={model.id} model={model} index={index} />
                ))
              )}
            </ScrollView>
          </Animated.View>
        )}
      </Animated.View>

      {/* Products Floating Panel with Glassmorphism */}
      <Animated.View
        style={[
          styles.productsPanel,
          productsPanelStyle,
        ]}
      >
        {/* Glassmorphism Background */}
        <BlurView
          intensity={isDark ? 50 : 70}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)' }]} />

        {/* Header with gradient glow */}
        <LinearGradient
          colors={[
            mood?.primary + '30' || colors.primary + '20',
            'transparent',
          ]}
          style={styles.productsPanelHeaderGradient}
        >
          <View style={[styles.productsPanelHeader, { borderBottomColor: mood?.primary + '30' }]}>
            <TouchableOpacity
              style={[styles.backButton, { 
                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderColor: mood?.primary + '40',
              }]}
              onPress={handleBackToModels}
            >
              <Ionicons
                name={isRTL ? 'chevron-forward' : 'chevron-back'}
                size={24}
                color={mood?.primary || colors.text}
              />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {selectedModel ? getName(selectedModel) : ''}
              </Text>
              <View style={styles.headerSubtitleRow}>
                <View style={[styles.productCountBadge, { backgroundColor: mood?.primary + '25' }]}>
                  <Text style={[styles.headerSubtitle, { color: mood?.primary || colors.primary }]}>
                    {filteredProducts.length} {language === 'ar' ? 'منتج' : 'products'}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.closeButton, { 
                backgroundColor: colors.error + '20',
                borderColor: colors.error + '40',
              }]}
              onPress={() => {
                triggerHaptic('light');
                setSelectorState('collapsed');
              }}
            >
              <Ionicons name="close" size={24} color={colors.error} />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Search & Filters */}
        <View style={[styles.filtersRow, { 
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
          borderBottomColor: mood?.primary + '20',
        }]}>
          <View style={[styles.searchBox, { 
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', 
            borderColor: mood?.primary + '50',
          }]}>
            <Ionicons name="search" size={18} color={mood?.primary || colors.primary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
              placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {(['all', 'low', 'medium', 'high'] as const).map((filter) => {
              const isActive = priceFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: isActive ? mood?.primary || colors.primary : 'transparent',
                      borderColor: isActive ? mood?.primary || colors.primary : mood?.primary + '50',
                    },
                  ]}
                  onPress={() => {
                    triggerHaptic('selection');
                    setPriceFilter(filter);
                  }}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: isActive ? '#FFF' : colors.text },
                    ]}
                  >
                    {filter === 'all'
                      ? language === 'ar' ? 'الكل' : 'All'
                      : filter === 'low'
                      ? '<100'
                      : filter === 'medium'
                      ? '100-500'
                      : '>500'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Products Grid */}
        {loadingProducts ? (
          <View style={styles.loadingContainer}>
            <View style={styles.loadingGrid}>
              {[1, 2, 3, 4].map((i) => (
                <ProductCardSkeleton key={i} moodAware />
              ))}
            </View>
          </View>
        ) : filteredProducts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={56} color={mood?.primary + '60'} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'لا توجد منتجات' : 'No products found'}
            </Text>
          </View>
        ) : (
          <View style={styles.flashListContainer}>
            <FlashList
              data={filteredProducts.slice(0, 9)}
              numColumns={3}
              keyExtractor={(item: Product) => item.id}
              estimatedItemSize={170}
              contentContainerStyle={styles.productsGrid}
              renderItem={({ item, index }: { item: Product; index: number }) => (
                <ProductCardItem
                  item={item}
                  index={index}
                  isDark={isDark}
                  mood={mood}
                  colors={colors}
                  language={language}
                  onPress={handleProductPress}
                />
              )}
            />
          </View>
        )}
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 2,
    zIndex: 1000,
    overflow: 'hidden',
  },
  neonBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    shadowOffset: { width: 0, height: 0 },
  },
  anchorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  anchorRowRTL: {
    flexDirection: 'row-reverse',
  },
  anchorButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  hintContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dualHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  hintTouchable: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  hintText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  hintDivider: {
    width: 1,
    height: 20,
    opacity: 0.5,
  },
  hintChevron: {
    shadowOffset: { width: 0, height: 0 },
  },
  breadcrumb: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breadcrumbRTL: {
    flexDirection: 'row-reverse',
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  breadcrumbLogo: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  breadcrumbText: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Chassis Search Styles
  chassisSearchContainer: {
    flex: 1,
    paddingHorizontal: 4,
  },
  chassisSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 10,
  },
  chassisSearchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  chassisResultsContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  chassisResultsScroll: {
    paddingBottom: 12,
  },
  chassisModelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  chassisModelImage: {
    width: 60,
    height: 45,
    borderRadius: 8,
  },
  chassisModelPlaceholder: {
    width: 60,
    height: 45,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chassisModelInfo: {
    flex: 1,
    gap: 2,
  },
  chassisModelName: {
    fontSize: 14,
    fontWeight: '600',
  },
  chassisModelBrand: {
    fontSize: 12,
    fontWeight: '500',
  },
  chassisTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
    marginTop: 2,
  },
  chassisTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  chassisModelYear: {
    fontSize: 11,
    marginTop: 2,
  },
  chassisEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 10,
  },
  chassisEmptyText: {
    fontSize: 14,
  },
  gridContainer: {
    paddingBottom: 12,
  },
  gridScroll: {
    paddingHorizontal: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 10,
    paddingHorizontal: 4,
  },
  gridItem: {
    width: (SCREEN_WIDTH - 40) / 3.5,
    minWidth: 95,
    maxWidth: 130,
    height: 135,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    padding: 6,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  viewAllItem: {
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  brandLogo: {
    width: 75,
    height: 75,
    borderRadius: 14,
  },
  modelImage: {
    width: 85,
    height: 65,
    borderRadius: 12,
  },
  placeholderIcon: {
    width: 90,
    height: 90,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  gridItemText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
    textAlign: 'center',
  },
  gridItemSubtext: {
    fontSize: 10,
    marginTop: 3,
    fontWeight: '500',
  },
  productsPanel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
  },
  productsPanelHeaderGradient: {
    paddingTop: 50,
  },
  productsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerSubtitleRow: {
    marginTop: 4,
  },
  productCountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  filtersRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  filterChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1.5,
    marginRight: 10,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    padding: 12,
  },
  loadingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  flashListContainer: {
    flex: 1,
    minHeight: 300,
  },
  productsGrid: {
    padding: 12,
  },
  productCardWrapper: {
    width: '50%',
    padding: 6,
  },
  productCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  productImage: {
    width: '100%',
    height: 115,
  },
  productImagePlaceholder: {
    width: '100%',
    height: 115,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    minHeight: 36,
  },
  priceTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default InteractiveCarSelector;
