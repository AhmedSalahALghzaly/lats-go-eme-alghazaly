/**
 * Skeleton Loading Component
 * Provides placeholder UI while content is loading
 */
import React from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useColorMood } from '../../store/appStore';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
}) => {
  const mood = useColorMood();
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E7EB', '#F3F4F6'],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor,
        },
        style,
      ]}
    />
  );
};

export const ProductCardSkeleton: React.FC = () => {
  return (
    <View style={styles.productCard}>
      <Skeleton height={120} borderRadius={8} />
      <View style={styles.productContent}>
        <Skeleton width="80%" height={16} style={styles.mb8} />
        <Skeleton width="50%" height={14} style={styles.mb8} />
        <Skeleton width="30%" height={20} />
      </View>
    </View>
  );
};

export const CategoryCardSkeleton: React.FC = () => {
  return (
    <View style={styles.categoryCard}>
      <Skeleton width={60} height={60} borderRadius={30} />
      <Skeleton width={80} height={14} style={styles.mt8} />
    </View>
  );
};

export const ListItemSkeleton: React.FC = () => {
  return (
    <View style={styles.listItem}>
      <Skeleton width={50} height={50} borderRadius={25} />
      <View style={styles.listContent}>
        <Skeleton width="70%" height={16} style={styles.mb8} />
        <Skeleton width="40%" height={12} />
      </View>
    </View>
  );
};

export const DashboardCardSkeleton: React.FC = () => {
  return (
    <View style={styles.dashboardCard}>
      <Skeleton width="60%" height={14} style={styles.mb8} />
      <Skeleton width="40%" height={24} />
    </View>
  );
};

const styles = StyleSheet.create({
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    width: 160,
  },
  productContent: {
    marginTop: 12,
  },
  categoryCard: {
    alignItems: 'center',
    padding: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginBottom: 8,
  },
  listContent: {
    flex: 1,
    marginLeft: 12,
  },
  dashboardCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flex: 1,
    margin: 4,
  },
  mb8: {
    marginBottom: 8,
  },
  mt8: {
    marginTop: 8,
  },
});

export default Skeleton;
