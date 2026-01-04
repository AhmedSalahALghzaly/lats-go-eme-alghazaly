import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated } from 'react-native';
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
  };
  onAddToCart?: (quantity: number) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const { colors } = useTheme();
  const { t, language, isRTL } = useTranslation();
  const router = useRouter();
  const { user } = useAppStore();
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [cartLoading, setCartLoading] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);
  
  // Animation refs
  const priceScaleAnim = useRef(new Animated.Value(1)).current;
  const quantityBounceAnim = useRef(new Animated.Value(1)).current;

  // Check if product is in favorites when user is logged in
  useEffect(() => {
    const checkFavorite = async () => {
      if (user && product.id) {
        try {
          const response = await favoritesApi.check(product.id);
          setIsFavorite(response.data.is_favorite);
        } catch (error) {
          console.error('Error checking favorite:', error);
        }
      }
    };
    checkFavorite();
  }, [user, product.id]);

  const getName = () => {
    return language === 'ar' && product.name_ar ? product.name_ar : product.name;
  };

  // Calculate total price based on quantity
  const totalPrice = product.price * quantity;

  const formatPrice = (price: number) => {
    return `${price.toFixed(2)} ج.م`;
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    setFavoriteLoading(true);
    try {
      const response = await favoritesApi.toggle(product.id);
      setIsFavorite(response.data.is_favorite);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!onAddToCart) return;
    
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    setCartLoading(true);
    setAddedToCart(true);
    
    try {
      await onAddToCart(quantity);
      // Reset added state after animation
      setTimeout(() => setAddedToCart(false), 1500);
    } catch (error) {
      console.error('Error adding to cart:', error);
      setAddedToCart(false);
    } finally {
      setCartLoading(false);
    }
  };

  const handleIncreaseQuantity = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuantity(prev => prev + 1);
    
    // Animate quantity badge
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

    // Animate price
    animatePrice();
  };

  const handleDecreaseQuantity = () => {
    if (quantity > 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setQuantity(prev => prev - 1);
      
      // Animate quantity badge
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

      // Animate price
      animatePrice();
    }
  };

  const animatePrice = () => {
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
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      onPress={() => router.push(`/product/${product.id}`)}
      activeOpacity={0.7}
    >
      <View style={[styles.imageContainer, { backgroundColor: colors.surface }]}>
        {product.image_url ? (
          <Image
            source={{ uri: product.image_url }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="cube-outline" size={48} color={colors.textSecondary} />
        )}
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
          {getName()}
        </Text>
        
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
            {formatPrice(totalPrice)}
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

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    width: 160,
    margin: 6,
  },
  imageContainer: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  content: {
    padding: 10,
  },
  name: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 8,
    height: 34,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    gap: 6,
  },
  quantityRowRTL: {
    flexDirection: 'row-reverse',
  },
  quantityButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  quantityBadge: {
    minWidth: 28,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
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
    width: 30,
    height: 30,
    borderRadius: 15,
  },
});
