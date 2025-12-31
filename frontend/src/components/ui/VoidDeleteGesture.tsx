/**
 * Void Delete Gesture Component
 * A specialized drag-to-delete gesture that creates an "implode" effect
 */
import React, { useRef } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Text,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import { PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const DELETE_THRESHOLD = -SCREEN_WIDTH * 0.35;

interface VoidDeleteGestureProps {
  children: React.ReactNode;
  onDelete: () => void;
  disabled?: boolean;
}

export const VoidDeleteGesture: React.FC<VoidDeleteGestureProps> = ({
  children,
  onDelete,
  disabled = false,
}) => {
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const isDeleting = useSharedValue(false);

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  const triggerDelete = () => {
    triggerHaptic();
    onDelete();
  };

  const gestureHandler = useAnimatedGestureHandler<
    PanGestureHandlerGestureEvent,
    { startX: number }
  >({
    onStart: (_, ctx) => {
      ctx.startX = translateX.value;
    },
    onActive: (event, ctx) => {
      if (disabled) return;
      // Only allow left swipe
      const newX = ctx.startX + event.translationX;
      translateX.value = Math.min(0, newX);
      
      // Calculate progress towards deletion
      const progress = Math.abs(translateX.value) / Math.abs(DELETE_THRESHOLD);
      scale.value = interpolate(progress, [0, 1], [1, 0.8], Extrapolate.CLAMP);
      
      // Trigger haptic when crossing threshold
      if (translateX.value < DELETE_THRESHOLD && !isDeleting.value) {
        isDeleting.value = true;
        runOnJS(triggerHaptic)();
      } else if (translateX.value > DELETE_THRESHOLD && isDeleting.value) {
        isDeleting.value = false;
      }
    },
    onEnd: () => {
      if (disabled) return;
      
      if (translateX.value < DELETE_THRESHOLD) {
        // Implode animation
        scale.value = withTiming(0, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 });
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200 }, () => {
          runOnJS(triggerDelete)();
        });
      } else {
        // Spring back
        translateX.value = withSpring(0);
        scale.value = withSpring(1);
      }
    },
  });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const voidStyle = useAnimatedStyle(() => {
    const progress = Math.abs(translateX.value) / Math.abs(DELETE_THRESHOLD);
    return {
      opacity: interpolate(progress, [0, 0.5, 1], [0, 0.5, 1], Extrapolate.CLAMP),
      transform: [{ scale: interpolate(progress, [0, 1], [0.5, 1.2], Extrapolate.CLAMP) }],
    };
  });

  return (
    <View style={styles.container}>
      {/* Void indicator behind */}
      <Animated.View style={[styles.voidContainer, voidStyle]}>
        <View style={styles.voidCircle}>
          <Ionicons name="trash" size={24} color="#FFF" />
        </View>
        <Text style={styles.voidText}>Release to delete</Text>
      </Animated.View>

      {/* Main content */}
      <PanGestureHandler onGestureEvent={gestureHandler} enabled={!disabled}>
        <Animated.View style={[styles.content, animatedStyle]}>
          {children}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  content: {
    backgroundColor: 'transparent',
  },
  voidContainer: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
  },
  voidCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voidText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default VoidDeleteGesture;
