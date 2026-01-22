import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Animated as RNAnimated,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../../src/components/Header';
import { Footer } from '../../src/components/Footer';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAppStore } from '../../src/store/appStore';
import { productsApi, cartApi, commentsApi, favoritesApi } from '../../src/services/api';
import { AnimatedFavoriteButton, AnimatedCartButton } from '../../src/components/AnimatedIconButton';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withSequence, 
  withTiming,
  interpolate,
  interpolateColor,
  Extrapolation,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

const GOLD_COLOR = '#FFD700';

// Check if user can view entity profiles
const canViewEntityProfile = (userRole?: string, subscriptionStatus?: string): boolean => {
  const allowedRoles = ['owner', 'admin', 'partner', 'subscriber'];
  return allowedRoles.includes(userRole || '') || subscriptionStatus === 'subscriber';
};

interface Comment {
  id: string;
  product_id: string;
  user_id: string;
  user_name: string;
  user_picture?: string;
  text: string;
  rating?: number;
  created_at: string;
  is_owner: boolean;
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t, isRTL, language } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, addToLocalCart } = useAppStore();
  const subscriptionStatus = useAppStore((state) => state.subscriptionStatus);

  // Check if user should see subscribe button (not a subscriber and no pending request)
  const showSubscribeButton = subscriptionStatus === 'none';

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [quantity, setQuantity] = useState(1);
  
  // Image slider state
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [productImages, setProductImages] = useState<string[]>([]);
  
  // Favorites state
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  
  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);
  
  // New comment form
  const [commentText, setCommentText] = useState('');
  const [selectedRating, setSelectedRating] = useState(0);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showCommentForm, setShowCommentForm] = useState(false);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchComments();
      if (user) {
        checkFavoriteStatus();
      }
    }
  }, [id, user]);

  // Set up product images when product is loaded
  useEffect(() => {
    if (product) {
      const images: string[] = [];
      // Add images array first
      if (product.images && product.images.length > 0) {
        images.push(...product.images);
      } 
      // Add image_url if exists and not already in images
      else if (product.image_url && !images.includes(product.image_url)) {
        images.push(product.image_url);
      }
      setProductImages(images);
      setSelectedImageIndex(0);
    }
  }, [product]);

  const fetchProduct = async () => {
    try {
      const response = await productsApi.getById(id as string);
      setProduct(response.data);
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const response = await commentsApi.getProductComments(id as string);
      setComments(response.data.comments || []);
      setAvgRating(response.data.avg_rating);
      setRatingCount(response.data.rating_count || 0);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setCommentsLoading(false);
    }
  };

  const checkFavoriteStatus = async () => {
    try {
      const response = await favoritesApi.check(id as string);
      setIsFavorite(response.data.is_favorite);
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    setFavoriteLoading(true);
    try {
      const response = await favoritesApi.toggle(id as string);
      setIsFavorite(response.data.is_favorite);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert(t('error'));
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    setAddingToCart(true);
    try {
      await cartApi.addItem(product.id, quantity);
      addToLocalCart({ product_id: product.id, quantity: quantity, product });
      Alert.alert('', t('addToCart') + ' ✔', [{ text: 'OK' }]);
      setQuantity(1); // Reset quantity after adding
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert(t('error'));
    } finally {
      setAddingToCart(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!user) {
      router.push('/login');
      return;
    }

    if (!commentText.trim()) {
      Alert.alert(language === 'ar' ? 'يرجى كتابة تعليق' : 'Please enter a comment');
      return;
    }

    setSubmittingComment(true);
    try {
      await commentsApi.addComment(id as string, commentText.trim(), selectedRating > 0 ? selectedRating : undefined);
      setCommentText('');
      setSelectedRating(0);
      setShowCommentForm(false);
      Keyboard.dismiss();
      fetchComments();
      Alert.alert(language === 'ar' ? 'تم إضافة التعليق' : 'Comment added successfully');
    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert(t('error'));
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    Alert.alert(
      language === 'ar' ? 'حذف التعليق' : 'Delete Comment',
      language === 'ar' ? 'هل أنت متأكد من حذف هذا التعليق؟' : 'Are you sure you want to delete this comment?',
      [
        { text: language === 'ar' ? 'إلغاء' : 'Cancel', style: 'cancel' },
        {
          text: language === 'ar' ? 'حذف' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await commentsApi.deleteComment(commentId);
              fetchComments();
            } catch (error) {
              console.error('Error deleting comment:', error);
              Alert.alert(t('error'));
            }
          },
        },
      ]
    );
  };

  const getName = (item: any, field: string = 'name') => {
    const arField = `${field}_ar`;
    return language === 'ar' && item?.[arField] ? item[arField] : item?.[field] || '';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderStars = (rating: number, size: number = 16, interactive: boolean = false, onPress?: (rating: number) => void) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            disabled={!interactive}
            onPress={() => onPress && onPress(star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={size}
              color={star <= rating ? '#FFD700' : colors.textSecondary}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            {t('error')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <Header title={getName(product)} showBack={true} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Product Image Slider with Thumbnails */}
        <View style={[styles.imageContainer, { backgroundColor: colors.surface }]}>
          {/* Main Image */}
          {productImages.length > 0 ? (
            <Image
              source={{ uri: productImages[selectedImageIndex] }}
              style={styles.productImage}
              contentFit="contain"
              cachePolicy="disk"
              placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              transition={200}
            />
          ) : (
            <Ionicons name="cube-outline" size={100} color={colors.textSecondary} />
          )}
          
          {/* Favorite Button */}
          <View style={[styles.favoriteButton, { backgroundColor: 'transparent' }]}>
            <AnimatedFavoriteButton
              isFavorite={isFavorite}
              isLoading={favoriteLoading}
              onPress={handleToggleFavorite}
              size={24}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.card }}
            />
          </View>

          {/* Image Counter */}
          {productImages.length > 1 && (
            <View style={[styles.imageCounter, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
              <Text style={styles.imageCounterText}>
                {selectedImageIndex + 1}/{productImages.length}
              </Text>
            </View>
          )}
        </View>

        {/* Thumbnail Images */}
        {productImages.length > 1 && (
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.thumbnailsContainer}
            contentContainerStyle={styles.thumbnailsContent}
          >
            {productImages.map((img, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.thumbnail,
                  { 
                    borderColor: selectedImageIndex === index ? colors.primary : 'transparent',
                    backgroundColor: colors.surface,
                  }
                ]}
                onPress={() => setSelectedImageIndex(index)}
                activeOpacity={0.7}
              >
                <Image 
                  source={{ uri: img }} 
                  style={styles.thumbnailImage}
                  contentFit="cover"
                  cachePolicy="disk"
                />
                {selectedImageIndex === index && (
                  <View style={[styles.thumbnailOverlay, { borderColor: colors.primary }]} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Supplier Contact Button - Only visible if supplier is linked */}
        {product.supplier && (
          <TouchableOpacity
            style={[styles.supplierButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => router.push(`/owner/suppliers?viewMode=profile&id=${product.supplier.id}`)}
            activeOpacity={0.85}
          >
            <View style={styles.supplierContent}>
              <View style={[styles.supplierImageContainer, { backgroundColor: colors.surface }]}>
                {product.supplier.profile_image ? (
                  <Image 
                    source={{ uri: product.supplier.profile_image }} 
                    style={styles.supplierProfileImage}
                    contentFit="cover"
                  />
                ) : (
                  <Ionicons name="person-circle" size={44} color={colors.secondary} />
                )}
              </View>
              <View style={styles.supplierTextContainer}>
                <Text style={[styles.supplierLabel, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'مورد هذا المنتج' : 'Product Supplier'}
                </Text>
                <Text style={[styles.supplierName, { color: colors.text }]}>
                  {language === 'ar' && product.supplier.name_ar 
                    ? product.supplier.name_ar 
                    : product.supplier.name}
                </Text>
              </View>
              <View style={[styles.supplierArrowContainer, { backgroundColor: colors.secondary + '20' }]}>
                <Ionicons name="chevron-forward" size={18} color={colors.secondary} />
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

        {/* Product Info */}
        <View style={styles.infoContainer}>
          {/* Rating Summary */}
          {avgRating !== null && (
            <View style={styles.ratingContainer}>
              {renderStars(Math.round(avgRating))}
              <Text style={[styles.ratingText, { color: colors.text }]}>
                {avgRating.toFixed(1)}
              </Text>
              <Text style={[styles.ratingCount, { color: colors.textSecondary }]}>
                ({ratingCount} {language === 'ar' ? 'تقييم' : 'reviews'})
              </Text>
            </View>
          )}

          {/* Brand Badge - Clickable */}
          {product.product_brand && (
            <TouchableOpacity 
              style={[styles.brandBadge, { backgroundColor: colors.primary + '15' }]}
              onPress={() => router.push(`/search?product_brand_id=${product.product_brand.id}`)}
            >
              <Ionicons name="pricetag" size={14} color={colors.primary} />
              <Text style={[styles.brandText, { color: colors.primary }]}>
                {product.product_brand.name}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          )}

          {/* Name */}
          <Text style={[styles.productName, { color: colors.text }]}>
            {getName(product)}
          </Text>

          {/* SKU */}
          <Text style={[styles.sku, { color: colors.textSecondary }]}>
            {t('sku')}: {product.sku}
          </Text>

          {/* Price */}
          <Text style={[styles.price, { color: colors.primary }]}>
            {product.price?.toFixed(2)} ج.م
          </Text>

          {/* Description */}
          {(product.description || product.description_ar) && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('description')}
              </Text>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                {getName(product, 'description')}
              </Text>
            </View>
          )}

          {/* Category - Clickable */}
          {product.category && (
            <View style={styles.section}>
              <TouchableOpacity 
                style={[styles.categoryBadge, { borderColor: colors.border }]}
                onPress={() => router.push(`/category/${product.category.id}`)}
              >
                <Ionicons name="grid-outline" size={16} color={colors.primary} />
                <Text style={[styles.categoryText, { color: colors.text }]}>
                  {getName(product.category)}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          {/* Compatible Cars - Clickable */}
          {product.car_models && product.car_models.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('compatibleWith')}
              </Text>
              <View style={styles.carModels}>
                {product.car_models.map((model: any) => (
                  <TouchableOpacity 
                    key={model.id} 
                    style={[styles.carModelBadge, { backgroundColor: colors.surface }]}
                    onPress={() => router.push(`/car/${model.id}`)}
                  >
                    <Ionicons name="car-sport" size={14} color={colors.primary} />
                    <Text style={[styles.carModelText, { color: colors.text }]}>
                      {getName(model)}
                      {model.year_start && model.year_end && (
                        ` (${model.year_start}-${model.year_end})`
                      )}
                    </Text>
                    <Ionicons name="chevron-forward" size={12} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Comments Section */}
          <View style={[styles.commentsSection, { borderTopColor: colors.border }]}>
            <View style={styles.commentsHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {language === 'ar' ? 'التعليقات والتقييمات' : 'Comments & Reviews'}
              </Text>
              <Text style={[styles.commentsCount, { color: colors.textSecondary }]}>
                ({comments.length})
              </Text>
            </View>

            {/* Add Comment Button */}
            {!showCommentForm && (
              <TouchableOpacity
                style={[styles.addCommentButton, { backgroundColor: colors.primary + '15' }]}
                onPress={() => {
                  if (!user) {
                    router.push('/login');
                    return;
                  }
                  setShowCommentForm(true);
                }}
              >
                <Ionicons name="create-outline" size={20} color={colors.primary} />
                <Text style={[styles.addCommentText, { color: colors.primary }]}>
                  {language === 'ar' ? 'أضف تعليقك' : 'Write a review'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Comment Form */}
            {showCommentForm && (
              <View style={[styles.commentForm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.formLabel, { color: colors.text }]}>
                  {language === 'ar' ? 'تقييمك' : 'Your Rating'}
                </Text>
                {renderStars(selectedRating, 28, true, setSelectedRating)}
                
                <Text style={[styles.formLabel, { color: colors.text, marginTop: 12 }]}>
                  {language === 'ar' ? 'تعليقك' : 'Your Comment'}
                </Text>
                <TextInput
                  style={[styles.commentInput, { 
                    backgroundColor: colors.background, 
                    color: colors.text,
                    borderColor: colors.border,
                    textAlign: isRTL ? 'right' : 'left',
                  }]}
                  placeholder={language === 'ar' ? 'اكتب تعليقك هنا...' : 'Write your comment here...'}
                  placeholderTextColor={colors.textSecondary}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  numberOfLines={4}
                />
                
                <View style={styles.formButtons}>
                  <TouchableOpacity
                    style={[styles.cancelButton, { borderColor: colors.border }]}
                    onPress={() => {
                      setShowCommentForm(false);
                      setCommentText('');
                      setSelectedRating(0);
                    }}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>
                      {language === 'ar' ? 'إلغاء' : 'Cancel'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: colors.primary }]}
                    onPress={handleSubmitComment}
                    disabled={submittingComment}
                  >
                    {submittingComment ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={styles.submitButtonText}>
                        {language === 'ar' ? 'إرسال' : 'Submit'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Comments List */}
            {commentsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 20 }} />
            ) : comments.length === 0 ? (
              <View style={styles.noComments}>
                <Ionicons name="chatbubble-outline" size={40} color={colors.textSecondary} />
                <Text style={[styles.noCommentsText, { color: colors.textSecondary }]}>
                  {language === 'ar' ? 'لا توجد تعليقات بعد' : 'No comments yet'}
                </Text>
              </View>
            ) : (
              <View style={styles.commentsList}>
                {comments.map((comment) => (
                  <View 
                    key={comment.id} 
                    style={[styles.commentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <View style={styles.commentHeader}>
                      <View style={styles.commentUserInfo}>
                        <View style={[styles.commentAvatar, { backgroundColor: colors.primary + '20' }]}>
                          {comment.user_picture ? (
                            <Image 
                              source={{ uri: comment.user_picture }} 
                              style={styles.avatarImage}
                              contentFit="cover"
                              cachePolicy="disk"
                            />
                          ) : (
                            <Ionicons name="person" size={18} color={colors.primary} />
                          )}
                        </View>
                        <View>
                          <Text style={[styles.commentUserName, { color: colors.text }]}>
                            {comment.user_name}
                          </Text>
                          <Text style={[styles.commentDate, { color: colors.textSecondary }]}>
                            {formatDate(comment.created_at)}
                          </Text>
                        </View>
                      </View>
                      
                      {comment.is_owner && (
                        <TouchableOpacity
                          style={styles.deleteCommentButton}
                          onPress={() => handleDeleteComment(comment.id)}
                        >
                          <Ionicons name="trash-outline" size={18} color={colors.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                    
                    {comment.rating && (
                      <View style={styles.commentRating}>
                        {renderStars(comment.rating, 14)}
                      </View>
                    )}
                    
                    <Text style={[styles.commentText, { color: colors.text }]}>
                      {comment.text}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Bottom padding for button */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add to Cart Button - Professional Animated */}
      <AnimatedAddToCartBar
        onPress={handleAddToCart}
        isLoading={addingToCart}
        price={product.price}
        quantity={quantity}
        onQuantityChange={setQuantity}
        label={t('addToCart')}
        colors={colors}
        language={language}
        isRTL={isRTL}
      />
    </KeyboardAvoidingView>
  );
}

// Professional Animated Add to Cart Component with Quantity Selector
const AnimatedAddToCartBar: React.FC<{
  onPress: () => void;
  isLoading: boolean;
  price: number;
  quantity: number;
  onQuantityChange: (qty: number) => void;
  label: string;
  colors: any;
  language: string;
  isRTL: boolean;
}> = ({ onPress, isLoading, price, quantity, onQuantityChange, label, colors, language, isRTL }) => {
  const scale = useSharedValue(1);
  const iconRotate = useSharedValue(0);
  const shimmerX = useSharedValue(-200);
  const successScale = useSharedValue(0);
  const priceScale = useSharedValue(1);
  const quantityScale = useSharedValue(1);
  const [showSuccess, setShowSuccess] = useState(false);

  // Calculate total price
  const totalPrice = price * quantity;

  // Start shimmer animation on mount
  useEffect(() => {
    const animateShimmer = () => {
      shimmerX.value = withSequence(
        withTiming(-200, { duration: 0 }),
        withTiming(400, { duration: 2000 })
      );
    };
    const interval = setInterval(animateShimmer, 3000);
    animateShimmer();
    return () => clearInterval(interval);
  }, []);

  const handlePress = () => {
    if (isLoading) return;
    
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Button press animation
    scale.value = withSequence(
      withSpring(0.92, { damping: 10, stiffness: 400 }),
      withSpring(1.05, { damping: 8, stiffness: 300 }),
      withSpring(1, { damping: 10, stiffness: 400 })
    );
    
    // Icon rotation animation
    iconRotate.value = withSequence(
      withTiming(-15, { duration: 80 }),
      withTiming(15, { duration: 80 }),
      withTiming(-10, { duration: 60 }),
      withTiming(10, { duration: 60 }),
      withTiming(0, { duration: 100 })
    );
    
    onPress();
  };

  const handleIncrease = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onQuantityChange(quantity + 1);
    
    // Animate quantity badge
    quantityScale.value = withSequence(
      withSpring(1.3, { damping: 5, stiffness: 300 }),
      withSpring(1, { damping: 5, stiffness: 300 })
    );
    
    // Animate price
    priceScale.value = withSequence(
      withTiming(1.1, { duration: 100 }),
      withSpring(1, { damping: 5, stiffness: 300 })
    );
  };

  const handleDecrease = () => {
    if (quantity > 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onQuantityChange(quantity - 1);
      
      // Animate quantity badge
      quantityScale.value = withSequence(
        withSpring(0.7, { damping: 5, stiffness: 300 }),
        withSpring(1, { damping: 5, stiffness: 300 })
      );
      
      // Animate price
      priceScale.value = withSequence(
        withTiming(0.9, { duration: 100 }),
        withSpring(1, { damping: 5, stiffness: 300 })
      );
    }
  };

  // Show success animation after loading completes
  useEffect(() => {
    if (!isLoading && showSuccess) {
      successScale.value = withSequence(
        withSpring(1.2, { damping: 8, stiffness: 400 }),
        withSpring(1, { damping: 10, stiffness: 400 })
      );
      setTimeout(() => setShowSuccess(false), 1500);
    }
  }, [isLoading]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${iconRotate.value}deg` }],
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  const priceAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: priceScale.value }],
  }));

  const quantityAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: quantityScale.value }],
  }));

  const successStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity: interpolate(successScale.value, [0, 0.5, 1], [0, 1, 1], Extrapolation.CLAMP),
  }));

  return (
    <View style={[
      addToCartStyles.container, 
      { backgroundColor: colors.card, borderTopColor: colors.border }
    ]}>
      {/* Left Side - Quantity Selector */}
      <View style={[addToCartStyles.quantitySection, isRTL && addToCartStyles.quantitySectionRTL]}>
        <TouchableOpacity
          onPress={handleDecrease}
          style={[
            addToCartStyles.qtyButton,
            { 
              backgroundColor: quantity > 1 ? colors.primary + '20' : colors.surface,
              borderColor: quantity > 1 ? colors.primary : colors.border,
            },
          ]}
          disabled={quantity <= 1}
        >
          <Ionicons name="remove" size={18} color={quantity > 1 ? colors.primary : colors.textSecondary} />
        </TouchableOpacity>
        
        <Animated.View style={[addToCartStyles.qtyBadge, { backgroundColor: colors.primary }, quantityAnimStyle]}>
          <Text style={addToCartStyles.qtyText}>{quantity}</Text>
        </Animated.View>
        
        <TouchableOpacity
          onPress={handleIncrease}
          style={[
            addToCartStyles.qtyButton,
            { 
              backgroundColor: colors.primary + '20',
              borderColor: colors.primary,
            },
          ]}
        >
          <Ionicons name="add" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Center - Dynamic Price */}
      <View style={addToCartStyles.priceSection}>
        <Text style={[addToCartStyles.priceLabel, { color: colors.textSecondary }]}>
          {language === 'ar' ? 'الإجمالي' : 'Total'}
        </Text>
        <Animated.Text style={[addToCartStyles.priceValue, { color: colors.text }, priceAnimStyle]}>
          {totalPrice?.toFixed(2)} <Text style={addToCartStyles.currency}>{language === 'ar' ? 'ج.م' : 'EGP'}</Text>
        </Animated.Text>
      </View>

      {/* Right - Add to Cart Button */}
      <Animated.View style={[addToCartStyles.buttonWrapper, containerStyle]}>
        <TouchableOpacity
          style={addToCartStyles.button}
          onPress={handlePress}
          disabled={isLoading}
          activeOpacity={1}
        >
          <LinearGradient
            colors={isLoading ? ['#6B7280', '#4B5563'] : ['#3B82F6', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={addToCartStyles.gradient}
          >
            {/* Shimmer effect */}
            <Animated.View style={[addToCartStyles.shimmer, shimmerStyle]}>
              <LinearGradient
                colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={addToCartStyles.shimmerGradient}
              />
            </Animated.View>

            {isLoading ? (
              <View style={addToCartStyles.loadingContainer}>
                <ActivityIndicator size="small" color="#FFF" />
              </View>
            ) : (
              <View style={addToCartStyles.buttonContent}>
                <Animated.View style={iconStyle}>
                  <Ionicons name="cart" size={20} color="#FFF" />
                </Animated.View>
                <View style={addToCartStyles.plusBadge}>
                  <Ionicons name="add" size={12} color="#FFF" />
                </View>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const addToCartStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    borderTopWidth: 1,
    gap: 10,
  },
  quantitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quantitySectionRTL: {
    flexDirection: 'row-reverse',
  },
  qtyButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  qtyBadge: {
    minWidth: 36,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  qtyText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  priceSection: {
    flex: 1,
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  currency: {
    fontSize: 12,
    fontWeight: '600',
  },
  buttonWrapper: {
    minWidth: 60,
  },
  button: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 100,
  },
  shimmerGradient: {
    flex: 1,
    width: 100,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  plusBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  imageContainer: {
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imageCounter: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageCounterText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  thumbnailsContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  thumbnailsContent: {
    gap: 10,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 2,
    overflow: 'hidden',
    marginRight: 10,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 2,
    borderRadius: 6,
  },
  favoriteButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  infoContainer: {
    padding: 20,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  starsContainer: {
    flexDirection: 'row',
  },
  starButton: {
    padding: 2,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '700',
  },
  ratingCount: {
    fontSize: 13,
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 12,
    gap: 6,
  },
  brandText: {
    fontSize: 13,
    fontWeight: '600',
  },
  productName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  sku: {
    fontSize: 14,
    marginBottom: 12,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  categoryText: {
    fontSize: 14,
  },
  carModels: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  carModelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6,
  },
  carModelText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Comments Section
  commentsSection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  commentsCount: {
    fontSize: 14,
  },
  addCommentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  addCommentText: {
    fontSize: 15,
    fontWeight: '600',
  },
  commentForm: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  commentInput: {
    minHeight: 100,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  formButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  noComments: {
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  noCommentsText: {
    fontSize: 14,
  },
  commentsList: {
    marginTop: 16,
    gap: 12,
  },
  commentCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  commentUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  commentUserName: {
    fontSize: 14,
    fontWeight: '600',
  },
  commentDate: {
    fontSize: 11,
  },
  deleteCommentButton: {
    padding: 6,
  },
  commentRating: {
    marginTop: 8,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  // Supplier Button Styles
  supplierButton: {
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
  supplierContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  supplierImageContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  supplierProfileImage: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  supplierTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  supplierLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
  supplierArrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Premium Subscribe Button Styles
  subscribeButtonContainer: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  subscribeGradient: {
    borderRadius: 16,
  },
  subscribeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  subscribeIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  subscribeTextContainer: {
    flex: 1,
  },
  subscribeTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  subscribeSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  subscribeArrowContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Subscribe Banner inside Supplier/Distributor button
  subscribeBannerContainer: {
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  subscribeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
    position: 'relative',
  },
  subscribeBannerGoldBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#FFD700',
  },
  subscribeBannerGoldBorderRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#FFD700',
  },
  subscribeBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
});
