import React, { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import { ArrowLeft, Download, Package, Truck, CheckCircle, QrCode } from 'lucide-react';
import { orderService } from '../services/orders';
import { Button, Card } from '../styles/GlobalStyles';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import SafeHtml from '../components/SafeHtml';
import CollectionQR from '../components/CollectionQR';
import { downloadFile, formatCurrency, formatDate } from '../utils/helpers';
import { renderShippingMethodDescription, containsHTML, sanitizeText } from '../utils/safeContent';
import toast from 'react-hot-toast';

const OrderContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
`;

const OrderHeader = styled.div`
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const BackButton = styled(Link)`
  color: var(--link-text);
  text-decoration: none;
  padding: 0.5rem;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: background-color 0.2s ease;

  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }
`;

const OrderTitle = styled.h1`
  font-size: 2rem;
  margin: 0;
`;

const OrderNumber = styled.div`
  font-size: 1rem;
  color: #666;
  margin-top: 0.25rem;
`;

const StatusBadge = styled.div`
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.85rem;
  font-weight: 600;
  text-transform: uppercase;
  
  ${props => {
    switch(props.status?.toLowerCase()) {
      case 'pending':
        return `
          background-color: rgba(255, 193, 7, 0.1);
          color: #e6a700;
          border: 1px solid rgba(255, 193, 7, 0.3);
        `;
      case 'processing':
        return `
          background-color: rgba(0, 123, 255, 0.1);
          color: #0056b3;
          border: 1px solid rgba(0, 123, 255, 0.3);
        `;
      case 'shipped':
        return `
          background-color: rgba(108, 117, 125, 0.1);
          color: #495057;
          border: 1px solid rgba(108, 117, 125, 0.3);
        `;
      case 'delivered':
      case 'complete':
        return `
          background-color: rgba(34, 197, 94, 0.1);
          color: #15803d;
          border: 1px solid rgba(34, 197, 94, 0.3);
        `;
      case 'cancelled':
        return `
          background-color: rgba(239, 68, 68, 0.1);
          color: #dc2626;
          border: 1px solid rgba(239, 68, 68, 0.3);
        `;
      default:
        return `
          background-color: rgba(108, 117, 125, 0.1);
          color: #495057;
          border: 1px solid rgba(108, 117, 125, 0.3);
        `;
    }
  }}
`;

const OrderGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const OrderContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  @media (max-width: 768px) {
    order: 2;
  }
`;

const Section = styled(Card)`
  padding: 1.5rem;
`;

const SectionTitle = styled.h3`
  margin-bottom: 1rem;
  color: var(--dark);
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const OrderItem = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid #eee;
  
  &:last-child {
    border-bottom: none;
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
    text-align: center;
    gap: 0.5rem;
  }
`;

const ItemImage = styled.div`
  width: 60px;
  height: 60px;
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

const ItemTitle = styled.h4`
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: var(--dark);
`;

const ItemDetails = styled.div`
  font-size: 0.9rem;
  color: #666;
`;

const ItemPrice = styled.div`
  text-align: right;
  
  @media (max-width: 600px) {
    text-align: center;
  }
`;

const PriceAmount = styled.div`
  font-size: 1rem;
  font-weight: 600;
  color: var(--link-text);
`;

const DiscountLabel = styled.span`
  color: var(--success, #2e7d32);
  font-size: 0.9rem;
`;

const DiscountAmount = styled.span`
  color: var(--success, #2e7d32);
  font-size: 0.9rem;
  font-weight: 600;
`;

const OrderSidebar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  @media (max-width: 768px) {
    order: 1;
  }
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

const InfoRow = styled.div`
  margin-bottom: 0.75rem;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const InfoLabel = styled.div`
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 0.25rem;
`;

const InfoValue = styled.div`
  font-weight: 500;
  color: var(--dark);
`;

const OrderDetail = () => {
  const { orderNumber } = useParams();
  const [searchParams] = useSearchParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const accessId = searchParams.get('id') || '';

  const toNumber = (value) => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  useEffect(() => {
    loadOrder();
  }, [orderNumber, accessId]);

  const loadOrder = async () => {
    setLoading(true);
    try {
      const orderData = await orderService.getOrder(orderNumber, accessId);
      setOrder(orderData);
    } catch (error) {
      console.error('Failed to load order:', error);
      setOrder(null);
      toast.error('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const downloadReceipt = async () => {
    try {
      setDownloadingReceipt(true);
      const blob = await orderService.getOrderReceipt(orderNumber, accessId);
      downloadFile(blob, `receipt-${orderNumber}.pdf`);
      toast.success('Receipt downloaded successfully');
    } catch (error) {
      console.error('Failed to download receipt:', error);
      toast.error('Failed to download receipt');
    } finally {
      setDownloadingReceipt(false);
    }
  };

  if (loading) {
    return (
      <OrderContainer>
        <Loading text="Loading order details..." />
      </OrderContainer>
    );
  }

  if (!order) {
    return (
      <OrderContainer>
        <Alert variant="error">
          Order not found. Please check the order number and try again.
        </Alert>
      </OrderContainer>
    );
  }

  const orderLines = order.lines || [];
  const itemCount = orderLines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0);
  const subtotal = toNumber(order.basket_total_before_discounts_incl_tax)
    || orderLines.reduce(
      (sum, line) => sum + toNumber(line.line_price_before_discounts_incl_tax ?? line.line_price_incl_tax),
      0,
    );
  const shippingCost = toNumber(order.shipping_incl_tax);
  const donationAmount = toNumber(order.donation_amount);
  const totalWithDonation = toNumber(order.total_incl_tax) + donationAmount;
  const basketDiscounts = order.basket_discounts || [];
  const paymentMethod = order.sources?.map((source) => source.source_type).filter(Boolean).join(', ') || 'PayNow';
  const collectionQrUrl = order.access_id
    ? `${window.location.origin}/console/order-lookup/${encodeURIComponent(order.number)}?id=${encodeURIComponent(order.access_id)}`
    : null;

  return (
    <OrderContainer>
      <OrderHeader>
        <HeaderLeft>
          <div>
            <OrderTitle>Order Details</OrderTitle>
            <OrderNumber>Order #{order.number}</OrderNumber>
          </div>
        </HeaderLeft>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <StatusBadge status={order.status}>
            {order.status}
          </StatusBadge>
          
          <Button
            variant="secondary"
            onClick={downloadReceipt}
            disabled={downloadingReceipt}
          >
            <Download size={16} />
            {downloadingReceipt ? 'Downloading...' : 'Receipt'}
          </Button>
        </div>
      </OrderHeader>

      <OrderGrid>
        <OrderContent>
          {/* Order Items */}
          <Section>
            <SectionTitle>
              <Package size={20} />
              Order Items
            </SectionTitle>
            
            {orderLines.map((line) => (
              <OrderItem key={line.id}>
                <ItemImage>
                  {line.product_image ? (
                    <img
                      src={line.product_image}
                      alt={sanitizeText(line.title)}
                    />
                  ) : (
                    <div style={{ color: '#666', fontSize: '0.7rem' }}>
                      No Image
                    </div>
                  )}
                </ItemImage>

                <ItemInfo>
                  <ItemTitle>{sanitizeText(line.title)}</ItemTitle>
                  <ItemDetails>
                    Quantity: {line.quantity} × {formatCurrency(line.unit_price_incl_tax, order.currency)}
                  </ItemDetails>
                </ItemInfo>

                <ItemPrice>
                  <PriceAmount>
                    {formatCurrency(
                      line.line_price_before_discounts_incl_tax ?? line.line_price_incl_tax,
                      order.currency,
                    )}
                  </PriceAmount>
                </ItemPrice>
              </OrderItem>
            ))}
          </Section>

          {/* Shipping Information */}
          {/* <Section>
            <SectionTitle>
              <Truck size={20} />
              Shipping Information
            </SectionTitle>
            
            <InfoRow>
              <InfoLabel>Shipping Method</InfoLabel>
              <InfoValue>
                {order.shipping_method || 'Standard Shipping'}
                {order.shipping_method_description && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                    {containsHTML(order.shipping_method_description) ? (
                      <SafeHtml 
                        html={renderShippingMethodDescription(order.shipping_method_description)}
                        tag="span"
                      />
                    ) : (
                      order.shipping_method_description
                    )}
                  </div>
                )}
              </InfoValue>
            </InfoRow>
            
            {order.shipping_address && (
              <InfoRow>
                <InfoLabel>Shipping Address</InfoLabel>
                <InfoValue>
                  {order.shipping_address.first_name} {order.shipping_address.last_name}<br />
                  {order.shipping_address.line1}<br />
                  {order.shipping_address.line2 && `${order.shipping_address.line2}\n`}
                  {order.shipping_address.line4}, {order.shipping_address.state} {order.shipping_address.postcode}<br />
                  {order.shipping_address.country}
                </InfoValue>
              </InfoRow>
            )}
            
            <InfoRow>
              <InfoLabel>Estimated Delivery</InfoLabel>
              <InfoValue>
                {order.estimated_delivery_date 
                  ? formatDate(order.estimated_delivery_date)
                  : '3-5 business days'
                }
              </InfoValue>
            </InfoRow>
          </Section> */}
        </OrderContent>

        <OrderSidebar>
          {/* Order Summary */}
          {order.is_self_collect && collectionQrUrl && (
            <Section>
              <SectionTitle>
                <QrCode size={20} />
                Collection QR Code
              </SectionTitle>
              <CollectionQR content={collectionQrUrl} orderNumber={order.number} />
            </Section>
          )}

          <Section>
            <SectionTitle>Order Summary</SectionTitle>
            
            <SummaryRow>
              <span>Subtotal ({itemCount} items)</span>
              <span>{formatCurrency(subtotal, order.currency)}</span>
            </SummaryRow>

            {basketDiscounts.map((discount, idx) => (
              <SummaryRow key={`${discount.name}-${idx}`}>
                <DiscountLabel>{sanitizeText(discount.name)}</DiscountLabel>
                <DiscountAmount>-{formatCurrency(discount.amount, order.currency)}</DiscountAmount>
              </SummaryRow>
            ))}

            <SummaryRow>
              <span>Shipping</span>
              <span>{shippingCost === 0 ? 'Free' : formatCurrency(shippingCost, order.currency)}</span>
            </SummaryRow>

            {donationAmount > 0 && (
              <SummaryRow>
                <span>Donation</span>
                <span>{formatCurrency(donationAmount, order.currency)}</span>
              </SummaryRow>
            )}

            <SummaryRow total>
              <span>Total</span>
              <span>{formatCurrency(totalWithDonation, order.currency)}</span>
            </SummaryRow>
          </Section>

          {/* Order Information */}
          <Section>
            <SectionTitle>Order Information</SectionTitle>
            
            <InfoRow>
              <InfoLabel>Order Date</InfoLabel>
              <InfoValue>{formatDate(order.date_placed)}</InfoValue>
            </InfoRow>
            
            <InfoRow>
              <InfoLabel>Payment Method</InfoLabel>
              <InfoValue>{paymentMethod}</InfoValue>
            </InfoRow>
            
            {order.guest_email && (
              <InfoRow>
                <InfoLabel>Email</InfoLabel>
                <InfoValue>{order.guest_email}</InfoValue>
              </InfoRow>
            )}
          </Section>

          {/* Order Tracking */}
          {order.status === 'shipped' && (
            <Section>
              <SectionTitle>
                <Truck size={20} />
                Order Status
              </SectionTitle>
              
              <Alert variant="info">
                <CheckCircle size={16} />
                Your order has been shipped and is on its way!
              </Alert>
            </Section>
          )}
        </OrderSidebar>
      </OrderGrid>
    </OrderContainer>
  );
};

export default OrderDetail;
