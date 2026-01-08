import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useTranslation } from '../hooks/useTranslation';

interface CategoryCardProps {
  category: {
    id: string;
    name: string;
    name_ar: string;
    icon?: string;
    image_data?: string;
    children?: any[];
  };
  size?: 'small' | 'medium' | 'large';
}

const iconMap: { [key: string]: string } = {
  'engine': 'engine',
  'car-suspension': 'car-brake-abs',
  'car-clutch': 'cog',
  'lightning-bolt': 'lightning-bolt',
  'car-door': 'car-door',
  'car-tire-alert': 'tire',
  'filter': 'filter',
  'oil': 'oil',
  'air-filter': 'air-filter',
  'fan': 'fan',
  'flash': 'flash',
  'car-brake-abs': 'car-brake-abs',
  'cog': 'cog',
  'battery': 'battery',
  'lightbulb': 'lightbulb',
  'flip-horizontal': 'flip-horizontal',
  'car-side': 'car-side',
};

export const CategoryCard: React.FC<CategoryCardProps> = ({ category, size = 'medium' }) => {
  const { colors } = useTheme();
  const { language } = useTranslation();
  const router = useRouter();

  const getName = () => {
    return language === 'ar' && category.name_ar ? category.name_ar : category.name;
  };

  const getIconName = () => {
    const icon = category.icon || 'cube';
    return iconMap[icon] || 'cube';
  };

  const sizeStyles = {
    small: { width: 80, height: 80, iconSize: 24, fontSize: 11, containerSize: 40 },
    medium: { width: 100, height: 100, iconSize: 32, fontSize: 12, containerSize: 50 },
    large: { width: 120, height: 120, iconSize: 40, fontSize: 14, containerSize: 60 },
  };

  const { width, height, iconSize, fontSize, containerSize } = sizeStyles[size];

  // Check if category has an uploaded image
  const hasImage = category.image_data && category.image_data.length > 0;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          width,
          height,
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
      onPress={() => router.push(`/category/${category.id}`)}
      activeOpacity={0.7}
    >
      <View 
        style={[
          styles.iconContainer, 
          { 
            backgroundColor: hasImage ? 'transparent' : colors.primary + '15',
            width: containerSize,
            height: containerSize,
            borderRadius: containerSize / 2,
            overflow: 'hidden',
          }
        ]}
      >
        {hasImage ? (
          <Image
            source={{ uri: category.image_data }}
            style={{
              width: containerSize,
              height: containerSize,
              borderRadius: containerSize / 2,
            }}
            resizeMode="cover"
          />
        ) : (
          <MaterialCommunityIcons
            name={getIconName() as any}
            size={iconSize}
            color={colors.primary}
          />
        )}
      </View>
      <Text
        style={[styles.name, { color: colors.text, fontSize }]}
        numberOfLines={2}
      >
        {getName()}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  name: {
    fontWeight: '600',
    textAlign: 'center',
  },
});
