import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Image, Modal } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { productsApi, productBrandsApi, categoriesApi, carModelsApi, carBrandsApi } from '../../src/services/api';
import { useAdminSync } from '../../src/services/adminSyncService';
import { useDataCacheStore } from '../../src/store/useDataCacheStore';
import { Header } from '../../src/components/Header';
import { ImageUploader } from '../../src/components/ui/ImageUploader';
import { Toast, SaveButton } from '../../src/components/ui/FormFeedback';

export default function ProductsAdmin() {
  const { colors } = useTheme();
  const { language, isRTL } = useTranslation();
  const router = useRouter();
  
  // Admin Sync Service for Local-First Updates
  const adminSync = useAdminSync();
  const cacheStore = useDataCacheStore();

  const [products, setProducts] = useState<any[]>([]);
  const [productBrands, setProductBrands] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [carModels, setCarModels] = useState<any[]>([]);
  const [carBrands, setCarBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');

  // Toast state for feedback
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  // Form state - Basic Info
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [description, setDescription] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [price, setPrice] = useState('');
  const [sku, setSku] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');

  // Form state - Relationship Fields
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedCarModelIds, setSelectedCarModelIds] = useState<string[]>([]);

  // Form state - Images (multiple)
  const [images, setImages] = useState<string[]>([]);

  // Delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [productToDelete, setProductToDelete] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  // Quantity editing state
  const [editingQuantityId, setEditingQuantityId] = useState<string | null>(null);
  const [quantityInputs, setQuantityInputs] = useState<{ [key: string]: string }>({});
  const [updatingQuantityId, setUpdatingQuantityId] = useState<string | null>(null);

  // Edit mode state
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Relationship search states
  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [carModelSearchQuery, setCarModelSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [productsRes, brandsRes, catsRes, modelsRes, carBrandsRes] = await Promise.all([
        productsApi.getAllAdmin(),
        productBrandsApi.getAll(),
        categoriesApi.getAll(),
        carModelsApi.getAll(),
        carBrandsApi.getAll(),
      ]);
      const productsList = productsRes.data?.products || [];
      setProducts(productsList);
      setProductBrands(brandsRes.data || []);
      setCategories(catsRes.data || []);
      setCarModels(modelsRes.data || []);
      setCarBrands(carBrandsRes.data || []);
      
      // Initialize quantity inputs
      const quantities: { [key: string]: string } = {};
      productsList.forEach((p: any) => {
        quantities[p.id] = (p.stock_quantity || p.stock || 0).toString();
      });
      setQuantityInputs(quantities);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

 

  const handleSave = async () => {
    if (!name.trim() || !nameAr.trim() || !price || !sku || !selectedBrandId || !selectedCategoryId) {
      setError(language === 'ar' ? 'يرجى ملء جميع الحقول المطلوبة' : 'Please fill all required fields');
      return;
    }

    setSaving(true);
    setError('');

    const productData = {
      name: name.trim(),
      name_ar: nameAr.trim(),
      description: description.trim() || null,
      description_ar: descriptionAr.trim() || null,
      price: parseFloat(price),
      sku: sku.trim(),
      image_url: images.length > 0 ? images[0] : null,
      images: images,
      product_brand_id: selectedBrandId,
      category_id: selectedCategoryId,
      car_model_ids: selectedCarModelIds,
      stock_quantity: parseInt(stockQuantity) || 0,
    };

    try {
      let result;
      
      if (isEditMode && editingProduct) {
        // Update existing product with optimistic update
        result = await adminSync.updateProduct(editingProduct.id, productData);
        
        if (result.success) {
          // Update local state immediately (already done in adminSync)
          setProducts(prev => prev.map(p => 
            p.id === editingProduct.id ? { ...p, ...productData, ...result.data } : p
          ));
          showToast(language === 'ar' ? 'تم تحديث المنتج بنجاح' : 'Product updated successfully', 'success');
        } else {
          setError(result.error || 'Failed to update product');
          showToast(result.error || 'Failed to update product', 'error');
        }
      } else {
        // Create new product with optimistic update
        result = await adminSync.createProduct(productData);
        
        if (result.success) {
          // Product already added to store optimistically
          // Refresh to get the server ID
          const productsRes = await productsApi.getAllAdmin();
          setProducts(productsRes.data?.products || []);
          showToast(language === 'ar' ? 'تم إضافة المنتج بنجاح' : 'Product created successfully', 'success');
        } else {
          setError(result.error || 'Failed to create product');
          showToast(result.error || 'Failed to create product', 'error');
        }
      }

      if (result.success) {
        setShowSuccess(true);
        resetForm();
        setTimeout(() => setShowSuccess(false), 2000);
      }
    } catch (error: any) {
      setError(error.response?.data?.detail || (isEditMode ? 'Error updating product' : 'Error saving product'));
      showToast(error.response?.data?.detail || 'Operation failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const resetForm = () => {
    setName('');
    setNameAr('');
    setDescription('');
    setDescriptionAr('');
    setPrice('');
    setSku('');
    setStockQuantity('0');
    setImages([]);
    setSelectedBrandId('');
    setSelectedCategoryId('');
    setSelectedCarModelIds([]);
    setIsEditMode(false);
    setEditingProduct(null);
  };

  const handleEditProduct = (product: any) => {
    // Populate form with product data
    setName(product.name || '');
    setNameAr(product.name_ar || '');
    setDescription(product.description || '');
    setDescriptionAr(product.description_ar || '');
    setPrice(product.price?.toString() || '');
    setSku(product.sku || '');
    setStockQuantity((product.stock_quantity || product.stock || 0).toString());
    setImages(product.images || (product.image_url ? [product.image_url] : []));
    setSelectedBrandId(product.product_brand_id || '');
    setSelectedCategoryId(product.category_id || '');
    setSelectedCarModelIds(product.car_model_ids || []);
    setEditingProduct(product);
    setIsEditMode(true);
    
    // Scroll to form (optional visual feedback)
    setError('');
  };

  const openDeleteConfirm = (product: any) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    setDeleting(true);
    
    // Optimistic delete - remove from local state immediately
    setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
    
    try {
      const result = await adminSync.deleteProduct(productToDelete.id);
      
      if (result.success) {
        showToast(language === 'ar' ? 'تم حذف المنتج بنجاح' : 'Product deleted successfully', 'success');
      } else {
        // Rollback - re-add the product
        setProducts(prev => [productToDelete, ...prev]);
        showToast(result.error || 'Failed to delete product', 'error');
      }
      
      setShowDeleteModal(false);
      setProductToDelete(null);
    } catch (error: any) {
      // Rollback on error
      setProducts(prev => [productToDelete, ...prev]);
      showToast(error.response?.data?.detail || 'Error deleting product', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleUpdateQuantity = async (productId: string) => {
    const newQuantity = parseInt(quantityInputs[productId]) || 0;
    
    setUpdatingQuantityId(productId);
    try {
      // Update the product with new stock quantity
      const product = products.find(p => p.id === productId);
      if (product) {
        await productsApi.update(productId, {
          ...product,
          stock_quantity: newQuantity,
        });
        // Update local state
        setProducts(prev => prev.map(p => 
          p.id === productId ? { ...p, stock_quantity: newQuantity, stock: newQuantity } : p
        ));
      }
    } catch (error) {
      console.error('Error updating quantity:', error);
    } finally {
      setUpdatingQuantityId(null);
    }
  };

  const toggleCarModel = (modelId: string) => {
    setSelectedCarModelIds((prev) =>
      prev.includes(modelId) ? prev.filter((id) => id !== modelId) : [...prev, modelId]
    );
  };

  const getBrandName = useCallback((brandId: string) => {
    const brand = productBrands.find((b) => b.id === brandId);
    return language === 'ar' ? brand?.name_ar : brand?.name;
  }, [productBrands, language]);

  const getCategoryName = useCallback((catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    return language === 'ar' ? cat?.name_ar : cat?.name;
  }, [categories, language]);

  const getCarModelNames = useCallback((modelIds: string[]) => {
    return modelIds
      .map((id) => {
        const model = carModels.find((m) => m.id === id);
        return language === 'ar' ? model?.name_ar : model?.name;
      })
      .filter(Boolean)
      .join(', ');
  }, [carModels, language]);

  const getSelectedBrandName = () => {
    if (!selectedBrandId) return null;
    const brand = productBrands.find((b) => b.id === selectedBrandId);
    return language === 'ar' ? brand?.name_ar : brand?.name;
  };

  // Filtered products for FlashList
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter((product) => {
      const name = (product.name || '').toLowerCase();
      const nameAr = (product.name_ar || '').toLowerCase();
      const sku = (product.sku || '').toLowerCase();
      return name.includes(query) || nameAr.includes(query) || sku.includes(query);
    });
  }, [products, searchQuery]);

  // Render product item for FlashList
  const renderProductItem = useCallback(({ item: product }: { item: any }) => (
    <View style={[styles.productCard, { borderColor: colors.border }]}>
      <View style={styles.productHeader}>
        {product.image_url || (product.images && product.images.length > 0) ? (
          <Image 
            source={{ uri: product.images?.[0] || product.image_url }} 
            style={styles.productImage} 
          />
        ) : (
          <View style={[styles.productImagePlaceholder, { backgroundColor: colors.surface }]}>
            <Ionicons name="cube" size={24} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.productMainInfo}>
          <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>
            {language === 'ar' ? product.name_ar : product.name}
          </Text>
          <Text style={[styles.productSku, { color: colors.textSecondary }]}>
            SKU: {product.sku}
          </Text>
          <Text style={[styles.productPrice, { color: colors.primary }]}>
            {product.price?.toFixed(2)} ج.م
          </Text>
        </View>
        
        {/* Action Buttons Container */}
        <View style={styles.actionButtonsContainer}>
          {/* Delete Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
            onPress={() => openDeleteConfirm(product)}
          >
            <Ionicons name="trash" size={18} color={colors.error} />
          </TouchableOpacity>
          
          {/* Edit Button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
            onPress={() => handleEditProduct(product)}
          >
            <Ionicons name="create" size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Product Relationships Display */}
      <View style={[styles.productMeta, { backgroundColor: colors.surface }]}>
        <View style={styles.metaRow}>
          <Ionicons name="pricetag" size={12} color={colors.textSecondary} />
          <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'الماركة:' : 'Brand:'}
          </Text>
          <Text style={[styles.metaValue, { color: colors.text }]}>
            {getBrandName(product.product_brand_id) || '-'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="grid" size={12} color={colors.textSecondary} />
          <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'الفئة:' : 'Category:'}
          </Text>
          <Text style={[styles.metaValue, { color: colors.text }]}>
            {getCategoryName(product.category_id) || '-'}
          </Text>
        </View>
        {product.car_model_ids?.length > 0 && (
          <View style={styles.metaRow}>
            <Ionicons name="car" size={12} color={colors.textSecondary} />
            <Text style={[styles.metaLabel, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'الموديلات:' : 'Models:'}
            </Text>
            <Text style={[styles.metaValue, { color: colors.text }]} numberOfLines={1}>
              {getCarModelNames(product.car_model_ids)}
            </Text>
          </View>
        )}
      </View>

      {/* Quantity Display and Edit Section */}
      <View style={styles.quantitySection}>
        {/* Current Quantity Display (Green Field) */}
        <View style={[styles.currentQuantity, { backgroundColor: '#10b981' }]}>
          <Ionicons name="cube" size={14} color="#FFF" />
          <Text style={styles.currentQuantityText}>
            {product.stock_quantity || product.stock || 0}
          </Text>
        </View>

        {/* Edit Quantity Input */}
        <TextInput
          style={[styles.quantityInput, { 
            backgroundColor: colors.surface, 
            borderColor: colors.border, 
            color: colors.text 
          }]}
          value={quantityInputs[product.id] || '0'}
          onChangeText={(text) => setQuantityInputs({ ...quantityInputs, [product.id]: text })}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={colors.textSecondary}
        />

        {/* Update Quantity Button (Yellow with Checkmark) */}
        <TouchableOpacity
          style={[styles.updateQuantityBtn, { backgroundColor: '#f59e0b' }]}
          onPress={() => handleUpdateQuantity(product.id)}
          disabled={updatingQuantityId === product.id}
        >
          {updatingQuantityId === product.id ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="checkmark" size={16} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  ), [colors, language, quantityInputs, updatingQuantityId, getBrandName, getCategoryName, getCarModelNames, handleEditProduct, handleUpdateQuantity, openDeleteConfirm]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Header title={language === 'ar' ? 'المنتجات' : 'Products'} showBack showSearch={false} showCart={false} />

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
            {language === 'ar' ? 'المنتجات' : 'Products'}
          </Text>
        </View>

        {/* Add New Form */}
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: isEditMode ? colors.primary : colors.border }]}>
          <View style={styles.formTitleRow}>
            <Text style={[styles.formTitle, { color: isEditMode ? colors.primary : colors.text }]}>
              {isEditMode 
                ? (language === 'ar' ? 'تعديل المنتج' : 'Edit Product')
                : (language === 'ar' ? 'إضافة منتج جديد' : 'Add New Product')
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

          {/* Section 1: Basic Product Information */}
          <View style={[styles.formSection, { borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.primary }]}>
              <Ionicons name="information-circle" size={14} /> {language === 'ar' ? 'المعلومات الأساسية' : 'Basic Information'}
            </Text>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'اسم المنتج (بالإنجليزية) *' : 'Product Name (English) *'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={name}
                onChangeText={setName}
                placeholder={language === 'ar' ? 'مثال: Oil Filter' : 'e.g., Oil Filter'}
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'اسم المنتج (بالعربية) *' : 'Product Name (Arabic) *'}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }, isRTL && styles.inputRTL]}
                value={nameAr}
                onChangeText={setNameAr}
                placeholder={language === 'ar' ? 'مثال: فلتر زيت' : 'e.g., فلتر زيت'}
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'الوصف (بالإنجليزية)' : 'Description (English)'}
              </Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                value={description}
                onChangeText={setDescription}
                placeholder={language === 'ar' ? 'وصف تفصيلي للمنتج...' : 'Detailed product description...'}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'الوصف (بالعربية)' : 'Description (Arabic)'}
              </Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }, isRTL && styles.inputRTL]}
                value={descriptionAr}
                onChangeText={setDescriptionAr}
                placeholder={language === 'ar' ? 'وصف تفصيلي بالعربية...' : 'Arabic description...'}
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.text }]}>SKU *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={sku}
                  onChangeText={setSku}
                  placeholder="ABC-123"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 12 }]}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {language === 'ar' ? 'السعر *' : 'Price *'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 12 }]}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {language === 'ar' ? 'الكمية' : 'Stock'}
                </Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={stockQuantity}
                  onChangeText={setStockQuantity}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>
          </View>

          {/* Section 2: Product Relationships */}
          <View style={[styles.formSection, { borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.primary }]}>
              <Ionicons name="link" size={14} /> {language === 'ar' ? 'التصنيفات والعلاقات' : 'Classifications & Relations'}
            </Text>

            {/* Product Brand Selection */}
            <View style={styles.formGroup}>
              <View style={styles.labelWithSearch}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {language === 'ar' ? 'ماركة المنتج *' : 'Product Brand *'}
                </Text>
                <View style={[styles.miniSearchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="search" size={14} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.miniSearchInput, { color: colors.text }]}
                    value={brandSearchQuery}
                    onChangeText={setBrandSearchQuery}
                    placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
                    placeholderTextColor={colors.textSecondary}
                  />
                  {brandSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setBrandSearchQuery('')}>
                      <Ionicons name="close-circle" size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'اختر الماركة المصنعة للمنتج' : 'Select the product manufacturer brand'}
              </Text>
              
              {/* Selected Brand Display */}
              {selectedBrandId && (
                <View style={[styles.selectedDisplay, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
                  {productBrands.find(b => b.id === selectedBrandId)?.logo && (
                    <Image 
                      source={{ uri: productBrands.find(b => b.id === selectedBrandId)?.logo }} 
                      style={styles.selectedBrandLogo} 
                    />
                  )}
                  <Ionicons name="pricetag" size={16} color={colors.primary} />
                  <Text style={[styles.selectedText, { color: colors.primary }]}>
                    {getSelectedBrandName()}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedBrandId('')}>
                    <Ionicons name="close-circle" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                {productBrands
                  .filter((brand) => {
                    if (!brandSearchQuery.trim()) return true;
                    const query = brandSearchQuery.toLowerCase();
                    const name = (brand.name || '').toLowerCase();
                    const nameAr = (brand.name_ar || '').toLowerCase();
                    return name.includes(query) || nameAr.includes(query);
                  })
                  .map((brand) => (
                  <TouchableOpacity
                    key={brand.id}
                    style={[
                      styles.brandChip,
                      { 
                        backgroundColor: selectedBrandId === brand.id ? colors.primary : colors.surface, 
                        borderColor: selectedBrandId === brand.id ? colors.primary : colors.border 
                      }
                    ]}
                    onPress={() => setSelectedBrandId(brand.id)}
                  >
                    {brand.logo ? (
                      <Image 
                        source={{ uri: brand.logo }} 
                        style={[
                          styles.brandChipLogo,
                          { borderColor: selectedBrandId === brand.id ? 'rgba(255,255,255,0.3)' : colors.border }
                        ]} 
                      />
                    ) : (
                      <View style={[styles.brandChipPlaceholder, { backgroundColor: colors.border }]}>
                        <Ionicons name="pricetag" size={14} color={colors.textSecondary} />
                      </View>
                    )}
                    {selectedBrandId === brand.id && (
                      <Ionicons name="checkmark-circle" size={14} color="#FFF" style={{ marginLeft: 4 }} />
                    )}
                    <Text style={{ color: selectedBrandId === brand.id ? '#FFF' : colors.text, fontSize: 12, fontWeight: '500' }}>
                      {language === 'ar' ? brand.name_ar : brand.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Category Selection */}
            <View style={styles.formGroup}>
              <View style={styles.labelWithSearch}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {language === 'ar' ? 'الفئة *' : 'Category *'}
                </Text>
                <View style={[styles.miniSearchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="search" size={14} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.miniSearchInput, { color: colors.text }]}
                    value={categorySearchQuery}
                    onChangeText={setCategorySearchQuery}
                    placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
                    placeholderTextColor={colors.textSecondary}
                  />
                  {categorySearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setCategorySearchQuery('')}>
                      <Ionicons name="close-circle" size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'اختر فئة المنتج' : 'Select product category'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                {categories
                  .filter((cat) => {
                    if (!categorySearchQuery.trim()) return true;
                    const query = categorySearchQuery.toLowerCase();
                    const name = (cat.name || '').toLowerCase();
                    const nameAr = (cat.name_ar || '').toLowerCase();
                    return name.includes(query) || nameAr.includes(query);
                  })
                  .map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      { 
                        backgroundColor: selectedCategoryId === cat.id ? colors.primary : colors.surface, 
                        borderColor: selectedCategoryId === cat.id ? colors.primary : colors.border 
                      }
                    ]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                  >
                    {/* Category Image/Icon */}
                    {(cat.image_data || cat.icon) ? (
                      <Image 
                        source={{ uri: cat.image_data || cat.icon }} 
                        style={[
                          styles.categoryChipImage,
                          { borderColor: selectedCategoryId === cat.id ? 'rgba(255,255,255,0.3)' : colors.border }
                        ]} 
                      />
                    ) : (
                      <View style={[styles.categoryChipPlaceholder, { backgroundColor: colors.border }]}>
                        <Ionicons name="grid" size={14} color={colors.textSecondary} />
                      </View>
                    )}
                    {selectedCategoryId === cat.id && (
                      <Ionicons name="checkmark" size={14} color="#FFF" style={{ marginLeft: 2 }} />
                    )}
                    <Text style={{ color: selectedCategoryId === cat.id ? '#FFF' : colors.text, fontSize: 13, fontWeight: '500' }}>
                      {language === 'ar' ? cat.name_ar : cat.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Car Models Selection */}
            <View style={styles.formGroup}>
              <View style={styles.labelWithSearch}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {language === 'ar' ? 'موديلات السيارات المتوافقة' : 'Compatible Car Models'}
                </Text>
                <View style={[styles.miniSearchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="search" size={14} color={colors.textSecondary} />
                  <TextInput
                    style={[styles.miniSearchInput, { color: colors.text }]}
                    value={carModelSearchQuery}
                    onChangeText={setCarModelSearchQuery}
                    placeholder={language === 'ar' ? 'بحث...' : 'Search...'}
                    placeholderTextColor={colors.textSecondary}
                  />
                  {carModelSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setCarModelSearchQuery('')}>
                      <Ionicons name="close-circle" size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'اختر موديلات السيارات المتوافقة (يمكن اختيار أكثر من موديل)' : 'Select compatible car models (multiple selection allowed)'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                {carModels
                  .filter((model) => {
                    if (!carModelSearchQuery.trim()) return true;
                    const query = carModelSearchQuery.toLowerCase();
                    const name = (model.name || '').toLowerCase();
                    const nameAr = (model.name_ar || '').toLowerCase();
                    return name.includes(query) || nameAr.includes(query);
                  })
                  .map((model) => {
                    const isSelected = selectedCarModelIds.includes(model.id);
                    const yearRange = model.year_start && model.year_end 
                      ? `${model.year_start} - ${model.year_end}`
                      : model.year_start 
                        ? `${model.year_start}+`
                        : null;
                    
                    return (
                      <TouchableOpacity
                        key={model.id}
                        style={[
                          styles.carModelChip,
                          { 
                            backgroundColor: isSelected ? '#10b981' : colors.surface, 
                            borderColor: isSelected ? '#10b981' : colors.border 
                          }
                        ]}
                        onPress={() => toggleCarModel(model.id)}
                      >
                        {/* Car Model Image */}
                        {model.image_url ? (
                          <Image 
                            source={{ uri: model.image_url }} 
                            style={[
                              styles.carModelChipImage,
                              { borderColor: isSelected ? 'rgba(255,255,255,0.3)' : colors.border }
                            ]} 
                          />
                        ) : (
                          <View style={[styles.carModelChipPlaceholder, { backgroundColor: colors.border }]}>
                            <Ionicons name="car" size={16} color={colors.textSecondary} />
                          </View>
                        )}
                        
                        <View style={styles.carModelChipTextContainer}>
                          <View style={styles.carModelNameRow}>
                            {isSelected && (
                              <Ionicons name="checkmark" size={14} color="#FFF" style={{ marginRight: 4 }} />
                            )}
                            <Text style={{ color: isSelected ? '#FFF' : colors.text, fontSize: 13, fontWeight: '500' }} numberOfLines={1}>
                              {language === 'ar' ? model.name_ar : model.name}
                            </Text>
                          </View>
                          {yearRange && (
                            <Text style={[styles.carModelYearText, { color: isSelected ? 'rgba(255,255,255,0.75)' : colors.textSecondary }]}>
                              {yearRange}
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </ScrollView>
              {selectedCarModelIds.length > 0 && (
                <Text style={[styles.selectedCount, { color: colors.primary }]}>
                  {language === 'ar' ? `تم اختيار ${selectedCarModelIds.length} موديل` : `${selectedCarModelIds.length} models selected`}
                </Text>
              )}
            </View>
          </View>

          {/* Section 3: Product Images */}
          <View style={[styles.formSection, { borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.primary }]}>
              <Ionicons name="images" size={14} /> {language === 'ar' ? 'صور المنتج' : 'Product Images'}
            </Text>
            
            <ImageUploader
              mode="multiple"
              value={images}
              onChange={(newImages) => setImages(newImages as string[])}
              maxImages={5}
              size="medium"
              label={language === 'ar' ? 'صور المنتج' : 'Product Images'}
              hint={language === 'ar' ? 'يمكنك إضافة حتى 5 صور' : 'You can add up to 5 images'}
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
                    ? (language === 'ar' ? 'تحديث المنتج' : 'Update Product')
                    : (language === 'ar' ? 'حفظ المنتج' : 'Save Product')
                  }
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Existing Products List */}
        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.listTitle, { color: colors.text }]}>
            {language === 'ar' ? 'المنتجات الحالية' : 'Existing Products'} ({products.length})
          </Text>

          {/* Search Bar */}
          <View style={[styles.searchContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={language === 'ar' ? 'ابحث بالاسم أو رمز SKU...' : 'Search by name or SKU...'}
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
          ) : products.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'لا توجد منتجات' : 'No products found'}
            </Text>
          ) : (
            <View style={styles.flashListContainer}>
              <FlashList
                data={filteredProducts}
                renderItem={renderProductItem}
                keyExtractor={(product) => product.id}
                estimatedItemSize={200}
                scrollEnabled={false}
                extraData={{ quantityInputs, updatingQuantityId }}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.deleteConfirmModal, { backgroundColor: colors.card }]}>
            {/* Close Button (X) */}
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => {
                setShowDeleteModal(false);
                setProductToDelete(null);
              }}
            >
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </TouchableOpacity>

            {/* Delete Icon */}
            <View style={[styles.deleteIconCircle, { backgroundColor: '#ef4444' + '20' }]}>
              <Ionicons name="trash" size={36} color="#ef4444" />
            </View>

            {/* Confirmation Text */}
            <Text style={[styles.deleteConfirmText, { color: colors.text }]}>
              {language === 'ar' 
                ? 'هل أنت متأكد من حذف هذا المنتج؟'
                : 'Are you sure you want to delete this product?'}
            </Text>

            {/* Product Name */}
            {productToDelete && (
              <Text style={[styles.deleteProductName, { color: colors.textSecondary }]}>
                {language === 'ar' ? productToDelete.name_ar : productToDelete.name}
              </Text>
            )}

            {/* Delete Button (inside oval) */}
            <TouchableOpacity
              style={[styles.confirmDeleteBtn, { backgroundColor: '#ef4444' }]}
              onPress={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Ionicons name="trash" size={18} color="#FFF" />
                  <Text style={styles.confirmDeleteBtnText}>
                    {language === 'ar' ? 'حذف' : 'Delete'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Toast Component */}
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
  flashListContainer: { minHeight: 300 },
  breadcrumb: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  breadcrumbRTL: { flexDirection: 'row-reverse' },
  breadcrumbText: { fontSize: 14 },
  formCard: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 16 },
  formTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  formTitle: { fontSize: 20, fontWeight: '700' },
  cancelEditBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
  cancelEditText: { fontSize: 14, fontWeight: '600' },
  formSection: { borderBottomWidth: 1, paddingBottom: 20, marginBottom: 20 },
  sectionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 16, flexDirection: 'row', alignItems: 'center' },
  formGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  fieldHint: { fontSize: 12, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  inputRTL: { textAlign: 'right' },
  textArea: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row' },
  selectedDisplay: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 8, 
    borderWidth: 1, 
    marginBottom: 10,
    gap: 8,
  },
  selectedText: { flex: 1, fontSize: 14, fontWeight: '600' },
  selectedBrandLogo: { width: 24, height: 24, borderRadius: 12 },
  chipsContainer: { flexDirection: 'row', marginTop: 4 },
  chip: { 
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14, 
    paddingVertical: 8, 
    borderRadius: 20, 
    borderWidth: 1, 
    marginRight: 8,
    marginBottom: 8,
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 10,
    marginBottom: 8,
    gap: 6,
  },
  brandChipLogo: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
  },
  brandChipPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedCount: { fontSize: 12, marginTop: 8, fontWeight: '500' },
  // New styles for enhanced UI
  labelWithSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  miniSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
    minWidth: 100,
    maxWidth: 150,
  },
  miniSearchInput: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 10,
    marginBottom: 8,
    gap: 6,
  },
  categoryChipImage: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryChipPlaceholder: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carModelChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 10,
    marginBottom: 8,
    gap: 8,
    minWidth: 120,
  },
  carModelChipImage: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
  },
  carModelChipPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  carModelChipTextContainer: {
    flexDirection: 'column',
    flex: 1,
  },
  carModelNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carModelYearText: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '400',
  },
  errorText: { color: '#ef4444', fontSize: 14, marginBottom: 12 },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, gap: 8 },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
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
  productCard: { borderBottomWidth: 1, paddingVertical: 12 },
  productHeader: { flexDirection: 'row', alignItems: 'center' },
  productImage: { width: 56, height: 56, borderRadius: 10 },
  productImagePlaceholder: { width: 56, height: 56, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  productMainInfo: { flex: 1, marginLeft: 12 },
  productName: { fontSize: 15, fontWeight: '600' },
  productSku: { fontSize: 12, marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: '700', marginTop: 2 },
  // Action Buttons
  actionButtonsContainer: {
    flexDirection: 'column',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  productMeta: { marginTop: 10, padding: 10, borderRadius: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 6 },
  metaLabel: { fontSize: 12 },
  metaValue: { fontSize: 12, fontWeight: '500', flex: 1 },
  // Quantity Section
  quantitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  currentQuantity: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  currentQuantityText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  quantityInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    textAlign: 'center',
  },
  updateQuantityBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  deleteConfirmModal: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    position: 'relative',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  deleteConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  deleteProductName: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  confirmDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
    minWidth: 120,
  },
  confirmDeleteBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
