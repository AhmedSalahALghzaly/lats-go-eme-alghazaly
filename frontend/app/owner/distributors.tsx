/**
 * Distributors Management - Full CRUD with Car Brand Linkage
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
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAppStore } from '../../src/store/appStore';
import { distributorApi, carBrandApi } from '../../src/services/api';
import { VoidDeleteGesture } from '../../src/components/ui/VoidDeleteGesture';
import { ErrorCapsule } from '../../src/components/ui/ErrorCapsule';
import { ConfettiEffect } from '../../src/components/ui/ConfettiEffect';
import { ImageUploader } from '../../src/components/ui/ImageUploader';
import { Toast } from '../../src/components/ui/FormFeedback';

type ViewMode = 'list' | 'add' | 'edit' | 'profile';

export default function DistributorsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const language = useAppStore((state) => state.language);
  const distributors = useAppStore((state) => state.distributors);
  const setDistributors = useAppStore((state) => state.setDistributors);
  const carBrands = useAppStore((state) => state.carBrands);
  const isRTL = language === 'ar';

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [selectedDistributor, setSelectedDistributor] = useState<any>(null);
  
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

  const fetchDistributors = async () => {
    try {
      const res = await distributorApi.getAll();
      setDistributors(res.data || []);
    } catch (err) {
      console.error('Error fetching distributors:', err);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDistributors();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchDistributors();
  }, []);

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

  const handleAddDistributor = async () => {
    if (!formData.name.trim()) {
      setError(isRTL ? 'الاسم مطلوب' : 'Name is required');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const newDistributor = { id: tempId, ...formData, created_at: new Date().toISOString() };

    setDistributors([newDistributor, ...distributors]);
    setShowConfetti(true);
    setViewMode('list');
    resetForm();

    try {
      const res = await distributorApi.create(formData);
      setDistributors([res.data, ...distributors.filter((d: any) => d.id !== tempId)]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setDistributors(distributors.filter((d: any) => d.id !== tempId));
      setError(err.response?.data?.detail || 'Failed to add distributor');
    }
  };

  const handleUpdateDistributor = async () => {
    if (!selectedDistributor) return;

    const prevDistributors = [...distributors];
    const updated = { ...selectedDistributor, ...formData };

    setDistributors(distributors.map((d: any) => d.id === selectedDistributor.id ? updated : d));
    setViewMode('list');

    try {
      await distributorApi.update(selectedDistributor.id, formData);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setDistributors(prevDistributors);
      setError(err.response?.data?.detail || 'Failed to update distributor');
    }
  };

  const handleDeleteDistributor = async (distId: string) => {
    const toDelete = distributors.find((d: any) => d.id === distId);
    if (!toDelete) return;

    setDistributors(distributors.filter((d: any) => d.id !== distId));

    try {
      await distributorApi.delete(distId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setDistributors([...distributors, toDelete]);
      setError(err.response?.data?.detail || 'Failed to delete distributor');
    }
  };

  const openEditMode = (distributor: any) => {
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
    });
    setViewMode('edit');
  };

  const openProfileMode = (distributor: any) => {
    setSelectedDistributor(distributor);
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
  if (viewMode === 'profile' && selectedDistributor) {
    const linkedBrandObjects = carBrands.filter((b: any) => 
      (selectedDistributor.linked_brands || []).includes(b.id)
    );

    return (
      <View style={styles.container}>
        <LinearGradient colors={['#991B1B', '#DC2626', '#EF4444']} style={StyleSheet.absoluteFill} />
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}>
          <View style={[styles.header, isRTL && styles.headerRTL]}>
            <TouchableOpacity style={styles.backButton} onPress={() => setViewMode('list')}>
              <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{selectedDistributor.name}</Text>
            <TouchableOpacity style={styles.editButton} onPress={() => openEditMode(selectedDistributor)}>
              <Ionicons name="pencil" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.profileImageContainer}>
            {selectedDistributor.profile_image ? (
              <Image source={{ uri: selectedDistributor.profile_image }} style={styles.profileImage} />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Ionicons name="car" size={60} color="#EF4444" />
              </View>
            )}
          </View>

          <View style={styles.infoCard}>
            <BlurView intensity={15} tint="light" style={styles.infoBlur}>
              {selectedDistributor.phone && (
                <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(`tel:${selectedDistributor.phone}`)}>
                  <Ionicons name="call" size={20} color="#EF4444" />
                  <Text style={styles.infoText}>{selectedDistributor.phone}</Text>
                </TouchableOpacity>
              )}
              {selectedDistributor.contact_email && (
                <TouchableOpacity style={styles.infoRow} onPress={() => Linking.openURL(`mailto:${selectedDistributor.contact_email}`)}>
                  <Ionicons name="mail" size={20} color="#EF4444" />
                  <Text style={styles.infoText}>{selectedDistributor.contact_email}</Text>
                </TouchableOpacity>
              )}
              {selectedDistributor.address && (
                <View style={styles.infoRow}>
                  <Ionicons name="location" size={20} color="#EF4444" />
                  <Text style={styles.infoText}>{selectedDistributor.address}</Text>
                </View>
              )}
              {selectedDistributor.website && (
                <TouchableOpacity style={[styles.websiteButton, { backgroundColor: '#EF4444' }]} onPress={() => Linking.openURL(selectedDistributor.website)}>
                  <Ionicons name="globe" size={20} color="#FFF" />
                  <Text style={styles.websiteText}>{isRTL ? 'زيارة الموقع' : 'Visit Website'}</Text>
                </TouchableOpacity>
              )}
            </BlurView>
          </View>

          {selectedDistributor.description && (
            <View style={styles.descriptionCard}>
              <BlurView intensity={15} tint="light" style={styles.descriptionBlur}>
                <Text style={styles.descriptionTitle}>{isRTL ? 'الوصف' : 'Description'}</Text>
                <Text style={styles.descriptionText}>{selectedDistributor.description}</Text>
              </BlurView>
            </View>
          )}

          {linkedBrandObjects.length > 0 && (
            <View style={styles.brandsSection}>
              <Text style={styles.brandsSectionTitle}>{isRTL ? 'ماركات السيارات' : 'Linked Car Brands'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandsCarousel}>
                {linkedBrandObjects.map((brand: any) => (
                  <TouchableOpacity key={brand.id} style={styles.brandCircle}>
                    {brand.logo || brand.image ? (
                      <Image source={{ uri: brand.logo || brand.image }} style={styles.brandImage} />
                    ) : (
                      <Ionicons name="car-sport" size={24} color="#EF4444" />
                    )}
                    <Text style={styles.brandName} numberOfLines={1}>{brand.name}</Text>
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
        <LinearGradient colors={['#991B1B', '#DC2626', '#EF4444']} style={StyleSheet.absoluteFill} />
        <ScrollView style={styles.scrollView} contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top }]}>
          <View style={[styles.header, isRTL && styles.headerRTL]}>
            <TouchableOpacity style={styles.backButton} onPress={() => { setViewMode('list'); resetForm(); }}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {viewMode === 'add' ? (isRTL ? 'إضافة موزع' : 'Add Distributor') : (isRTL ? 'تعديل موزع' : 'Edit Distributor')}
            </Text>
            <TouchableOpacity 
              style={[styles.saveButton, { backgroundColor: '#DC2626' }]} 
              onPress={viewMode === 'add' ? handleAddDistributor : handleUpdateDistributor}
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

          <View style={styles.brandLinkSection}>
            <Text style={styles.brandLinkTitle}>{isRTL ? 'ربط ماركات السيارات' : 'Link Car Brands'}</Text>
            <View style={styles.brandGrid}>
              {carBrands.map((brand: any) => (
                <TouchableOpacity
                  key={brand.id}
                  style={[
                    styles.brandSelectItem,
                    formData.linked_brands.includes(brand.id) && styles.brandSelectActiveRed,
                  ]}
                  onPress={() => toggleBrandLink(brand.id)}
                >
                  <Text style={styles.brandSelectText}>{brand.name}</Text>
                  {formData.linked_brands.includes(brand.id) && (
                    <Ionicons name="checkmark-circle" size={16} color="#EF4444" />
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
      <LinearGradient colors={['#991B1B', '#DC2626', '#EF4444']} style={StyleSheet.absoluteFill} />
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
          <Text style={styles.headerTitle}>{isRTL ? 'الموزعين' : 'Distributors'}</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => { resetForm(); setViewMode('add'); }}>
            <Ionicons name="add" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.listContainer}>
          {distributors.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={64} color="rgba(255,255,255,0.5)" />
              <Text style={styles.emptyText}>{isRTL ? 'لا يوجد موزعين' : 'No distributors yet'}</Text>
            </View>
          ) : (
            distributors.map((distributor: any) => (
              <VoidDeleteGesture key={distributor.id} onDelete={() => handleDeleteDistributor(distributor.id)}>
                <TouchableOpacity style={styles.card} onPress={() => openProfileMode(distributor)}>
                  <BlurView intensity={15} tint="light" style={styles.cardBlur}>
                    <View style={[styles.cardAvatar, { backgroundColor: 'rgba(239,68,68,0.2)' }]}>
                      {distributor.profile_image ? (
                        <Image source={{ uri: distributor.profile_image }} style={styles.avatarImage} />
                      ) : (
                        <Ionicons name="car" size={24} color="#EF4444" />
                      )}
                    </View>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardName}>{distributor.name}</Text>
                      <Text style={styles.cardDetail}>{distributor.contact_email || distributor.phone || ''}</Text>
                      {(distributor.linked_brands || []).length > 0 && (
                        <Text style={[styles.cardBrands, { color: '#EF4444' }]}>
                          {(distributor.linked_brands || []).length} {isRTL ? 'علامات مرتبطة' : 'brands linked'}
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
  saveButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  listContainer: { marginTop: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: 16, marginTop: 16 },
  card: { marginBottom: 12, borderRadius: 16, overflow: 'hidden' },
  cardBlur: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: 'rgba(255,255,255,0.1)' },
  cardAvatar: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 50, height: 50 },
  cardInfo: { flex: 1, marginLeft: 12 },
  cardName: { fontSize: 16, fontWeight: '600', color: '#FFF' },
  cardDetail: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  cardBrands: { fontSize: 11, marginTop: 4 },
  formCard: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, marginTop: 16 },
  input: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#FFF', marginBottom: 12 },
  textArea: { height: 100, textAlignVertical: 'top' },
  brandLinkSection: { marginTop: 20 },
  brandLinkTitle: { fontSize: 16, fontWeight: '600', color: '#FFF', marginBottom: 12 },
  brandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  brandSelectItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 6 },
  brandSelectActiveRed: { backgroundColor: 'rgba(239,68,68,0.3)', borderWidth: 1, borderColor: '#EF4444' },
  brandSelectText: { fontSize: 13, color: '#FFF' },
  profileImageContainer: { alignItems: 'center', marginTop: 20 },
  profileImage: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: 'rgba(255,255,255,0.3)' },
  profilePlaceholder: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  infoCard: { marginTop: 20, borderRadius: 16, overflow: 'hidden' },
  infoBlur: { padding: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  infoText: { fontSize: 15, color: '#FFF', flex: 1 },
  websiteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, marginTop: 8, gap: 8 },
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
});
