import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryProvider } from '../src/providers/QueryProvider';
import { useAppStore, useHasHydrated } from '../src/store/appStore';
import { adminApi } from '../src/services/api';
import { syncService } from '../src/services/syncService';
import { networkService } from '../src/services/networkService';
import { screenshotProtectionService } from '../src/services/screenshotProtectionService';
import { autoLogoutService } from '../src/services/autoLogoutService';
import { offlineDatabaseService } from '../src/services/offlineDatabaseService';
import { DriftLoader } from '../src/components/ui/DriftLoader';

/**
 * Auth Guard Component - Fully Stabilized for Mobile
 * 
 * ROOT CAUSE FIX:
 * - REMOVED pathname from all useEffect dependencies (causes infinite loop on mobile)
 * - Expo Router's usePathname() triggers more frequently on mobile vs web
 * - All screen-specific logic now uses refs instead of reactive dependencies
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  
  // Zustand state
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const hasHydrated = useHasHydrated();
  const user = useAppStore((state) => state.user);
  const currentMood = useAppStore((state) => state.currentMood);
  
  // Refs for preventing duplicate operations
  const servicesInitialized = useRef(false);
  const adminsLoaded = useRef(false);
  const lastActivityRecorded = useRef(0);
  
  // Single consolidated UI state
  const [appReady, setAppReady] = useState(false);

  /**
   * Initialize core services - runs ONCE on mount
   */
  useEffect(() => {
    if (servicesInitialized.current) return;
    servicesInitialized.current = true;

    const initializeServices = async () => {
      console.log('[App] Initializing services...');

      try {
        await offlineDatabaseService.initialize();
        await networkService.initialize();
        await screenshotProtectionService.initialize();
        
        const { logout } = useAppStore.getState();
        await autoLogoutService.initialize(() => {
          console.log('[App] Auto-logout triggered');
          logout();
          router.replace('/login');
        });

        syncService.start();
        console.log('[App] All services initialized');
      } catch (error) {
        console.error('[App] Service initialization error:', error);
      }
    };

    initializeServices();

    return () => {
      networkService.cleanup();
      screenshotProtectionService.cleanup();
      autoLogoutService.cleanup();
      syncService.stop();
      offlineDatabaseService.close();
    };
  }, []);

  /**
   * Hydration handler - sets app ready state
   * NO pathname dependency - prevents mobile infinite loop
   */
  useEffect(() => {
    if (hasHydrated) {
      setAppReady(true);
      return;
    }
    
    // Fallback timeout for slow hydration
    const timeout = setTimeout(() => {
      console.log('[AuthGuard] Force ready (hydration timeout)');
      const { setHasHydrated } = useAppStore.getState();
      setHasHydrated(true);
      setAppReady(true);
    }, 1500);
    
    return () => clearTimeout(timeout);
  }, [hasHydrated]);

  /**
   * User activity tracking - DEBOUNCED to prevent rapid calls
   * NO pathname dependency - uses interval instead
   */
  useEffect(() => {
    if (!appReady || !isAuthenticated || !user) return;

    // Record initial activity
    const recordActivity = () => {
      const now = Date.now();
      // Only record if 5 seconds have passed since last record
      if (now - lastActivityRecorded.current > 5000) {
        lastActivityRecorded.current = now;
        autoLogoutService.recordUserActivity();
        offlineDatabaseService.updateLastActivity(user.id);
      }
    };

    recordActivity();

    // Set up interval for periodic activity tracking instead of pathname-based
    const interval = setInterval(recordActivity, 60000); // Every minute

    return () => clearInterval(interval);
  }, [appReady, isAuthenticated, user?.id]);

  /**
   * Fetch admins list - runs ONCE when authenticated
   */
  useEffect(() => {
    if (!appReady || !isAuthenticated || adminsLoaded.current) return;

    const fetchAdmins = async () => {
      try {
        const response = await adminApi.checkAccess();
        if (response.data) {
          const { setAdmins } = useAppStore.getState();
          setAdmins(response.data);
          adminsLoaded.current = true;
        }
      } catch (error) {
        console.log('[AuthGuard] Could not fetch admins');
      }
    };

    fetchAdmins();
  }, [appReady, isAuthenticated]);

  /**
   * Navigation guard - handles auth-based routing
   * Uses segments only (stable), NOT pathname (unstable on mobile)
   */
  useEffect(() => {
    if (!appReady) return;

    // Debounce navigation to prevent rapid-fire calls
    const timeout = setTimeout(() => {
      const inAuthGroup = segments[0] === 'login';
      const inProtectedRoute = 
        segments[0] === 'admin' || 
        segments[0] === 'owner' || 
        segments[0] === 'checkout' || 
        segments[0] === 'orders' ||
        segments[0] === 'favorites';

      if (isAuthenticated && inAuthGroup) {
        console.log('[AuthGuard] Redirecting to home');
        router.replace('/(tabs)');
      } else if (!isAuthenticated && inProtectedRoute) {
        console.log('[AuthGuard] Redirecting to login');
        router.replace('/login');
      }
    }, 150);

    return () => clearTimeout(timeout);
  }, [appReady, isAuthenticated, segments]);

  // Loading state
  if (!appReady) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentMood?.background || '#0F172A' }]}>
        <DriftLoader size="large" color={currentMood?.primary || '#3B82F6'} />
      </View>
    );
  }

  return <>{children}</>;
}

/**
 * Root Layout - Minimal wrapper
 */
export default function RootLayout() {
  const theme = useAppStore((state) => state.theme);

  return (
    <QueryProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
          <AuthGuard>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ presentation: 'modal' }} />
              <Stack.Screen name="product/[id]" />
              <Stack.Screen name="category/[id]" />
              <Stack.Screen name="car/[id]" />
              <Stack.Screen name="brand/[id]" />
              <Stack.Screen name="models" />
              <Stack.Screen name="search" />
              <Stack.Screen name="checkout" />
              <Stack.Screen name="orders" />
              <Stack.Screen name="favorites" />
            </Stack>
          </AuthGuard>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
