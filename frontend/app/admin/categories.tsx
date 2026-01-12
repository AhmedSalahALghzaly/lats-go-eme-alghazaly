import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { categoriesApi } from '../../src/services/api';
import { useAdminSync } from '../../src/services/adminSyncService';
import { Header } from '../../src/components/Header';
import { ImageUploader } from '../../src/components/ui/ImageUploader';
import { Toast } from '../../src/components/ui/FormFeedback';

export default function CategoriesAdmin() {
  const { colors } = useTheme();
  const { language, isRTL } = useTranslation();
  const router = useRouter();
  
  // Admin Sync Service for Local-First Updates
  const adminSync = useAdminSync();

  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [icon, setIcon] = useState('');
  const [categoryImage, setCategoryImage] = useState<string>('');

  // Edit mode state
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await categoriesApi.getAll();
      setCategories(response.data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter categories based on search query
  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const query = searchQuery.toLowerCase();
    return categories.filter((category) => {
      const name = (category.name || '').toLowerCase();
      const nameAr = (category.name_ar || '').toLowerCase();
      return name.includes(query) || nameAr.includes(query);
    });
  }, [categories, searchQuery]);

  const resetForm = () => {
    setName('');
    setNameAr('');
    setParentId(null);
    setIcon('');
    setCategoryImage('');
    setError('');
    setIsEditMode(false);
    setEditingCategory(null);
  };

  const handleEditCategory = (category: any) => {
    // Populate form with category data
    setName(category.name || '');
    setNameAr(category.name_ar || '');
    setParentId(category.parent_id || null);
    setIcon(category.icon || '');
    setCategoryImage(category.image_data || '');
    setEditingCategory(category);
    setIsEditMode(true);
    setError('');
  };

  const handleSave = async () => {
    if (!name.trim() || !nameAr.trim()) {
      showToast(language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields', 'error');
      return;
    }

    setSaving(true);
    setError('');

    const categoryData = {
      name: name.trim(),
      name_ar: nameAr.trim(),
      parent_id: parentId,
      icon: icon.trim() || null,
      image_data: categoryImage || null,
    };

    console.log('Saving category with image_data:', categoryImage ? 'HAS IMAGE' : 'NO IMAGE');

    try {
      let result;
      
      if (isEditMode && editingCategory) {
        // Update existing category
        result = await adminSync.updateCategory(editingCategory.id, categoryData);
        
        if (result.success) {
          setCategories(prev => prev.map(c => 
            c.id === editingCategory.id ? { ...c, ...categoryData, ...result.data } : c
          ));
          showToast(language === 'ar' ? 'تم تحديث الفئة بنجاح' : 'Category updated successfully', 'success');
        } else {
          showToast(result.error || 'Failed to update category', 'error');
        }
      } else {
        // Create new category using optimistic update via AdminSyncService
        result = await adminSync.createCategory(categoryData);
        
        if (result.success) {
          showToast(language === 'ar' ? 'تم حفظ الفئة بنجاح' : 'Category saved successfully', 'success');
          // Refresh to get server data with ID
          fetchCategories();
        } else {
          showToast(result.error || 'Error saving category', 'error');
        }
      }

      if (result.success) {
        setShowSuccess(true);
        resetForm();
        setTimeout(() => setShowSuccess(false), 2000);
      }
    } catch (error: any) {
      showToast(error.response?.data?.detail || 'Error saving category', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Optimistic delete - remove from UI immediately
    const categoryToDelete = categories.find(c => c.id === id);
    setCategories(prev => prev.filter(c => c.id !== id));
    
    try {
      const result = await adminSync.deleteCategory(id);
      
      if (!result.success) {
        // Rollback - re-add the category
        if (categoryToDelete) {
          setCategories(prev => [...prev, categoryToDelete]);
        }
        showToast(result.error || 'Failed to delete category', 'error');
      } else {
        showToast(language === 'ar' ? 'تم حذف الفئة بنجاح' : 'Category deleted successfully', 'success');
      }
    } catch (error) {
      // Rollback on error
      if (categoryToDelete) {
        setCategories(prev => [...prev, categoryToDelete]);
      }
      console.error('Error deleting category:', error);
      showToast(language === 'ar' ? 'فشل في حذف الفئة' : 'Failed to delete category', 'error');
    }
  };

  const parentCategories = categories.filter(c => !c.parent_id);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Header title={language === 'ar' ? 'الفئات' : 'Categories'} showBack showSearch={false} showCart={false} />

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
            {language === 'ar' ? 'الفئات' : 'Categories'}
          </Text>
        </View>

        {/* Add/Edit Form */}
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: isEditMode ? colors.primary : colors.border }]}>
          <View style={styles.formTitleRow}>
            <Text style={[styles.formTitle, { color: isEditMode ? colors.primary : colors.text }]}>
              {isEditMode 
                ? (language === 'ar' ? 'تعديل الفئة' : 'Edit Category')
                : (language === 'ar' ? 'إضافة فئة جديدة' : 'Add New Category')
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

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              {language === 'ar' ? 'الفئة الرئيسية (اختياري)' : 'Parent Category (Optional)'}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.parentSelector}>
              <TouchableOpacity
                style={[
                  styles.parentChip,
                  { backgroundColor: !parentId ? colors.primary : colors.surface, borderColor: colors.border }
                ]}
                onPress={() => setParentId(null)}
              >
                <Text style={{ color: !parentId ? '#FFF' : colors.text }}>
                  {language === 'ar' ? 'بدون فئة رئيسية' : 'No Parent'}
                </Text>
              </TouchableOpacity>
              {parentCategories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.parentChip,
                    { backgroundColor: parentId === cat.id ? colors.primary : colors.surface, borderColor: colors.border }
                  ]}
                  onPress={() => setParentId(cat.id)}
                >
                  <Text style={{ color: parentId === cat.id ? '#FFF' : colors.text }}>
                    {language === 'ar' ? cat.name_ar : cat.name}
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
              placeholder={language === 'ar' ? 'مثال: Engine' : 'e.g., Engine'}
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
              placeholder={language === 'ar' ? 'مثال: المحرك' : 'e.g., المحرك'}
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: colors.text }]}>
              {language === 'ar' ? 'الأيقونة (اختياري)' : 'Icon Name (Optional)'}
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              value={icon}
              onChangeText={setIcon}
              placeholder="e.g., settings"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          {/* Category Image Upload */}
          <View style={styles.formGroup}>
            <ImageUploader
              mode="single"
              value={categoryImage}
              onChange={(newImage) => setCategoryImage(newImage as string)}
              size="medium"
              shape="rounded"
              label={language === 'ar' ? 'صورة الفئة' : 'Category Image'}
              hint={language === 'ar' ? 'اختر صورة للفئة (اختياري)' : 'Choose a category image (optional)'}
            />
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

        {/* Existing Categories List */}
        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.listTitle, { color: colors.text }]}>
            {language === 'ar' ? 'الفئات الحالية' : 'Existing Categories'} ({filteredCategories.length})
          </Text>

          {/* Search Bar */}
          <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={language === 'ar' ? 'ابحث بالاسم...' : 'Search by name...'}
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
          ) : filteredCategories.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {searchQuery ? (language === 'ar' ? 'لا توجد نتائج' : 'No results found') : (language === 'ar' ? 'لا توجد فئات' : 'No categories found')}
            </Text>
          ) : (
            filteredCategories.map((category) => {
              const parent = category.parent_id ? categories.find(c => c.id === category.parent_id) : null;
              const hasImage = category.image_data && category.image_data.length > 0;
              return (
                <View key={category.id} style={[styles.listItem, { borderColor: colors.border }]}>
                  <View style={[styles.categoryIcon, { backgroundColor: hasImage ? 'transparent' : colors.primary + '20', overflow: 'hidden' }]}>
                    {hasImage ? (
                      <Image source={{ uri: category.image_data }} style={styles.categoryImage} resizeMode="cover" />
                    ) : (
                      <Ionicons name={(category.icon || 'grid') as any} size={24} color={colors.primary} />
                    )}
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryName, { color: colors.text }]}>{category.name}</Text>
                    <Text style={[styles.categoryMeta, { color: colors.textSecondary }]}>
                      {category.name_ar} {parent ? `• ${language === 'ar' ? parent.name_ar : parent.name}` : ''}
                    </Text>
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={[styles.editButton, { backgroundColor: colors.primary + '20' }]}
                      onPress={() => handleEditCategory(category)}
                    >
                      <Ionicons name="create" size={18} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.deleteButton, { backgroundColor: colors.error + '20' }]}
                      onPress={() => handleDelete(category.id)}
                    >
                      <Ionicons name="trash" size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
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
  parentSelector: { flexDirection: 'row' },
  parentChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
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
  categoryIcon: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  categoryImage: { width: 52, height: 52, borderRadius: 12 },
  categoryInfo: { flex: 1, marginLeft: 12 },
  categoryName: { fontSize: 16, fontWeight: '600' },
  categoryMeta: { fontSize: 13, marginTop: 2 },
  actionButtons: { flexDirection: 'column', gap: 8 },
  editButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  deleteButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
