/**
 * Car Models Admin - Refactored with TanStack Query + FlashList
 * High-performance, stable architecture with optimistic updates
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { carBrandsApi, carModelsApi } from '../../src/services/api';
import { useAdminSync } from '../../src/services/adminSyncService';
import { Header } from '../../src/components/Header';
import { Toast } from '../../src/components/ui/FormFeedback';
import { queryKeys } from '../../src/lib/queryClient';

// Types
interface CarModel {
  id: string;
  name: string;
  name_ar: string;
  brand_id: string;
  year_start?: number;
  year_end?: number;
  chassis_number?: string;
  image_url?: string;
  catalog_pdf?: string;
}

interface CarBrand {
  id: string;
  name: string;
  name_ar: string;
  logo?: string;
}

// Memoized Model List Item Component
const ModelListItem = React.memo(({
  model,
  brandName,
  colors,
  onEdit,
  onDelete,
}: {
  model: CarModel;
  brandName: string;
  colors: any;
  onEdit: (model: CarModel) => void;
  onDelete: (id: string) => void;
}) => (
  <View style={[styles.listItem, { borderColor: colors.border }]}>
    {model.image_url ? (
      <Image source={{ uri: model.image_url }} style={styles.modelThumb} />
    ) : (
      <View style={[styles.modelIcon, { backgroundColor: colors.primary + '20' }]}>
        <Ionicons name="layers" size={24} color={colors.primary} />
      </View>
    )}
    <View style={styles.modelInfo}>
      <Text style={[styles.modelName, { color: colors.text }]}>{model.name}</Text>
      <Text style={[styles.modelNameAr, { color: colors.textSecondary }]}>{model.name_ar}</Text>
      <Text style={[styles.modelMeta, { color: colors.textSecondary }]}>
        {brandName} {model.year_start && model.year_end ? `(${model.year_start}-${model.year_end})` : ''}
      </Text>
    </View>
    <View style={styles.actionButtons}>
      <TouchableOpacity
        style={[styles.editButton, { backgroundColor: colors.primary + '20' }]}
        onPress={() => onEdit(model)}
      >
        <Ionicons name="create" size={18} color={colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.deleteButton, { backgroundColor: colors.error + '20' }]}
        onPress={() => onDelete(model.id)}
      >
        <Ionicons name="trash" size={18} color={colors.error} />
      </TouchableOpacity>
    </View>
  </View>
));

export default function ModelsAdmin() {
  const { colors } = useTheme();
  const { language, isRTL } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const adminSync = useAdminSync();

  // Form state
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [catalogPdf, setCatalogPdf] = useState<string | null>(null);
  const [catalogPdfName, setCatalogPdfName] = useState('');

  // Edit mode state
  const [editingModel, setEditingModel] = useState<CarModel | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  // TanStack Query: Fetch Brands
  const {
    data: brandsData,
    isLoading: brandsLoading,
  } = useQuery({
    queryKey: queryKeys.carBrands.all,
    queryFn: async () => {
      const response = await carBrandsApi.getAll();
      return response.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const brands: CarBrand[] = brandsData || [];

  // TanStack Query: Fetch Models
  const {
    data: modelsData,
    isLoading: modelsLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: queryKeys.carModels.all,
    queryFn: async () => {
      const response = await carModelsApi.getAll();
      return response.data || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const models: CarModel[] = modelsData || [];

  // Pre-compute brand name map for O(1) lookups instead of O(N) in renderItem
  const brandNameMap = useMemo(() => {
    const map: Record<string, { name: string; name_ar: string }> = {};
    brands.forEach(brand => {
      map[brand.id] = { name: brand.name, name_ar: brand.name_ar };
    });
    return map;
  }, [brands]);

  // Get brand name helper
  const getBrandName = useCallback((brandId: string) => {
    const brand = brandNameMap[brandId];
    if (!brand) return '';
    return language === 'ar' ? brand.name_ar : brand.name;
  }, [brandNameMap, language]);

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const query = searchQuery.toLowerCase();
    return models.filter((model) => {
      const modelName = (model.name || '').toLowerCase();
      const modelNameAr = (model.name_ar || '').toLowerCase();
      const brandName = getBrandName(model.brand_id).toLowerCase();
      return modelName.includes(query) || modelNameAr.includes(query) || brandName.includes(query);
    });
  }, [models, searchQuery, getBrandName]);

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return adminSync.createCarModel(data);
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.carModels.all });
        showToast(language === 'ar' ? 'تم إضافة الموديل بنجاح' : 'Model created successfully', 'success');
        resetForm();
      } else {
        showToast(result.error || 'Failed to create model', 'error');
      }
    },
    onError: (error: any) => {
      showToast(error.message || 'Failed to create model', 'error');
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return adminSync.updateCarModel(id, data);
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: queryKeys.carModels.all });
        showToast(language === 'ar' ? 'تم تحديث الموديل بنجاح' : 'Model updated successfully', 'success');
        resetForm();
      } else {
        showToast(result.error || 'Failed to update model', 'error');
      }
    },
    onError: (error: any) => {
      showToast(error.message || 'Failed to update model', 'error');
    },
  });

  // Delete Mutation with Optimistic Update
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return adminSync.deleteCarModel(id);
    },
    onMutate: async (deletedId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.carModels.all });

      // Snapshot previous value
      const previousModels = queryClient.getQueryData(queryKeys.carModels.all);

      // Optimistically remove from cache
      queryClient.setQueryData(queryKeys.carModels.all, (old: CarModel[] | undefined) =>
        old ? old.filter(m => m.id !== deletedId) : []
      );

      return { previousModels };
    },
    onSuccess: (result) => {
      if (result.success) {
        showToast(language === 'ar' ? 'تم حذف الموديل بنجاح' : 'Model deleted successfully', 'success');
      } else {
        // Rollback handled by onError
        showToast(result.error || 'Failed to delete model', 'error');
        queryClient.invalidateQueries({ queryKey: queryKeys.carModels.all });
      }
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousModels) {
        queryClient.setQueryData(queryKeys.carModels.all, context.previousModels);
      }
      showToast(language === 'ar' ? 'فشل في حذف الموديل' : 'Failed to delete model', 'error');
    },
  });

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  }, []);

  const pickImage = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 1,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const mimeType = result.assets[0].mimeType || 'image/jpeg';
        const isPng = mimeType.includes('png') || result.assets[0].uri?.toLowerCase().endsWith('.png');
        const format = isPng ? 'image/png' : 'image/jpeg';
        setModelImage(`data:${format};base64,${result.assets[0].base64}`);
        setImageUrl('');
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  }, []);

  const pickCatalogPdf = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        setCatalogPdfName(file.name || 'catalog.pdf');
        
        try {
          const base64 = await FileSystem.readAsStringAsync(file.uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          setCatalogPdf(`data:application/pdf;base64,${base64}`);
          showToast(language === 'ar' ? 'تم اختيار الكتالوج بنجاح' : 'Catalog selected successfully', 'success');
        } catch (readError) {
          console.error('Error reading PDF:', readError);
          setCatalogPdf(file.uri);
          showToast(language === 'ar' ? 'تم اختيار الكتالوج' : 'Catalog selected', 'success');
        }
      }
    } catch (error) {
      console.error('Error picking PDF:', error);
      showToast(language === 'ar' ? 'فشل اختيار الملف' : 'Failed to select file', 'error');
    }
  }, [language, showToast]);

  const resetForm = useCallback(() => {
    setName('');
    setNameAr('');
    setSelectedBrandId('');
    setYearFrom('');
    setYearTo('');
    setChassisNumber('');
    setModelImage(null);
    setImageUrl('');
    setCatalogPdf(null);
    setCatalogPdfName('');
    setIsEditMode(false);
    setEditingModel(null);
  }, []);

  const handleEditModel = useCallback((model: CarModel) => {
    setName(model.name || '');
    setNameAr(model.name_ar || '');
    setSelectedBrandId(model.brand_id || '');
    setYearFrom(model.year_start?.toString() || '');
    setYearTo(model.year_end?.toString() || '');
    setChassisNumber(model.chassis_number || '');
    setModelImage(model.image_url || null);
    setImageUrl('');
    setCatalogPdf(model.catalog_pdf || null);
    setCatalogPdfName(model.catalog_pdf ? 'catalog.pdf' : '');
    setEditingModel(model);
    setIsEditMode(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedBrandId || !name.trim() || !nameAr.trim()) {
      showToast(language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields', 'error');
      return;
    }

    const modelData = {
      name: name.trim(),
      name_ar: nameAr.trim(),
      brand_id: selectedBrandId,
      year_start: yearFrom ? parseInt(yearFrom) : null,
      year_end: yearTo ? parseInt(yearTo) : null,
      chassis_number: chassisNumber.trim() || null,
      image_url: modelImage || imageUrl.trim() || null,
      catalog_pdf: catalogPdf || null,
    };

    if (isEditMode && editingModel) {
      updateMutation.mutate({ id: editingModel.id, data: modelData });
    } else {
      createMutation.mutate(modelData);
    }
  }, [selectedBrandId, name, nameAr, yearFrom, yearTo, chassisNumber, modelImage, imageUrl, catalogPdf, isEditMode, editingModel, language, showToast, createMutation, updateMutation]);

  const handleDelete = useCallback((id: string) => {
    deleteMutation.mutate(id);
  }, [deleteMutation]);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const isLoading = brandsLoading || modelsLoading;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // List Header Component (Form + Search + Stats)
  const ListHeaderComponent = useCallback(() => (
    <View>
      {/* Breadcrumb */}
      <View style={[styles.breadcrumb, isRTL && styles.breadcrumbRTL]}>
        <TouchableOpacity onPress={() => router.push('/admin')}>
          <Text style={[styles.breadcrumbText, { color: colors.primary }]}>
            {language === 'ar' ? 'لوحة التحكم' : 'Admin'}
          </Text>
        </TouchableOpacity>
        <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={16} color={colors.textSecondary} />
        <Text style={[styles.breadcrumbText, { color: colors.textSecondary }]}>
          {language === 'ar' ? 'الموديلات' : 'Models'}
        </Text>
      </View>

      {/* Add/Edit Form */}
      <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: isEditMode ? colors.primary : colors.border }]}>
        <View style={styles.formTitleRow}>
          <Text style={[styles.formTitle, { color: isEditMode ? colors.primary : colors.text }]}>
            {isEditMode 
              ? (language === 'ar' ? 'تعديل الموديل' : 'Edit Model')
              : (language === 'ar' ? 'إضافة موديل جديد' : 'Add New Model')
            }
          </Text>
          {isEditMode && (
            <TouchableOpacity
              style={[styles.cancelEditBtn, { backgroundColor: colors.error + '20' }]}
              onPress={resetForm}
            >
              <Ionicons name="close" size={18} color={colors.error} />
              <Text style={[styles.cancelEditText, { color: colors.error }]}>
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Model Image Upload */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            {language === 'ar' ? 'صورة الموديل' : 'Model Image'}
          </Text>
          
          <View style={styles.imageUploadSection}>
            {modelImage ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: modelImage }} style={styles.modelImagePreview} />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => setModelImage(null)}
                >
                  <Ionicons name="close-circle" size={24} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.uploadBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={pickImage}
              >
                <Ionicons name="camera" size={32} color={colors.primary} />
                <Text style={[styles.uploadBtnText, { color: colors.primary }]}>
                  {language === 'ar' ? 'اختر صورة' : 'Pick Image'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {!modelImage && (
            <View style={styles.urlInputSection}>
              <Text style={[styles.orText, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'أو أدخل رابط الصورة' : 'Or enter image URL'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={imageUrl}
                onChangeText={setImageUrl}
                placeholder="https://example.com/model.png"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
          )}
        </View>

        {/* Brand Selector */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            {language === 'ar' ? 'اختر الماركة *' : 'Select Brand *'}
          </Text>
          <View style={styles.brandSelectorWrapper}>
            {brands.map((brand) => (
              <TouchableOpacity
                key={brand.id}
                style={[
                  styles.brandChip,
                  { backgroundColor: selectedBrandId === brand.id ? colors.primary : colors.surface, borderColor: colors.border }
                ]}
                onPress={() => setSelectedBrandId(brand.id)}
              >
                <Text style={{ color: selectedBrandId === brand.id ? '#FFF' : colors.text }}>
                  {language === 'ar' ? brand.name_ar : brand.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Name Fields */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            {language === 'ar' ? 'الاسم (بالإنجليزية) *' : 'Name (English) *'}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={name}
            onChangeText={setName}
            placeholder={language === 'ar' ? 'مثال: Camry' : 'e.g., Camry'}
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            {language === 'ar' ? 'الاسم (بالعربية) *' : 'Name (Arabic) *'}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }, isRTL && styles.inputRTL]}
            value={nameAr}
            onChangeText={setNameAr}
            placeholder={language === 'ar' ? 'مثال: كامري' : 'e.g., كامري'}
            placeholderTextColor={colors.textSecondary}
          />
        </View>

        {/* Year Range */}
        <View style={styles.row}>
          <View style={[styles.formGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.text }]}>
              {language === 'ar' ? 'من سنة' : 'Year From'}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={yearFrom}
              onChangeText={setYearFrom}
              placeholder="2020"
              keyboardType="numeric"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
          <View style={[styles.formGroup, { flex: 1, marginLeft: 12 }]}>
            <Text style={[styles.label, { color: colors.text }]}>
              {language === 'ar' ? 'إلى سنة' : 'Year To'}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={yearTo}
              onChangeText={setYearTo}
              placeholder="2024"
              keyboardType="numeric"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        {/* Chassis Number */}
        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            {language === 'ar' ? 'رقم الشاسيه (VIN)' : 'Chassis Number (VIN)'}
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            value={chassisNumber}
            onChangeText={setChassisNumber}
            placeholder={language === 'ar' ? 'مثال: JTDKN3DU5A0...' : 'e.g., JTDKN3DU5A0...'}
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="characters"
          />
          <Text style={[styles.helperText, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'رقم الهيكل للبحث المباشر' : 'Vehicle Identification Number for direct search'}
          </Text>
        </View>

        {/* Catalog PDF Upload */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>
            {language === 'ar' ? 'كتالوج الموديل (PDF)' : 'Model Catalog (PDF)'}
          </Text>
          <TouchableOpacity
            style={[styles.catalogUploadButton, { backgroundColor: '#FFD70015', borderColor: '#FFD70050' }]}
            onPress={pickCatalogPdf}
          >
            <View style={styles.catalogUploadContent}>
              <View style={styles.catalogIconContainer}>
                <Ionicons name="document-text" size={24} color="#FFD700" />
              </View>
              <View style={styles.catalogTextContainer}>
                {catalogPdfName ? (
                  <>
                    <Text style={[styles.catalogFileName, { color: colors.text }]} numberOfLines={1}>
                      {catalogPdfName}
                    </Text>
                    <Text style={styles.catalogSelectedText}>
                      {language === 'ar' ? 'تم اختيار الملف' : 'File selected'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.catalogUploadText}>
                      {language === 'ar' ? 'اضغط لاختيار ملف PDF' : 'Tap to select PDF file'}
                    </Text>
                    <Text style={[styles.catalogHelperText, { color: colors.textSecondary }]}>
                      {language === 'ar' ? 'للمشتركين فقط' : 'For subscribers only'}
                    </Text>
                  </>
                )}
              </View>
              {catalogPdfName && (
                <TouchableOpacity 
                  style={styles.catalogRemoveButton}
                  onPress={() => {
                    setCatalogPdf(null);
                    setCatalogPdfName('');
                  }}
                >
                  <Ionicons name="close-circle" size={22} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name={isEditMode ? "create" : "save"} size={20} color="#FFF" />
              <Text style={styles.saveButtonText}>
                {isEditMode 
                  ? (language === 'ar' ? 'تحديث' : 'Update')
                  : (language === 'ar' ? 'حفظ' : 'Save')
                }
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* List Header with Search */}
      <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.listTitle, { color: colors.text }]}>
          {language === 'ar' ? 'الموديلات الحالية' : 'Existing Models'} ({filteredModels.length})
        </Text>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={language === 'ar' ? 'ابحث بالاسم أو الماركة...' : 'Search by name or brand...'}
            placeholderTextColor={colors.textSecondary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  ), [isRTL, colors, language, isEditMode, modelImage, selectedBrandId, brands, name, nameAr, yearFrom, yearTo, chassisNumber, imageUrl, catalogPdfName, catalogPdf, isSaving, filteredModels.length, searchQuery, router, resetForm, pickImage, pickCatalogPdf, handleSave]);

  // Empty component
  const ListEmptyComponent = useCallback(() => (
    <View style={styles.emptyContainer}>
      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} />
      ) : (
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {searchQuery ? (language === 'ar' ? 'لا توجد نتائج' : 'No results found') : (language === 'ar' ? 'لا توجد موديلات' : 'No models found')}
        </Text>
      )}
    </View>
  ), [isLoading, colors, searchQuery, language]);

  // Render item
  const renderItem = useCallback(({ item }: { item: CarModel }) => (
    <ModelListItem
      model={item}
      brandName={getBrandName(item.brand_id)}
      colors={colors}
      onEdit={handleEditModel}
      onDelete={handleDelete}
    />
  ), [colors, getBrandName, handleEditModel, handleDelete]);

  const keyExtractor = useCallback((item: CarModel) => item.id, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Header title={language === 'ar' ? 'الموديلات' : 'Models'} showBack showSearch={false} showCart={false} />

      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <FlashList
          data={filteredModels}
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
          extraData={[colors, language, searchQuery]}
        />
      </KeyboardAvoidingView>
      
      <Toast
        visible={toastVisible}
        message={toastMessage}
        type={toastType}
        onDismiss={() => setToastVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  listContentContainer: { padding: 16 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  breadcrumbRTL: { flexDirection: 'row-reverse' },
  breadcrumbText: { fontSize: 14 },
  formCard: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  formTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  formTitle: { fontSize: 18, fontWeight: '700' },
  cancelEditBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
  cancelEditText: { fontSize: 14, fontWeight: '600' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  inputRTL: { textAlign: 'right' },
  row: { flexDirection: 'row' },
  imageUploadSection: { alignItems: 'center', marginBottom: 12 },
  uploadBtn: { width: '100%', height: 100, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  uploadBtnText: { fontSize: 12, marginTop: 4, fontWeight: '500' },
  imagePreviewContainer: { position: 'relative', width: '100%' },
  modelImagePreview: { width: '100%', height: 120, borderRadius: 12 },
  removeImageBtn: { position: 'absolute', top: -8, right: -8 },
  urlInputSection: { marginTop: 8 },
  orText: { fontSize: 12, textAlign: 'center', marginBottom: 8 },
  brandSelectorWrapper: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  brandChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  helperText: { fontSize: 12, marginTop: 4 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 8, gap: 8 },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  listCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  listTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
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
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  emptyContainer: { alignItems: 'center', padding: 40 },
  emptyText: { textAlign: 'center', fontSize: 15 },
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
  modelIcon: { width: 64, height: 64, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modelThumb: { width: 64, height: 64, borderRadius: 12 },
  modelInfo: { flex: 1, marginLeft: 12 },
  modelName: { fontSize: 16, fontWeight: '600' },
  modelNameAr: { fontSize: 14, marginTop: 2 },
  modelMeta: { fontSize: 13, marginTop: 4 },
  actionButtons: { flexDirection: 'column', gap: 8 },
  editButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  catalogUploadButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  catalogUploadContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catalogIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFD70020',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  catalogTextContainer: {
    flex: 1,
  },
  catalogUploadText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFD700',
  },
  catalogHelperText: {
    fontSize: 12,
    marginTop: 2,
  },
  catalogFileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  catalogSelectedText: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 2,
  },
  catalogRemoveButton: {
    padding: 4,
  },
});
