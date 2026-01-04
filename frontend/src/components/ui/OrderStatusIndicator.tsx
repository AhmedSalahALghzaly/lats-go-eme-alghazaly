/**
 * OrderStatusIndicator - Real-time animated status indicator per customer row
 * Shows the status of the customer's most recent active order
 * Uses react-native-reanimated for pulse and glow effects
 */
import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

// Status color mapping based on requirements
const STATUS_CONFIG = {
  'no_active_order': { color: '#3B82F6', pulse: false, label: 'No Active Order' },
  'delivered': { color: '#3B82F6', pulse: false, label: 'Delivered' },
  'pending': { color: '#EF4444', pulse: true, label: 'Order Placed' },
  'confirmed': { color: '#EF4444', pulse: true, label: 'Confirmed' },
  'preparing': { color: '#FBBF24', pulse: true, label: 'Preparing' },
  'shipped': { color: '#10B981', pulse: true, label: 'Shipped' },
  'out_for_delivery': { color: '#3B82F6', pulse: true, label: 'Out for Delivery' },
  'cancelled': { color: '#6B7280', pulse: false, label: 'Cancelled' },
};

interface OrderStatusIndicatorProps {
  // Most recent order status for this customer
  status: string;
  // Number of active orders (not delivered/cancelled)
  activeOrderCount?: number;
  // Size of the indicator
  size?: number;
}

export const OrderStatusIndicator: React.FC<OrderStatusIndicatorProps> = ({
  status = 'no_active_order',
  activeOrderCount = 0,
  size = 28,
}) => {
  const pulseAnim = useSharedValue(1);
  const glowAnim = useSharedValue(0);
  const arrowAnim = useSharedValue(0);

  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG['no_active_order'];
  const shouldPulse = config.pulse;
  const hasMultipleOrders = activeOrderCount > 1;

  // Start pulse animation
  useEffect(() => {
    if (shouldPulse) {
      // Pulse scale animation
      pulseAnim.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      
      // Glow animation
      glowAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 600, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulseAnim.value = 1;
      glowAnim.value = 0;
    }
  }, [shouldPulse]);

  // Arrow pulse animation for multiple orders
  useEffect(() => {
    if (hasMultipleOrders) {
      arrowAnim.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 500 }),
          withTiming(0.3, { duration: 500 })
        ),
        -1,
        false
      );
    }
  }, [hasMultipleOrders]);

  const pulseStyle = useAnimatedStyle(() => {
    if (!shouldPulse) {
      return { transform: [{ scale: 1 }] };
    }
    return {
      transform: [{ scale: pulseAnim.value }],
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    if (!shouldPulse) {
      return {
        shadowOpacity: 0,
        shadowRadius: 0,
      };
    }
    return {
      shadowOpacity: interpolate(glowAnim.value, [0, 1], [0.3, 0.9]),
      shadowRadius: interpolate(glowAnim.value, [0, 1], [4, 12]),
    };
  });

  const arrowPulseStyle = useAnimatedStyle(() => {
    return {
      opacity: arrowAnim.value,
      transform: [{ scale: arrowAnim.value }],
    };
  });

  return (
    <View style={styles.container}>
      {/* Main Status Indicator */}
      <Animated.View
        style={[
          styles.indicator,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: config.color,
            shadowColor: config.color,
          },
          pulseStyle,
          glowStyle,
        ]}
      >
        {/* Inner dot for visual effect */}
        <View
          style={[
            styles.innerDot,
            {
              width: size * 0.4,
              height: size * 0.4,
              borderRadius: size * 0.2,
            },
          ]}
        />
      </Animated.View>

      {/* Multiple Orders Indicator - White circle with pulsing arrow */}
      {hasMultipleOrders && (
        <Animated.View
          style={[
            styles.multiOrderIndicator,
            {
              width: size * 0.65,
              height: size * 0.65,
              borderRadius: size * 0.325,
              left: size * 0.5,
            },
            arrowPulseStyle,
          ]}
        >
          <Ionicons name="arrow-up" size={size * 0.4} color={config.color} />
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  innerDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  multiOrderIndicator: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
});

export default OrderStatusIndicator;
