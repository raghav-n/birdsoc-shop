import React, { createContext, useContext, useEffect, useState } from 'react';
import { basketService } from '../services/basket';
import { tokenManager } from '../services/api';
import { useAuth } from './AuthContext';
import { useShopConfig } from './ShopConfigContext';
import toast from 'react-hot-toast';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { shopOpen } = useShopConfig();

  // Initialize or fetch cart
  const initializeCart = async () => {
    setLoading(true);
    try {
      let cartData;

      if (isAuthenticated) {
        // If a guest cart exists, merge it into the user's basket
        const guestCartId = tokenManager.getCartId();
        if (guestCartId) {
          try {
            await basketService.mergeBaskets(guestCartId);
            cartData = await basketService.getCurrentBasket();
          } catch (error) {
            // Merge failed (e.g. guest cart not found) — fall through to fetch normally
          }
          tokenManager.clearCartId();
        }

        if (!cartData) {
          // No guest cart or merge failed — fetch or create user's basket
          try {
            cartData = await basketService.getCurrentBasket();
          } catch (error) {
            if (error.response?.status === 404) {
              cartData = await basketService.createBasket();
              // Do NOT store the cart ID for authenticated users — they are
              // identified by their JWT. Storing it would cause the basket to
              // be treated as a guest cart on the next initializeCart call,
              // merging it into itself and marking it Merged.
            } else {
              throw error;
            }
          }
        }
      } else {
        // For guest users, try to get existing cart or create new one
        const existingCartId = tokenManager.getCartId();
        if (existingCartId) {
          try {
            cartData = await basketService.getCurrentBasket();
          } catch (error) {
            if (error.response?.status === 404) {
              // Cart not found, create new one
              cartData = await basketService.createBasket();
              tokenManager.setCartId(cartData.cart_id);
            } else {
              throw error;
            }
          }
        } else {
          // No cart exists, create new one
          cartData = await basketService.createBasket();
          tokenManager.setCartId(cartData.cart_id);
        }
      }
      
      setCart(cartData.basket || cartData);
    } catch (error) {
      console.error('Failed to initialize cart:', error);
      toast.error('Failed to load cart');
    } finally {
      setLoading(false);
    }
  };

  // Refresh cart data
  const refreshCart = async () => {
    try {
      const cartData = await basketService.getCurrentBasket();
      setCart(cartData.basket || cartData);
    } catch (error) {
      console.error('Failed to refresh cart:', error);
    }
  };

  const isStaleBasket = (error) => error.response?.status === 410;

  // Add item to cart
  const addToCart = async (productId, quantity = 1, options = {}) => {
    if (!shopOpen) {
      toast.error('The shop is currently closed');
      return { success: false, error: 'Shop is closed' };
    }
    if (!cart) return { success: false, error: 'Cart not initialized' };

    try {
      await basketService.addToBasket(cart.id, productId, quantity, options);
      await refreshCart();
      toast.success('Item added to cart');
      return { success: true };
    } catch (error) {
      if (isStaleBasket(error)) {
        // Our basket was merged by Oscar middleware; get the fresh one and retry
        await initializeCart();
        try {
          const freshCart = await basketService.getCurrentBasket();
          const freshId = (freshCart.basket || freshCart).id;
          await basketService.addToBasket(freshId, productId, quantity, options);
          await refreshCart();
          toast.success('Item added to cart');
          return { success: true };
        } catch (retryError) {
          const message = retryError.response?.data?.detail || 'Failed to add item to cart';
          toast.error(message);
          return { success: false, error: message };
        }
      }
      const message = error.response?.data?.detail || 'Failed to add item to cart';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Update cart line
  const updateCartLine = async (lineId, quantity) => {
    if (!cart) return { success: false, error: 'Cart not initialized' };

    try {
      await basketService.updateBasketLine(cart.id, lineId, quantity);
      await refreshCart();
      return { success: true };
    } catch (error) {
      if (isStaleBasket(error)) {
        await initializeCart();
      }
      const message = error.response?.data?.detail || 'Failed to update cart';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Remove cart line
  const removeFromCart = async (lineId) => {
    if (!cart) return { success: false, error: 'Cart not initialized' };

    try {
      await basketService.removeBasketLine(cart.id, lineId);
      await refreshCart();
      toast.success('Item removed from cart');
      return { success: true };
    } catch (error) {
      if (isStaleBasket(error)) {
        await initializeCart();
      }
      const message = error.response?.data?.detail || 'Failed to remove item';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Apply voucher
  const applyVoucher = async (code) => {
    if (!cart) return { success: false, error: 'Cart not initialized' };
    
    try {
      await basketService.applyVoucher(cart.id, code);
      await refreshCart();
      toast.success('Voucher applied successfully');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.detail || 'Failed to apply voucher';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  // Get cart count
  const getCartCount = () => {
    return cart?.lines?.reduce((total, line) => total + line.quantity, 0) || 0;
  };

  // Clear cart (typically after successful order)
  const clearCart = () => {
    setCart(null);
    tokenManager.clearCartId();
  };

  // Initialize cart when component mounts or auth state changes
  useEffect(() => {
    if (authLoading) {
      return;
    }
    initializeCart();
  }, [isAuthenticated, authLoading]);

  const value = {
    cart,
    loading,
    shopOpen,
    addToCart,
    updateCartLine,
    removeFromCart,
    applyVoucher,
    refreshCart,
    getCartCount,
    clearCart,
    initializeCart,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};
