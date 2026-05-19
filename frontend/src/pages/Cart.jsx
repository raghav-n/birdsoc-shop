import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import {
  Trash2, Plus, Minus, ShoppingBag, ArrowRight, Heart, Check, Tag,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import {
  BsPage, BsOverline, BsH1, BsCard, BsButton, BsInput, BsMono,
} from '../styles/birdsoc';
import Loading from '../components/Loading';
import { sanitizeText } from '../utils/safeContent';
import { formatCurrency } from '../utils/helpers';
import { trackRemoveFromCart } from '../utils/analytics';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2.5rem 2rem 4rem;

  @media (max-width: 768px) {
    padding: 1.25rem 1rem 1.5rem;
  }
`;

const HeadRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 1.75rem;

  @media (max-width: 900px) {
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
  }
`;

const Subtitle = styled.p`
  font-size: 0.85rem;
  color: var(--bs-text-dim);
  margin: 0.45rem 0 0;
`;

const Steps = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;

  @media (max-width: 900px) {
    display: none;
  }
`;

const StepDot = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StepCircle = styled.div`
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: ${(p) => p.$active ? 'var(--bs-accent)' : 'var(--bs-panel-hi)'};
  color: ${(p) => p.$active ? 'var(--bs-on-accent)' : 'var(--bs-text-mute)'};
  font-family: var(--bs-mono);
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
`;

const StepText = styled.div`
  font-size: 12.5px;
  font-weight: ${(p) => p.$active ? 700 : 500};
  color: ${(p) => p.$active ? 'var(--bs-text)' : 'var(--bs-text-mute)'};
`;

const StepLine = styled.div`
  width: 24px;
  height: 1px;
  background: var(--bs-rule);
`;

const MobileSteps = styled.div`
  display: none;

  @media (max-width: 900px) {
    display: flex;
    gap: 6px;
    margin-top: 0.5rem;
  }
`;

const StepBar = styled.div`
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background: ${(p) => p.$on ? 'var(--bs-accent)' : 'var(--bs-panel-hi)'};
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 2.5rem;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const LinesCard = styled(BsCard)`
  padding: 0.25rem 1.5rem 1.5rem;

  @media (max-width: 768px) {
    padding: 0.25rem 0.95rem 1rem;
  }
`;

const LinesHead = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0 0.25rem;
`;

const LinesLabel = styled.div`
  font-family: var(--bs-sans);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--bs-text-mute);
  letter-spacing: 1.2px;
  text-transform: uppercase;
`;

const Line = styled.div`
  display: grid;
  grid-template-columns: 96px 1fr auto auto auto;
  gap: 20px;
  align-items: center;
  padding: 1.1rem 0;
  border-top: 1px solid var(--bs-rule-soft);

  @media (max-width: 600px) {
    grid-template-columns: 72px 1fr;
    gap: 12px;
    align-items: flex-start;
  }
`;

const Thumb = styled.div`
  width: 96px;
  height: 96px;
  border-radius: 10px;
  overflow: hidden;
  background:
    var(--bs-photo-bg)
    repeating-linear-gradient(135deg, transparent 0 9px, var(--bs-photo-stripe) 9px 10px);
  flex-shrink: 0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  @media (max-width: 600px) {
    width: 72px;
    height: 72px;
  }
`;

const LineInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
`;

const LineTitle = styled.div`
  font-size: 0.91rem;
  font-weight: 600;
  color: var(--bs-text);
  letter-spacing: -0.2px;
  line-height: 1.3;
`;

const LineSku = styled.div`
  font-family: var(--bs-mono);
  font-size: 10.5px;
  color: var(--bs-text-mute);
  letter-spacing: 0.4px;
  text-transform: uppercase;
  margin-top: 2px;
`;

const Qty = styled.div`
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--bs-rule);
  border-radius: 10px;
  background: var(--bs-panel);
  overflow: hidden;
`;

const QtyBtn = styled.button`
  width: 36px;
  height: 38px;
  background: transparent;
  border: none;
  color: var(--bs-text);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover:not(:disabled) {
    background: var(--bs-panel-hi);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

const QtyDisp = styled.div`
  width: 32px;
  font-family: var(--bs-mono);
  font-size: 0.84rem;
  font-weight: 600;
  text-align: center;
`;

const LineTotal = styled.div`
  text-align: right;
  min-width: 88px;
`;

const LineTotalAmt = styled.div`
  font-size: 0.91rem;
  font-weight: 700;
  color: var(--bs-text);
  letter-spacing: -0.2px;
`;

const LineUnit = styled.div`
  font-family: var(--bs-mono);
  font-size: 0.72rem;
  color: var(--bs-text-mute);
  margin-top: 2px;
  letter-spacing: 0.3px;
`;

const RemoveBtn = styled.button`
  background: transparent;
  border: none;
  color: var(--bs-text-mute);
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: var(--bs-danger);
    background: rgba(168, 68, 44, 0.08);
  }
`;

const MobileLineBottom = styled.div`
  display: none;

  @media (max-width: 600px) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.4rem;
  }
`;

const MobileLineCol = styled.div`
  display: contents;

  @media (max-width: 600px) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
`;

const DesktopOnly = styled.div`
  @media (max-width: 600px) {
    display: none;
  }
`;

const NoteRow = styled.div`
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: 10px;
  background: var(--bs-body);
  border: 1px dashed var(--bs-rule);
  display: flex;
  align-items: center;
  gap: 14px;

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }
`;

const SummaryCard = styled(BsCard)`
  position: sticky;
  top: 5rem;
  display: flex;
  flex-direction: column;
  gap: 14px;

  @media (max-width: 900px) {
    position: static;
  }
`;

const SummaryLabel = styled.div`
  font-family: var(--bs-sans);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--bs-text-mute);
  letter-spacing: 1.4px;
  text-transform: uppercase;
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.84rem;
  color: var(--bs-text-dim);
`;

const RowValue = styled.div`
  color: var(--bs-text);
  font-weight: 600;
`;

const DiscountValue = styled.div`
  color: var(--bs-accent);
  font-weight: 600;
`;

const VoucherBlock = styled.div`
  margin-top: 4px;
  padding: 14px 0;
  border-top: 1px solid var(--bs-rule-soft);
  border-bottom: 1px solid var(--bs-rule-soft);
`;

const VoucherForm = styled.form`
  display: flex;
  gap: 8px;
`;

const VoucherInput = styled(BsInput)`
  height: 38px;
  font-family: var(--bs-mono);
`;

const TotalRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
`;

const TotalLabel = styled.div`
  font-size: 0.78rem;
  color: var(--bs-text-dim);
  font-weight: 600;
  letter-spacing: 0.4px;
  text-transform: uppercase;
`;

const TotalAmount = styled.div`
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--bs-text);
  letter-spacing: -0.6px;
`;

const TotalSub = styled.div`
  font-family: var(--bs-mono);
  font-size: 0.66rem;
  color: var(--bs-text-mute);
  letter-spacing: 0.4px;
  margin-top: -8px;
`;

const ConservationNote = styled.div`
  margin-top: 4px;
  padding: 12px;
  background: var(--bs-accent-tint);
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.78rem;
  color: var(--bs-accent-dim);
  line-height: 1.4;
`;

const Empty = styled.div`
  text-align: center;
  padding: 4rem 1rem;
`;

const EmptyIcon = styled.div`
  margin-bottom: 1rem;
  color: var(--bs-rule);
  display: flex;
  justify-content: center;
`;

const EmptyTitle = styled.h2`
  font-size: 1.4rem;
  font-weight: 700;
  color: var(--bs-text);
  margin: 0 0 0.5rem;
`;

const EmptyText = styled.p`
  color: var(--bs-text-dim);
  margin-bottom: 2rem;
`;

const VoucherFeedback = styled.div`
  font-size: 11.5px;
  color: var(--bs-accent);
  margin-top: 6px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
`;

const Cart = () => {
  const { cart, loading, updateCartLine, removeFromCart, applyVoucher, getCartCount } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [voucherCode, setVoucherCode] = useState('');
  const [applyingVoucher, setApplyingVoucher] = useState(false);

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

  const handleRemoveItem = async (line) => {
    trackRemoveFromCart(line);
    await removeFromCart(line.id);
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
      <BsPage>
        <Container>
          <Loading text="Loading cart..." />
        </Container>
      </BsPage>
    );
  }

  const cartItems = cart?.lines || [];
  const cartCount = getCartCount();
  const lineTotal = cartItems.reduce((sum, item) => sum + parseFloat(item.line_price_incl_tax || 0), 0);
  const discounts = cart?.offer_discounts || [];
  const total = cart?.total_incl_tax ?? lineTotal;
  const taxShown = cart?.total_incl_tax !== cart?.total_excl_tax;

  if (cartCount === 0) {
    return (
      <BsPage>
        <Container>
          <Empty>
            <EmptyIcon>
              <ShoppingBag size={64} strokeWidth={1.5} />
            </EmptyIcon>
            <EmptyTitle>Your cart is empty</EmptyTitle>
            <EmptyText>Looks like you haven't added anything to your cart yet.</EmptyText>
            <BsButton as={Link} to="/products" $primary $size="lg">
              Start shopping
              <ArrowRight size={16} strokeWidth={1.7} />
            </BsButton>
          </Empty>
        </Container>
      </BsPage>
    );
  }

  return (
    <BsPage>
      <Container>
        <HeadRow>
          <div>
            <BsOverline>Step 1 of 3 · Cart</BsOverline>
            <BsH1 style={{ fontSize: 'clamp(1.6rem, 4vw, 2.25rem)', letterSpacing: '-0.8px' }}>
              Your cart
            </BsH1>
            <Subtitle>
              {cartCount} {cartCount === 1 ? 'item' : 'items'}
            </Subtitle>
            <MobileSteps>
              <StepBar $on />
              <StepBar />
              <StepBar />
            </MobileSteps>
          </div>
          <Steps>
            {['Cart', 'Details', 'Payment'].map((s, i) => (
              <React.Fragment key={s}>
                <StepDot>
                  <StepCircle $active={i === 0}>{i + 1}</StepCircle>
                  <StepText $active={i === 0}>{s}</StepText>
                </StepDot>
                {i < 2 && <StepLine />}
              </React.Fragment>
            ))}
          </Steps>
        </HeadRow>

        <Grid>
          <LinesCard $padding="0.25rem 1.5rem 1.5rem">
            <LinesHead>
              <LinesLabel>Items · {cartItems.length}</LinesLabel>
            </LinesHead>

            {cartItems.map((item) => (
              <Line key={item.id}>
                <Thumb>
                  {item.product_image ? (
                    <img src={item.product_image} alt={sanitizeText(item.product_title)} />
                  ) : null}
                </Thumb>

                <MobileLineCol>
                  <LineInfo>
                    <LineTitle>{sanitizeText(item.product_title)}</LineTitle>
                    {item.product_sku && (
                      <LineSku>SKU {sanitizeText(item.product_sku)}</LineSku>
                    )}
                  </LineInfo>
                  <MobileLineBottom>
                    <Qty>
                      <QtyBtn
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        aria-label="Decrease quantity"
                      >
                        <Minus size={11} strokeWidth={2} />
                      </QtyBtn>
                      <QtyDisp>{item.quantity}</QtyDisp>
                      <QtyBtn
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        aria-label="Increase quantity"
                      >
                        <Plus size={11} strokeWidth={2} />
                      </QtyBtn>
                    </Qty>
                    <LineTotalAmt>{formatCurrency(item.line_price_incl_tax)}</LineTotalAmt>
                  </MobileLineBottom>
                </MobileLineCol>

                <DesktopOnly>
                  <Qty>
                    <QtyBtn
                      onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      aria-label="Decrease quantity"
                    >
                      <Minus size={13} strokeWidth={2} />
                    </QtyBtn>
                    <QtyDisp>{item.quantity}</QtyDisp>
                    <QtyBtn
                      onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                      aria-label="Increase quantity"
                    >
                      <Plus size={13} strokeWidth={2} />
                    </QtyBtn>
                  </Qty>
                </DesktopOnly>

                <DesktopOnly>
                  <LineTotal>
                    <LineTotalAmt>{formatCurrency(item.line_price_incl_tax)}</LineTotalAmt>
                    <LineUnit>{formatCurrency(item.unit_price_incl_tax)} ea</LineUnit>
                  </LineTotal>
                </DesktopOnly>

                <DesktopOnly>
                  <RemoveBtn onClick={() => handleRemoveItem(item)} aria-label="Remove">
                    <Trash2 size={15} strokeWidth={1.7} />
                  </RemoveBtn>
                </DesktopOnly>
              </Line>
            ))}
          </LinesCard>

          <SummaryCard>
            <SummaryLabel>Order summary</SummaryLabel>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Row>
                <span>Subtotal ({cartCount} items)</span>
                <RowValue>{formatCurrency(lineTotal)}</RowValue>
              </Row>

              {discounts.map((discount, idx) => (
                <Row key={idx}>
                  <span style={{ color: 'var(--bs-accent)', fontWeight: 600 }}>{discount.name}</span>
                  <DiscountValue>−{formatCurrency(discount.amount)}</DiscountValue>
                </Row>
              ))}

              {taxShown && (
                <Row>
                  <span>Tax</span>
                  <RowValue>
                    {formatCurrency((cart?.total_incl_tax || 0) - (cart?.total_excl_tax || 0))}
                  </RowValue>
                </Row>
              )}
            </div>

            <VoucherBlock>
              <SummaryLabel style={{ marginBottom: 8 }}>Voucher code</SummaryLabel>
              <VoucherForm onSubmit={handleVoucherSubmit}>
                <VoucherInput
                  id="voucher"
                  type="text"
                  placeholder="Enter voucher code"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value)}
                />
                <BsButton
                  type="submit"
                  $size="sm"
                  disabled={!voucherCode.trim() || applyingVoucher}
                >
                  {applyingVoucher ? 'Applying…' : 'Apply'}
                </BsButton>
              </VoucherForm>
              {discounts.length > 0 && (
                <VoucherFeedback>
                  <Check size={11} strokeWidth={2.5} /> Discount applied
                </VoucherFeedback>
              )}
            </VoucherBlock>

            <TotalRow>
              <TotalLabel>Total</TotalLabel>
              <TotalAmount>{formatCurrency(total)}</TotalAmount>
            </TotalRow>

            <BsButton $primary $size="lg" $full onClick={handleCheckout} style={{ marginTop: 4 }}>
              Proceed to checkout
              <ArrowRight size={16} strokeWidth={1.7} />
            </BsButton>
            <BsButton as={Link} to="/products" $size="md" $full>
              Continue shopping
            </BsButton>

            <ConservationNote>
              <Heart size={14} strokeWidth={1.7} />
              <div>Your order helps fund our signature projects and outreach events.</div>
            </ConservationNote>
          </SummaryCard>
        </Grid>
      </Container>
    </BsPage>
  );
};

export default Cart;
