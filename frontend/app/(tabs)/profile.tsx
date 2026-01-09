import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Header } from '../../src/components/Header';
import { useTheme, lightTheme, darkTheme } from '../../src/hooks/useTheme';
import { useTranslation } from '../../src/hooks/useTranslation';
import { useAppStore, useCanAccessAdminPanel } from '../../src/store/appStore';
import { authApi } from '../../src/services/api';
import { AppVersionInfo } from '../../src/components/ui/AppVersionInfo';

// Owner email that can always access the interface
const OWNER_EMAIL = 'pc.2025.ai@gmail.com';

export default function ProfileScreen() {
  const { colors, isDark } = useTheme();
  const { t, isRTL, language } = useTranslation();
  const router = useRouter();
  const { user, theme, toggleTheme, setLanguage, logout, userRole } = useAppStore();
  const partners = useAppStore((state) => state.partners);
  const admins = useAppStore((state) => state.admins);
  const canAccessAdminPanel = useCanAccessAdminPanel();

  // Check if user can access owner interface
  const isOwner = user?.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();
  const isPartner = partners.some(
    (p: any) => p.email?.toLowerCase() === user?.email?.toLowerCase()
  );
  const isAdmin = admins.some(
    (a: any) => a.email?.toLowerCase() === user?.email?.toLowerCase()
  ) || userRole === 'admin';
  const canAccessOwner = isOwner || isPartner;

  const handleLogout = async () => {
    Alert.alert(
      t('logout'),
      t('confirm') + '?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              await authApi.logout();
            } catch (error) {
              console.error('Logout error:', error);
            }
            logout();
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Header title={t('myProfile')} showBack={false} />
        <View style={styles.guestContainer}>
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface }]}>
            <Ionicons name="person-outline" size={60} color={colors.textSecondary} />
          </View>
          <Text style={[styles.guestText, { color: colors.text }]}>
            {t('loginRequired')}
          </Text>
          <TouchableOpacity
            style={[styles.loginButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/login')}
          >
            <Ionicons name="logo-google" size={20} color="#FFF" />
            <Text style={styles.loginButtonText}>{t('loginWithGoogle')}</Text>
          </TouchableOpacity>

          {/* Settings Section for Guest */}
          <View style={[styles.settingsSection, { marginTop: 40 }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              {t('settings')}
            </Text>
            
            <View style={[
              styles.settingItem, 
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}>
              <View style={styles.settingLeft}>
                <Ionicons name={isDark ? 'moon' : 'sunny'} size={22} color={colors.primary} />
                <Text style={[styles.settingText, { color: colors.text }]}>
                  {t('darkMode')}
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#FFF"
              />
            </View>

            <TouchableOpacity
              style={[
                styles.settingItem, 
                { backgroundColor: colors.card, borderColor: colors.border }
              ]}
              onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            >
              <View style={styles.settingLeft}>
                <Ionicons name="language" size={22} color={colors.primary} />
                <Text style={[styles.settingText, { color: colors.text }]}>
                  {t('language')}
                </Text>
              </View>
              <View style={styles.settingRight}>
                <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                  {language === 'en' ? 'English' : 'العربية'}
                </Text>
                <Ionicons 
                  name={isRTL ? 'chevron-back' : 'chevron-forward'} 
                  size={20} 
                  color={colors.textSecondary} 
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Header title={t('myProfile')} showBack={false} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={[
          styles.profileCard, 
          { backgroundColor: colors.card, borderColor: colors.border }
        ]}>
          {user.picture ? (
            <Image 
              source={{ uri: user.picture }} 
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="disk"
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surface }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {user.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: colors.text }]}>
              {user.name}
            </Text>
            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
              {user.email}
            </Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity
            style={[
              styles.menuItem, 
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
            onPress={() => router.push('/favorites')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.error + '15' }]}>
                <Ionicons name="heart" size={22} color={colors.error} />
              </View>
              <Text style={[styles.menuText, { color: colors.text }]}>
                {language === 'ar' ? 'المفضلة' : 'My Favorites'}
              </Text>
            </View>
            <Ionicons 
              name={isRTL ? 'chevron-back' : 'chevron-forward'} 
              size={20} 
              color={colors.textSecondary} 
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.menuItem, 
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
            onPress={() => router.push('/(tabs)/cart?tab=orders')}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="receipt-outline" size={22} color={colors.primary} />
              </View>
              <Text style={[styles.menuText, { color: colors.text }]}>
                {t('myOrders')}
              </Text>
            </View>
            <Ionicons 
              name={isRTL ? 'chevron-back' : 'chevron-forward'} 
              size={20} 
              color={colors.textSecondary} 
            />
          </TouchableOpacity>

          {/* Owner Dashboard Access - Only for authorized users */}
          {canAccessOwner && (
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/owner')}
            >
              <View style={styles.menuLeft}>
                <LinearGradient
                  colors={['#6366F1', '#8B5CF6', '#A855F7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.menuIcon, { borderRadius: 11 }]}
                >
                  <Ionicons name="diamond" size={20} color="#FFF" />
                </LinearGradient>
                <View>
                  <Text style={[styles.menuText, { color: colors.text }]}>
                    {language === 'ar' ? 'لوحة المالك' : 'Owner Dashboard'}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#8B5CF6', marginTop: 2 }}>
                    {isOwner ? (language === 'ar' ? 'مالك' : 'Owner') : (language === 'ar' ? 'شريك' : 'Partner')}
                  </Text>
                </View>
              </View>
              <View style={styles.ownerBadge}>
                <Ionicons name="sparkles" size={16} color="#8B5CF6" />
              </View>
            </TouchableOpacity>
          )}

          {/* Admin Dashboard Access - For admins (not owners/partners) */}
          {isAdmin && !canAccessOwner && (
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/admin')}
            >
              <View style={styles.menuLeft}>
                <LinearGradient
                  colors={['#10B981', '#059669', '#047857']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.menuIcon, { borderRadius: 11 }]}
                >
                  <Ionicons name="settings" size={20} color="#FFF" />
                </LinearGradient>
                <View>
                  <Text style={[styles.menuText, { color: colors.text }]}>
                    {language === 'ar' ? 'لوحة الإدارة' : 'Admin Dashboard'}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#10B981', marginTop: 2 }}>
                    {language === 'ar' ? 'مدير' : 'Admin'}
                  </Text>
                </View>
              </View>
              <View style={styles.ownerBadge}>
                <Ionicons name="shield-checkmark" size={16} color="#10B981" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Settings Section */}
        <View style={styles.settingsSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {t('settings')}
          </Text>
          
          <View style={[
            styles.settingItem, 
            { backgroundColor: colors.card, borderColor: colors.border }
          ]}>
            <View style={styles.settingLeft}>
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={22} color={colors.primary} />
              <Text style={[styles.settingText, { color: colors.text }]}>
                {t('darkMode')}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#FFF"
            />
          </View>

          <TouchableOpacity
            style={[
              styles.settingItem, 
              { backgroundColor: colors.card, borderColor: colors.border }
            ]}
            onPress={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          >
            <View style={styles.settingLeft}>
              <Ionicons name="language" size={22} color={colors.primary} />
              <Text style={[styles.settingText, { color: colors.text }]}>
                {t('language')}
              </Text>
            </View>
            <View style={styles.settingRight}>
              <Text style={[styles.settingValue, { color: colors.textSecondary }]}>
                {language === 'en' ? 'English' : 'العربية'}
              </Text>
              <Ionicons 
                name={isRTL ? 'chevron-back' : 'chevron-forward'} 
                size={20} 
                color={colors.textSecondary} 
              />
            </View>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { borderColor: colors.error }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={[styles.logoutText, { color: colors.error }]}>
            {t('logout')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  guestText: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 24,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 10,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  avatarPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 28,
    fontWeight: '700',
  },
  userInfo: {
    marginLeft: 16,
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
  },
  menuSection: {
    marginBottom: 24,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingsSection: {
    marginBottom: 24,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  settingValue: {
    fontSize: 14,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
