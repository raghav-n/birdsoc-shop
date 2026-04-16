import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { Search, Plus, Minus, Trash2, Tag, CheckCircle, RefreshCw, ShoppingCart } from 'lucide-react';
import { catalogueService } from '../services/catalogue';
import { onsiteService } from '../services/onsite';
import { checkoutService } from '../services/checkout';
import PayNowQR from '../components/PayNowQR';
import { formatCurrency } from '../utils/helpers';
import toast from 'react-hot-toast';

// ── Layout ───────────────────────────────────────────────────────────────────

const Page = styled.div`
  display: grid;
  grid-template-columns: 1fr 380px;
  height: calc(100vh - 64px); /* subtract header */
  overflow: hidden;
  background: var(--page-background);

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
  }
`;

const LeftPanel = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid #e1e1e1;
`;

const RightPanel = styled.div`
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: white;
`;

// ── Left: product browser ────────────────────────────────────────────────────

const ProductBrowserHeader = styled.div`
  padding: 0.75rem 1rem 0.6rem;
  border-bottom: 1px solid #e1e1e1;
  background: white;
  flex-shrink: 0;
`;

const PageTitle = styled.h1`
  font-size: 1.15rem;
  margin: 0 0 0.55rem 0;
  color: var(--dark);
`;

const SearchWrapper = styled.div`
  position: relative;
`;

const SearchIcon = styled.div`
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #999;
  pointer-events: none;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 0.6rem 0.75rem 0.6rem 2.25rem;
  border: 2px solid #e1e1e1;
  border-radius: 6px;
  font-size: 0.95rem;
  background: #f8f4f9;
  transition: border-color 0.15s;
  box-sizing: border-box;

  &:focus {
    outline: none;
    border-color: var(--link-text);
    background: white;
  }
`;

const ProductGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.6rem 0.75rem 0.75rem;
  overflow-y: auto;
  flex: 1;
`;

const CategorySection = styled.section`
  background: white;
  border: 1px solid #e6dfe9;
  border-radius: 12px;
  padding: 0.6rem;
`;

const CategoryLabel = styled.div`
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
  background: #ebe4ef;
  color: var(--dark);
  font-size: 0.74rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin-bottom: 0.5rem;
`;

const CategoryItems = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.45rem;
`;

const ProductCard = styled.div`
  background: white;
  border: 2px solid ${props => props.$inCart ? 'var(--link-text)' : '#e1e1e1'};
  border-radius: 10px;
  padding: 0.45rem 0.55rem;
  cursor: ${props => props.$clickable ? 'pointer' : 'default'};
  text-align: left;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 176px;
  min-width: 176px;
  max-width: 176px;

  &:hover {
    border-color: ${props => props.$clickable ? 'var(--link-text)' : '#e1e1e1'};
    box-shadow: ${props => props.$clickable ? '0 3px 10px rgba(0,0,0,0.12)' : 'none'};
  }

  &:active {
    transform: ${props => props.$clickable ? 'scale(0.97)' : 'none'};
  }

  &:focus-visible {
    outline: none;
    border-color: var(--link-text);
    box-shadow: 0 0 0 3px rgba(43, 120, 228, 0.18);
  }

  &[aria-disabled='true'] {
    opacity: 0.45;
    cursor: not-allowed;
  }

  @media (max-width: 700px) {
    width: calc(50% - 0.225rem);
    min-width: calc(50% - 0.225rem);
    max-width: calc(50% - 0.225rem);
  }
`;

const ProductInfo = styled.div`
  flex: 1;
`;

const ProductName = styled.div`
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--dark);
  line-height: 1.3;
  margin-bottom: 0.2rem;
`;

const ProductPrice = styled.div`
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--link-text);
`;

const ProductStock = styled.div`
  font-size: 0.66rem;
  color: ${props => props.$low ? 'var(--danger)' : '#888'};
  margin-top: 0.15rem;
`;

const VariantList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-top: 0.35rem;
`;

const VariantButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid ${props => props.$inCart ? 'var(--link-text)' : '#ddd'};
  border-radius: 999px;
  background: ${props => props.$inCart ? 'rgba(43, 120, 228, 0.08)' : '#fafafa'};
  padding: 0.28rem 0.5rem;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
  max-width: 100%;

  &:hover:not(:disabled) {
    border-color: var(--link-text);
    background: white;
  }

  &:active:not(:disabled) {
    transform: scale(0.98);
  }

  &:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const VariantName = styled.div`
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--dark);
`;

const VariantPrice = styled.div`
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--link-text);
  flex-shrink: 0;
`;

const VariantCartBadge = styled.div`
  background: var(--link-text);
  color: white;
  border-radius: 999px;
  padding: 0.12rem 0.38rem;
  font-size: 0.64rem;
  font-weight: 700;
  flex-shrink: 0;
`;

const VariantMeta = styled.div`
  font-size: 0.62rem;
  font-weight: 600;
  color: ${props => props.$low ? 'var(--danger)' : '#777'};
  flex-shrink: 0;
`;

const CartBadge = styled.div`
  position: absolute;
  top: 6px;
  right: 6px;
  background: var(--link-text);
  color: white;
  border-radius: 50%;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  font-weight: 700;
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
`;

// ── Right: cart + QR ─────────────────────────────────────────────────────────

const CartHeader = styled.div`
  padding: 1rem 1.25rem 0.75rem;
  border-bottom: 1px solid #e1e1e1;
  flex-shrink: 0;
`;

const CartTitle = styled.h2`
  font-size: 1rem;
  margin: 0;
  color: var(--dark);
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CartBody = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
`;

const EmptyCart = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: #aaa;
  gap: 0.5rem;
  padding: 2rem;
  text-align: center;
`;

const CartItems = styled.div`
  padding: 0.5rem 0;
`;

const CartItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
`;

const CartItemName = styled.div`
  flex: 1;
  font-size: 0.85rem;
  color: var(--dark);
  line-height: 1.3;
`;

const QtyControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
`;

const QtyBtn = styled.button`
  background: none;
  border: 1px solid #ddd;
  border-radius: 4px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--dark);
  transition: background 0.1s;
  flex-shrink: 0;

  &:hover {
    background: #f0f0f0;
  }
`;

const QtyDisplay = styled.div`
  width: 24px;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 600;
`;

const RemoveBtn = styled.button`
  background: none;
  border: none;
  color: #ccc;
  cursor: pointer;
  padding: 2px;
  display: flex;
  align-items: center;
  border-radius: 4px;

  &:hover {
    color: var(--danger);
    background: rgba(204, 51, 13, 0.06);
  }
`;

const CartItemPrice = styled.div`
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--dark);
  min-width: 48px;
  text-align: right;
  flex-shrink: 0;
`;

// ── Cart footer: voucher + totals + action ────────────────────────────────────

const CartFooter = styled.div`
  border-top: 1px solid #e1e1e1;
  padding: 0.75rem 1rem;
  flex-shrink: 0;
`;

const VoucherRow = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
`;

const VoucherInput = styled.input`
  flex: 1;
  padding: 0.45rem 0.65rem;
  border: 2px solid ${props => props.$applied ? 'var(--success)' : props.$error ? 'var(--danger)' : '#e1e1e1'};
  border-radius: 6px;
  font-size: 0.85rem;
  background: #f8f4f9;
  font-family: monospace;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &:focus {
    outline: none;
    border-color: var(--link-text);
    background: white;
  }

  &:disabled {
    opacity: 0.7;
  }
`;

const VoucherApplyBtn = styled.button`
  padding: 0.45rem 0.75rem;
  background: ${props => props.$applied ? 'var(--success)' : 'var(--link-text)'};
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s;
  display: flex;
  align-items: center;
  gap: 0.3rem;

  &:hover {
    opacity: 0.88;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const TotalsBlock = styled.div`
  font-size: 0.85rem;
  color: #555;
  margin-bottom: 0.75rem;
`;

const TotalRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.3rem;

  &:last-child {
    margin-bottom: 0;
    padding-top: 0.35rem;
    border-top: 1px solid #e1e1e1;
    font-size: 1rem;
    font-weight: 700;
    color: var(--dark);
  }
`;

const DiscountLabel = styled.span`
  color: var(--success);
`;

const DiscountValue = styled.span`
  color: var(--success);
  font-weight: 600;
`;

const ActionBtn = styled.button`
  width: 100%;
  padding: 0.85rem;
  background: var(--link-text);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, background 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;

  &:hover:not(:disabled) {
    background: var(--link-text-hover);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

// ── QR / Payment section ──────────────────────────────────────────────────────

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(76, 122, 45, 0.4); }
  50% { box-shadow: 0 0 0 10px rgba(76, 122, 45, 0); }
`;

const QRSection = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  gap: 0.75rem;
  overflow-y: auto;
`;

const QRCard = styled.div`
  border-radius: 12px;
  border: 3px solid ${props => props.$confirmed ? 'var(--success)' : 'var(--link-text)'};
  padding: 0.5rem;
  animation: ${props => props.$polling && !props.$confirmed ? pulse : 'none'} 2s infinite;
  transition: border-color 0.3s;
`;

const PaymentStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: ${props => props.$confirmed ? 'var(--success)' : '#666'};
  text-align: center;
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const Spinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid #ddd;
  border-top-color: var(--link-text);
  border-radius: 50%;
  animation: ${spin} 0.8s linear infinite;
  flex-shrink: 0;
`;

const OrderRef = styled.div`
  background: #f8f4f9;
  border: 1px solid #e1e1e1;
  border-radius: 8px;
  padding: 0.6rem 1rem;
  text-align: center;
  width: 100%;
`;

const OrderRefLabel = styled.div`
  font-size: 0.72rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.2rem;
`;

const OrderRefValue = styled.div`
  font-size: 1rem;
  font-weight: 700;
  color: var(--dark);
  font-family: monospace;
  letter-spacing: 0.08em;
`;

const NewSaleBtn = styled.button`
  width: 100%;
  padding: 0.75rem;
  background: white;
  border: 2px solid var(--link-text);
  color: var(--link-text);
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: var(--page-background);
  }
`;

const BackToCartBtn = styled(NewSaleBtn)`
  border-color: #d4ccd9;
  color: var(--dark);

  &:hover {
    background: #f7f4f8;
  }
`;

const SuccessBanner = styled.div`
  background: var(--success);
  color: white;
  border-radius: 10px;
  padding: 1rem;
  text-align: center;
  width: 100%;
`;

// ── Component ─────────────────────────────────────────────────────────────────

const PHASE = { BUILDING: 'building', PLACED: 'placed', CONFIRMED: 'confirmed' };

const getVariantLabel = (child, parentTitle) => {
  if (child.attributes && child.attributes.length > 0) {
    return child.attributes.map((attribute) => attribute.value).join(' / ');
  }
  return child.title.replace(parentTitle, '').replace(/^\s*[-–—]\s*/, '').trim() || child.title;
};

const getStockLabel = (stock) => {
  const count = stock?.num_in_stock;
  if (!stock?.is_available || count <= 0) {
    return { text: 'Out of stock', low: true };
  }
  if (count !== null && count !== undefined && count < 3) {
    return { text: `Only ${count} left`, low: true };
  }
  return null;
};

const getSharedVariantPrice = (product) => {
  const prices = (product.children || [])
    .map((child) => child.price?.incl_tax)
    .filter((price) => price !== null && price !== undefined);

  if (prices.length === 0) return null;

  const [firstPrice] = prices;
  return prices.every((price) => price === firstPrice) ? firstPrice : null;
};

const getTitleWords = (title) => title
  .split(/\s+/)
  .map((word) => ({
    original: word,
    normalized: word.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, ''),
  }))
  .filter((word) => word.normalized);

const getCommonCategoryWords = (products) => {
  if (products.length < 2) {
    return new Set();
  }

  const [firstProduct, ...rest] = products;
  const commonWords = new Set(getTitleWords(firstProduct.title).map((word) => word.normalized));

  rest.forEach((product) => {
    const productWords = new Set(getTitleWords(product.title).map((word) => word.normalized));
    Array.from(commonWords).forEach((word) => {
      if (!productWords.has(word)) {
        commonWords.delete(word);
      }
    });
  });

  return commonWords;
};

const getCategoryDisplayTitle = (title, commonWords) => {
  if (commonWords.size === 0) {
    return title;
  }

  const trimmedTitle = getTitleWords(title)
    .filter((word) => !commonWords.has(word.normalized))
    .map((word) => word.original)
    .join(' ')
    .trim();

  return trimmedTitle || title;
};

export default function OnsitePurchase() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [search, setSearch] = useState('');

  // Cart: { [productId]: { product, quantity } }
  const [cart, setCart] = useState({});

  // Pricing
  const [pricing, setPricing] = useState(null);
  const [calculatingPrice, setCalculatingPrice] = useState(false);

  // Voucher
  const [voucherInput, setVoucherInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState('');
  const [voucherError, setVoucherError] = useState('');

  // Order / payment phase
  const [phase, setPhase] = useState(PHASE.BUILDING);
  const [placing, setPlacing] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [orderTotal, setOrderTotal] = useState(0);

  const handledRef = useRef(false);
  const pollingRef = useRef(false);
  const calcIdRef = useRef(0);

  // ── Load products ────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const [productData, categoryData] = await Promise.all([
          catalogueService.getProducts({ page_size: 200 }),
          catalogueService.getCategories(true),
        ]);
        const items = (productData.results || productData || []).filter(p => {
          if (!p.is_public) return false;
          if (p.structure === 'child') return false;
          if (p.structure === 'standalone') return p.stock?.is_available && (p.stock?.num_in_stock ?? 1) > 0;
          if (p.structure === 'parent') return (p.children || []).some(c => c.stock?.is_available && (c.stock?.num_in_stock ?? 1) > 0);
          return false;
        });
        setProducts(items);
        setCategories(categoryData.results || categoryData || []);
      } catch {
        toast.error('Failed to load products');
      } finally {
        setLoadingProducts(false);
      }
    };
    load();
  }, []);

  // ── Recalculate pricing whenever cart or voucher changes ─────────────────

  const calculatePrice = useCallback(async (cartState, voucherCode, calcId) => {
    const items = Object.values(cartState);
    if (items.length === 0) {
      setPricing(null);
      setCalculatingPrice(false);
      return;
    }
    try {
      const products = items.map(({ product, quantity }) => ({
        id: product.id,
        quantity,
      }));
      const result = await onsiteService.calculate(products, voucherCode);
      if (calcId !== calcIdRef.current) return;
      setPricing(result);
      if (result.voucher_error && voucherCode) {
        setVoucherError(result.voucher_error);
      }
    } catch {
      // silent – don't toast on every keystroke
      if (calcId !== calcIdRef.current) return;
    }
    setCalculatingPrice(false);
  }, []);

  useEffect(() => {
    const hasItems = Object.keys(cart).length > 0;
    if (hasItems) {
      setCalculatingPrice(true);
    }
    calcIdRef.current += 1;
    const id = calcIdRef.current;
    const timer = setTimeout(() => {
      calculatePrice(cart, appliedVoucher, id);
    }, 250);
    return () => clearTimeout(timer);
  }, [cart, appliedVoucher, calculatePrice]);

  // ── Gmail payment polling ─────────────────────────────────────────────────

  useEffect(() => {
    if (phase !== PHASE.PLACED || !orderNumber) return;

    handledRef.current = false;
    pollingRef.current = false;

    const check = async () => {
      if (handledRef.current || pollingRef.current) return;
      pollingRef.current = true;
      try {
        const result = await checkoutService.checkPayNowEmail(orderNumber);
        if (result.confirmed) {
          handledRef.current = true;
          setPhase(PHASE.CONFIRMED);
        }
      } catch (err) {
        const code = err.response?.status;
        if (code !== 404 && code !== 501 && code !== 502) {
          console.error('Payment check failed:', err);
        }
      } finally {
        pollingRef.current = false;
      }
    };

    check();
    const id = window.setInterval(check, 10000);
    return () => window.clearInterval(id);
  }, [phase, orderNumber]);

  // ── Cart helpers ─────────────────────────────────────────────────────────

  const addToCart = (product) => {
    // For parent products, we don't add directly (they have variants)
    if (product.structure === 'parent') {
      toast('This product has variants — select a specific variant below', { icon: 'ℹ️' });
      return;
    }
    setCart(prev => {
      const existing = prev[product.id];
      const maxStock = product.stock?.num_in_stock ?? 99;
      if (existing && existing.quantity >= maxStock) {
        toast.error(`Only ${maxStock} in stock`);
        return prev;
      }
      return {
        ...prev,
        [product.id]: { product, quantity: (existing?.quantity ?? 0) + 1 },
      };
    });
  };

  const handleProductCardKeyDown = (event, product) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    addToCart(product);
  };

  const setQty = (productId, qty) => {
    if (qty <= 0) {
      setCart(prev => { const n = { ...prev }; delete n[productId]; return n; });
    } else {
      setCart(prev => ({ ...prev, [productId]: { ...prev[productId], quantity: qty } }));
    }
  };

  const removeFromCart = (productId) => {
    setCart(prev => { const n = { ...prev }; delete n[productId]; return n; });
  };

  // ── Voucher ──────────────────────────────────────────────────────────────

  const applyVoucher = () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) return;
    setAppliedVoucher(code);
    setVoucherError('');
  };

  const removeVoucher = () => {
    setAppliedVoucher('');
    setVoucherInput('');
    setVoucherError('');
  };

  // ── Proceed to payment ────────────────────────────────────────────────────

  const handleProceedToPayment = async () => {
    const cartItems = Object.values(cart);
    if (cartItems.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    setPlacing(true);
    try {
      const products = cartItems.map(({ product, quantity }) => ({ id: product.id, quantity }));
      const result = await onsiteService.createPending(products, appliedVoucher);
      setOrderNumber(result.order_number);
      setOrderTotal(parseFloat(result.total));
      setPhase(PHASE.PLACED);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to prepare payment');
    } finally {
      setPlacing(false);
    }
  };

  // ── New sale ─────────────────────────────────────────────────────────────

  const handleNewSale = () => {
    setCart({});
    setPricing(null);
    setVoucherInput('');
    setAppliedVoucher('');
    setVoucherError('');
    setOrderNumber('');
    setOrderTotal(0);
    setPhase(PHASE.BUILDING);
    handledRef.current = false;
    pollingRef.current = false;
  };

  const handleBackToCart = () => {
    setOrderNumber('');
    setOrderTotal(0);
    setPhase(PHASE.BUILDING);
    handledRef.current = false;
    pollingRef.current = false;
  };

  // ── Derived values ───────────────────────────────────────────────────────

  const cartItems = Object.values(cart);
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  const filteredProducts = products.filter(p =>
    !search || p.title?.toLowerCase().includes(search.toLowerCase())
  );

  const groupedProducts = useMemo(() => {
    const remaining = [...filteredProducts];
    const groups = categories.map((category) => {
      const matched = remaining.filter((product) => product.category_slugs?.includes(category.slug));
      if (matched.length === 0) {
        return null;
      }
      const commonWords = getCommonCategoryWords(matched);

      matched.forEach((product) => {
        const index = remaining.findIndex((candidate) => candidate.id === product.id);
        if (index >= 0) {
          remaining.splice(index, 1);
        }
      });

      return {
        key: category.id ?? category.slug,
        name: category.name,
        products: matched.map((product) => ({
          product,
          displayTitle: getCategoryDisplayTitle(product.title, commonWords),
        })),
      };
    }).filter(Boolean);

    if (remaining.length > 0) {
      const commonWords = getCommonCategoryWords(remaining);
      groups.push({
        key: 'uncategorised',
        name: 'Other',
        products: remaining.map((product) => ({
          product,
          displayTitle: getCategoryDisplayTitle(product.title, commonWords),
        })),
      });
    }

    return groups;
  }, [categories, filteredProducts]);

  const subtotal = parseFloat(pricing?.subtotal ?? 0);
  const offers = pricing?.offers ?? [];
  const offersDiscount = parseFloat(pricing?.offers_discount ?? 0);
  const voucherDiscount = parseFloat(pricing?.voucher_discount ?? 0);
  const total = parseFloat(pricing?.total ?? subtotal);

  const referenceId = orderNumber ? `MER-${orderNumber}` : '';

  // ── Render: product grid (left panel) ────────────────────────────────────

  const renderProductGrid = () => {
    if (loadingProducts) {
      return <EmptyCart><Spinner style={{ width: 32, height: 32, borderWidth: 3 }} /><span>Loading products…</span></EmptyCart>;
    }
    if (groupedProducts.length === 0) {
      return <EmptyCart><span>No products found</span></EmptyCart>;
    }
    return groupedProducts.map((group) => (
      <CategorySection key={group.key}>
        <CategoryLabel>{group.name}</CategoryLabel>
        <CategoryItems>
          {group.products.map(({ product, displayTitle }) => {
            const isParent = product.structure === 'parent';
            const inCart = !isParent ? cart[product.id] : null;
            const stockState = getStockLabel(product.stock);
            const sharedVariantPrice = isParent ? getSharedVariantPrice(product) : null;
            const cardClickable = !isParent && phase === PHASE.BUILDING;

            return (
              <ProductCard
                key={product.id}
                $inCart={!!inCart}
                $clickable={cardClickable}
                onClick={cardClickable ? () => addToCart(product) : undefined}
                onKeyDown={cardClickable ? (event) => handleProductCardKeyDown(event, product) : undefined}
                role={cardClickable ? 'button' : undefined}
                tabIndex={cardClickable ? 0 : undefined}
                aria-disabled={phase !== PHASE.BUILDING ? 'true' : undefined}
              >
                {inCart && <CartBadge>{inCart.quantity}</CartBadge>}
                <ProductInfo>
                  <ProductName>{displayTitle}</ProductName>
                  {!isParent ? (
                    <>
                      <ProductPrice>{product.price ? formatCurrency(parseFloat(product.price.incl_tax)) : '—'}</ProductPrice>
                      {stockState && <ProductStock $low={stockState.low}>{stockState.text}</ProductStock>}
                    </>
                  ) : (
                    <>
                  {sharedVariantPrice !== null && (
                    <ProductPrice>{formatCurrency(parseFloat(sharedVariantPrice))}</ProductPrice>
                  )}
                  <VariantList>
                    {(product.children || []).map((child) => {
                          const variantLabel = getVariantLabel(child, product.title);
                          const variantInCart = cart[child.id];
                          const variantStock = getStockLabel(child.stock);
                          const variantDisabled = phase !== PHASE.BUILDING || !child.stock?.is_available || (child.stock?.num_in_stock ?? 0) <= 0;
                          const showVariantPrice = sharedVariantPrice === null;

                          return (
                            <VariantButton
                              key={child.id}
                              type="button"
                              $inCart={!!variantInCart}
                              disabled={variantDisabled}
                              aria-label={`Add ${product.title} - ${variantLabel}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                addToCart(child);
                              }}
                            >
                              <VariantName>{variantLabel}</VariantName>
                              {showVariantPrice && (
                                <VariantPrice>{child.price ? formatCurrency(parseFloat(child.price.incl_tax)) : '—'}</VariantPrice>
                              )}
                              {variantStock && (
                                <VariantMeta $low={variantStock.low}>{variantStock.text}</VariantMeta>
                              )}
                              {variantInCart && <VariantCartBadge>{variantInCart.quantity}</VariantCartBadge>}
                            </VariantButton>
                          );
                        })}
                      </VariantList>
                    </>
                  )}
                </ProductInfo>
              </ProductCard>
            );
          })}
        </CategoryItems>
      </CategorySection>
    ));
  };

  // ── Render: cart (right panel) ────────────────────────────────────────────

  const renderCart = () => {
    if (phase === PHASE.PLACED || phase === PHASE.CONFIRMED) {
      return renderQRSection();
    }

    return (
      <>
        <CartBody>
          {cartItems.length === 0 ? (
            <EmptyCart>
              <ShoppingCart size={32} strokeWidth={1.5} />
              <div>Tap a product to add it</div>
            </EmptyCart>
          ) : (
            <CartItems>
              {cartItems.map(({ product, quantity }) => {
                const price = product.price ? parseFloat(product.price.incl_tax) : 0;
                return (
                  <CartItem key={product.id}>
                    <CartItemName>{product.title}</CartItemName>
                    <QtyControls>
                      <QtyBtn onClick={() => setQty(product.id, quantity - 1)}><Minus size={12} /></QtyBtn>
                      <QtyDisplay>{quantity}</QtyDisplay>
                      <QtyBtn
                        onClick={() => setQty(product.id, quantity + 1)}
                        disabled={product.stock?.num_in_stock !== null && quantity >= (product.stock?.num_in_stock ?? 99)}
                      >
                        <Plus size={12} />
                      </QtyBtn>
                    </QtyControls>
                    <CartItemPrice>{formatCurrency(price * quantity)}</CartItemPrice>
                    <RemoveBtn onClick={() => removeFromCart(product.id)}><Trash2 size={13} /></RemoveBtn>
                  </CartItem>
                );
              })}
            </CartItems>
          )}
        </CartBody>

        <CartFooter>
          {/* Voucher */}
          <VoucherRow>
            <VoucherInput
              placeholder="VOUCHER CODE"
              value={voucherInput}
              onChange={e => { setVoucherInput(e.target.value.toUpperCase()); setVoucherError(''); }}
              onKeyDown={e => e.key === 'Enter' && applyVoucher()}
              $applied={!!appliedVoucher && !voucherError}
              $error={!!voucherError}
              disabled={!!appliedVoucher}
            />
            {appliedVoucher ? (
              <VoucherApplyBtn $applied onClick={removeVoucher}>
                <CheckCircle size={14} /> Applied
              </VoucherApplyBtn>
            ) : (
              <VoucherApplyBtn onClick={applyVoucher} disabled={!voucherInput.trim() || cartItems.length === 0}>
                <Tag size={14} /> Apply
              </VoucherApplyBtn>
            )}
          </VoucherRow>
          {voucherError && <div style={{ fontSize: '0.78rem', color: 'var(--danger)', marginBottom: '0.5rem' }}>{voucherError}</div>}
          {appliedVoucher && !voucherError && <div style={{ fontSize: '0.78rem', color: 'var(--success)', marginBottom: '0.5rem' }}>✓ {appliedVoucher}</div>}

          {/* Totals */}
          {cartItems.length > 0 && (
            <TotalsBlock style={{ opacity: calculatingPrice ? 0.5 : 1, transition: 'opacity 0.2s' }}>
              {offers.length > 0
                ? offers.map((offer, i) => (
                    <TotalRow key={i}>
                      <DiscountLabel>{offer.name}</DiscountLabel>
                      <DiscountValue>−{formatCurrency(parseFloat(offer.amount))}</DiscountValue>
                    </TotalRow>
                  ))
                : offersDiscount > 0 && (
                    <TotalRow>
                      <DiscountLabel>{pricing?.offers_description || 'Discount'}</DiscountLabel>
                      <DiscountValue>−{formatCurrency(offersDiscount)}</DiscountValue>
                    </TotalRow>
                  )
              }
              {voucherDiscount > 0 && (
                <TotalRow>
                  <DiscountLabel>Voucher ({appliedVoucher})</DiscountLabel>
                  <DiscountValue>−{formatCurrency(voucherDiscount)}</DiscountValue>
                </TotalRow>
              )}
              <TotalRow>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  Total
                  {calculatingPrice && <Spinner />}
                </span>
                <span>{formatCurrency(total)}</span>
              </TotalRow>
            </TotalsBlock>
          )}

          <ActionBtn
            onClick={handleProceedToPayment}
            disabled={cartItems.length === 0 || placing || calculatingPrice}
          >
            {placing ? (
              <><Spinner />Preparing payment…</>
            ) : calculatingPrice ? (
              <><Spinner />Updating…</>
            ) : (
              'Proceed to Payment'
            )}
          </ActionBtn>
        </CartFooter>
      </>
    );
  };

  // ── Render: QR + polling ──────────────────────────────────────────────────

  const renderQRSection = () => {
    const confirmed = phase === PHASE.CONFIRMED;

    return (
      <QRSection>
        {confirmed && (
          <SuccessBanner>
            <CheckCircle size={28} style={{ marginBottom: 4 }} />
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Payment received!</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: 4 }}>Order confirmed automatically</div>
          </SuccessBanner>
        )}

        <OrderRef>
          <OrderRefLabel>Order Reference</OrderRefLabel>
          <OrderRefValue>{referenceId}</OrderRefValue>
        </OrderRef>

        <QRCard $polling={!confirmed} $confirmed={confirmed}>
          <PayNowQR amount={orderTotal} referenceId={referenceId} donation={0} />
        </QRCard>

        <PaymentStatus $confirmed={confirmed}>
          {confirmed ? (
            <><CheckCircle size={16} color="var(--success)" /> Payment confirmed</>
          ) : (
            <><Spinner /> Waiting for payment…</>
          )}
        </PaymentStatus>

        {/* Order summary */}
        <div style={{ width: '100%', fontSize: '0.8rem', color: '#666' }}>
          {cartItems.map(({ product, quantity }) => (
            <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', borderBottom: '1px solid #f0f0f0' }}>
              <span>{product.title} × {quantity}</span>
              <span>{formatCurrency(parseFloat(product.price?.incl_tax ?? 0) * quantity)}</span>
            </div>
          ))}
          {offers.length > 0
            ? offers.map((offer, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', color: 'var(--success)' }}>
                  <span>{offer.name}</span>
                  <span>−{formatCurrency(parseFloat(offer.amount))}</span>
                </div>
              ))
            : offersDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', color: 'var(--success)' }}>
                  <span>{pricing?.offers_description || 'Discount'}</span>
                  <span>−{formatCurrency(offersDiscount)}</span>
                </div>
              )
          }
          {voucherDiscount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.2rem 0', color: 'var(--success)' }}>
              <span>Voucher ({appliedVoucher})</span>
              <span>−{formatCurrency(voucherDiscount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0 0', fontWeight: 700, fontSize: '0.95rem', color: 'var(--dark)' }}>
            <span>Total</span>
            <span>{formatCurrency(orderTotal)}</span>
          </div>
        </div>

        {!confirmed && (
          <BackToCartBtn onClick={handleBackToCart}>
            Back to Cart
          </BackToCartBtn>
        )}

        <NewSaleBtn onClick={handleNewSale}>
          <RefreshCw size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          New Sale
        </NewSaleBtn>
      </QRSection>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <Page>
      <LeftPanel>
        <ProductBrowserHeader>
          <Link to="/console" style={{ fontSize: '0.8rem', color: 'var(--link-text)', display: 'inline-block', marginBottom: '0.3rem' }}>← Back to Console</Link>
          <PageTitle>Onsite Purchase</PageTitle>
          <SearchWrapper>
            <SearchIcon><Search size={16} /></SearchIcon>
            <SearchInput
              type="text"
              placeholder="Search products…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </SearchWrapper>
        </ProductBrowserHeader>
        <ProductGrid>
          {renderProductGrid()}
        </ProductGrid>
      </LeftPanel>

      <RightPanel>
        <CartHeader>
          <CartTitle>
            <ShoppingCart size={18} />
            Cart{cartCount > 0 ? ` (${cartCount})` : ''}
            {phase === PHASE.PLACED && ' — Awaiting payment'}
            {phase === PHASE.CONFIRMED && ' — Paid ✓'}
          </CartTitle>
        </CartHeader>
        {renderCart()}
      </RightPanel>
    </Page>
  );
}
