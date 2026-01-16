import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { carBrandsApi, carModelsApi } from '../../src/services/api';
import { useAdminSync } from '../../src/services/adminSyncService';
import { Header } from '../../src/components/Header';
import { Toast } from '../../src/components/ui/FormFeedback';

export default function ModelsAdmin() {
  const { colors } = useTheme();
  const { language, isRTL } = useTranslation();
  const router = useRouter();
  const adminSync = useAdminSync();

  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [modelImage, setModelImage] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState('');

  // Edit mode state
  const [editingModel, setEditingModel] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [brandsRes, modelsRes] = await Promise.all([
        carBrandsApi.getAll(),
        carModelsApi.getAll(),
      ]);
      setBrands(brandsRes.data || []);
      setModels(modelsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper to get brand name
  const getBrandName = (brandId: string) => {
    const brand = brands.find(b => b.id === brandId);
    return language === 'ar' ? brand?.name_ar : brand?.name;
  };

  // Filter models based on search query
  const filteredModels = useMemo(() => {
    if (!searchQuery.trim()) return models;
    const query = searchQuery.toLowerCase();
    return models.filter((model) => {
      const name = (model.name || '').toLowerCase();
      const nameAr = (model.name_ar || '').toLowerCase();
      // Inline brand lookup to avoid function reference issues
      const brand = brands.find(b => b.id === model.brand_id);
      const brandName = (language === 'ar' ? brand?.name_ar : brand?.name)?.toLowerCase() || '';
      return name.includes(query) || nameAr.includes(query) || brandName.includes(query);
    });
  }, [models, searchQuery, brands, language]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 1, // CRITICAL: Full quality to preserve PNG transparency
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        // CRITICAL FIX: Detect actual image format from mimeType to preserve PNG alpha channel
        const mimeType = result.assets[0].mimeType || 'image/jpeg';
        const isPng = mimeType.includes('png') || result.assets[0].uri?.toLowerCase().endsWith('.png');
        const format = isPng ? 'image/png' : 'image/jpeg';
        setModelImage(`data:${format};base64,${result.assets[0].base64}`);
        setImageUrl('');
      }
    } catch (error) {
      console.error('Error picking image:', error);
    }
  };

  const resetForm = () => {
    setName('');
    setNameAr('');
    setSelectedBrandId('');
    setYearFrom('');
    setYearTo('');
    setChassisNumber('');
    setModelImage(null);
    setImageUrl('');
    setIsEditMode(false);
    setEditingModel(null);
    setError('');
  };

  const handleEditModel = (model: any) => {
    // Populate form with model data
    setName(model.name || '');
    setNameAr(model.name_ar || '');
    setSelectedBrandId(model.brand_id || '');
    setYearFrom(model.year_start?.toString() || '');
    setYearTo(model.year_end?.toString() || '');
    setChassisNumber(model.chassis_number || '');
    setModelImage(model.image_url || null);
    setImageUrl('');
    setEditingModel(model);
    setIsEditMode(true);
    setError('');
  };

  const handleSave = async () => {
    if (!selectedBrandId || !name.trim() || !nameAr.trim()) {
      setError(language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }

    setSaving(true);
    setError('');

    const modelData = {
      name: name.trim(),
      name_ar: nameAr.trim(),
      brand_id: selectedBrandId,
      year_start: yearFrom ? parseInt(yearFrom) : null,
      year_end: yearTo ? parseInt(yearTo) : null,
      chassis_number: chassisNumber.trim() || null,
      image_url: modelImage || imageUrl.trim() || null,
    };

    try {
      let result;
      
      if (isEditMode && editingModel) {
        // Update existing model
        result = await adminSync.updateCarModel(editingModel.id, modelData);
        
        if (result.success) {
          setModels(prev => prev.map(m => 
            m.id === editingModel.id ? { ...m, ...modelData, ...result.data } : m
          ));
          showToast(language === 'ar' ? 'تم تحديث الموديل بنجاح' : 'Model updated successfully', 'success');
        } else {
          showToast(result.error || 'Failed to update model', 'error');
        }
      } else {
        // Create new model
        result = await adminSync.createCarModel(modelData);
        
        if (result.success) {
          fetchData();
          showToast(language === 'ar' ? 'تم إضافة الموديل بنجاح' : 'Model created successfully', 'success');
        } else {
          showToast(result.error || 'Failed to create model', 'error');
        }
      }

      if (result.success) {
        setShowSuccess(true);
        resetForm();
        setTimeout(() => setShowSuccess(false), 2000);
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Error saving model');
      showToast(error.response?.data?.detail || 'Operation failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const modelToDelete = models.find(m => m.id === id);
    setModels(prev => prev.filter(m => m.id !== id));
    
    try {
      const result = await adminSync.deleteCarModel(id);
      
      if (!result.success) {
        if (modelToDelete) {
          setModels(prev => [...prev, modelToDelete]);
        }
        showToast(result.error || 'Failed to delete model', 'error');
      } else {
        showToast(language === 'ar' ? 'تم حذف الموديل بنجاح' : 'Model deleted successfully', 'success');
      }
    } catch (error) {
      if (modelToDelete) {
        setModels(prev => [...prev, modelToDelete]);
      }
      console.error('Error deleting model:', error);
      showToast(language === 'ar' ? 'فشل في حذف الموديل' : 'Failed to delete model', 'error');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Header title={language === 'ar' ? 'الموديلات' : 'Models'} showBack showSearch={false} showCart={false} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
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

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              {language === 'ar' ? 'اختر الماركة *' : 'Select Brand *'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.brandSelector}>
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
            </ScrollView>
          </View>

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

          {/* Chassis Number Input */}
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

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: showSuccess ? '#10b981' : colors.primary }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : showSuccess ? (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                <Text style={styles.saveButtonText}>
                  {language === 'ar' ? 'تم الحفظ بنجاح' : 'Saved Successfully'}
                </Text>
              </>
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

        {/* Existing Models List */}
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

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : filteredModels.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {searchQuery ? (language === 'ar' ? 'لا توجد نتائج' : 'No results found') : (language === 'ar' ? 'لا توجد موديلات' : 'No models found')}
            </Text>
          ) : (
            filteredModels.map((model) => (
              <View key={model.id} style={[styles.listItem, { borderColor: colors.border }]}>
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
                    {getBrandName(model.brand_id)} {model.year_start && model.year_end ? `(${model.year_start}-${model.year_end})` : ''}
                  </Text>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.editButton, { backgroundColor: colors.primary + '20' }]}
                    onPress={() => handleEditModel(model)}
                  >
                    <Ionicons name="create" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.deleteButton, { backgroundColor: colors.error + '20' }]}
                    onPress={() => handleDelete(model.id)}
                  >
                    <Ionicons name="trash" size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
      
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
  scrollView: { flex: 1 },
  contentContainer: { padding: 16 },
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
  brandSelector: { flexDirection: 'row' },
  brandChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  errorText: { color: '#ef4444', fontSize: 14, marginBottom: 12 },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 8, gap: 8 },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  listCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  listTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  // Search Bar Styles
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
  emptyText: { textAlign: 'center', padding: 20 },
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
});
