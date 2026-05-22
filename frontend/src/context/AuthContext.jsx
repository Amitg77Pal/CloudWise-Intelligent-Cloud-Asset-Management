import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [storageType, setStorageType] = useState('local');

  useEffect(() => {
    const initAuth = async () => {
      const localToken = localStorage.getItem('token');
      const sessionToken = sessionStorage.getItem('token');
      const token = localToken || sessionToken;
      const storedUser = localToken
        ? localStorage.getItem('user')
        : sessionStorage.getItem('user');

      if (localToken) {
        setStorageType('local');
      } else if (sessionToken) {
        setStorageType('session');
      }

      if (token && storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          const profile = await authService.getProfile();
          const nextUser = profile?.user || profile;
          if (nextUser) {
            setUser(nextUser);
            if (localToken) {
              localStorage.setItem('user', JSON.stringify(nextUser));
            } else {
              sessionStorage.setItem('user', JSON.stringify(nextUser));
            }
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          sessionStorage.removeItem('token');
          sessionStorage.removeItem('user');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password, options = {}) => {
    try {
      const response = await authService.login(email, password);
      
      if (response.requiresMfa) {
        return { success: true, requiresMfa: true, email: response.email };
      }

      const { token, user: userData } = response;

      if (!token || !userData) {
        return {
          success: false,
          error: 'Invalid response from server',
        };
      }

      const remember = options.remember === true;
      const store = remember ? localStorage : sessionStorage;
      store.setItem('token', token);
      store.setItem('user', JSON.stringify(userData));
      setStorageType(remember ? 'local' : 'session');
      setUser(userData);

      return { success: true };
    } catch (error) {
      // Don't clear user data on login error - user might just have wrong password
      return {
        success: false,
        error: error.response?.data?.message || error.response?.data?.error || 'Login failed. Please check your credentials.',
      };
    }
  };

  const verifyMfa = async (email, otp, options = {}) => {
    try {
      const response = await authService.verifyMfa({ email, otp });
      const { token, user: userData } = response;

      if (!token || !userData) {
        return {
          success: false,
          error: 'Invalid response from server',
        };
      }

      const remember = options.remember === true;
      const store = remember ? localStorage : sessionStorage;
      store.setItem('token', token);
      store.setItem('user', JSON.stringify(userData));
      setStorageType(remember ? 'local' : 'session');
      setUser(userData);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.response?.data?.error || 'Verification failed. Please check the code and try again.',
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await authService.register(userData);
      const { token, user: newUser } = response;

      if (!token || !newUser) {
        return {
          success: false,
          error: 'Invalid response from server',
        };
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(newUser));
      setStorageType('local');
      setUser(newUser);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.message || error.response?.data?.error || 'Registration failed. Please try again.',
      };
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
    setStorageType('local');
    // Redirect handled by component using this function
  };

  const updateUser = (nextUser) => {
    setUser(nextUser);
    const store = storageType === 'session' ? sessionStorage : localStorage;
    store.setItem('user', JSON.stringify(nextUser));
  };

  const value = {
    user,
    loading,
    login,
    verifyMfa,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
