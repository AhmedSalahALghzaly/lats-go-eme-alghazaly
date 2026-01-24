/**
 * Interactive Car Selector - Rebuilt with FlashList & React Query
 * Features: Morphing vehicle icons, Glassmorphism UI, haptic feedback,
 * Image-based selection, stable cross-platform animations
 * Architecture: FlashList for lists, stable animations (no FadeIn)
 */
import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
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
} from 'react-native-reanimated';

import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore, useColorMood } from '../store/appStore';
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
  }), []);

  const getName = (i: { name: string; name_ar?: string }) =>
    language === 'ar' ? (i.name_ar || i.name) : i.name;

  const brand = item as CarBrand;
  const model = item as CarModel;
  const hasImage = isBrand ? (brand.logo_url || brand.logo) : model.image_url;

  const handlePressIn = () => {
    scale.value = withSpring(0.92, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    onPress(item, isBrand);
  };

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
              size={isBrand ? 42 : 49} // Scaled by 1.75: 24*1.75=42, 28*1.75=49
              color={moodPrimary || colorsPrimary}
            />
          </View>
        )}
        <Text style={[styles.gridItemText, { color: colorsText }]} numberOfLines={1}>
          {getName(item)}
        </Text>
        {!isBrand && model.year_start && (
          <Text style={[styles.gridItemSubtext, { color: moodPrimary || colorsTextSecondary }]}>
            {model.year_start}{model.year_end ? ` - ${model.year_end}` : '+'}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
});

// ============================================================================
// MEMOIZED CHASSIS MODEL CARD COMPONENT - For Chassis Search FlashList
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
  }), []);

  const getName = (i: { name: string; name_ar?: string }) =>
    language === 'ar' ? (i.name_ar || i.name) : i.name;

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    onPress(model);
  };

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
            {getName(model)}
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
});

// ============================================================================
// MEMOIZED PRODUCT CARD COMPONENT - For Products FlashList
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
  }), []);

  const getName = (i: { name: string; name_ar?: string }) =>
    language === 'ar' ? (i.name_ar || i.name) : i.name;

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
  };

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
        onPress={() => onPress(item.id)}
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
            {getName(item)}
          </Text>
          <View style={[styles.priceTag, { backgroundColor: (moodPrimary || '#009688') + '20' }]}>
            <Text style={[styles.priceText, { color: moodPrimary || colorsPrimary }]}>
              {item.price?.toFixed(2)} {language === 'ar' ? 'ج.م' : 'EGP'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================
export const InteractiveCarSelector: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { language, isRTL } = useTranslation();
  const router = useRouter();
  const mood = useColorMood();
  const moodPrimary = mood?.primary || colors.primary;

  // Store data
  const carBrands = useAppStore((state) => state.carBrands);
  const carModels = useAppStore((state) => state.carModels);

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

  // Animation values - defined once, never recreated
  const containerHeight = useSharedValue(70);
  const gridOpacity = useSharedValue(0);
  const productsSlideAnim = useSharedValue(SCREEN_HEIGHT);
  const carIconScale = useSharedValue(1);
  const carIconGlow = useSharedValue(0.5);
  const chassisIconGlow = useSharedValue(0.5);
  // New: Rotation animation for car icon anchor (720 degrees = 2 full rotations)
  const carIconRotation = useSharedValue(0);

  // Current vehicle icon
  const currentIcon = VEHICLE_ICONS[currentIconIndex];

  // ============================================================================
  // ICON CYCLING ANIMATION (Stable - no reanimated in interval)
  // ============================================================================
  useEffect(() => {
    let morphInterval: ReturnType<typeof setInterval> | null = null;
    
    if (selectorState === 'collapsed') {
      morphInterval = setInterval(() => {
        setCurrentIconIndex((prev) => (prev + 1) % VEHICLE_ICONS.length);
      }, 3000);
    }
    
    return () => {
      if (morphInterval) clearInterval(morphInterval);
    };
  }, [selectorState]);

  // VIN character cycling
  useEffect(() => {
    let vinInterval: ReturnType<typeof setInterval> | null = null;
    
    if (selectorState === 'collapsed') {
      vinInterval = setInterval(() => {
        setCurrentVinIndex((prev) => (prev + 1) % VIN_CHARS.length);
      }, 1200);
    }
    
    return () => {
      if (vinInterval) clearInterval(vinInterval);
    };
  }, [selectorState]);

  // ============================================================================
  // EXPAND/COLLAPSE ANIMATIONS (Single consolidated effect)
  // ============================================================================
  useEffect(() => {
    // Calculate 35% screen height for expanded states
    const expandedHeight = Math.round(SCREEN_HEIGHT * 0.35);
    const chassisExpandedHeight = Math.round(SCREEN_HEIGHT * 0.40); // Slightly taller for chassis search
    
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
        // Use 35% screen height for expanded brands/models view
        containerHeight.value = withSpring(expandedHeight, { damping: 15 });
        gridOpacity.value = withTiming(1, { duration: 300 });
        carIconScale.value = withSpring(1.1, { damping: 12 });
        carIconGlow.value = withTiming(0.8, { duration: 300 });
        productsSlideAnim.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
        break;
      case 'chassis_search':
        // Use slightly more height for chassis search with grid results
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
  // ANIMATED STYLES
  // ============================================================================
  const containerStyle = useAnimatedStyle(() => ({
    height: containerHeight.value,
  }), []);

  const gridStyle = useAnimatedStyle(() => ({
    opacity: gridOpacity.value,
  }), []);

  const carIconStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: carIconScale.value },
      { rotate: `${carIconRotation.value}deg` }
    ],
    shadowOpacity: interpolate(carIconGlow.value, [0, 1], [0.2, 0.6], Extrapolation.CLAMP),
    shadowRadius: interpolate(carIconGlow.value, [0, 1], [4, 12], Extrapolation.CLAMP),
  }), []);

  const chassisIconStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(chassisIconGlow.value, [0, 1], [0.2, 0.6], Extrapolation.CLAMP),
    shadowRadius: interpolate(chassisIconGlow.value, [0, 1], [4, 12], Extrapolation.CLAMP),
  }), []);

  const productsPanelStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: productsSlideAnim.value }],
  }), []);

  // ============================================================================
  // DATA HELPERS
  // ============================================================================
  const getName = useCallback((item: { name: string; name_ar?: string }) =>
    language === 'ar' ? (item.name_ar || item.name) : item.name, [language]);

  const displayBrands = useMemo(() => 
    carBrands.slice(0, 9), [carBrands]);

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

  // Brand lookup map for chassis cards
  const brandMap = useMemo(() => {
    const map: Record<string, string> = {};
    carBrands.forEach(b => {
      map[b.id] = language === 'ar' ? (b.name_ar || b.name) : b.name;
    });
    return map;
  }, [carBrands, language]);

  // ============================================================================
  // API CALLS - Fixed to use productApi.getAll with car_model_id
  // ============================================================================
  const fetchProductsForModel = useCallback(async (modelId: string) => {
    setLoadingProducts(true);
    try {
      // Use productApi.getAll with car_model_id parameter
      const response = await productApi.getAll({ car_model_id: modelId, limit: 50 });
      // Extract products from axios response - response.data contains the API response
      const productsData = response.data?.products || [];
      setProducts(productsData);
      
      // Trigger success haptic only after successful fetch
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
  // EVENT HANDLERS
  // ============================================================================
  const handleCarAnchorPress = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Trigger 720-degree rotation animation (2 full rotations) with spring bounce effect
    if (selectorState === 'collapsed' || selectorState === 'chassis_search') {
      // Opening animation: rotate 720 degrees with spring
      carIconRotation.value = withSequence(
        withTiming(720, { duration: 600 }),
        withSpring(0, { damping: 8, stiffness: 100, mass: 0.5 })
      );
      setSelectorState('brands');
    } else {
      // Closing animation: rotate -720 degrees with spring
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
  }, [selectorState, carIconRotation]);

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

  // ============================================================================
  // FLASHLIST RENDER ITEMS - Stable references
  // ============================================================================
  const renderGridItem = useCallback(({ item }: { item: CarBrand | CarModel }) => (
    <GridItem
      item={item}
      isBrand={selectorState === 'brands'}
      isDark={isDark}
      moodPrimary={moodPrimary}
      colorsText={colors.text}
      colorsPrimary={colors.primary}
      colorsTextSecondary={colors.textSecondary}
      language={language}
      onPress={handleGridItemPress}
    />
  ), [selectorState, isDark, moodPrimary, colors.text, colors.primary, colors.textSecondary, language, handleGridItemPress]);

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

  // ============================================================================
  // FLASHLIST KEY EXTRACTORS
  // ============================================================================
  const keyExtractor = useCallback((item: { id: string }) => item.id, []);
  const filterKeyExtractor = useCallback((item: PriceFilter) => item, []);

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
        {/* Glassmorphism Background - Enhanced Frosted Glass Effect */}
        <View style={StyleSheet.absoluteFill}>
          <BlurView
            intensity={isDark ? 85 : 90}
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
          {/* Additional frosted overlay for stronger glass effect */}
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
                  <TouchableOpacity onPress={() => setChassisSearchQuery('')}>
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
                backgroundColor: selectorState === 'brands' || selectorState === 'models' || selectorState === 'products' 
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
            <MaterialCommunityIcons
              name={selectorState !== 'collapsed' && selectorState !== 'chassis_search' ? 'close' : currentIcon}
              size={26}
              color={selectorState === 'brands' || selectorState === 'models' || selectorState === 'products' ? '#FFF' : moodPrimary}
            />
          </AnimatedTouchable>
        </View>

        {/* Brands/Models FlashList - Horizontal */}
        {(selectorState === 'brands' || selectorState === 'models') && (
          <Animated.View style={[styles.gridContainer, gridStyle]}>
            <FlashList
              data={selectorState === 'brands' ? displayBrands : filteredModels}
              horizontal
              keyExtractor={keyExtractor}
              renderItem={renderGridItem}
              estimatedItemSize={148} // Updated: 85 * 1.75 ≈ 148 for larger grid items
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalListContent}
              ListFooterComponent={
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
              }
            />
          </Animated.View>
        )}

        {/* Chassis Search Results - Grid FlashList */}
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
                numColumns={3}
                keyExtractor={keyExtractor}
                renderItem={renderChassisItem}
                estimatedItemSize={280} // Updated: 160 * 1.75 = 280 for larger chassis cards
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
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.filterChipsContainer}>
            <FlashList
              data={['all', 'low', 'medium', 'high'] as PriceFilter[]}
              horizontal
              estimatedItemSize={60}
              showsHorizontalScrollIndicator={false}
              keyExtractor={filterKeyExtractor}
              renderItem={({ item: filter }) => {
                const isActive = priceFilter === filter;
                return (
                  <TouchableOpacity
                    style={[
                      styles.filterChip,
                      {
                        backgroundColor: isActive ? moodPrimary : 'transparent',
                        borderColor: isActive ? moodPrimary : moodPrimary + '50',
                      },
                    ]}
                    onPress={() => {
                      if (Platform.OS !== 'web') {
                        Haptics.selectionAsync();
                      }
                      setPriceFilter(filter);
                    }}
                  >
                    <Text style={[styles.filterChipText, { color: isActive ? '#FFF' : colors.text }]}>
                      {filter === 'all'
                        ? language === 'ar' ? 'الكل' : 'All'
                        : filter === 'low' ? '<100' : filter === 'medium' ? '100-500' : '>500'}
                    </Text>
                  </TouchableOpacity>
                );
              }}
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
              data={filteredProducts.slice(0, 9)}
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
    fontSize: 15,
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
  // Grid Styles - Scaled by 75% (1.75x original dimensions)
  gridContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  horizontalListContent: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  gridItemWrapper: {
    marginHorizontal: 6, // Increased from 4
  },
  gridItem: {
    width: 140,  // 80 * 1.75 = 140
    height: 175, // 100 * 1.75 = 175
    borderRadius: 16, // Slightly larger radius
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    padding: 14, // 8 * 1.75 = 14
  },
  viewAllItem: {
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  brandLogo: {
    width: 70,  // 40 * 1.75 = 70
    height: 70, // 40 * 1.75 = 70
    marginBottom: 7, // 4 * 1.75 = 7
  },
  modelImage: {
    width: 88,  // 50 * 1.75 = 87.5 ≈ 88
    height: 61, // 35 * 1.75 = 61.25 ≈ 61
    borderRadius: 7, // 4 * 1.75 = 7
    marginBottom: 7, // 4 * 1.75 = 7
  },
  placeholderIcon: {
    width: 70,  // 40 * 1.75 = 70
    height: 70, // 40 * 1.75 = 70
    borderRadius: 35, // Half of width/height
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  gridItemText: {
    fontSize: 19, // 11 * 1.75 ≈ 19
    fontWeight: '600',
    textAlign: 'center',
  },
  gridItemSubtext: {
    fontSize: 16, // 9 * 1.75 ≈ 16
    fontWeight: '500',
    marginTop: 4, // 2 * 1.75 ≈ 4
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
    paddingHorizontal: 4,
  },
  chassisGridContent: {
    paddingVertical: 8,
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
    width: (SCREEN_WIDTH - 24) / 3, // Keep same column count but items are larger inside
    padding: 6, // Increased from 4
  },
  chassisGridCard: {
    borderRadius: 16, // Increased from 12
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  chassisGridCardImage: {
    width: '100%',
    height: 122, // 70 * 1.75 ≈ 122
  },
  chassisGridCardPlaceholder: {
    width: '100%',
    height: 122, // 70 * 1.75 ≈ 122
    alignItems: 'center',
    justifyContent: 'center',
  },
  chassisGridCardInfo: {
    padding: 14, // 8 * 1.75 = 14
    alignItems: 'center',
  },
  chassisGridCardName: {
    fontSize: 19, // 11 * 1.75 ≈ 19
    fontWeight: '700',
    textAlign: 'center',
  },
  chassisGridCardYear: {
    fontSize: 16, // 9 * 1.75 ≈ 16
    marginTop: 4,
  },
  chassisGridCardBrand: {
    fontSize: 17, // 10 * 1.75 ≈ 17
    fontWeight: '600',
    marginTop: 4,
  },
  chassisGridCardChassisContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7, // 4 * 1.75 = 7
    paddingHorizontal: 10, // 6 * 1.75 ≈ 10
    paddingVertical: 5, // 3 * 1.75 ≈ 5
    borderRadius: 10, // 6 * 1.75 ≈ 10
    marginTop: 7,
  },
  chassisGridCardChassis: {
    fontSize: 14, // 8 * 1.75 = 14
    fontWeight: '600',
  },
  // Products Panel Styles
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
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  productCountBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  filtersRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
