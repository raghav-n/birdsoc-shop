import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { Button, Card, FormGroup, Label, Input } from '../styles/GlobalStyles';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import { sanitizeText } from '../utils/safeContent';
import { formatCurrency } from '../utils/helpers';

const CartContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
`;

const CartHeader = styled.div`
  margin-bottom: 2rem;
`;

const CartTitle = styled.h1`
  font-size: 2rem;
  margin-bottom: 0.5rem;
`;

const CartSubtitle = styled.p`
  color: #666;
  margin: 0;
`;

const CartGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const CartItems = styled.div``;

const CartItem = styled(Card)`
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
  padding: 1rem;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
    text-align: center;
  }
`;

const ItemImage = styled.div`
  width: 80px;
  height: 80px;
  background-color: #f5f5f5;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  @media (max-width: 600px) {
    margin: 0 auto;
  }
`;

const ItemInfo = styled.div``;

const ItemTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--dark);
`;

const ItemPrice = styled.div`
  font-size: 1rem;
  color: var(--link-text);
  font-weight: 600;
  margin-bottom: 0.5rem;
`;

const ItemControls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-end;

  @media (max-width: 600px) {
    align-items: center;
  }
`;

const QuantityControls = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const QuantityButton = styled.button`
  background: var(--page-header-background);
  border: 1px solid #ddd;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: var(--link-text);
    color: white;
    border-color: var(--link-text);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const QuantityDisplay = styled.div`
  min-width: 40px;
  height: 32px;
  border: 1px solid #ddd;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 500;
  background: white;
  font-size: 0.9rem;
`;

const RemoveButton = styled.button`
  background: none;
  border: none;
  color: var(--danger);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 4px;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(204, 51, 13, 0.1);
  }
`;

const CartSummary = styled(Card)`
  height: fit-content;
  position: sticky;
  top: 2rem;
`;

const SummaryTitle = styled.h3`
  margin-bottom: 1rem;
  color: var(--dark);
`;

const SummaryRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  
  ${props => props.total && `
    font-weight: 600;
    font-size: 1.1rem;
    padding-top: 0.75rem;
    border-top: 1px solid #eee;
    color: var(--link-text);
  `}
`;

const VoucherSection = styled.div`
  margin: 1.5rem 0;
  padding: 1rem 0;
  border-top: 1px solid #eee;
  border-bottom: 1px solid #eee;
`;

const VoucherForm = styled.form`
  display: flex;
  gap: 0.5rem;
`;

const VoucherInput = styled(Input)`
  flex: 1;
`;

const DiscountLabel = styled.span`
  color: var(--success, #2e7d32);
  font-size: 0.9rem;
`;

const DiscountAmount = styled.span`
  color: var(--success, #2e7d32);
  font-weight: 600;
  font-size: 0.9rem;
`;

const EmptyCart = styled.div`
  text-align: center;
  padding: 3rem 1rem;
`;

const EmptyCartIcon = styled.div`
  font-size: 4rem;
  color: #ddd;
  margin-bottom: 1rem;
`;

const EmptyCartText = styled.h2`
  font-size: 1.5rem;
  color: #666;
  margin-bottom: 1rem;
`;

const Cart = () => {
  const { cart, loading, updateCartLine, removeFromCart, applyVoucher, getCartCount } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [voucherCode, setVoucherCode] = useState('');
  const [applyingVoucher, setApplyingVoucher] = useState(false);

  // Auto-apply a pending voucher after login redirect
  useEffect(() => {
    if (!isAuthenticated || !cart) return;
    const pending = localStorage.getItem('pendingVoucherCode');
    if (!pending) return;
    localStorage.removeItem('pendingVoucherCode');
    applyVoucher(pending);
  }, [isAuthenticated, cart]);

  const handleQuantityChange = async (lineId, newQuantity) => {
    if (newQuantity < 1) return;
    await updateCartLine(lineId, newQuantity);
  };

  const handleRemoveItem = async (lineId) => {
    await removeFromCart(lineId);
  };

  const handleVoucherSubmit = async (e) => {
    e.preventDefault();
    if (!voucherCode.trim()) return;

    if (!isAuthenticated) {
      localStorage.setItem('pendingVoucherCode', voucherCode.trim());
      navigate('/login', { state: { from: { pathname: '/cart' } } });
      return;
    }

    setApplyingVoucher(true);
    await applyVoucher(voucherCode);
    setApplyingVoucher(false);
    setVoucherCode('');
  };

  const handleCheckout = () => {
    if (isAuthenticated) {
      navigate('/checkout');
    } else {
      navigate('/login', { state: { from: { pathname: '/checkout' } } });
    }
  };

  if (loading) {
    return (
      <CartContainer>
        <Loading text="Loading cart..." />
      </CartContainer>
    );
  }

  const cartItems = cart?.lines || [];
  const cartCount = getCartCount();
  const lineTotal = cartItems.reduce((sum, item) => sum + parseFloat(item.line_price_incl_tax || 0), 0);
  const discounts = cart?.offer_discounts || [];
  const total = cart?.total_incl_tax ?? lineTotal;

  if (cartCount === 0) {
    return (
      <CartContainer>
        <EmptyCart>
          <EmptyCartIcon>
            <ShoppingBag size={80} />
          </EmptyCartIcon>
          <EmptyCartText>Your cart is empty</EmptyCartText>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            Looks like you haven't added anything to your cart yet.
          </p>
          <Button as={Link} to="/products" size="large">
            Start Shopping
          </Button>
        </EmptyCart>
      </CartContainer>
    );
  }

  return (
    <CartContainer>
      <CartHeader>
        <CartTitle>Shopping Cart</CartTitle>
        <CartSubtitle>
          {cartCount} {cartCount === 1 ? 'item' : 'items'} in your cart
        </CartSubtitle>
      </CartHeader>

      <CartGrid>
        <CartItems>
          {cartItems.map((item) => (
            <CartItem key={item.id}>
              <ItemImage>
                {/* Note: You might want to add product image URL to the basket line response */}
                <div style={{ color: '#666', fontSize: '0.8rem' }}>
                  No Image
                </div>
              </ItemImage>

              <ItemInfo>
                <ItemTitle>{sanitizeText(item.product_title)}</ItemTitle>
                <ItemPrice>
                  {formatCurrency(item.unit_price_incl_tax)} each
                </ItemPrice>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  Subtotal: {formatCurrency(item.line_price_incl_tax)}
                </div>
              </ItemInfo>

              <ItemControls>
                <QuantityControls>
                  <QuantityButton
                    onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                  >
                    <Minus size={14} />
                  </QuantityButton>
                  <QuantityDisplay>{item.quantity}</QuantityDisplay>
                  <QuantityButton
                    onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                  >
                    <Plus size={14} />
                  </QuantityButton>
                </QuantityControls>

                <RemoveButton onClick={() => handleRemoveItem(item.id)}>
                  <Trash2 size={16} />
                </RemoveButton>
              </ItemControls>
            </CartItem>
          ))}
        </CartItems>

        <CartSummary>
          <SummaryTitle>Order Summary</SummaryTitle>

          <SummaryRow>
            <span>Subtotal ({cartCount} items)</span>
            <span>{formatCurrency(lineTotal)}</span>
          </SummaryRow>

          {discounts.map((discount, idx) => (
            <SummaryRow key={idx}>
              <DiscountLabel>{discount.name}</DiscountLabel>
              <DiscountAmount>-{formatCurrency(discount.amount)}</DiscountAmount>
            </SummaryRow>
          ))}

          {cart?.total_incl_tax !== cart?.total_excl_tax && (
            <SummaryRow>
              <span>Tax</span>
              <span>{formatCurrency((cart?.total_incl_tax || 0) - (cart?.total_excl_tax || 0))}</span>
            </SummaryRow>
          )}

          <VoucherSection>
            <FormGroup style={{ margin: 0 }}>
              <Label htmlFor="voucher">Voucher Code</Label>
              <VoucherForm onSubmit={handleVoucherSubmit}>
                <VoucherInput
                  id="voucher"
                  type="text"
                  placeholder="Enter voucher code"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="small"
                  disabled={!voucherCode.trim() || applyingVoucher}
                >
                  {applyingVoucher ? 'Applying...' : 'Apply'}
                </Button>
              </VoucherForm>
            </FormGroup>
          </VoucherSection>

          <SummaryRow total>
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </SummaryRow>

          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Button onClick={handleCheckout} size="large" fullWidth>
              Proceed to Checkout
              <ArrowRight size={18} />
            </Button>
            
            <Button as={Link} to="/products" variant="secondary" fullWidth>
              Continue Shopping
            </Button>
          </div>
        </CartSummary>
      </CartGrid>
    </CartContainer>
  );
};

export default Cart;
