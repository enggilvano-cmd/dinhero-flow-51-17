import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppSettings, getSettings, updateSettings as saveSettings } from '@/lib/supabase-storage';
import { useAuth } from '@/hooks/useAuth';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: AppSettings) => void;
  formatCurrency: (amount: number) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const { user, loading } = useAuth();
  const [settings, setSettings] = useState<AppSettings>({
    currency: 'BRL',
    theme: 'system',
    notifications: true,
    autoBackup: false,
    language: 'pt-BR',
    userId: ''
  });

  // Apply theme immediately on mount and settings change
  const applyTheme = (theme: AppSettings['theme']) => {
    const root = window.document.documentElement;
    
    // Remove all theme classes first
    root.classList.remove('light', 'dark');
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  };

  // Load theme from localStorage immediately on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('app-theme') as AppSettings['theme'] || 'system';
    setSettings(prev => ({ ...prev, theme: savedTheme }));
    applyTheme(savedTheme);
  }, []);

  // Load full settings when user is authenticated
  useEffect(() => {
    const loadSettings = async () => {
      if (!user || loading) return;
      
      try {
        const loadedSettings = await getSettings();
        const localTheme = localStorage.getItem('app-theme') as AppSettings['theme'];
        
        // If localStorage has a different theme, use it and update Supabase
        if (localTheme && localTheme !== loadedSettings.theme) {
          const updatedSettings = { ...loadedSettings, theme: localTheme };
          setSettings(updatedSettings);
          applyTheme(localTheme);
          await saveSettings(updatedSettings);
        } else {
          setSettings(loadedSettings);
          applyTheme(loadedSettings.theme);
          localStorage.setItem('app-theme', loadedSettings.theme);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        // Keep the theme from localStorage if Supabase fails
      }
    };
    loadSettings();
  }, [user, loading]);

  // Apply theme when settings change and listen for system changes
  useEffect(() => {
    applyTheme(settings.theme);

    // Listen for system theme changes when theme is set to 'system'
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (settings.theme === 'system') {
        applyTheme('system');
      }
    };

    mediaQuery.addEventListener('change', handleSystemThemeChange);
    return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
  }, [settings.theme]);

  const updateSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    // Save theme to localStorage immediately for persistence when logged out
    localStorage.setItem('app-theme', newSettings.theme);
    applyTheme(newSettings.theme);
    
    // Save to Supabase if user is authenticated
    if (user) {
      await saveSettings(newSettings);
    }
  };

  const formatCurrency = (amount: number): string => {
    const currencySymbols = {
      'BRL': 'R$',
      'USD': '$',
      'EUR': '€'
    };

    const locales = {
      'BRL': 'pt-BR',
      'USD': 'en-US', 
      'EUR': 'de-DE'
    };

    try {
      return new Intl.NumberFormat(locales[settings.currency as keyof typeof locales], {
        style: 'currency',
        currency: settings.currency,
        minimumFractionDigits: 2
      }).format(amount);
    } catch (error) {
      // Fallback if currency not supported
      const symbol = currencySymbols[settings.currency as keyof typeof currencySymbols] || settings.currency;
      return `${symbol} ${amount.toFixed(2).replace('.', ',')}`;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, formatCurrency }}>
      {children}
    </SettingsContext.Provider>
  );
}