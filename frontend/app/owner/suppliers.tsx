/**
 * Suppliers Management - Full CRUD with Brand Linkage
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../../src/store/appStore';
import { useTheme } from '../../src/hooks/useTheme';
import { supplierApi, productBrandApi } from '../../src/services/api';
import { VoidDeleteGesture } from '../../src/components/ui/VoidDeleteGesture';
import { ErrorCapsule } from '../../src/components/ui/ErrorCapsule';
import { ConfettiEffect } from '../../src/components/ui/ConfettiEffect';
import { ImageUploader } from '../../src/components/ui/ImageUploader';
import { Toast } from '../../src/components/ui/FormFeedback';
import { BrandCardHorizontal } from '../../src/components/BrandCardHorizontal';

type ViewMode = 'list' | 'add' | 'edit' | 'profile';

export default function SuppliersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ viewMode?: string; id?: string }>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const language = useAppStore((state) => state.language);
  const suppliers = useAppStore((state) => state.suppliers);
  const setSuppliers = useAppStore((state) => state.setSuppliers);
  const productBrands = useAppStore((state) => state.productBrands);
  const user = useAppStore((state) => state.user);
  const isRTL = language === 'ar';
  
  // Check if user is owner or admin
  const isOwnerOrAdmin = user?.role === 'owner' || user?.role === 'admin' || user?.is_admin;

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  
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
  });

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'warning' | 'info'>('success');

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  };

  const fetchSuppliers = async () => {
    try {
      const res = await supplierApi.getAll();
      setSuppliers(res.data || []);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSuppliers();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  // Handle URL params for direct navigation to profile
  useEffect(() => {
    if (params.viewMode === 'profile' && params.id) {
      const supplier = suppliers.find((s: any) => s.id === params.id);
      if (supplier) {
        setSelectedSupplier(supplier);
        setViewMode('profile');
      }
    }
  }, [params.viewMode, params.id, suppliers]);

  const resetForm = () => {
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
    });
  };

  const handleAddSupplier = async () => {
    if (!formData.name.trim()) {
      setError(isRTL ? 'الاسم مطلوب' : 'Name is required');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const newSupplier = { id: tempId, ...formData, created_at: new Date().toISOString() };

    // Optimistic update
    setSuppliers([newSupplier, ...suppliers]);
    setShowConfetti(true);
    setViewMode('list');
    resetForm();

    try {
      const res = await supplierApi.create(formData);
      setSuppliers([res.data, ...suppliers.filter((s: any) => s.id !== tempId)]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setSuppliers(suppliers.filter((s: any) => s.id !== tempId));
      setError(err.response?.data?.detail || 'Failed to add supplier');
    }
  };

  const handleUpdateSupplier = async () => {
    if (!selectedSupplier) return;

    const prevSuppliers = [...suppliers];
    const updated = { ...selectedSupplier, ...formData };

    setSuppliers(suppliers.map((s: any) => s.id === selectedSupplier.id ? updated : s));
    setViewMode('list');

    try {
      await supplierApi.update(selectedSupplier.id, formData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setSuppliers(prevSuppliers);
      setError(err.response?.data?.detail || 'Failed to update supplier');
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    const toDelete = suppliers.find((s: any) => s.id === supplierId);
    if (!toDelete) return;

    setSuppliers(suppliers.filter((s: any) => s.id !== supplierId));

    try {
      await supplierApi.delete(supplierId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setSuppliers([...suppliers, toDelete]);
      setError(err.response?.data?.detail || 'Failed to delete supplier');
    }
  };

  const openEditMode = (supplier: any) => {
    setSelectedSupplier(supplier);
    setFormData({
      name: supplier.name || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      description: supplier.description || '',
      website: supplier.website || '',
      contact_email: supplier.contact_email || '',
      profile_image: supplier.profile_image || '',
      images: supplier.images || [],
      linked_brands: supplier.linked_brands || [],
    });
    setViewMode('edit');
  };

  const openProfileMode = (supplier: any) => {
    setSelectedSupplier(supplier);
    setViewMode('profile');
  };

  const toggleBrandLink = (brandId: string) => {
    setFormData(prev => ({
      ...prev,
      linked_brands: prev.linked_brands.includes(brandId)
        ? prev.linked_brands.filter(id => id !== brandId)
        : [...prev.linked_brands, brandId],
    }));
  };

  // Profile View
  if (viewMode === 'profile' && selectedSupplier) {
    const linkedBrandObjects = productBrands.filter((b: any) => 
      (selectedSupplier.linked_product_brand_ids || selectedSupplier.linked_brands || []).includes(b.id)
    );

    // Get display name based on language
    const displayName = isRTL && selectedSupplier.name_ar ? selectedSupplier.name_ar : selectedSupplier.name;
    const displayAddress = isRTL && selectedSupplier.address_ar ? selectedSupplier.address_ar : selectedSupplier.address;
    const displayDescription = isRTL && selectedSupplier.description_ar ? selectedSupplier.description_ar : selectedSupplier.description;

    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0D9488', '#14B8A6', '#2DD4BF']} style={StyleSheet.absoluteFill} />
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}>
          <View style={[styles.header, isRTL && styles.headerRTL]}>
            <TouchableOpacity style={styles.backButton} onPress={() => { setViewMode('list'); setSelectedSupplier(null); router.setParams({ viewMode: undefined, id: undefined }); }}>
              <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{displayName}</Text>
            {isOwnerOrAdmin && (
              <TouchableOpacity style={styles.editButton} onPress={() => router.push(`/owner/add-entity-form?entityType=supplier&id=${selectedSupplier.id}`)}>
                <Ionicons name="pencil" size={20} color="#FFF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Profile Image */}
          <View style={styles.profileImageContainer}>
            {selectedSupplier.profile_image ? (
              <Image source={{ uri: selectedSupplier.profile_image }} style={styles.profileImage} />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Ionicons name="briefcase" size={60} color="#14B8A6" />
              </View>
            )}
          </View>

          {/* Arabic Name (if available and different) */}
          {selectedSupplier.name_ar && selectedSupplier.name_ar !== selectedSupplier.name && (
            <Text style={styles.arabicNameText}>{selectedSupplier.name_ar}</Text>
          )}

          {/* Contact Info - ALL FIELDS */}
          <View style={styles.infoCard}>
            <BlurView intensity={15} tint="light" style={styles.infoBlur}>
              <Text style={styles.infoSectionTitle}>{isRTL ? 'معلومات الاتصال' : 'Contact Information'}</Text>
              
              {/* Phone Numbers */}
              {selectedSupplier.phone_numbers && selectedSupplier.phone_numbers.length > 0 ? (
                selectedSupplier.phone_numbers.map((phone: string, index: number) => (
                  <TouchableOpacity key={index} style={styles.infoRow} onPress={() => Linking.openURL(`tel:${phone}`)}>
                    <Ionicons name="call" size={20} color="#14B8A6" />
                    <Text style={styles.infoText}>{phone}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#14B8A6" />
                  </TouchableOpacity>
                ))
              ) : selectedSupplier.phone ? (
                <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(`tel:${selectedSupplier.phone}`)}>
                  <Ionicons name="call" size={20} color="#14B8A6" />
                  <Text style={styles.infoText}>{selectedSupplier.phone}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#14B8A6" />
                </TouchableOpacity>
              ) : null}

              {/* Email */}
              {selectedSupplier.contact_email && (
                <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(`mailto:${selectedSupplier.contact_email}`)}>
                  <Ionicons name="mail" size={20} color="#14B8A6" />
                  <Text style={styles.infoText}>{selectedSupplier.contact_email}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#14B8A6" />
                </TouchableOpacity>
              )}

              {/* Website */}
              {(selectedSupplier.website_url || selectedSupplier.website) && (
                <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(selectedSupplier.website_url || selectedSupplier.website)}>
                  <Ionicons name="globe" size={20} color="#14B8A6" />
                  <Text style={[styles.infoText, { flex: 1 }]} numberOfLines={1}>{selectedSupplier.website_url || selectedSupplier.website}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#14B8A6" />
                </TouchableOpacity>
              )}
            </BlurView>
          </View>

          {/* Address Section */}
          {(selectedSupplier.address || selectedSupplier.address_ar) && (
            <View style={styles.infoCard}>
              <BlurView intensity={15} tint="light" style={styles.infoBlur}>
                <Text style={styles.infoSectionTitle}>{isRTL ? 'العنوان' : 'Address'}</Text>
                <View style={styles.infoRow}>
                  <Ionicons name="location" size={20} color="#14B8A6" />
                  <Text style={[styles.infoText, { flex: 1 }]}>{displayAddress}</Text>
                </View>
                {/* Show both addresses if different */}
                {selectedSupplier.address_ar && selectedSupplier.address && selectedSupplier.address !== selectedSupplier.address_ar && (
                  <View style={[styles.infoRow, { marginTop: 8 }]}>
                    <Ionicons name="location-outline" size={20} color="#14B8A6" />
                    <Text style={[styles.infoText, { flex: 1, fontStyle: 'italic' }]}>
                      {isRTL ? selectedSupplier.address : selectedSupplier.address_ar}
                    </Text>
                  </View>
                )}
              </BlurView>
            </View>
          )}

          {/* Description Section */}
          {(selectedSupplier.description || selectedSupplier.description_ar) && (
            <View style={styles.descriptionCard}>
              <BlurView intensity={15} tint="light" style={styles.descriptionBlur}>
                <Text style={styles.descriptionTitle}>{isRTL ? 'الوصف' : 'Description'}</Text>
                <Text style={styles.descriptionText}>{displayDescription}</Text>
                {/* Show both descriptions if different */}
                {selectedSupplier.description_ar && selectedSupplier.description && selectedSupplier.description !== selectedSupplier.description_ar && (
                  <Text style={[styles.descriptionText, { marginTop: 12, fontStyle: 'italic', opacity: 0.8 }]}>
                    {isRTL ? selectedSupplier.description : selectedSupplier.description_ar}
                  </Text>
                )}
              </BlurView>
            </View>
          )}

          {/* Slider Images Gallery */}
          {selectedSupplier.slider_images && selectedSupplier.slider_images.length > 0 && (
            <View style={styles.gallerySection}>
              <Text style={styles.brandsSectionTitle}>{isRTL ? 'معرض الصور' : 'Image Gallery'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandsCarousel}>
                {selectedSupplier.slider_images.map((img: string, index: number) => (
                  <View key={index} style={styles.galleryImageContainer}>
                    <Image source={{ uri: img }} style={styles.galleryImage} />
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Linked Brands Carousel */}
          {linkedBrandObjects.length > 0 && (
            <View style={styles.brandsSection}>
              <Text style={styles.brandsSectionTitle}>{isRTL ? 'العلامات التجارية المرتبطة' : 'Linked Brands'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandsCarousel}>
                {linkedBrandObjects.map((brand: any) => (
                  <TouchableOpacity key={brand.id} style={styles.brandCircle}>
                    {brand.image ? (
                      <Image source={{ uri: brand.image }} style={styles.brandImage} />
                    ) : (
                      <Ionicons name="pricetag" size={24} color="#14B8A6" />
                    )}
                    <Text style={styles.brandName} numberOfLines={1}>{isRTL && brand.name_ar ? brand.name_ar : brand.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View style={{ height: insets.bottom + 40 }} />
        </ScrollView>
      </View>
    );
  }

  // Add/Edit Form View
  if (viewMode === 'add' || viewMode === 'edit') {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#0D9488', '#14B8A6', '#2DD4BF']} style={StyleSheet.absoluteFill} />
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}>
          <View style={[styles.header, isRTL && styles.headerRTL]}>
            <TouchableOpacity style={styles.backButton} onPress={() => { setViewMode('list'); resetForm(); }}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {viewMode === 'add' ? (isRTL ? 'إضافة مورد' : 'Add Supplier') : (isRTL ? 'تعديل مورد' : 'Edit Supplier')}
            </Text>
            <TouchableOpacity 
              style={styles.saveButton} 
              onPress={viewMode === 'add' ? handleAddSupplier : handleUpdateSupplier}
            >
              <Ionicons name="checkmark" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.formCard}>
            <TextInput
              style={styles.input}
              placeholder={isRTL ? 'الاسم *' : 'Name *'}
              placeholderTextColor="#9CA3AF"
              value={formData.name}
              onChangeText={(text) => setFormData(prev => ({ ...prev, name: text }))}
            />
            <TextInput
              style={styles.input}
              placeholder={isRTL ? 'رقم الهاتف' : 'Phone'}
              placeholderTextColor="#9CA3AF"
              value={formData.phone}
              onChangeText={(text) => setFormData(prev => ({ ...prev, phone: text }))}
              keyboardType="phone-pad"
            />
            <TextInput
              style={styles.input}
              placeholder={isRTL ? 'البريد الإلكتروني' : 'Email'}
              placeholderTextColor="#9CA3AF"
              value={formData.contact_email}
              onChangeText={(text) => setFormData(prev => ({ ...prev, contact_email: text }))}
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder={isRTL ? 'العنوان' : 'Address'}
              placeholderTextColor="#9CA3AF"
              value={formData.address}
              onChangeText={(text) => setFormData(prev => ({ ...prev, address: text }))}
            />
            <TextInput
              style={styles.input}
              placeholder={isRTL ? 'الموقع الإلكتروني' : 'Website URL'}
              placeholderTextColor="#9CA3AF"
              value={formData.website}
              onChangeText={(text) => setFormData(prev => ({ ...prev, website: text }))}
              keyboardType="url"
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={isRTL ? 'الوصف' : 'Description'}
              placeholderTextColor="#9CA3AF"
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Brand Linkage */}
          <View style={styles.brandLinkSection}>
            <Text style={styles.brandLinkTitle}>{isRTL ? 'ربط العلامات التجارية' : 'Link Product Brands'}</Text>
            <View style={styles.brandGrid}>
              {productBrands.map((brand: any) => (
                <TouchableOpacity
                  key={brand.id}
                  style={[
                    styles.brandSelectItem,
                    formData.linked_brands.includes(brand.id) && styles.brandSelectActive,
                  ]}
                  onPress={() => toggleBrandLink(brand.id)}
                >
                  <Text style={styles.brandSelectText}>{brand.name}</Text>
                  {formData.linked_brands.includes(brand.id) && (
                    <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ height: insets.bottom + 40 }} />
        </ScrollView>
      </View>
    );
  }

  // List View
  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0D9488', '#14B8A6', '#2DD4BF']} style={StyleSheet.absoluteFill} />
      <ErrorCapsule message={error || ''} visible={!!error} onDismiss={() => setError(null)} />
      <ConfettiEffect active={showConfetti} onComplete={() => setShowConfetti(false)} />

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFF" />}
      >
        <View style={[styles.header, isRTL && styles.headerRTL]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isRTL ? 'الموردين' : 'Suppliers'}</Text>
          {isOwnerOrAdmin && (
            <TouchableOpacity style={styles.addButton} onPress={() => router.push('/owner/add-entity-form?entityType=supplier')}>
              <Ionicons name="add" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.listContainer}>
          {suppliers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="briefcase-outline" size={64} color="rgba(255,255,255,0.5)" />
              <Text style={styles.emptyText}>{isRTL ? 'لا يوجد موردين' : 'No suppliers yet'}</Text>
            </View>
          ) : (
            suppliers.map((supplier: any) => (
              <VoidDeleteGesture key={supplier.id} onDelete={() => handleDeleteSupplier(supplier.id)}>
                <TouchableOpacity style={styles.card} onPress={() => openProfileMode(supplier)}>
                  <BlurView intensity={15} tint="light" style={styles.cardBlur}>
                    <View style={styles.cardAvatar}>
                      {supplier.profile_image ? (
                        <Image source={{ uri: supplier.profile_image }} style={styles.avatarImage} />
                      ) : (
                        <Ionicons name="briefcase" size={24} color="#14B8A6" />
                      )}
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{supplier.name}</Text>
                      <Text style={styles.cardDetail}>{supplier.contact_email || supplier.phone || ''}</Text>
                      {(supplier.linked_brands || []).length > 0 && (
                        <Text style={styles.cardBrands}>
                          {(supplier.linked_brands || []).length} {isRTL ? 'علامات مرتبطة' : 'brands linked'}
                        </Text>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.5)" />
                  </BlurView>
                </TouchableOpacity>
              </VoidDeleteGesture>
            ))
          )}
        </View>

        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 },
  headerRTL: { flexDirection: 'row-reverse' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 24, fontWeight: '700', color: '#FFF' },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  editButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  saveButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },
  listContainer: { marginTop: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, marginTop: 16 },
  card: { marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  cardBlur: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  cardAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(20,184,166,0.2)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 50, height: 50 },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  cardDetail: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  cardBrands: { fontSize: 11, color: '#14B8A6', marginTop: 4 },
  formCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, marginTop: 16 },
  input: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#FFF', marginBottom: 12 },
  textArea: { height: 100, textAlignVertical: 'top' },
  brandLinkSection: { marginTop: 20 },
  brandLinkTitle: { fontSize: 16, fontWeight: '600', color: '#FFF', marginBottom: 12 },
  brandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  brandSelectItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
  brandSelectActive: { backgroundColor: 'rgba(16,185,129,0.3)', borderWidth: 1, borderColor: '#10B981' },
  brandSelectText: { fontSize: 13, color: '#FFF' },
  profileImageContainer: { alignItems: 'center', marginTop: 20 },
  profileImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)' },
  profilePlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  infoCard: { marginTop: 20, borderRadius: 16, overflow: 'hidden' },
  infoBlur: { padding: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  infoText: { fontSize: 15, color: '#FFF', flex: 1 },
  websiteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#14B8A6', paddingVertical: 12, borderRadius: 12, marginTop: 8, gap: 8 },
  websiteText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  descriptionCard: { marginTop: 16, borderRadius: 16, overflow: 'hidden' },
  descriptionBlur: { padding: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  descriptionTitle: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  descriptionText: { fontSize: 15, color: '#FFF', lineHeight: 22 },
  brandsSection: { marginTop: 24 },
  brandsSectionTitle: { fontSize: 16, fontWeight: '600', color: '#FFF', marginBottom: 12 },
  brandsCarousel: { paddingVertical: 8 },
  brandCircle: { alignItems: 'center', marginRight: 16 },
  brandImage: { width: 60, height: 60, borderRadius: 30 },
  brandName: { fontSize: 11, color: 'rgba(255,255,255,0.8)', marginTop: 6, width: 60, textAlign: 'center' },
  // New styles for enhanced profile view
  infoSectionTitle: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.8)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 0.5 },
  arabicNameText: { fontSize: 18, fontWeight: '600', color: 'rgba(255,255,255,0.9)', textAlign: 'center', marginTop: 8 },
  gallerySection: { marginTop: 24 },
  galleryImageContainer: { width: 120, height: 80, borderRadius: 12, overflow: 'hidden', marginRight: 12 },
  galleryImage: { width: '100%', height: '100%' },
});
