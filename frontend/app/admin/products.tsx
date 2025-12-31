import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { productsApi, productBrandsApi, categoriesApi, carModelsApi, carBrandsApi } from '../../src/services/api';
import { Header } from '../../src/components/Header';
import { ImageUploader } from '../../src/components/ui/ImageUploader';
import { Toast, SaveButton } from '../../src/components/ui/FormFeedback';

export default function ProductsAdmin() {
  const { colors } = useTheme();
  const { language, isRTL } = useTranslation();
  const router = useRouter();

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

    try {
      await productsApi.create({
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
      });

      setShowSuccess(true);
      // Reset form
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
      fetchData();

      setTimeout(() => setShowSuccess(false), 2000);
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Error saving product');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteConfirm = (product: any) => {
    setProductToDelete(product);
    setShowDeleteModal(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;

    setDeleting(true);
    try {
      await productsApi.delete(productToDelete.id);
      setShowDeleteModal(false);
      setProductToDelete(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting product:', error);
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

  const getBrandName = (brandId: string) => {
    const brand = productBrands.find((b) => b.id === brandId);
    return language === 'ar' ? brand?.name_ar : brand?.name;
  };

  const getCategoryName = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    return language === 'ar' ? cat?.name_ar : cat?.name;
  };

  const getCarModelNames = (modelIds: string[]) => {
    return modelIds
      .map((id) => {
        const model = carModels.find((m) => m.id === id);
        return language === 'ar' ? model?.name_ar : model?.name;
      })
      .filter(Boolean)
      .join(', ');
  };

  const getSelectedBrandName = () => {
    if (!selectedBrandId) return null;
    const brand = productBrands.find((b) => b.id === selectedBrandId);
    return language === 'ar' ? brand?.name_ar : brand?.name;
  };

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
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.text }]}>
            {language === 'ar' ? 'إضافة منتج جديد' : 'Add New Product'}
          </Text>

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
              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'ماركة المنتج *' : 'Product Brand *'}
              </Text>
              <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'اختر الماركة المصنعة للمنتج' : 'Select the product manufacturer brand'}
              </Text>
              
              {/* Selected Brand Display */}
              {selectedBrandId && (
                <View style={[styles.selectedDisplay, { backgroundColor: colors.primary + '15', borderColor: colors.primary }]}>
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
                {productBrands.map((brand) => (
                  <TouchableOpacity
                    key={brand.id}
                    style={[
                      styles.chip,
                      { 
                        backgroundColor: selectedBrandId === brand.id ? colors.primary : colors.surface, 
                        borderColor: selectedBrandId === brand.id ? colors.primary : colors.border 
                      }
                    ]}
                    onPress={() => setSelectedBrandId(brand.id)}
                  >
                    {selectedBrandId === brand.id && (
                      <Ionicons name="checkmark" size={14} color="#FFF" style={{ marginRight: 4 }} />
                    )}
                    <Text style={{ color: selectedBrandId === brand.id ? '#FFF' : colors.text, fontSize: 13, fontWeight: '500' }}>
                      {language === 'ar' ? brand.name_ar : brand.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Category Selection */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'الفئة *' : 'Category *'}
              </Text>
              <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'اختر فئة المنتج' : 'Select product category'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.chip,
                      { 
                        backgroundColor: selectedCategoryId === cat.id ? colors.primary : colors.surface, 
                        borderColor: selectedCategoryId === cat.id ? colors.primary : colors.border 
                      }
                    ]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                  >
                    {selectedCategoryId === cat.id && (
                      <Ionicons name="checkmark" size={14} color="#FFF" style={{ marginRight: 4 }} />
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
              <Text style={[styles.label, { color: colors.text }]}>
                {language === 'ar' ? 'موديلات السيارات المتوافقة' : 'Compatible Car Models'}
              </Text>
              <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
                {language === 'ar' ? 'اختر موديلات السيارات المتوافقة (يمكن اختيار أكثر من موديل)' : 'Select compatible car models (multiple selection allowed)'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsContainer}>
                {carModels.map((model) => (
                  <TouchableOpacity
                    key={model.id}
                    style={[
                      styles.chip,
                      { 
                        backgroundColor: selectedCarModelIds.includes(model.id) ? '#10b981' : colors.surface, 
                        borderColor: selectedCarModelIds.includes(model.id) ? '#10b981' : colors.border 
                      }
                    ]}
                    onPress={() => toggleCarModel(model.id)}
                  >
                    {selectedCarModelIds.includes(model.id) && (
                      <Ionicons name="checkmark" size={14} color="#FFF" style={{ marginRight: 4 }} />
                    )}
                    <Text style={{ color: selectedCarModelIds.includes(model.id) ? '#FFF' : colors.text, fontSize: 13, fontWeight: '500' }}>
                      {language === 'ar' ? model.name_ar : model.name}
                    </Text>
                  </TouchableOpacity>
                ))}
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
            <Text style={[styles.fieldHint, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'يمكنك إضافة صور متعددة للمنتج' : 'You can add multiple product images'}
            </Text>

            <ImageUploader
              images={images}
              onImagesChange={setImages}
              maxImages={5}
              language={language}
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
                <Ionicons name="save" size={20} color="#FFF" />
                <Text style={styles.saveButtonText}>
                  {language === 'ar' ? 'حفظ المنتج' : 'Save Product'}
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

          {loading ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : products.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {language === 'ar' ? 'لا توجد منتجات' : 'No products found'}
            </Text>
          ) : (
            products.map((product) => (
              <View key={product.id} style={[styles.productCard, { borderColor: colors.border }]}>
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
                  
                  {/* Delete Button */}
                  <TouchableOpacity
                    style={[styles.deleteButton, { backgroundColor: colors.error + '20' }]}
                    onPress={() => openDeleteConfirm(product)}
                  >
                    <Ionicons name="trash" size={18} color={colors.error} />
                  </TouchableOpacity>
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
            ))
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
  formTitle: { fontSize: 20, fontWeight: '700', marginBottom: 20 },
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
  selectedCount: { fontSize: 12, marginTop: 8, fontWeight: '500' },
  errorText: { color: '#ef4444', fontSize: 14, marginBottom: 12 },
  saveButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, gap: 8 },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  listCard: { borderRadius: 12, borderWidth: 1, padding: 16 },
  listTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  emptyText: { textAlign: 'center', padding: 20 },
  productCard: { borderBottomWidth: 1, paddingVertical: 12 },
  productHeader: { flexDirection: 'row', alignItems: 'center' },
  productImage: { width: 56, height: 56, borderRadius: 10 },
  productImagePlaceholder: { width: 56, height: 56, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  productMainInfo: { flex: 1, marginLeft: 12 },
  productName: { fontSize: 15, fontWeight: '600' },
  productSku: { fontSize: 12, marginTop: 2 },
  productPrice: { fontSize: 14, fontWeight: '700', marginTop: 2 },
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
