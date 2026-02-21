import React, { createContext, useContext, useEffect, useState } from 'react';
import { miscService } from '../services/misc';

const ShopConfigContext = createContext();

export const useShopConfig = () => {
  const context = useContext(ShopConfigContext);
  if (!context) {
    throw new Error('useShopConfig must be used within a ShopConfigProvider');
  }
  return context;
};

export const ShopConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const data = await miscService.getConfig();
        setConfig(data);
      } catch (error) {
        console.error('Failed to fetch shop config:', error);
        // Default to open if config fetch fails
        setConfig({ shop_open: true });
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const shopOpen = config?.shop_open ?? true;

  return (
    <ShopConfigContext.Provider value={{ config, shopOpen, loading }}>
      {children}
    </ShopConfigContext.Provider>
  );
};
