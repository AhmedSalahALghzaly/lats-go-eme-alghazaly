/**
 * Distributors Management - Refactored with TanStack Query + FlashList
 * High-performance, stable architecture with optimistic updates
 * FIXED: Hooks order issue - all hooks are called before any conditional returns
 */
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Image,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../src/store/appStore';
import { useTheme } from '../../src/hooks/useTheme';
import { distributorApi, productBrandApi } from '../../src/services/api';
import { VoidDeleteGesture } from '../../src/components/ui/VoidDeleteGesture';
import { ErrorCapsule } from '../../src/components/ui/ErrorCapsule';
import { ConfettiEffect } from '../../src/components/ui/ConfettiEffect';
import { ImageUploader } from '../../src/components/ui/ImageUploader';
import { Toast } from '../../src/components/ui/FormFeedback';
import { BrandCardHorizontal } from '../../src/components/BrandCardHorizontal';
import { queryKeys } from '../../src/lib/queryClient';

type ViewMode = 'list' | 'add' | 'edit' | 'profile';

interface Distributor {
  id: string;
  name: string;
  name_ar?: string;
  phone?: string;
  address?: string;
  address_ar?: string;
  description?: string;
  description_ar?: string;
  website?: string;
  contact_email?: string;
  profile_image?: string;
  images?: string[];
  linked_brands?: string[];
  linked_product_brand_ids?: string[];
  regions?: string[];
  performance_rating?: number;
  created_at?: string;
}

// Memoized Distributor List Item
const DistributorListItem = React.memo(({
  distributor,
  colors,
  isRTL,
  language,
  isOwnerOrAdmin,
  onPress,
  onEdit,
  onDelete,
}: {
  distributor: Distributor;
  colors: any;
  isRTL: boolean;
  language: string;
  isOwnerOrAdmin: boolean;
  onPress: (distributor: Distributor) => void;
  onEdit: (distributor: Distributor) => void;
  onDelete: (id: string) => void;
}) => {
  const displayName = isRTL && distributor.name_ar ? distributor.name_ar : distributor.name;
  
  return (
    <VoidDeleteGesture onDelete={() => onDelete(distributor.id)} enabled={isOwnerOrAdmin}>
      <TouchableOpacity
        style={[styles.distributorCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => onPress(distributor)}
        activeOpacity={0.7}
      >
        <View style={[styles.distributorCardContent, isRTL && styles.cardRTL]}>
          {distributor.profile_image ? (
            <Image source={{ uri: distributor.profile_image }} style={styles.distributorImage} />
          ) : (
            <View style={[styles.distributorImagePlaceholder, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="storefront" size={28} color={colors.primary} />
            </View>
          )}
          <View style={[styles.distributorInfo, isRTL && styles.infoRTL]}>
            <Text style={[styles.distributorName, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {distributor.phone && (
              <View style={[styles.distributorMeta, isRTL && styles.metaRTL]}>
                <Ionicons name="call" size={14} color={colors.textSecondary} />
                <Text style={[styles.distributorMetaText, { color: colors.textSecondary }]}>
                  {distributor.phone}
                </Text>
              </View>
            )}
            {distributor.regions && distributor.regions.length > 0 && (
              <View style={[styles.distributorMeta, isRTL && styles.metaRTL]}>
                <Ionicons name="map" size={14} color={colors.textSecondary} />
                <Text style={[styles.distributorMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {distributor.regions.slice(0, 2).join(', ')}
                  {distributor.regions.length > 2 && ` +${distributor.regions.length - 2}`}
                </Text>
              </View>
            )}
            {distributor.performance_rating !== undefined && (
              <View style={[styles.ratingBadge, { backgroundColor: colors.warning + '20' }]}>
                <Ionicons name="star" size={12} color={colors.warning} />
                <Text style={[styles.ratingText, { color: colors.warning }]}>
                  {distributor.performance_rating.toFixed(1)}
                </Text>
              </View>
            )}
          </View>
          <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.textSecondary} />
        </View>
      </TouchableOpacity>
    </VoidDeleteGesture>
  );
});

export default function DistributorsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ viewMode?: string; id?: string }>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const queryClient = useQueryClient();
  const language = useAppStore((state) => state.language);
  const productBrands = useAppStore((state) => state.productBrands);
  const user = useAppStore((state) => state.user);
  const isRTL = language === 'ar';
  
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.is_admin;

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedDistributor, setSelectedDistributor] = useState<Distributor | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    description: '',
    website: '',
    contact_email: '',
    profile_image: '',
    images: [] as string[],
    linked_brands: [] as string[],
    regions: [] as string[],
    newRegion: '',
  });

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  // TanStack Query: Fetch Distributors
  const {
    data: distributorsData,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: queryKeys.distributors.all,
    queryFn: async () => {
      const res = await distributorApi.getAll();
      return res.data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const distributors: Distributor[] = distributorsData || [];

  // Filter distributors based on search
  const filteredDistributors = useMemo(() => {
    if (!searchQuery.trim()) return distributors;
    const query = searchQuery.toLowerCase();
    return distributors.filter((d) => {
      const name = (d.name || '').toLowerCase();
      const nameAr = (d.name_ar || '').toLowerCase();
      const phone = (d.phone || '').toLowerCase();
      const regions = (d.regions || []).join(' ').toLowerCase();
      return name.includes(query) || nameAr.includes(query) || phone.includes(query) || regions.includes(query);
    });
  }, [distributors, searchQuery]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  }, []);

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await distributorApi.create(data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.distributors.all });
      setShowConfetti(true);
      showToast(isRTL ? 'تم إضافة الموزع بنجاح' : 'Distributor added successfully', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
      setViewMode('list');
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to add distributor');
      showToast(err.response?.data?.detail || 'Failed to add distributor', 'error');
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await distributorApi.update(id, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.distributors.all });
      showToast(isRTL ? 'تم تحديث الموزع بنجاح' : 'Distributor updated successfully', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
      setViewMode('list');
      setSelectedDistributor(null);
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to update distributor');
      showToast(err.response?.data?.detail || 'Failed to update distributor', 'error');
    },
  });

  // Delete Mutation with Optimistic Update
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await distributorApi.delete(id);
      return id;
    },
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.distributors.all });
      const previousDistributors = queryClient.getQueryData(queryKeys.distributors.all);

      queryClient.setQueryData(queryKeys.distributors.all, (old: Distributor[] | undefined) =>
        old ? old.filter(d => d.id !== deletedId) : []
      );

      return { previousDistributors };
    },
    onSuccess: () => {
      showToast(isRTL ? 'تم حذف الموزع بنجاح' : 'Distributor deleted successfully', 'success');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (err: any, variables, context) => {
      if (context?.previousDistributors) {
        queryClient.setQueryData(queryKeys.distributors.all, context.previousDistributors);
      }
      setError(err.response?.data?.detail || 'Failed to delete distributor');
      showToast(err.response?.data?.detail || 'Failed to delete distributor', 'error');
    },
  });

  // Handle URL params for direct navigation to profile
  useEffect(() => {
    const handleProfileNavigation = async () => {
      if (params.viewMode === 'profile' && params.id) {
        // First check if distributor exists in current data
        let distributor = distributors.find((d) => d.id === params.id);
        
        // If not found and we have data, try fetching directly
        if (!distributor && !isLoading) {
          try {
            const res = await distributorApi.getById(params.id);
            if (res.data) {
              distributor = res.data;
            }
          } catch (err) {
            console.error('Error fetching distributor:', err);
          }
        }
        
        if (distributor) {
          setSelectedDistributor(distributor);
          setViewMode('profile');
        }
      }
    };
    
    handleProfileNavigation();
  }, [params.viewMode, params.id, distributors, isLoading]);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      phone: '',
      address: '',
      description: '',
      website: '',
      contact_email: '',
      profile_image: '',
      images: [],
      linked_brands: [],
      regions: [],
      newRegion: '',
    });
  }, []);

  const handleAddDistributor = useCallback(() => {
    if (!formData.name.trim()) {
      setError(isRTL ? 'الاسم مطلوب' : 'Name is required');
      return;
    }
    const { newRegion, ...dataToSend } = formData;
    createMutation.mutate(dataToSend);
  }, [formData, isRTL, createMutation]);

  const handleUpdateDistributor = useCallback(() => {
    if (!selectedDistributor) return;
    const { newRegion, ...dataToSend } = formData;
    updateMutation.mutate({ id: selectedDistributor.id, data: dataToSend });
  }, [selectedDistributor, formData, updateMutation]);

  const handleDeleteDistributor = useCallback((distributorId: string) => {
    deleteMutation.mutate(distributorId);
  }, [deleteMutation]);

  const openEditMode = useCallback((distributor: Distributor) => {
    setSelectedDistributor(distributor);
    setFormData({
      name: distributor.name || '',
      phone: distributor.phone || '',
      address: distributor.address || '',
      description: distributor.description || '',
      website: distributor.website || '',
      contact_email: distributor.contact_email || '',
      profile_image: distributor.profile_image || '',
      images: distributor.images || [],
      linked_brands: distributor.linked_brands || [],
      regions: distributor.regions || [],
      newRegion: '',
    });
    setViewMode('edit');
  }, []);

  const openProfileMode = useCallback((distributor: Distributor) => {
    setSelectedDistributor(distributor);
    setViewMode('profile');
  }, []);

  const addRegion = useCallback(() => {
    if (formData.newRegion.trim() && !formData.regions.includes(formData.newRegion.trim())) {
      setFormData(prev => ({
        ...prev,
        regions: [...prev.regions, prev.newRegion.trim()],
        newRegion: '',
      }));
    }
  }, [formData.newRegion, formData.regions]);

  const removeRegion = useCallback((region: string) => {
    setFormData(prev => ({
      ...prev,
      regions: prev.regions.filter(r => r !== region),
    }));
  }, []);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ============================================================================
  // CRITICAL: All useCallback hooks must be defined BEFORE any conditional returns
  // ============================================================================
  
  // List Header Component
  const ListHeaderComponent = useCallback(() => (
    <View>
      {/* Header */}
      <View style={[styles.listHeader, { paddingTop: insets.top }]}>
        <View style={[styles.headerRow, isRTL && styles.headerRTL]}>
          <TouchableOpacity 
            style={[styles.backButton, { backgroundColor: colors.surface }]} 
            onPress={() => router.back()}
          >
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isRTL ? 'الموزعون' : 'Distributors'}
          </Text>
          {isOwnerOrAdmin && (
            <TouchableOpacity 
              style={[styles.addButton, { backgroundColor: colors.primary }]} 
              onPress={() => setViewMode('add')}
            >
              <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={isRTL ? 'ابحث عن موزع...' : 'Search distributors...'}
            placeholderTextColor={colors.textSecondary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.statsValue}>{filteredDistributors.length}</Text>
          <Text style={styles.statsLabel}>
            {isRTL ? 'إجمالي الموزعين' : 'Total Distributors'}
          </Text>
        </View>
      </View>
    </View>
  ), [insets.top, isRTL, colors, isOwnerOrAdmin, searchQuery, filteredDistributors.length, router]);

  // Empty component
  const ListEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <>
          <Ionicons name="storefront-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {searchQuery 
              ? (isRTL ? 'لا توجد نتائج' : 'No results found')
              : (isRTL ? 'لا يوجد موزعون' : 'No distributors found')
            }
          </Text>
        </>
      )}
    </View>
  ), [isLoading, colors, searchQuery, isRTL]);

  // Render item
  const renderItem = useCallback(({ item }: { item: Distributor }) => (
    <DistributorListItem
      distributor={item}
      colors={colors}
      isRTL={isRTL}
      language={language}
      isOwnerOrAdmin={isOwnerOrAdmin}
      onPress={openProfileMode}
      onEdit={openEditMode}
      onDelete={handleDeleteDistributor}
    />
  ), [colors, isRTL, language, isOwnerOrAdmin, openProfileMode, openEditMode, handleDeleteDistributor]);

  const keyExtractor = useCallback((item: Distributor) => item.id, []);

  // ============================================================================
  // NOW we can have conditional returns (after all hooks are defined)
  // ============================================================================

  // Profile View
  if (viewMode === 'profile' && selectedDistributor) {
    const linkedBrandObjects = productBrands.filter((b: any) => 
      (selectedDistributor.linked_product_brand_ids || selectedDistributor.linked_brands || []).includes(b.id)
    );
    const displayName = isRTL && selectedDistributor.name_ar ? selectedDistributor.name_ar : selectedDistributor.name;
    const displayAddress = isRTL && selectedDistributor.address_ar ? selectedDistributor.address_ar : selectedDistributor.address;
    const displayDescription = isRTL && selectedDistributor.description_ar ? selectedDistributor.description_ar : selectedDistributor.description;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={[styles.profileHeader, isRTL && styles.headerRTL]}>
            <TouchableOpacity 
              style={[styles.profileBackButton, { backgroundColor: colors.surface }]} 
              onPress={() => { setViewMode('list'); setSelectedDistributor(null); router.setParams({ viewMode: undefined, id: undefined }); }}
            >
              <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.profileHeaderTitle, { color: colors.text }]}>{displayName}</Text>
            {isOwnerOrAdmin && (
              <TouchableOpacity 
                style={[styles.profileEditButton, { backgroundColor: colors.primary }]} 
                onPress={() => router.push(`/owner/add-entity-form?entityType=distributor&id=${selectedDistributor.id}`)}
              >
                <Ionicons name="pencil" size={20} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Profile Image */}
          <View style={styles.profileImageContainerThemed}>
            {selectedDistributor.profile_image ? (
              <Image source={{ uri: selectedDistributor.profile_image }} style={styles.profileImageThemed} />
            ) : (
              <View style={[styles.profileImagePlaceholder, { backgroundColor: colors.surface }]}>
                <Ionicons name="storefront" size={60} color={colors.textSecondary} />
              </View>
            )}
          </View>

          {/* Performance Rating */}
          {selectedDistributor.performance_rating !== undefined && (
            <View style={[styles.ratingSection, { backgroundColor: colors.warning + '15' }]}>
              <Ionicons name="star" size={24} color={colors.warning} />
              <Text style={[styles.ratingSectionText, { color: colors.warning }]}>
                {selectedDistributor.performance_rating.toFixed(1)} / 5.0
              </Text>
              <Text style={[styles.ratingSectionLabel, { color: colors.textSecondary }]}>
                {isRTL ? 'تقييم الأداء' : 'Performance Rating'}
              </Text>
            </View>
          )}

          {/* Regions */}
          {selectedDistributor.regions && selectedDistributor.regions.length > 0 && (
            <View style={styles.regionsSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {isRTL ? 'المناطق' : 'Regions'}
              </Text>
              <View style={styles.regionChips}>
                {selectedDistributor.regions.map((region, index) => (
                  <View key={index} style={[styles.regionChip, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.regionChipText, { color: colors.primary }]}>{region}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Info Cards */}
          <View style={styles.infoSection}>
            {selectedDistributor.phone && (
              <TouchableOpacity
                style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => Linking.openURL(`tel:${selectedDistributor.phone}`)}
              >
                <Ionicons name="call" size={22} color={colors.primary} />
                <Text style={[styles.infoCardText, { color: colors.text }]}>{selectedDistributor.phone}</Text>
              </TouchableOpacity>
            )}
            {displayAddress && (
              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="location" size={22} color={colors.primary} />
                <Text style={[styles.infoCardText, { color: colors.text }]}>{displayAddress}</Text>
              </View>
            )}
            {selectedDistributor.contact_email && (
              <TouchableOpacity
                style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => Linking.openURL(`mailto:${selectedDistributor.contact_email}`)}
              >
                <Ionicons name="mail" size={22} color={colors.primary} />
                <Text style={[styles.infoCardText, { color: colors.text }]}>{selectedDistributor.contact_email}</Text>
              </TouchableOpacity>
            )}
            {selectedDistributor.website && (
              <TouchableOpacity
                style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => Linking.openURL(selectedDistributor.website!.startsWith('http') ? selectedDistributor.website! : `https://${selectedDistributor.website}`)}
              >
                <Ionicons name="globe" size={22} color={colors.primary} />
                <Text style={[styles.infoCardText, { color: colors.text }]}>{selectedDistributor.website}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Description */}
          {displayDescription && (
            <View style={[styles.descriptionSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {isRTL ? 'الوصف' : 'Description'}
              </Text>
              <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>{displayDescription}</Text>
            </View>
          )}

          {/* Linked Brands */}
          {linkedBrandObjects.length > 0 && (
            <View style={styles.brandsSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {isRTL ? 'الماركات المرتبطة' : 'Linked Brands'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandsScroll}>
                {linkedBrandObjects.map((brand: any) => (
                  <BrandCardHorizontal key={brand.id} brand={brand} />
                ))}
              </ScrollView>
            </View>
          )}
        </ScrollView>

        <Toast
          visible={toastVisible}
          message={toastMessage}
          type={toastType}
          onDismiss={() => setToastVisible(false)}
        />
      </View>
    );
  }

  // Add/Edit Form View
  if (viewMode === 'add' || viewMode === 'edit') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={[styles.formHeader, isRTL && styles.headerRTL]}>
              <TouchableOpacity 
                style={[styles.backButton, { backgroundColor: colors.surface }]} 
                onPress={() => { setViewMode('list'); resetForm(); setSelectedDistributor(null); }}
              >
                <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.formHeaderTitle, { color: colors.text }]}>
                {viewMode === 'add' 
                  ? (isRTL ? 'إضافة موزع' : 'Add Distributor')
                  : (isRTL ? 'تعديل الموزع' : 'Edit Distributor')
                }
              </Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Profile Image */}
            <View style={styles.formGroup}>
              <ImageUploader
                mode="single"
                value={formData.profile_image}
                onChange={(img) => setFormData(prev => ({ ...prev, profile_image: img as string }))}
                size="large"
                shape="circle"
                label={isRTL ? 'صورة الموزع' : 'Distributor Image'}
              />
            </View>

            {/* Name */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                {isRTL ? 'الاسم *' : 'Name *'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={formData.name}
                onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
                placeholder={isRTL ? 'اسم الموزع' : 'Distributor name'}
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {/* Phone */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                {isRTL ? 'رقم الهاتف' : 'Phone'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={formData.phone}
                onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
                placeholder={isRTL ? 'رقم الهاتف' : 'Phone number'}
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
              />
            </View>

            {/* Email */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                {isRTL ? 'البريد الإلكتروني' : 'Email'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={formData.contact_email}
                onChangeText={(text) => setFormData(prev => ({ ...prev, contact_email: text }))}
                placeholder={isRTL ? 'البريد الإلكتروني' : 'Email address'}
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Website */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                {isRTL ? 'الموقع الإلكتروني' : 'Website'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={formData.website}
                onChangeText={(text) => setFormData(prev => ({ ...prev, website: text }))}
                placeholder="https://example.com"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="none"
              />
            </View>

            {/* Regions */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                {isRTL ? 'المناطق' : 'Regions'}
              </Text>
              <View style={styles.regionInputRow}>
                <TextInput
                  style={[styles.regionInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={formData.newRegion}
                  onChangeText={(text) => setFormData(prev => ({ ...prev, newRegion: text }))}
                  placeholder={isRTL ? 'أضف منطقة' : 'Add region'}
                  placeholderTextColor={colors.textSecondary}
                  onSubmitEditing={addRegion}
                />
                <TouchableOpacity
                  style={[styles.addRegionButton, { backgroundColor: colors.primary }]}
                  onPress={addRegion}
                >
                  <Ionicons name="add" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
              {formData.regions.length > 0 && (
                <View style={styles.regionChips}>
                  {formData.regions.map((region, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[styles.regionChip, { backgroundColor: colors.primary + '20' }]}
                      onPress={() => removeRegion(region)}
                    >
                      <Text style={[styles.regionChipText, { color: colors.primary }]}>{region}</Text>
                      <Ionicons name="close-circle" size={16} color={colors.primary} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Address */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                {isRTL ? 'العنوان' : 'Address'}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={formData.address}
                onChangeText={(text) => setFormData(prev => ({ ...prev, address: text }))}
                placeholder={isRTL ? 'العنوان' : 'Address'}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                {isRTL ? 'الوصف' : 'Description'}
              </Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder={isRTL ? 'وصف الموزع' : 'Description'}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={viewMode === 'add' ? handleAddDistributor : handleUpdateDistributor}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Ionicons name={viewMode === 'add' ? 'add' : 'checkmark'} size={20} color="#FFF" />
                  <Text style={styles.saveButtonText}>
                    {viewMode === 'add' 
                      ? (isRTL ? 'إضافة الموزع' : 'Add Distributor')
                      : (isRTL ? 'حفظ التغييرات' : 'Save Changes')
                    }
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {error && (
          <ErrorCapsule
            message={error}
            onDismiss={() => setError(null)}
          />
        )}

        <Toast
          visible={toastVisible}
          message={toastMessage}
          type={toastType}
          onDismiss={() => setToastVisible(false)}
        />
      </View>
    );
  }

  // Main List View
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlashList
        data={filteredDistributors}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={100}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={styles.listContentContainer}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        extraData={[colors, searchQuery]}
      />

      {error && (
        <ErrorCapsule
          message={error}
          onDismiss={() => setError(null)}
          onRetry={refetch}
        />
      )}

      {showConfetti && (
        <ConfettiEffect onComplete={() => setShowConfetti(false)} />
      )}

      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  listContentContainer: { paddingHorizontal: 16, paddingBottom: 100 },
  listHeader: { marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerRTL: { flexDirection: 'row-reverse' },
  backButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  addButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  statsCard: { borderRadius: 16, padding: 20, alignItems: 'center' },
  statsValue: { fontSize: 32, fontWeight: '700', color: '#FFF' },
  statsLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  distributorCard: { borderRadius: 12, borderWidth: 1, marginBottom: 12, overflow: 'hidden' },
  distributorCardContent: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  cardRTL: { flexDirection: 'row-reverse' },
  distributorImage: { width: 56, height: 56, borderRadius: 28 },
  distributorImagePlaceholder: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  distributorInfo: { flex: 1, marginLeft: 12 },
  infoRTL: { marginLeft: 0, marginRight: 12, alignItems: 'flex-end' },
  distributorName: { fontSize: 16, fontWeight: '600' },
  distributorMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  metaRTL: { flexDirection: 'row-reverse' },
  distributorMetaText: { fontSize: 13 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 6, alignSelf: 'flex-start', gap: 4 },
  ratingText: { fontSize: 12, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', padding: 60 },
  emptyText: { fontSize: 16, marginTop: 16 },
  // Profile styles
  profileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 20 },
  profileBackButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  profileHeaderTitle: { fontSize: 20, fontWeight: '700', flex: 1, textAlign: 'center' },
  profileEditButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  profileImageContainerThemed: { alignItems: 'center', marginBottom: 24 },
  profileImageThemed: { width: 120, height: 120, borderRadius: 60 },
  profileImagePlaceholder: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  ratingSection: { marginHorizontal: 16, padding: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20 },
  ratingSectionText: { fontSize: 24, fontWeight: '700' },
  ratingSectionLabel: { fontSize: 14 },
  regionsSection: { paddingHorizontal: 16, marginBottom: 20 },
  regionChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  regionChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, gap: 4 },
  regionChipText: { fontSize: 14 },
  infoSection: { paddingHorizontal: 16, gap: 12 },
  infoCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, gap: 12 },
  infoCardText: { fontSize: 15, flex: 1 },
  descriptionSection: { marginHorizontal: 16, marginTop: 20, padding: 16, borderRadius: 12, borderWidth: 1 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  descriptionText: { fontSize: 14, lineHeight: 22 },
  brandsSection: { marginTop: 20, paddingHorizontal: 16 },
  brandsScroll: { marginTop: 12 },
  // Form styles
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 24 },
  formHeaderTitle: { fontSize: 20, fontWeight: '700' },
  formGroup: { paddingHorizontal: 16, marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  regionInputRow: { flexDirection: 'row', gap: 8 },
  regionInput: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
  addRegionButton: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, padding: 16, borderRadius: 12, gap: 8, marginTop: 8 },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});
