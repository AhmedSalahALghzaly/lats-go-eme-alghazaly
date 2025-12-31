/**
 * Notification Center Component
 * Real-time notifications with WebSocket support
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAppStore, Notification } from '../../store/appStore';
import { notificationApi } from '../../services/api';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface NotificationCenterProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ visible, onClose }) => {
  const notifications = useAppStore((state) => state.notifications);
  const unreadCount = useAppStore((state) => state.unreadCount);
  const markNotificationRead = useAppStore((state) => state.markNotificationRead);
  const markAllNotificationsRead = useAppStore((state) => state.markAllNotificationsRead);
  const language = useAppStore((state) => state.language);

  const slideY = useSharedValue(SCREEN_HEIGHT);

  useEffect(() => {
    if (visible) {
      slideY.value = withSpring(0, { damping: 20 });
    } else {
      slideY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
    }
  }, [visible]);

  const handleMarkRead = async (id: string) => {
    try {
      markNotificationRead(id);
      await notificationApi.markRead(id);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      markAllNotificationsRead();
      await notificationApi.markAllRead();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return { name: 'checkmark-circle', color: '#10B981' };
      case 'warning': return { name: 'warning', color: '#F59E0B' };
      case 'error': return { name: 'alert-circle', color: '#EF4444' };
      default: return { name: 'information-circle', color: '#3B82F6' };
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return language === 'ar' ? 'الآن' : 'Just now';
    if (minutes < 60) return language === 'ar' ? `${minutes} دقيقة` : `${minutes}m ago`;
    if (hours < 24) return language === 'ar' ? `${hours} ساعة` : `${hours}h ago`;
    return language === 'ar' ? `${days} يوم` : `${days}d ago`;
  };

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      </TouchableOpacity>

      <Animated.View style={[styles.container, contentStyle]}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.handleBar} />
            <View style={styles.headerRow}>
              <Text style={styles.headerTitle}>
                {language === 'ar' ? 'الإشعارات' : 'Notifications'}
              </Text>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={handleMarkAllRead}>
                  <Text style={styles.markAllText}>
                    {language === 'ar' ? 'قراءة الكل' : 'Mark all read'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Notifications List */}
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="notifications-off" size={48} color="#9CA3AF" />
                <Text style={styles.emptyText}>
                  {language === 'ar' ? 'لا توجد إشعارات' : 'No notifications'}
                </Text>
              </View>
            ) : (
              notifications.map((notification) => {
                const icon = getIcon(notification.type);
                return (
                  <TouchableOpacity
                    key={notification.id}
                    style={[
                      styles.notificationItem,
                      !notification.read && styles.notificationUnread,
                    ]}
                    onPress={() => handleMarkRead(notification.id)}
                  >
                    <View style={[styles.iconContainer, { backgroundColor: icon.color + '20' }]}>
                      <Ionicons name={icon.name as any} size={20} color={icon.color} />
                    </View>
                    <View style={styles.notificationContent}>
                      <Text style={styles.notificationTitle}>{notification.title}</Text>
                      <Text style={styles.notificationMessage} numberOfLines={2}>
                        {notification.message}
                      </Text>
                      <Text style={styles.notificationTime}>
                        {formatTime(notification.created_at)}
                      </Text>
                    </View>
                    {!notification.read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </Animated.View>
    </Modal>
  );
};

// Notification Bell Button with pulse effect
interface NotificationBellProps {
  onPress: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onPress }) => {
  const unreadCount = useAppStore((state) => state.unreadCount);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (unreadCount > 0) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        true
      );
    } else {
      pulseScale.value = 1;
    }
  }, [unreadCount]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <TouchableOpacity onPress={onPress} style={styles.bellButton}>
      <Ionicons name="notifications" size={22} color="#1a1a2e" />
      {unreadCount > 0 && (
        <Animated.View style={[styles.badge, pulseStyle]}>
          <Text style={styles.badgeText}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </Animated.View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_HEIGHT * 0.7,
  },
  content: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  markAllText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  list: {
    maxHeight: SCREEN_HEIGHT * 0.5,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 12,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  notificationUnread: {
    backgroundColor: '#F9FAFB',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  notificationMessage: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  notificationTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    alignSelf: 'center',
  },
  bellButton: {
    padding: 6,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
});

export default NotificationCenter;
