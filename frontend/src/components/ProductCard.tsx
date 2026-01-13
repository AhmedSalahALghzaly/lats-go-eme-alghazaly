import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore } from '../store/appStore';
import { favoritesApi } from '../services/api';
import { AnimatedFavoriteButton, AnimatedCartButton } from './AnimatedIconButton';
import * as Haptics from 'expo-haptics';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    name_ar: string;
    price: number;
    image_url?: string;
    product_brand_id?: string;
    // Enhanced fields for detailed display
    product_brand_name?: string;
    product_brand_name_ar?: string;
    manufacturer_country?: string;
    manufacturer_country_ar?: string;
    sku?: string;
    // Car compatibility fields - format: "Brand Model Year"
    compatible_car_model?: string;
    compatible_car_model_ar?: string;
    compatible_car_brand?: string;
    compatible_car_brand_ar?: string;
    compatible_car_year_from?: number;
    compatible_car_year_to?: number;
    compatible_car_models_count?: number;
  };
  onAddToCart?: (quantity: number) => void;
  cardWidth?: number;
  showDetails?: boolean;
}

// Memoized ProductCard component
const ProductCardComponent: React.FC<ProductCardProps> = ({ 
  product, 
  onAddToCart, 
  cardWidth, 
  showDetails = true 
}) => {
  const { colors } = useTheme();
  const { language, isRTL } = useTranslation();
  const router = useRouter();
  const user = useAppStore(useCallback((state) => state.user, []));
  
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);
  
  // Animation refs
  const priceScaleAnim = useRef(new Animated.Value(1)).current;
  const quantityBounceAnim = useRef(new Animated.Value(1)).current;

  // Memoized computed values
  const displayName = useMemo(() => 
    language === 'ar' && product.name_ar ? product.name_ar : product.name,
    [language, product.name, product.name_ar]
  );

  const brandName = useMemo(() => {
    if (language === 'ar' && product.product_brand_name_ar) {
      return product.product_brand_name_ar;
    }
    return product.product_brand_name || '';
  }, [language, product.product_brand_name, product.product_brand_name_ar]);

  const carModelName = useMemo(() => {
    // Build the full compatibility string: "Brand Model Year-Year" (e.g., "Toyota Corolla 2020-2024")
    const parts: string[] = [];
    
    // Get car brand name
    if (language === 'ar' && product.compatible_car_brand_ar) {
      parts.push(product.compatible_car_brand_ar);
    } else if (product.compatible_car_brand) {
      parts.push(product.compatible_car_brand);
    }
    
    // Get car model name
    if (language === 'ar' && product.compatible_car_model_ar) {
      parts.push(product.compatible_car_model_ar);
    } else if (product.compatible_car_model) {
      parts.push(product.compatible_car_model);
    }
    
    // Add year range if available
    if (product.compatible_car_year_from) {
      if (product.compatible_car_year_to && product.compatible_car_year_to !== product.compatible_car_year_from) {
        parts.push(`${product.compatible_car_year_from}-${product.compatible_car_year_to}`);
      } else {
        parts.push(`${product.compatible_car_year_from}`);
      }
    }
    
    return parts.join(' ');
  }, [language, product.compatible_car_model, product.compatible_car_model_ar, product.compatible_car_brand, product.compatible_car_brand_ar, product.compatible_car_year_from, product.compatible_car_year_to]);

  const countryName = useMemo(() => {
    if (language === 'ar' && product.manufacturer_country_ar) {
      return product.manufacturer_country_ar;
    }
    return product.manufacturer_country || '';
  }, [language, product.manufacturer_country, product.manufacturer_country_ar]);

  const totalPrice = useMemo(() => product.price * quantity, [product.price, quantity]);
  
  const formattedPrice = useMemo(() => `${totalPrice.toFixed(2)} ج.م`, [totalPrice]);

  // Check if product is in favorites
  useEffect(() => {
    let isMounted = true;
    const checkFavorite = async () => {
      if (user && product.id) {
        try {
          const response = await favoritesApi.check(product.id);
          if (isMounted) {
            setIsFavorite(response.data.is_favorite);
          }
        } catch (error) {
          // Silent fail for favorite check
        }
      }
    };
    checkFavorite();
    return () => { isMounted = false; };
  }, [user, product.id]);

  // Memoized handlers
  const handleCardPress = useCallback(() => {
    router.push(`/product/${product.id}`);
  }, [router, product.id]);

  const handleToggleFavorite = useCallback(async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    setFavoriteLoading(true);
    try {
      const response = await favoritesApi.toggle(product.id);
      setIsFavorite(response.data.is_favorite);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setFavoriteLoading(false);
    }
  }, [user, router, product.id]);

  const animatePrice = useCallback(() => {
    Animated.sequence([
      Animated.timing(priceScaleAnim, {
        toValue: 1.15,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.spring(priceScaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [priceScaleAnim]);

  const handleAddToCart = useCallback(async () => {
    if (!onAddToCart) return;
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    setCartLoading(true);
    setAddedToCart(true);
    
    try {
      await onAddToCart(quantity);
      setTimeout(() => setAddedToCart(false), 1500);
    } catch (error) {
      console.error('Error adding to cart:', error);
      setAddedToCart(false);
    } finally {
      setCartLoading(false);
    }
  }, [onAddToCart, quantity]);

  const handleIncreaseQuantity = useCallback(() => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setQuantity(prev => prev + 1);
    
    Animated.sequence([
      Animated.spring(quantityBounceAnim, {
        toValue: 1.3,
        friction: 5,
        tension: 300,
        useNativeDriver: true,
      }),
      Animated.spring(quantityBounceAnim, {
        toValue: 1,
        friction: 5,
        tension: 300,
        useNativeDriver: true,
      }),
    ]).start();

    animatePrice();
  }, [quantityBounceAnim, animatePrice]);

  const handleDecreaseQuantity = useCallback(() => {
    if (quantity > 1) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      setQuantity(prev => prev - 1);
      
      Animated.sequence([
        Animated.spring(quantityBounceAnim, {
          toValue: 0.7,
          friction: 5,
          tension: 300,
          useNativeDriver: true,
        }),
        Animated.spring(quantityBounceAnim, {
          toValue: 1,
          friction: 5,
          tension: 300,
          useNativeDriver: true,
        }),
      ]).start();

      animatePrice();
    }
  }, [quantity, quantityBounceAnim, animatePrice]);

  // Memoized style computations
  const containerStyle = useMemo(() => [
    styles.container,
    {
      backgroundColor: colors.card,
      borderColor: colors.border,
      width: cardWidth || 160,
    },
  ], [colors.card, colors.border, cardWidth]);

  const imageContainerStyle = useMemo(() => [
    styles.imageContainer, 
    { backgroundColor: colors.surface }
  ], [colors.surface]);

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={handleCardPress}
      activeOpacity={0.7}
    >
      {/* Image Container */}
      <View style={imageContainerStyle}>
        {product.image_url ? (
          <Image
            source={{ uri: product.image_url }}
            style={styles.image}
            contentFit="cover"
            backgroundColor="transparent"
            cachePolicy="disk"
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
            placeholderContentFit="contain"
            transition={200}
          />
        ) : (
          <Ionicons name="cube-outline" size={48} color={colors.textSecondary} />
        )}
      </View>
      
      <View style={styles.content}>
        {/* Product Name */}
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
          {displayName}
        </Text>
        
        {/* Product Details Section - Reordered as per requirements */}
        {showDetails && (
          <View style={styles.detailsContainer}>
            {/* 1. Compatible Car Brands */}
            {carModelName ? (
              <View style={[styles.detailRow, isRTL && styles.detailRowRTL]}>
                <Ionicons name="car-sport-outline" size={12} color={colors.success || '#10B981'} />
                <Text style={[styles.detailText, styles.carModelText, { color: colors.success || '#10B981' }]} numberOfLines={1}>
                  {carModelName}
                  {product.compatible_car_models_count && product.compatible_car_models_count > 1 && (
                    ` +${product.compatible_car_models_count - 1}`
                  )}
                </Text>
              </View>
            ) : null}
            
            {/* 2. Product Brand & Country */}
            {brandName ? (
              <View style={[styles.detailRow, isRTL && styles.detailRowRTL]}>
                <Ionicons name="pricetag-outline" size={12} color={colors.primary} />
                <Text style={[styles.detailText, styles.brandText, { color: colors.primary }]} numberOfLines={1}>
                  {brandName}{countryName ? ` • ${countryName}` : ''}
                </Text>
              </View>
            ) : null}
            
            {/* 3. Product SKU */}
            {product.sku ? (
              <View style={[styles.detailRow, isRTL && styles.detailRowRTL]}>
                <Ionicons name="barcode-outline" size={12} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {product.sku}
                </Text>
              </View>
            ) : null}
          </View>
        )}
        
        {/* Quantity Selector Row */}
        <View style={[styles.quantityRow, isRTL && styles.quantityRowRTL]}>
          {/* Minus Button */}
          <TouchableOpacity
            onPress={handleDecreaseQuantity}
            style={[
              styles.quantityButton,
              { 
                backgroundColor: quantity > 1 ? colors.primary + '20' : colors.surface,
                borderColor: quantity > 1 ? colors.primary : colors.border,
              },
            ]}
            disabled={quantity <= 1}
          >
            <Ionicons 
              name="remove" 
              size={14} 
              color={quantity > 1 ? colors.primary : colors.textSecondary} 
            />
          </TouchableOpacity>
          
          {/* Quantity Display */}
          <Animated.View
            style={[
              styles.quantityBadge,
              { 
                backgroundColor: colors.primary,
                transform: [{ scale: quantityBounceAnim }],
              },
            ]}
          >
            <Text style={styles.quantityText}>{quantity}</Text>
          </Animated.View>
          
          {/* Plus Button */}
          <TouchableOpacity
            onPress={handleIncreaseQuantity}
            style={[
              styles.quantityButton,
              { 
                backgroundColor: colors.primary + '20',
                borderColor: colors.primary,
              },
            ]}
          >
            <Ionicons name="add" size={14} color={colors.primary} />
          </TouchableOpacity>
        </View>
        
        {/* Footer with Favorites button, Dynamic Price, and Add to Cart button */}
        <View style={[styles.footer, isRTL && styles.footerRTL]}>
          {/* Animated Favorites Button - Left */}
          <AnimatedFavoriteButton
            isFavorite={isFavorite}
            isLoading={favoriteLoading}
            onPress={handleToggleFavorite}
            size={16}
            style={styles.iconButton}
          />
          
          {/* Dynamic Price - Center */}
          <Animated.Text 
            style={[
              styles.price, 
              { 
                color: colors.primary,
                transform: [{ scale: priceScaleAnim }],
              }
            ]}
          >
            {formattedPrice}
          </Animated.Text>
          
          {/* Animated Add to Cart Button - Right */}
          {onAddToCart && (
            <AnimatedCartButton
              isInCart={addedToCart}
              isLoading={cartLoading}
              onPress={handleAddToCart}
              size={16}
              primaryColor={colors.primary}
              style={styles.iconButton}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Export memoized component with custom comparison
export const ProductCard = React.memo(ProductCardComponent, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.product.id === nextProps.product.id &&
    prevProps.product.price === nextProps.product.price &&
    prevProps.product.image_url === nextProps.product.image_url &&
    prevProps.product.name === nextProps.product.name &&
    prevProps.product.name_ar === nextProps.product.name_ar &&
    prevProps.cardWidth === nextProps.cardWidth &&
    prevProps.showDetails === nextProps.showDetails
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    margin: 6,
  },
  imageContainer: {
    height: 115,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  brandBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  brandBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    padding: 8,
    paddingTop: 6,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    minHeight: 32,
  },
  detailsContainer: {
    marginBottom: 6,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  detailRowRTL: {
    flexDirection: 'row-reverse',
  },
  detailText: {
    fontSize: 10.5, // 5% increase from 10
    flex: 1,
  },
  brandText: {
    fontWeight: '600',
  },
  carModelText: {
    fontWeight: '600',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 8,
  },
  quantityRowRTL: {
    flexDirection: 'row-reverse',
  },
  quantityButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  quantityBadge: {
    minWidth: 28,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  quantityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerRTL: {
    flexDirection: 'row-reverse',
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  iconButton: {
    padding: 4,
  },
});

export default ProductCard;
