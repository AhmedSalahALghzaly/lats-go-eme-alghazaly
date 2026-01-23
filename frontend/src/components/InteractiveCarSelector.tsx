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
  // New chassis barcode animation values
  const barcodeScanAnim = useSharedValue(0);
  const chassisPulseAnim = useSharedValue(1);
  const chassisGlowIntensity = useSharedValue(0.4);

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
    let morphInterval: ReturnType<typeof setInterval> | null = null;
    
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
  }, [selectorState, morphProgress, carIconGlow]);

  // Chassis number animation - shifting VIN characters with electric blue glow
  useEffect(() => {
    let vinInterval: ReturnType<typeof setInterval> | null = null;
    
    if (selectorState === 'collapsed') {
      vinInterval = setInterval(() => {
        setCurrentVinIndex((prev) => (prev + 1) % VIN_CHARS.length);
        vinShiftAnim.value = withSequence(
          withTiming(1, { duration: 100 }),
          withTiming(0, { duration: 100 })
        );
      }, 800);
      
      // Enhanced chassis glow animation - Electric blue pulsing
      chassisIconGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 800 }),
          withTiming(0.3, { duration: 800 })
        ),
        -1,
        true
      );
      
      // Barcode scan line animation - continuous sweep
      barcodeScanAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500 }),
          withTiming(0, { duration: 0 })
        ),
        -1,
        false
      );
      
      // Chassis button pulse animation
      chassisPulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
      
      // Glow intensity variation
      chassisGlowIntensity.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: 1200 }),
          withTiming(0.4, { duration: 1200 })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(chassisIconGlow);
      cancelAnimation(barcodeScanAnim);
      cancelAnimation(chassisPulseAnim);
      cancelAnimation(chassisGlowIntensity);
      chassisIconGlow.value = withTiming(0.8, { duration: 300 });
      chassisPulseAnim.value = withTiming(1, { duration: 200 });
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
    shadowOpacity: interpolate(chassisIconGlow.value, [0, 1], [0.4, 1]),
    shadowRadius: interpolate(chassisIconGlow.value, [0, 1], [6, 20]),
    // Removed scale animation as per user request
  }));

  const vinAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(vinShiftAnim.value, [0, 0.5, 1], [1, 0.85, 1]),
    // Simple subtle animation without scale
  }));

  const morphStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morphProgress.value, [0, 0.5, 1], [1, 0.5, 1]),
    transform: [
      { scale: interpolate(morphProgress.value, [0, 0.5, 1], [1, 0.85, 1]) },
    ],
  }));

  const containerHeight = useAnimatedStyle(() => ({
    height: interpolate(expandAnim.value, [0, 1], [70, SCREEN_HEIGHT * 0.35], Extrapolation.CLAMP),
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

  // Chassis Model Card Component - Grid Style matching car models grid
  const ChassisModelGridCard = ({ model, index }: { model: CarModel; index: number }) => {
    const itemScale = useSharedValue(1);
    const glowAnim = useSharedValue(0);
    
    const itemAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: itemScale.value }],
    }));

    const itemGlowStyle = useAnimatedStyle(() => ({
      shadowOpacity: interpolate(glowAnim.value, [0, 1], [0, 0.6]),
      shadowRadius: interpolate(glowAnim.value, [0, 1], [0, 12]),
    }));

    const brand = carBrands.find(b => b.id === model.brand_id);

    const handlePress = () => {
      triggerHaptic('selection');
      itemScale.value = withSequence(
        withSpring(0.92, { damping: 10, stiffness: 400 }),
        withSpring(1.02, { damping: 8, stiffness: 300 }),
        withSpring(1, { damping: 12, stiffness: 200 })
      );
      glowAnim.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(0, { duration: 300 })
      );
      
      setTimeout(() => {
        handleModelSelect(model);
      }, 100);
    };

    return (
      <Animated.View
        entering={FadeIn.delay(Math.min(index * 50, 250)).duration(250).springify()}
        layout={Layout.springify()}
        style={[styles.chassisGridCardWrapper, itemAnimatedStyle, itemGlowStyle]}
      >
        <TouchableOpacity
          style={[
            styles.chassisGridCard,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)',
              borderColor: mood?.primary + '40',
              shadowColor: mood?.primary || colors.primary,
            },
          ]}
          onPress={handlePress}
          activeOpacity={0.85}
        >
          {/* Model Image */}
          {model.image_url ? (
            <Image
              source={{ uri: model.image_url }}
              style={styles.chassisGridCardImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={[styles.chassisGridCardPlaceholder, { backgroundColor: mood?.primary + '15' }]}>
              <MaterialCommunityIcons name="car-side" size={36} color={mood?.primary || colors.primary} />
            </View>
          )}
          
          {/* Card Info - Centered */}
          <View style={styles.chassisGridCardInfo}>
            {/* 1. Model Name */}
            <Text style={[styles.chassisGridCardName, { color: colors.text, textAlign: 'center' }]} numberOfLines={1}>
              {getName(model)}
            </Text>
            
            {/* 2. Year */}
            {model.year_start && (
              <Text style={[styles.chassisGridCardYear, { color: colors.textSecondary, textAlign: 'center' }]}>
                {model.year_start}{model.year_end ? ` - ${model.year_end}` : '+'}
              </Text>
            )}
            
            {/* 3. Brand Name */}
            {brand && (
              <Text style={[styles.chassisGridCardBrand, { color: mood?.primary || colors.primary, textAlign: 'center' }]} numberOfLines={1}>
                {getName(brand)}
              </Text>
            )}
            
            {/* 4. Chassis Number Tag */}
            {model.chassis_number && (
              <View style={[styles.chassisGridTag, { backgroundColor: mood?.primary + '20' }]}>
                <Ionicons name="key-outline" size={8} color={mood?.primary || colors.primary} />
                <Text style={[styles.chassisGridTagText, { color: mood?.primary || colors.primary }]} numberOfLines={1}>
                  {model.chassis_number}
                </Text>
              </View>
            )}
          </View>
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

        {/* Dual Anchor Button Row - Chassis on LEFT, Car on RIGHT */}
        <View style={styles.anchorRow}>
          {/* LEFT Button: Chassis Selector - Modern VIN Icon */}
          <AnimatedTouchable
            style={[
              styles.anchorButton,
              {
                backgroundColor: selectorState === 'chassis_search'
                  ? mood?.primary || colors.primary
                  : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderColor: mood?.primary || colors.primary,
                shadowColor: mood?.primary || colors.primary,
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
                  name="card-text-outline"
                  size={24}
                  color={mood?.primary || colors.primary}
                />
              )}
            </Animated.View>
          </AnimatedTouchable>

          {/* Center Content - Hints or Breadcrumbs */}
          {selectorState === 'collapsed' ? (
            <Animated.View 
              style={styles.hintContainer} 
              entering={FadeIn.duration(300)} 
              exiting={FadeOut.duration(200)}
            >
              <View style={styles.dualHintRow}>
                {/* Left text - always "رقم الشاسيه" in Arabic */}
                <TouchableOpacity style={styles.hintTouchable} onPress={handleChassisAnchorPress}>
                  <Text style={[styles.hintText, { color: colors.text }]}>
                    {language === 'ar' ? 'رقم الشاسيه' : 'Chassis No.'}
                  </Text>
                </TouchableOpacity>
                <View style={[styles.hintDivider, { backgroundColor: colors.border }]} />
                {/* Right text - always "اختر سيارتك" in Arabic */}
                <TouchableOpacity style={styles.hintTouchable} onPress={handleCarAnchorPress}>
                  <Text style={[styles.hintText, { color: colors.text }]}>
                    {language === 'ar' ? 'اختر سيارتك' : 'Choose Car'}
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

          {/* RIGHT Button: Car Selector */}
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

        {/* Chassis Search Results - Grid Layout with FlashList */}
        {selectorState === 'chassis_search' && (
          <Animated.View style={[styles.chassisResultsContainer, gridStyle]}>
            {chassisFilteredModels.length === 0 ? (
              <View style={styles.chassisEmptyState}>
                <MaterialCommunityIcons name="car-off" size={40} color={colors.textSecondary} />
                <Text style={[styles.chassisEmptyText, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
                </Text>
              </View>
            ) : (
              <FlashList
                data={chassisFilteredModels.slice(0, 12)}
                numColumns={3}
                keyExtractor={(item: CarModel) => item.id}
                estimatedItemSize={160}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.chassisGridContainer}
                renderItem={({ item, index }: { item: CarModel; index: number }) => (
                  <ChassisModelGridCard model={item} index={index} />
                )}
              />
            )}
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
              estimatedItemSize={190}
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
    shadowRadius: 5,
  },
  hintContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dualHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  dualHintRowRTL: {
    flexDirection: 'row-reverse',
  },
  hintTouchable: {
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  hintText: {
    fontSize: 15,
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
    gap: 7,
  },
  breadcrumbRTL: {
    flexDirection: 'row-reverse',
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 17,
    borderWidth: 1,
    gap: 5,
  },
  breadcrumbLogo: {
    width: 19,
    height: 19,
    borderRadius: 3,
  },
  breadcrumbText: {
    fontSize: 13,
    fontWeight: '700',
  },
  // Chassis Search Styles
  chassisSearchContainer: {
    flex: 1,
    paddingHorizontal: 3,
  },
  chassisSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 13,
    borderWidth: 1.5,
    gap: 10,
  },
  chassisSearchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  chassisResultsContainer: {
    flex: 1,
    paddingHorizontal: 9,
  },
  chassisResultsScroll: {
    paddingBottom: 7,
  },
  chassisModelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    borderRadius: 15,
    borderWidth: 1.5,
    marginBottom: 5,
    gap: 11,
  },
  chassisModelImage: {
    width: 70,
    height: 50,
    borderRadius: 7,
  },
  chassisModelPlaceholder: {
    width: 70,
    height: 50,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chassisModelInfo: {
    flex: 1,
    gap: 1.5,
  },
  chassisModelName: {
    fontSize: 15,
    fontWeight: '700',
  },
  chassisModelBrand: {
    fontSize: 15,
    fontWeight: '700',
  },
  chassisTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 5,
    gap: 3,
    marginTop: 1.5,
  },
  chassisTagText: {
    fontSize: 13,
    fontWeight: '700',
  },
  chassisModelYear: {
    fontSize: 13,
    marginTop: 1,
  },
  chassisEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 10,
  },
  chassisEmptyText: {
    fontSize: 15,
  },
  // New Grid Card Styles for Chassis Search
  chassisGridContainer: {
    padding: 6,
  },
  chassisGridCardWrapper: {
    width: (SCREEN_WIDTH - 50) / 3.10,
    padding: 1.5,
    height: 190,
  },
  chassisGridCard: {
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 1.5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
    height: '100%',
  },
  chassisGridCardImage: {
    width: '100%',
    height: 100,
    backgroundColor: 'transparent',
  },
  chassisGridCardPlaceholder: {
    width: '100%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chassisGridCardInfo: {
    padding: 3,
    paddingTop: 1,
    gap: 0,
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  chassisGridCardName: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 13,
    textAlign: 'center',
  },
  chassisGridCardBrand: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  chassisGridCardYear: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  chassisGridTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    gap: 1,
    marginTop: 1,
  },
  chassisGridTagText: {
    fontSize: 7,
    fontWeight: '600',
  },
  gridContainer: {
    paddingBottom: 11,
  },
  gridScroll: {
    paddingHorizontal: 11,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 10,
    paddingHorizontal: 4,
  },
  gridItem: {
    width: (SCREEN_WIDTH - 50) / 3.10,
    minWidth: 130,
    maxWidth: 150,
    height: 190,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.3,
    padding: 7,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
  },
  viewAllItem: {
    borderWidth: 3,
    borderStyle: 'dashed',
  },
  brandLogo: {
    width: 95,
    height: 95,
    borderRadius: 15,
  },
  modelImage: {
    width: 95,
    height: 95,
    borderRadius: 15,
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
    fontSize: 15,
    fontWeight: '700',
    marginTop: 1,
    textAlign: 'center',
  },
  gridItemSubtext: {
    fontSize: 11,
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
    paddingHorizontal: 17,
    paddingVertical: 13,
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
