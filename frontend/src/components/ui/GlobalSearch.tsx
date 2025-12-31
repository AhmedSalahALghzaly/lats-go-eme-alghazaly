/**
 * Global Search Component
 * Real-time fuzzy search across Products, Customers, Admins
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Keyboard,
  Dimensions,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useAppStore } from '../../store/appStore';
import { useRouter } from 'expo-router';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface SearchResult {
  id: string;
  type: 'product' | 'customer' | 'admin' | 'supplier' | 'distributor';
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  route?: string;
}

interface GlobalSearchProps {
  visible: boolean;
  onClose: () => void;
}

// Simple fuzzy match function
const fuzzyMatch = (text: string, query: string): boolean => {
  if (!query) return true;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  
  // Check if all characters in query appear in order in text
  let queryIndex = 0;
  for (let i = 0; i < lowerText.length && queryIndex < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIndex]) {
      queryIndex++;
    }
  }
  
  return queryIndex === lowerQuery.length || lowerText.includes(lowerQuery);
};

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ visible, onClose }) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);
  
  // Get data from Zustand store
  const products = useAppStore((state) => state.products);
  const customers = useAppStore((state) => state.customers);
  const admins = useAppStore((state) => state.admins);
  const suppliers = useAppStore((state) => state.suppliers);
  const distributors = useAppStore((state) => state.distributors);
  const language = useAppStore((state) => state.language);

  // Animation
  const overlayOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(SCREEN_HEIGHT);

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 200 });
      contentTranslateY.value = withSpring(0, { damping: 20 });
      setTimeout(() => inputRef.current?.focus(), 300);
    } else {
      overlayOpacity.value = withTiming(0, { duration: 200 });
      contentTranslateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
      setQuery('');
    }
  }, [visible]);

  // Search results
  const results = useMemo((): SearchResult[] => {
    if (!query || query.length < 2) return [];

    const allResults: SearchResult[] = [];

    // Search products
    products.forEach((p: any) => {
      const name = language === 'ar' ? (p.name_ar || p.name) : p.name;
      if (fuzzyMatch(name || '', query) || fuzzyMatch(p.sku || '', query)) {
        allResults.push({
          id: p.id,
          type: 'product',
          title: name || p.name,
          subtitle: `SKU: ${p.sku || 'N/A'} • ${p.price || 0} ج.م`,
          icon: 'cube',
          color: '#3B82F6',
          route: `/product/${p.id}`,
        });
      }
    });

    // Search customers
    customers.forEach((c: any) => {
      if (fuzzyMatch(c.name || '', query) || fuzzyMatch(c.email || '', query)) {
        allResults.push({
          id: c.id,
          type: 'customer',
          title: c.name || c.email,
          subtitle: c.email,
          icon: 'person',
          color: '#10B981',
          route: `/owner/customers`,
        });
      }
    });

    // Search admins
    admins.forEach((a: any) => {
      if (fuzzyMatch(a.name || '', query) || fuzzyMatch(a.email || '', query)) {
        allResults.push({
          id: a.id,
          type: 'admin',
          title: a.name || a.email,
          subtitle: `Revenue: ${a.revenue || 0} ج.م`,
          icon: 'shield-checkmark',
          color: '#8B5CF6',
          route: `/owner/admins`,
        });
      }
    });

    // Search suppliers
    suppliers.forEach((s: any) => {
      if (fuzzyMatch(s.name || '', query) || fuzzyMatch(s.contact_email || '', query)) {
        allResults.push({
          id: s.id,
          type: 'supplier',
          title: s.name,
          subtitle: s.contact_email || s.phone || '',
          icon: 'briefcase',
          color: '#14B8A6',
          route: `/owner/suppliers`,
        });
      }
    });

    // Search distributors
    distributors.forEach((d: any) => {
      if (fuzzyMatch(d.name || '', query) || fuzzyMatch(d.contact_email || '', query)) {
        allResults.push({
          id: d.id,
          type: 'distributor',
          title: d.name,
          subtitle: d.contact_email || d.phone || '',
          icon: 'car',
          color: '#EF4444',
          route: `/owner/distributors`,
        });
      }
    });

    return allResults.slice(0, 20); // Limit results
  }, [query, products, customers, admins, suppliers, distributors, language]);

  const handleResultPress = (result: SearchResult) => {
    onClose();
    if (result.route) {
      router.push(result.route as any);
    }
  };

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: contentTranslateY.value }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={() => {
          Keyboard.dismiss();
          onClose();
        }}
      >
        <Animated.View style={[styles.overlay, overlayStyle]}>
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View style={[styles.container, contentStyle]} pointerEvents="box-none">
        <TouchableOpacity activeOpacity={1} style={styles.content}>
          {/* Search Input */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={language === 'ar' ? 'ابحث في كل شيء...' : 'Search everything...'}
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Results */}
          <ScrollView style={styles.results} showsVerticalScrollIndicator={false}>
            {query.length < 2 ? (
              <View style={styles.placeholder}>
                <Ionicons name="search" size={48} color="rgba(255,255,255,0.3)" />
                <Text style={styles.placeholderText}>
                  {language === 'ar' ? 'اكتب للبحث...' : 'Type to search...'}
                </Text>
              </View>
            ) : results.length === 0 ? (
              <View style={styles.placeholder}>
                <Ionicons name="alert-circle" size={48} color="rgba(255,255,255,0.3)" />
                <Text style={styles.placeholderText}>
                  {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
                </Text>
              </View>
            ) : (
              results.map((result) => (
                <TouchableOpacity
                  key={`${result.type}-${result.id}`}
                  style={styles.resultItem}
                  onPress={() => handleResultPress(result)}
                >
                  <View style={[styles.resultIcon, { backgroundColor: result.color + '30' }]}>
                    <Ionicons name={result.icon as any} size={20} color={result.color} />
                  </View>
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultTitle} numberOfLines={1}>{result.title}</Text>
                    <Text style={styles.resultSubtitle} numberOfLines={1}>{result.subtitle}</Text>
                  </View>
                  <View style={styles.resultBadge}>
                    <Text style={[styles.resultBadgeText, { color: result.color }]}>
                      {result.type}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>

          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>
              {language === 'ar' ? 'إغلاق' : 'Close'}
            </Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    flex: 1,
    paddingTop: 100,
    paddingHorizontal: 16,
  },
  content: {
    backgroundColor: 'rgba(30,30,50,0.95)',
    borderRadius: 20,
    padding: 16,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
  },
  results: {
    marginTop: 16,
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  placeholder: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 12,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 8,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
  resultSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  resultBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  resultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  closeButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  closeText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GlobalSearch;
