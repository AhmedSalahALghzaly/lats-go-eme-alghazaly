/**
 * useWebSocket - Real-time WebSocket hook for live cart synchronization
 * Provides live updates for cart, orders, and favorites
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '../store/appStore';
import { useCartStore } from '../store/useCartStore';
import { cartApi, orderApi, favoriteApi } from '../services/api';
import Constants from 'expo-constants';

interface WebSocketMessage {
  type: 'cart_update' | 'order_update' | 'favorite_update' | 'sync' | 'notification';
  data?: any;
  tables?: string[];
  user_id?: string;
}

export const useWebSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const user = useAppStore((state) => state.user);
  const setCartItems = useCartStore((state) => state.setCartItems);
  const setOrders = useAppStore((state) => state.setOrders);
  
  // Get WebSocket URL from environment
  const getWsUrl = () => {
    const backendUrl = Constants.expoConfig?.extra?.EXPO_BACKEND_URL || 
                       process.env.EXPO_BACKEND_URL || 
                       '/api';
    // Convert HTTP to WS protocol
    if (backendUrl.startsWith('/')) {
      // Relative URL - use current window location
      if (typeof window !== 'undefined') {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${window.location.host}`;
      }
      return 'ws://localhost:8001';
    }
    return backendUrl.replace('http', 'ws');
  };

  // Sync cart from server
  const syncCart = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await cartApi.get();
      const items = response.data?.items || [];
      setCartItems(items);
      setLastUpdate(new Date());
      console.log('[WebSocket] Cart synced:', items.length, 'items');
    } catch (error) {
      console.error('[WebSocket] Cart sync error:', error);
    }
  }, [user, setCartItems]);

  // Sync orders from server
  const syncOrders = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await orderApi.getAll();
      const orders = response.data || [];
      setOrders(orders);
      setLastUpdate(new Date());
      console.log('[WebSocket] Orders synced:', orders.length, 'orders');
    } catch (error) {
      console.error('[WebSocket] Orders sync error:', error);
    }
  }, [user, setOrders]);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((message: WebSocketMessage) => {
    console.log('[WebSocket] Received:', message);

    switch (message.type) {
      case 'cart_update':
        if (message.user_id === user?.id || !message.user_id) {
          syncCart();
        }
        break;

      case 'order_update':
        if (message.user_id === user?.id || !message.user_id) {
          syncOrders();
        }
        break;

      case 'sync':
        if (message.tables?.includes('cart')) {
          syncCart();
        }
        if (message.tables?.includes('orders')) {
          syncOrders();
        }
        break;

      case 'notification':
        // Handle notifications (could show toast/alert)
        console.log('[WebSocket] Notification:', message.data);
        break;
    }
  }, [user, syncCart, syncOrders]);

  // Connect to WebSocket server
  const connect = useCallback(() => {
    if (!user || socketRef.current?.connected) return;

    const wsUrl = getWsUrl();
    console.log('[WebSocket] Connecting to:', wsUrl);

    socketRef.current = io(wsUrl, {
      path: '/ws/socket.io',
      transports: ['websocket', 'polling'],
      auth: {
        user_id: user.id,
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on('connect', () => {
      console.log('[WebSocket] Connected');
      setIsConnected(true);
      
      // Join user-specific room
      socketRef.current?.emit('join', { user_id: user.id });
      
      // Initial sync
      syncCart();
      syncOrders();
    });

    socketRef.current.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      setIsConnected(false);
    });

    socketRef.current.on('message', handleMessage);
    socketRef.current.on('cart_update', (data: any) => handleMessage({ type: 'cart_update', ...data }));
    socketRef.current.on('order_update', (data: any) => handleMessage({ type: 'order_update', ...data }));
    socketRef.current.on('sync', (data: any) => handleMessage({ type: 'sync', ...data }));

    socketRef.current.on('connect_error', (error) => {
      console.log('[WebSocket] Connection error:', error.message);
    });

    return socketRef.current;
  }, [user, handleMessage, syncCart, syncOrders]);

  // Disconnect from WebSocket server
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    }
  }, []);

  // Emit event to server
  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  // Manual refresh
  const refresh = useCallback(() => {
    syncCart();
    syncOrders();
  }, [syncCart, syncOrders]);

  // Connect on mount when user is logged in
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  return {
    isConnected,
    lastUpdate,
    connect,
    disconnect,
    emit,
    refresh,
    syncCart,
    syncOrders,
  };
};

// Lightweight context provider for WebSocket state
import React, { createContext, useContext, ReactNode } from 'react';

interface WebSocketContextType {
  isConnected: boolean;
  lastUpdate: Date | null;
  refresh: () => void;
  syncCart: () => Promise<void>;
  syncOrders: () => Promise<void>;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

export const WebSocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const ws = useWebSocket();
  
  const contextValue: WebSocketContextType = {
    isConnected: ws.isConnected,
    lastUpdate: ws.lastUpdate,
    refresh: ws.refresh,
    syncCart: ws.syncCart,
    syncOrders: ws.syncOrders,
  };
  
  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    // Return default values if used outside provider
    return {
      isConnected: false,
      lastUpdate: null,
      refresh: () => {},
      syncCart: async () => {},
      syncOrders: async () => {},
    };
  }
  return context;
};

export default useWebSocket;
