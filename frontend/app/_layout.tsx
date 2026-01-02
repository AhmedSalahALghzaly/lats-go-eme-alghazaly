import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppStore, useHasHydrated, useUser } from '../src/store/appStore';

// Auth Guard Component - Monitors auth state and handles navigation
function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const hasHydrated = useHasHydrated();
  const setHasHydrated = useAppStore((state) => state.setHasHydrated);
  const user = useAppStore((state) => state.user);
  const currentMood = useAppStore((state) => state.currentMood);
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [showContent, setShowContent] = useState(false);

  // Force show content after timeout - ensures app is never stuck on loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log('AuthGuard: Force showing content');
      setShowContent(true);
      if (!hasHydrated) {
        setHasHydrated(true);
      }
    }, 1500);
    return () => clearTimeout(timeout);
  }, []);

  // If hydration completes normally, show content
  useEffect(() => {
    if (hasHydrated) {
      setShowContent(true);
    }
  }, [hasHydrated]);

  // Wait for navigation to be ready
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsNavigationReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Don't do anything until hydration is complete and navigation is ready
    if (!hasHydrated || !isNavigationReady) {
      console.log('Auth Guard: Waiting...', { hasHydrated, isNavigationReady });
      return;
    }

    console.log('Auth Guard: Checking auth...', { isAuthenticated, user: user?.email, segments });

    const inAuthGroup = segments[0] === 'login';
    const inProtectedRoute = segments[0] === 'admin' || segments[0] === 'owner' || 
                            segments[0] === 'checkout' || segments[0] === 'orders' ||
                            segments[0] === 'favorites';

    // If user is authenticated and on login page, redirect to home
    if (isAuthenticated && inAuthGroup) {
      console.log('Auth Guard: User authenticated, redirecting from login to home');
      setTimeout(() => router.replace('/(tabs)'), 50);
    }
    // If user is not authenticated and trying to access protected routes
    else if (!isAuthenticated && inProtectedRoute) {
      console.log('Auth Guard: User not authenticated, redirecting to login');
      setTimeout(() => router.replace('/login'), 50);
    }
  }, [isAuthenticated, hasHydrated, segments, user, isNavigationReady]);

  // Show loading screen while hydrating (with force-show fallback)
  if (!hasHydrated && !forceShow) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: currentMood?.background || '#F0F9FF' }]}>
        <ActivityIndicator size="large" color={currentMood?.primary || '#3B82F6'} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  const theme = useAppStore((state) => state.theme);

  return (
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
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
