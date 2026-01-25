/**
 * Interactive Car Selector - Performance Optimized v2
 * FIXED: Maximum update depth exceeded error
 * 
 * Key Fixes:
 * 1. Isolated icon/VIN cycling into separate memoized components (no parent re-render)
 * 2. Stabilized all FlashList props with proper memoization
 * 3. Extracted theme colors as primitives to prevent reference changes
 * 4. Used refs for animation values that don't need re-renders
 */
import React, { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
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
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';

import { useAppStore } from '../store/appStore';
import { productApi } from '../services/api';
import { ProductCardSkeleton } from './ui/Skeleton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

// Types
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

// ============================================================================
// THEME CONSTANTS - Extracted to avoid object recreation
// ============================================================================
const LIGHT_COLORS = {
  background: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#666666',
  primary: '#2563EB',
  border: '#E5E5E5',
  error: '#EF4444',
};

const DARK_COLORS = {
  background: '#0F172A',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  primary: '#3B82F6',
  border: '#334155',
  error: '#EF4444',
};

// ============================================================================
// ISOLATED MORPHING ICON COMPONENT - Prevents parent re-renders
// ============================================================================
interface MorphingIconProps {
  isActive: boolean;
  moodPrimary: string;
}

const MorphingIcon = memo<MorphingIconProps>(({ isActive, moodPrimary }) => {
  const [iconIndex, setIconIndex] = useState(0);
  
  useEffect(() => {
    if (!isActive) {
      const interval = setInterval(() => {
        setIconIndex((prev) => (prev + 1) % VEHICLE_ICONS.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isActive]);
  
  const currentIcon = VEHICLE_ICONS[iconIndex];
  
  return (
    <MaterialCommunityIcons
      name={isActive ? 'close' : currentIcon}
      size={26}
      color={isActive ? '#FFF' : moodPrimary}
    />
  );
});

// ============================================================================
// MEMOIZED GRID ITEM COMPONENT - For Brands & Models FlashList
// ============================================================================
interface GridItemProps {
  item: CarBrand | CarModel;
  isBrand: boolean;
  isDark: boolean;
  moodPrimary: string;
  colorsText: string;
  colorsPrimary: string;
  colorsTextSecondary: string;
  language: string;
  onPress: (item: CarBrand | CarModel, isBrand: boolean) => void;
}

const GridItem = memo<GridItemProps>(({
  item,
  isBrand,
  isDark,
  moodPrimary,
  colorsText,
  colorsPrimary,
  colorsTextSecondary,
  language,
  onPress,
}) => {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const displayName = useMemo(() => 
    language === 'ar' ? (item.name_ar || item.name) : item.name,
    [language, item.name, item.name_ar]
  );

  const brand = item as CarBrand;
  const model = item as CarModel;
  const hasImage = isBrand ? (brand.logo_url || brand.logo) : model.image_url;

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 300 });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  }, []);

  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    onPress(item, isBrand);
  }, [item, isBrand, onPress]);

  return (
    <Animated.View style={[styles.gridItemWrapper, animatedStyle]}>
      <TouchableOpacity
        style={[
          styles.gridItem,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)',
            borderColor: moodPrimary + '40',
          },
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {hasImage ? (
          <Image
            source={{ uri: isBrand ? (brand.logo_url || brand.logo) : model.image_url }}
            style={isBrand ? styles.brandLogo : styles.modelImage}
            contentFit="contain"
            cachePolicy="disk"
            transition={150}
          />
        ) : (
          <View style={[styles.placeholderIcon, { backgroundColor: moodPrimary + '20' }]}>
            <MaterialCommunityIcons
              name={isBrand ? 'car' : 'car-side'}
              size={isBrand ? 42 : 49}
              color={moodPrimary || colorsPrimary}
            />
          </View>
        )}
        <Text style={[styles.gridItemText, { color: colorsText }]} numberOfLines={1}>
          {displayName}
        </Text>
        {!isBrand && model.year_start && (
          <Text style={[styles.gridItemSubtext, { color: moodPrimary || colorsTextSecondary }]}>
            {model.year_start}{model.year_end ? ` - ${model.year_end}` : '+'}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for better memoization
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.isBrand === nextProps.isBrand &&
    prevProps.isDark === nextProps.isDark &&
    prevProps.moodPrimary === nextProps.moodPrimary &&
    prevProps.language === nextProps.language
  );
});

// ============================================================================
// MEMOIZED CHASSIS MODEL CARD COMPONENT
// ============================================================================
interface ChassisCardProps {
  model: CarModel;
  brandName: string;
  isDark: boolean;
  moodPrimary: string;
  colorsText: string;
  colorsPrimary: string;
  colorsTextSecondary: string;
  language: string;
  onPress: (model: CarModel) => void;
}

const ChassisModelCard = memo<ChassisCardProps>(({
  model,
  brandName,
  isDark,
  moodPrimary,
  colorsText,
  colorsPrimary,
  colorsTextSecondary,
  language,
  onPress,
}) => {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const displayName = useMemo(() =>
    language === 'ar' ? (model.name_ar || model.name) : model.name,
    [language, model.name, model.name_ar]
  );

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  }, []);

  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    onPress(model);
  }, [model, onPress]);

  return (
    <Animated.View style={[styles.chassisGridCardWrapper, animatedStyle]}>
      <TouchableOpacity
        style={[
          styles.chassisGridCard,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.03)',
            borderColor: moodPrimary + '40',
          },
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {model.image_url ? (
          <Image
            source={{ uri: model.image_url }}
            style={styles.chassisGridCardImage}
            contentFit="cover"
            cachePolicy="disk"
            transition={150}
          />
        ) : (
          <View style={[styles.chassisGridCardPlaceholder, { backgroundColor: moodPrimary + '15' }]}>
            <MaterialCommunityIcons name="car-side" size={63} color={moodPrimary || colorsPrimary} />
          </View>
        )}
        
        <View style={styles.chassisGridCardInfo}>
          <Text style={[styles.chassisGridCardName, { color: colorsText }]} numberOfLines={1}>
            {displayName}
          </Text>
          
          {model.year_start && (
            <Text style={[styles.chassisGridCardYear, { color: colorsTextSecondary }]}>
              {model.year_start}{model.year_end ? ` - ${model.year_end}` : '+'}
            </Text>
          )}
          
          {brandName && (
            <Text style={[styles.chassisGridCardBrand, { color: moodPrimary || colorsPrimary }]} numberOfLines={1}>
              {brandName}
            </Text>
          )}
          
          {model.chassis_number && (
            <View style={[styles.chassisGridCardChassisContainer, { backgroundColor: moodPrimary + '15' }]}>
              <MaterialCommunityIcons name="barcode" size={12} color={moodPrimary || colorsPrimary} />
              <Text style={[styles.chassisGridCardChassis, { color: moodPrimary || colorsPrimary }]} numberOfLines={1}>
                {model.chassis_number}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.model.id === nextProps.model.id &&
    prevProps.brandName === nextProps.brandName &&
    prevProps.isDark === nextProps.isDark &&
    prevProps.moodPrimary === nextProps.moodPrimary &&
    prevProps.language === nextProps.language
  );
});

// ============================================================================
// MEMOIZED PRODUCT CARD COMPONENT
// ============================================================================
interface ProductCardProps {
  item: Product;
  isDark: boolean;
  moodPrimary: string;
  colorsText: string;
  colorsPrimary: string;
  colorsTextSecondary: string;
  language: string;
  onPress: (id: string) => void;
}

const ProductCard = memo<ProductCardProps>(({
  item,
  isDark,
  moodPrimary,
  colorsText,
  colorsPrimary,
  colorsTextSecondary,
  language,
  onPress,
}) => {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const displayName = useMemo(() =>
    language === 'ar' ? (item.name_ar || item.name) : item.name,
    [language, item.name, item.name_ar]
  );

  const priceLabel = useMemo(() =>
    `${item.price?.toFixed(2)} ${language === 'ar' ? 'ج.م' : 'EGP'}`,
    [item.price, language]
  );

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  }, []);

  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  return (
    <Animated.View style={[styles.productCardWrapper, animatedStyle]}>
      <TouchableOpacity
        style={[
          styles.productCard,
          { 
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)', 
            borderColor: (moodPrimary || '#009688') + '30',
          },
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        activeOpacity={0.9}
      >
        {item.image_url ? (
          <Image 
            source={{ uri: item.image_url }} 
            style={styles.productImage}
            contentFit="cover"
            cachePolicy="disk"
            transition={150}
          />
        ) : (
          <View style={[styles.productPlaceholder, { backgroundColor: (moodPrimary || '#009688') + '15' }]}>
            <Ionicons name="cube-outline" size={36} color={moodPrimary || colorsTextSecondary} />
          </View>
        )}
        <View style={styles.productInfo}>
          <Text style={[styles.productName, { color: colorsText }]} numberOfLines={2}>
            {displayName}
          </Text>
          <View style={[styles.priceTag, { backgroundColor: (moodPrimary || '#009688') + '20' }]}>
            <Text style={[styles.priceText, { color: moodPrimary || colorsPrimary }]}>
              {priceLabel}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.price === nextProps.item.price &&
    prevProps.isDark === nextProps.isDark &&
    prevProps.moodPrimary === nextProps.moodPrimary &&
    prevProps.language === nextProps.language
  );
});

// ============================================================================
// FILTER CHIP COMPONENT - Isolated to prevent re-renders
// ============================================================================
interface FilterChipProps {
  filter: PriceFilter;
  isActive: boolean;
  moodPrimary: string;
  colorsText: string;
  language: string;
  onPress: (filter: PriceFilter) => void;
}

const FilterChip = memo<FilterChipProps>(({ filter, isActive, moodPrimary, colorsText, language, onPress }) => {
  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    onPress(filter);
  }, [filter, onPress]);

  const label = useMemo(() => {
    if (filter === 'all') return language === 'ar' ? 'الكل' : 'All';
    if (filter === 'low') return '<100';
    if (filter === 'medium') return '100-500';
    return '>500';
  }, [filter, language]);

  return (
    <TouchableOpacity
      style={[
        styles.filterChip,
        {
          backgroundColor: isActive ? moodPrimary : 'transparent',
          borderColor: isActive ? moodPrimary : moodPrimary + '50',
        },
      ]}
      onPress={handlePress}
    >
      <Text style={[styles.filterChipText, { color: isActive ? '#FFF' : colorsText }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export const InteractiveCarSelector: React.FC = () => {
  const router = useRouter();
  
  // Extract primitives from store to avoid object recreation
  const theme = useAppStore((state) => state.theme);
  const language = useAppStore((state) => state.language);
  const isRTL = useAppStore((state) => state.isRTL);
  const currentMood = useAppStore((state) => state.currentMood);
  const carBrands = useAppStore((state) => state.carBrands);
  const carModels = useAppStore((state) => state.carModels);

  // Derived theme values - memoized
  const isDark = theme === 'dark';
  const colors = useMemo(() => isDark ? DARK_COLORS : LIGHT_COLORS, [isDark]);
  const moodPrimary = currentMood?.primary || colors.primary;

  // Local state
  const [selectorState, setSelectorState] = useState<SelectorState>('collapsed');
  const [selectedBrand, setSelectedBrand] = useState<CarBrand | null>(null);
  const [selectedModel, setSelectedModel] = useState<CarModel | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chassisSearchQuery, setChassisSearchQuery] = useState('');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');

  // Animation values - refs to prevent recreation
  const containerHeight = useSharedValue(70);
  const gridOpacity = useSharedValue(0);
  const productsSlideAnim = useSharedValue(SCREEN_HEIGHT);
  const carIconScale = useSharedValue(1);
  const carIconGlow = useSharedValue(0.5);
  const chassisIconGlow = useSharedValue(0.5);
  const carIconRotation = useSharedValue(0);

  // ============================================================================
  // EXPAND/COLLAPSE ANIMATIONS
  // ============================================================================
  useEffect(() => {
    const expandedHeight = Math.round(SCREEN_HEIGHT * 0.30);
    const chassisExpandedHeight = Math.round(SCREEN_HEIGHT * 0.35);
    
    switch (selectorState) {
      case 'collapsed':
        containerHeight.value = withTiming(70, { duration: 250 });
        gridOpacity.value = withTiming(0, { duration: 200 });
        carIconScale.value = withSpring(1, { damping: 12 });
        carIconGlow.value = withTiming(0.5, { duration: 300 });
        chassisIconGlow.value = withTiming(0.5, { duration: 300 });
        productsSlideAnim.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
        break;
      case 'brands':
      case 'models':
        containerHeight.value = withSpring(expandedHeight, { damping: 15 });
        gridOpacity.value = withTiming(1, { duration: 300 });
        carIconScale.value = withSpring(1.1, { damping: 12 });
        carIconGlow.value = withTiming(0.8, { duration: 300 });
        productsSlideAnim.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
        break;
      case 'chassis_search':
        containerHeight.value = withSpring(chassisExpandedHeight, { damping: 15 });
        gridOpacity.value = withTiming(1, { duration: 300 });
        chassisIconGlow.value = withTiming(0.8, { duration: 300 });
        productsSlideAnim.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
        break;
      case 'products':
        productsSlideAnim.value = withSpring(0, { damping: 18 });
        break;
    }
  }, [selectorState]);

  // ============================================================================
  // ANIMATED STYLES - Stable dependencies
  // ============================================================================
  const containerStyle = useAnimatedStyle(() => ({
    height: containerHeight.value,
  }));

  const gridStyle = useAnimatedStyle(() => ({
    opacity: gridOpacity.value,
  }));

  const carIconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: carIconScale.value },
      { rotate: `${carIconRotation.value}deg` }
    ],
    shadowOpacity: interpolate(carIconGlow.value, [0, 1], [0.2, 0.6], Extrapolation.CLAMP),
    shadowRadius: interpolate(carIconGlow.value, [0, 1], [4, 12], Extrapolation.CLAMP),
  }));

  const chassisIconStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(chassisIconGlow.value, [0, 1], [0.2, 0.6], Extrapolation.CLAMP),
    shadowRadius: interpolate(chassisIconGlow.value, [0, 1], [4, 12], Extrapolation.CLAMP),
  }));

  const productsPanelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: productsSlideAnim.value }],
  }));

  // ============================================================================
  // DATA HELPERS - Memoized
  // ============================================================================
  const getName = useCallback((item: { name: string; name_ar?: string }) =>
    language === 'ar' ? (item.name_ar || item.name) : item.name, [language]);

  const displayBrands = useMemo(() => carBrands.slice(0, 9), [carBrands]);

  const filteredModels = useMemo(() => {
    if (!selectedBrand) return [];
    return carModels
      .filter(m => m.brand_id === selectedBrand.id)
      .slice(0, 9);
  }, [carModels, selectedBrand]);

  const chassisFilteredModels = useMemo(() => {
    if (!chassisSearchQuery.trim()) return carModels.slice(0, 12);
    const query = chassisSearchQuery.toLowerCase().trim();
    return carModels.filter(m => 
      m.chassis_number?.toLowerCase().includes(query) ||
      m.name?.toLowerCase().includes(query) ||
      m.name_ar?.includes(query)
    ).slice(0, 12);
  }, [carModels, chassisSearchQuery]);

  const filteredProducts = useMemo(() => {
    let result = [...products];
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(query) ||
        p.name_ar?.includes(query) ||
        p.sku?.toLowerCase().includes(query)
      );
    }
    
    if (priceFilter !== 'all') {
      result = result.filter(p => {
        switch (priceFilter) {
          case 'low': return p.price < 100;
          case 'medium': return p.price >= 100 && p.price <= 500;
          case 'high': return p.price > 500;
          default: return true;
        }
      });
    }
    
    return result;
  }, [products, searchQuery, priceFilter]);

  const brandMap = useMemo(() => {
    const map: Record<string, string> = {};
    carBrands.forEach(b => {
      map[b.id] = language === 'ar' ? (b.name_ar || b.name) : b.name;
    });
    return map;
  }, [carBrands, language]);

  // Sliced products for display
  const displayProducts = useMemo(() => filteredProducts.slice(0, 9), [filteredProducts]);

  // ============================================================================
  // API CALLS
  // ============================================================================
  const fetchProductsForModel = useCallback(async (modelId: string) => {
    setLoadingProducts(true);
    try {
      const response = await productApi.getAll({ car_model_id: modelId, limit: 50 });
      const productsData = response.data?.products || [];
      setProducts(productsData);
      
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // ============================================================================
  // EVENT HANDLERS - Stable callbacks
  // ============================================================================
  const handleCarAnchorPress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    if (selectorState === 'collapsed' || selectorState === 'chassis_search') {
      carIconRotation.value = withSequence(
        withTiming(720, { duration: 600 }),
        withSpring(0, { damping: 8, stiffness: 100, mass: 0.5 })
      );
      setSelectorState('brands');
    } else {
      carIconRotation.value = withSequence(
        withTiming(-720, { duration: 600 }),
        withSpring(0, { damping: 8, stiffness: 100, mass: 0.5 })
      );
      setSelectorState('collapsed');
      setSelectedBrand(null);
      setSelectedModel(null);
      setProducts([]);
      setSearchQuery('');
    }
  }, [selectorState]);

  const handleChassisAnchorPress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (selectorState === 'collapsed' || selectorState === 'brands' || selectorState === 'models') {
      setSelectorState('chassis_search');
      setSelectedBrand(null);
      setSelectedModel(null);
      setSearchQuery('');
    } else {
      setSelectorState('collapsed');
      setChassisSearchQuery('');
    }
  }, [selectorState]);

  const handleGridItemPress = useCallback((item: CarBrand | CarModel, isBrand: boolean) => {
    if (isBrand) {
      setSelectedBrand(item as CarBrand);
      setSelectorState('models');
    } else {
      setSelectedModel(item as CarModel);
      setSelectorState('products');
      fetchProductsForModel((item as CarModel).id);
    }
  }, [fetchProductsForModel]);

  const handleChassisModelPress = useCallback((model: CarModel) => {
    setSelectedModel(model);
    const brand = carBrands.find(b => b.id === model.brand_id);
    if (brand) setSelectedBrand(brand);
    setSelectorState('products');
    fetchProductsForModel(model.id);
  }, [carBrands, fetchProductsForModel]);

  const handleProductPress = useCallback((productId: string) => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    router.push(`/product/${productId}`);
  }, [router]);

  const handleBackToBrands = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectorState('brands');
    setSelectedBrand(null);
    setSelectedModel(null);
    setProducts([]);
  }, []);

  const handleBackToModels = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectorState('models');
    setSelectedModel(null);
    setProducts([]);
  }, []);

  const handleViewAll = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (selectorState === 'brands') {
      router.push('/car-brands');
    } else if (selectedBrand) {
      router.push(`/brand/${selectedBrand.id}`);
    }
    setSelectorState('collapsed');
  }, [selectorState, selectedBrand, router]);

  const handleCloseProducts = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSelectorState('collapsed');
  }, []);

  const handleFilterPress = useCallback((filter: PriceFilter) => {
    setPriceFilter(filter);
  }, []);

  const handleClearChassisSearch = useCallback(() => {
    setChassisSearchQuery('');
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // ============================================================================
  // FLASHLIST RENDER ITEMS - Stable with minimal dependencies
  // ============================================================================
  const isBrandsView = selectorState === 'brands';
  
  const renderGridItem = useCallback(({ item }: { item: CarBrand | CarModel }) => (
    <GridItem
      item={item}
      isBrand={isBrandsView}
      isDark={isDark}
      moodPrimary={moodPrimary}
      colorsText={colors.text}
      colorsPrimary={colors.primary}
      colorsTextSecondary={colors.textSecondary}
      language={language}
      onPress={handleGridItemPress}
    />
  ), [isBrandsView, isDark, moodPrimary, colors.text, colors.primary, colors.textSecondary, language, handleGridItemPress]);

  const renderChassisItem = useCallback(({ item }: { item: CarModel }) => (
    <ChassisModelCard
      model={item}
      brandName={brandMap[item.brand_id] || ''}
      isDark={isDark}
      moodPrimary={moodPrimary}
      colorsText={colors.text}
      colorsPrimary={colors.primary}
      colorsTextSecondary={colors.textSecondary}
      language={language}
      onPress={handleChassisModelPress}
    />
  ), [brandMap, isDark, moodPrimary, colors.text, colors.primary, colors.textSecondary, language, handleChassisModelPress]);

  const renderProductItem = useCallback(({ item }: { item: Product }) => (
    <ProductCard
      item={item}
      isDark={isDark}
      moodPrimary={moodPrimary}
      colorsText={colors.text}
      colorsPrimary={colors.primary}
      colorsTextSecondary={colors.textSecondary}
      language={language}
      onPress={handleProductPress}
    />
  ), [isDark, moodPrimary, colors.text, colors.primary, colors.textSecondary, language, handleProductPress]);

  const renderFilterItem = useCallback(({ item }: { item: PriceFilter }) => (
    <FilterChip
      filter={item}
      isActive={priceFilter === item}
      moodPrimary={moodPrimary}
      colorsText={colors.text}
      language={language}
      onPress={handleFilterPress}
    />
  ), [priceFilter, moodPrimary, colors.text, language, handleFilterPress]);

  // ============================================================================
  // FLASHLIST KEY EXTRACTORS - Stable
  // ============================================================================
  const keyExtractor = useCallback((item: { id: string }) => item.id, []);
  const filterKeyExtractor = useCallback((item: PriceFilter) => item, []);

  // Filter data
  const filterData = useMemo<PriceFilter[]>(() => ['all', 'low', 'medium', 'high'], []);

  // Grid data based on state
  const gridData = selectorState === 'brands' ? displayBrands : filteredModels;

  // Determine if car anchor is active
  const isCarAnchorActive = selectorState === 'brands' || selectorState === 'models' || selectorState === 'products';

  // ============================================================================
  // VIEW ALL FOOTER COMPONENT - Memoized
  // ============================================================================
  const ViewAllFooter = useMemo(() => (
    <TouchableOpacity
      style={[
        styles.gridItem,
        styles.viewAllItem,
        { 
          backgroundColor: moodPrimary + '15', 
          borderColor: moodPrimary,
        },
      ]}
      onPress={handleViewAll}
    >
      <View style={[styles.placeholderIcon, { backgroundColor: moodPrimary + '25' }]}>
        <Ionicons name="grid" size={22} color={moodPrimary} />
      </View>
      <Text style={[styles.gridItemText, { color: moodPrimary, fontWeight: '700' }]}>
        {language === 'ar' ? 'عرض الكل' : 'View All'}
      </Text>
    </TouchableOpacity>
  ), [moodPrimary, language, handleViewAll]);

  // ============================================================================
  // RENDER
  // ============================================================================
  return (
    <>
      {/* Main Selector Container */}
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: isDark ? 'rgba(20,20,20,0.98)' : 'rgba(255,255,255,0.98)',
            borderTopColor: moodPrimary,
          },
          containerStyle,
        ]}
      >
        {/* Glassmorphism Background */}
        <View style={StyleSheet.absoluteFill}>
          <BlurView
            intensity={isDark ? 50 : 70}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[
              moodPrimary + '25',
              'rgba(255,255,255,0.05)',
              moodPrimary + '18'
            ]}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
          <View style={[
            StyleSheet.absoluteFill,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.15)' }
          ]} />
        </View>

        {/* Neon border glow */}
        <View
          style={[
            styles.neonBorder,
            { backgroundColor: moodPrimary, shadowColor: moodPrimary },
          ]}
        />

        {/* Dual Anchor Button Row */}
        <View style={styles.anchorRow}>
          {/* LEFT Button: Chassis Selector */}
          <AnimatedTouchable
            style={[
              styles.anchorButton,
              {
                backgroundColor: selectorState === 'chassis_search'
                  ? moodPrimary
                  : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderColor: moodPrimary,
                shadowColor: moodPrimary,
              },
              chassisIconStyle,
            ]}
            onPress={handleChassisAnchorPress}
            activeOpacity={0.8}
          >
            {selectorState === 'chassis_search' ? (
              <Ionicons name="close" size={26} color="#FFF" />
            ) : (
              <MaterialCommunityIcons
                name="card-text-outline"
                size={24}
                color={moodPrimary}
              />
            )}
          </AnimatedTouchable>

          {/* Center Content */}
          {selectorState === 'collapsed' ? (
            <View style={styles.hintContainer}>
              <View style={styles.dualHintRow}>
                <TouchableOpacity style={styles.hintTouchable} onPress={handleChassisAnchorPress}>
                  <Text style={[styles.hintText, { color: colors.text }]}>
                    {language === 'ar' ? 'رقم الشاسيه' : 'Chassis No.'}
                  </Text>
                </TouchableOpacity>
                <View style={[styles.hintDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity style={styles.hintTouchable} onPress={handleCarAnchorPress}>
                  <Text style={[styles.hintText, { color: colors.text }]}>
                    {language === 'ar' ? 'اختر سيارتك' : 'Choose Car'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : selectorState === 'chassis_search' ? (
            <Animated.View style={[styles.chassisSearchContainer, gridStyle]}>
              <View style={[styles.chassisSearchBox, { 
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', 
                borderColor: moodPrimary + '50',
              }]}>
                <MaterialCommunityIcons name="barcode-scan" size={20} color={moodPrimary} />
                <TextInput
                  style={[styles.chassisSearchInput, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
                  placeholder={language === 'ar' ? 'ابحث برقم الشاسيه أو اسم الموديل...' : 'Search by chassis number or model...'}
                  placeholderTextColor={colors.textSecondary}
                  value={chassisSearchQuery}
                  onChangeText={setChassisSearchQuery}
                  autoCapitalize="characters"
                />
                {chassisSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={handleClearChassisSearch}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </Animated.View>
          ) : (
            <Animated.View style={[styles.breadcrumb, gridStyle, isRTL && styles.breadcrumbRTL]}>
              {selectedBrand && (
                <TouchableOpacity
                  style={[styles.breadcrumbItem, { 
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                    borderColor: moodPrimary + '40',
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
                    <MaterialCommunityIcons name="car" size={14} color={moodPrimary} />
                  )}
                  <Text style={[styles.breadcrumbText, { color: moodPrimary }]}>
                    {getName(selectedBrand)}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={moodPrimary} />
                </TouchableOpacity>
              )}
              {selectedModel && (
                <TouchableOpacity
                  style={[styles.breadcrumbItem, { 
                    backgroundColor: moodPrimary + '25',
                    borderColor: moodPrimary + '60',
                  }]}
                  onPress={handleBackToModels}
                >
                  <Text style={[styles.breadcrumbText, { color: moodPrimary }]}>
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
                backgroundColor: isCarAnchorActive
                  ? moodPrimary 
                  : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderColor: moodPrimary,
                shadowColor: moodPrimary,
              },
              carIconStyle,
            ]}
            onPress={handleCarAnchorPress}
            activeOpacity={0.8}
          >
            <MorphingIcon 
              isActive={isCarAnchorActive} 
              moodPrimary={moodPrimary} 
            />
          </AnimatedTouchable>
        </View>

        {/* Brands/Models FlashList - Horizontal */}
        {(selectorState === 'brands' || selectorState === 'models') && (
          <Animated.View style={[styles.gridContainer, gridStyle]}>
            <FlashList
              data={gridData}
              horizontal
              keyExtractor={keyExtractor}
              renderItem={renderGridItem}
              estimatedItemSize={140}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalListContent}
              ListFooterComponent={ViewAllFooter}
              extraData={isBrandsView}
            />
          </Animated.View>
        )}

        {/* Chassis Search Results */}
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
                data={chassisFilteredModels}
                numColumns={2}
                keyExtractor={keyExtractor}
                renderItem={renderChassisItem}
                estimatedItemSize={220}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.chassisGridContent}
              />
            )}
          </Animated.View>
        )}
      </Animated.View>

      {/* Products Floating Panel */}
      <Animated.View style={[styles.productsPanel, productsPanelStyle]}>
        <BlurView
          intensity={isDark ? 50 : 70}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)' }]} />

        {/* Header */}
        <LinearGradient
          colors={[moodPrimary + '30', 'transparent']}
          style={styles.productsPanelHeaderGradient}
        >
          <View style={[styles.productsPanelHeader, { borderBottomColor: moodPrimary + '30' }]}>
            <TouchableOpacity
              style={[styles.backButton, { 
                backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderColor: moodPrimary + '40',
              }]}
              onPress={handleBackToModels}
            >
              <Ionicons
                name={isRTL ? 'chevron-forward' : 'chevron-back'}
                size={24}
                color={moodPrimary}
              />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                {selectedModel ? getName(selectedModel) : ''}
              </Text>
              <View style={[styles.productCountBadge, { backgroundColor: moodPrimary + '25' }]}>
                <Text style={[styles.headerSubtitle, { color: moodPrimary }]}>
                  {filteredProducts.length} {language === 'ar' ? 'منتج' : 'products'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.closeButton, { 
                backgroundColor: colors.error + '20',
                borderColor: colors.error + '40',
              }]}
              onPress={handleCloseProducts}
            >
              <Ionicons name="close" size={24} color={colors.error} />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Search & Filters */}
        <View style={[styles.filtersRow, { 
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
          borderBottomColor: moodPrimary + '20',
        }]}>
          <View style={[styles.searchBox, { 
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', 
            borderColor: moodPrimary + '50',
          }]}>
            <Ionicons name="search" size={18} color={moodPrimary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text, textAlign: isRTL ? 'right' : 'left' }]}
              placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.filterChipsContainer}>
            <FlashList
              data={filterData}
              horizontal
              estimatedItemSize={60}
              showsHorizontalScrollIndicator={false}
              keyExtractor={filterKeyExtractor}
              renderItem={renderFilterItem}
              extraData={priceFilter}
            />
          </View>
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
            <Ionicons name="cube-outline" size={56} color={moodPrimary + '60'} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'لا توجد منتجات' : 'No products found'}
            </Text>
          </View>
        ) : (
          <View style={styles.flashListContainer}>
            <FlashList
              data={displayProducts}
              numColumns={3}
              keyExtractor={keyExtractor}
              renderItem={renderProductItem}
              estimatedItemSize={190}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.productsGrid}
            />
          </View>
        )}
      </Animated.View>
    </>
  );
};

// ============================================================================
// STYLES
// ============================================================================
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
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  anchorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
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
  hintTouchable: {
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  hintText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  hintDivider: {
    width: 1,
    height: 20,
    opacity: 0.5,
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
  gridContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  horizontalListContent: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  gridItemWrapper: {
    marginHorizontal: 5,
  },
  gridItem: {
    width: 130,
    height: 175,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    padding: 3,
  },
  viewAllItem: {
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  brandLogo: {
    width: 119,
    height: 135,
    marginBottom: 3,
  },
  modelImage: {
    width: 119,
    height: 135,
    borderRadius: 7,
    marginBottom: 1,
  },
  placeholderIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  gridItemText: {
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
  },
  gridItemSubtext: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 5,
  },
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
    paddingHorizontal: 4,
  },
  chassisGridContent: {
    paddingVertical: 7,
  },
  chassisEmptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  chassisEmptyText: {
    fontSize: 14,
    marginTop: 8,
  },
  chassisGridCardWrapper: {
    width: (SCREEN_WIDTH / 2) - 12,
    padding: 3,
  },
  chassisGridCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  chassisGridCardImage: {
    width: '100%',
    height: 135,
  },
  chassisGridCardPlaceholder: {
    width: '100%',
    height: 135,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chassisGridCardInfo: {
    padding: 3,
    alignItems: 'center',
  },
  chassisGridCardName: {
    fontSize: 17,
    fontWeight: '500',
    textAlign: 'center',
  },
  chassisGridCardYear: {
    fontSize: 13,
    marginTop: 4,
  },
  chassisGridCardBrand: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 5,
  },
  chassisGridCardChassisContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginTop: 7,
  },
  chassisGridCardChassis: {
    fontSize: 14,
    fontWeight: '600',
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
    paddingVertical: 5,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    width: 37,
    height: 37,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  closeButton: {
    width: 37,
    height: 37,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  productCountBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  filtersRow: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    gap: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  filterChipsContainer: {
    height: 36,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  flashListContainer: {
    flex: 1,
  },
  productsGrid: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  productCardWrapper: {
    width: (SCREEN_WIDTH - 30) / 3,
    marginHorizontal: 2,
    marginBottom: 12,
  },
  productCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  productImage: {
    width: '100%',
    height: 130,
  },
  productPlaceholder: {
    width: '100%',
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productInfo: {
    padding: 10,
    gap: 6,
  },
  productName: {
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
  priceText: {
    fontSize: 13,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    padding: 16,
  },
  loadingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
});

export default InteractiveCarSelector;
