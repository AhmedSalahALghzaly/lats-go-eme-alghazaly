import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAppStore } from '../../src/store/appStore';
import { Header } from '../../src/components/Header';

const ADMIN_EMAILS = [
  'ahmed.salah.ghazaly.91@gmail.com',
  'ahmed.salah.mohamed.ai2025@gmail.com',
];

interface AdminSection {
  id: string;
  title: string;
  titleAr: string;
  icon: string;
  route: string;
  color: string;
}

const ADMIN_SECTIONS: AdminSection[] = [
  { id: 'marketing', title: 'Marketing Suite', titleAr: 'جناح التسويق', icon: 'megaphone', route: '/admin/marketing', color: '#e11d48' },
  { id: 'car-brands', title: 'Car Brands', titleAr: 'ماركات السيارات', icon: 'car-sport', route: '/admin/car-brands', color: '#3b82f6' },
  { id: 'models', title: 'Models', titleAr: 'الموديلات', icon: 'layers', route: '/admin/models', color: '#8b5cf6' },
  { id: 'product-brands', title: 'Product Brands', titleAr: 'ماركات المنتجات', icon: 'pricetag', route: '/admin/product-brands', color: '#06b6d4' },
  { id: 'categories', title: 'Categories', titleAr: 'الفئات', icon: 'grid', route: '/admin/categories', color: '#10b981' },
  { id: 'products', title: 'Products', titleAr: 'المنتجات', icon: 'cube', route: '/admin/products', color: '#f59e0b' },
  { id: 'price-hide', title: 'Price or Hide', titleAr: 'السعر أو الإخفاء', icon: 'eye-off', route: '/admin/price-hide', color: '#ef4444' },
  { id: 'customers', title: 'Customers', titleAr: 'العملاء', icon: 'people', route: '/admin/customers', color: '#ec4899' },
];

export default function AdminPanel() {
  const { colors } = useTheme();
  const { language, isRTL } = useTranslation();
  const router = useRouter();
  const { user } = useAppStore();

  // Check admin access
  const isAdmin = user && ADMIN_EMAILS.includes(user.email?.toLowerCase());

  if (!isAdmin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title={language === 'ar' ? 'لوحة التحكم' : 'Admin Panel'} showBack showSearch={false} showCart={false} />
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color={colors.error} />
          <Text style={[styles.accessDeniedText, { color: colors.text }]}>
            {language === 'ar' ? 'غير مصرح بالدخول' : 'Access Denied'}
          </Text>
          <Text style={[styles.accessDeniedSubtext, { color: colors.textSecondary }]}>
            {language === 'ar' ? 'ليس لديك صلاحية الوصول لهذه الصفحة' : 'You do not have permission to access this page'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <Header title={language === 'ar' ? 'لوحة التحكم' : 'Admin Panel'} showBack showSearch={false} showCart={false} />
      
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.welcomeCard, { backgroundColor: colors.primary }]}>
          <Ionicons name="shield-checkmark" size={32} color="#FFF" />
          <View style={styles.welcomeText}>
            <Text style={styles.welcomeTitle}>
              {language === 'ar' ? 'مرحباً بك في لوحة التحكم' : 'Welcome to Admin Panel'}
            </Text>
            <Text style={styles.welcomeSubtitle}>
              {user?.name || user?.email}
            </Text>
          </View>
        </View>

        <View style={styles.sectionsContainer}>
          {ADMIN_SECTIONS.map((section) => (
            <TouchableOpacity
              key={section.id}
              style={[styles.sectionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push(section.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: section.color + '20' }]}>
                <Ionicons name={section.icon as any} size={28} color={section.color} />
                <View style={[styles.plusBadge, { backgroundColor: section.color }]}>
                  <Ionicons name="add" size={14} color="#FFF" />
                </View>
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }, isRTL && styles.textRTL]}>
                {language === 'ar' ? section.titleAr : section.title}
              </Text>
              <Ionicons 
                name={isRTL ? 'chevron-back' : 'chevron-forward'} 
                size={20} 
                color={colors.textSecondary} 
              />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  welcomeText: {
    marginLeft: 16,
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  sectionsContainer: {
    gap: 12,
  },
  sectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  plusBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 16,
  },
  textRTL: {
    textAlign: 'right',
    marginLeft: 0,
    marginRight: 16,
  },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  accessDeniedText: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  accessDeniedSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
});
