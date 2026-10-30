import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';

// Configuración base de Axios
export const api = axios.create({
  baseURL: 'http://192.168.8.203:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

type AuthContextType = {
  user: any;
  isLoading: boolean;
  login: (userData: any, token?: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => { },
  logout: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Restaurar sesión al iniciar la app
  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('@user_data');
        const storedToken = await AsyncStorage.getItem('@user_token');

        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }

        if (storedToken) {
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
      } catch (error) {
        console.error('Error restaurando sesión:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, []);

  // Interceptor de Axios para inyectar dinámicamente el Token en los Headers de las peticiones
  useEffect(() => {
    const requestInterceptor = api.interceptors.request.use(
      async (config) => {
        const storedToken = await AsyncStorage.getItem('@user_token');
        if (storedToken) {
          config.headers.Authorization = `Bearer ${storedToken}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    return () => api.interceptors.request.eject(requestInterceptor);
  }, []);

  // Interceptor de Axios para capturar errores de conexión (servidor caído) o 401 globalmente
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const url = error.config?.url || '';
        const isAuthEndpoint = url.includes('/api/login') || url.includes('/api/login-admin') || url.includes('/api/logout');

        if (!error.response) {
          // Solo mostramos alerta de caída si no es la petición de logout (para evitar alertas repetidas)
          if (!url.includes('/api/logout')) {
            Alert.alert(
              'Servicio no disponible',
              'No se pudo establecer conexión con el servidor. Por favor, verifica tu red o intenta más tarde.'
            );
          }
        } else if (error.response.status === 401 && !isAuthEndpoint) {
          console.log('Error 401 detectado globalmente. Cerrando sesión...');
          await logout();
        }
        return Promise.reject(error);
      }
    );

    return () => api.interceptors.response.eject(interceptor);
  }, []);

  const login = async (userData: any, token?: string) => {
    try {
      await AsyncStorage.setItem('@user_data', JSON.stringify(userData));
      if (token) {
        await AsyncStorage.setItem('@user_token', token);
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      }
      setUser(userData);

      // Redireccionar basado en el rol
      if (userData.id_rol === 1) {
        router.replace('/client-dashboard');
      } else if (userData.id_rol === 2) {
        router.replace('/tech-dashboard');
      }
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
    }
  };

  const logout = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('@user_token');
      if (storedToken) {
        try {
          await api.post('/api/logout');
        } catch (srvError) {
          console.warn('No se pudo revocar la sesión en el servidor:', srvError);
        }
      }
      await AsyncStorage.removeItem('@user_data');
      await AsyncStorage.removeItem('@user_token');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
      // Forzar al login
      router.replace('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
