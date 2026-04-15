import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { Package, Eye, Download } from 'lucide-react';
import { orderService } from '../services/orders';
import { Button, Card } from '../styles/GlobalStyles';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import { sanitizeText } from '../utils/safeContent';
import { downloadFile, formatCurrency, formatDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const OrdersContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
`;

const OrdersHeader = styled.div`
  margin-bottom: 2rem;
`;

const OrdersTitle = styled.h1`
  font-size: 2rem;
  margin-bottom: 0.5rem;
`;

const OrdersSubtitle = styled.p`
  color: #666;
  margin: 0;
`;

const OrdersList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const OrderCard = styled(Card)`
  padding: 1.5rem;
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
`;

const OrderHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 1rem;
  }
`;

const OrderInfo = styled.div``;

const OrderNumber = styled.h3`
  font-size: 1.2rem;
  margin-bottom: 0.25rem;
  color: var(--dark);
`;

const OrderMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 0.5rem;
`;

const MetaItem = styled.div`
  font-size: 0.9rem;
  color: #666;
`;

const StatusBadge = styled.div`
  padding: 0.35rem 0.75rem;
  border-radius: 15px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  width: fit-content;
  
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

const OrderActions = styled.div`
  display: flex;
  gap: 0.5rem;
  
  @media (max-width: 768px) {
    width: 100%;
    justify-content: flex-start;
  }
`;

const OrderItems = styled.div`
  border-top: 1px solid #eee;
  padding-top: 1rem;
`;

const ItemsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const OrderItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.9rem;
`;

const ItemName = styled.div`
  color: var(--dark);
`;

const ItemQuantity = styled.div`
  color: #666;
`;

const OrderTotal = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 1.1rem;
  color: var(--link-text);
  padding-top: 0.75rem;
  border-top: 1px solid #eee;
`;

const EmptyOrders = styled.div`
  text-align: center;
  padding: 3rem 1rem;
`;

const EmptyOrdersIcon = styled.div`
  font-size: 4rem;
  color: #ddd;
  margin-bottom: 1rem;
`;

const EmptyOrdersText = styled.h2`
  font-size: 1.5rem;
  color: #666;
  margin-bottom: 1rem;
`;

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingReceipts, setDownloadingReceipts] = useState({});
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      loadOrders();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const loadOrders = async () => {
    try {
      const ordersData = await orderService.getOrders();
      setOrders(ordersData.results || ordersData);
    } catch (error) {
      console.error('Failed to load orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const downloadReceipt = async (orderNumber) => {
    try {
      setDownloadingReceipts(prev => ({ ...prev, [orderNumber]: true }));
      const blob = await orderService.getOrderReceipt(orderNumber);
      downloadFile(blob, `receipt-${orderNumber}.pdf`);
      toast.success('Receipt downloaded successfully');
    } catch (error) {
      console.error('Failed to download receipt:', error);
      toast.error('Failed to download receipt');
    } finally {
      setDownloadingReceipts(prev => ({ ...prev, [orderNumber]: false }));
    }
  };

  if (!isAuthenticated) {
    return (
      <OrdersContainer>
        <Alert variant="info">
          Please <Link to="/login" style={{ fontWeight: 500 }}>sign in</Link> to view your orders.
        </Alert>
      </OrdersContainer>
    );
  }

  if (loading) {
    return (
      <OrdersContainer>
        <Loading text="Loading your orders..." />
      </OrdersContainer>
    );
  }

  if (orders.length === 0) {
    return (
      <OrdersContainer>
        <OrdersHeader>
          <OrdersTitle>Your Orders</OrdersTitle>
          <OrdersSubtitle>Track your order history and download receipts</OrdersSubtitle>
        </OrdersHeader>
        
        <EmptyOrders>
          <EmptyOrdersIcon>
            <Package size={80} />
          </EmptyOrdersIcon>
          <EmptyOrdersText>No orders yet</EmptyOrdersText>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            You haven't placed any orders yet. Start shopping to see your orders here.
          </p>
          <Button as={Link} to="/products" size="large">
            Start Shopping
          </Button>
        </EmptyOrders>
      </OrdersContainer>
    );
  }

  return (
    <OrdersContainer>
      <OrdersHeader>
        <OrdersTitle>Your Orders</OrdersTitle>
        <OrdersSubtitle>
          {orders.length} {orders.length === 1 ? 'order' : 'orders'} found
        </OrdersSubtitle>
      </OrdersHeader>

      <OrdersList>
        {orders.map((order) => (
          <OrderCard key={order.number}>
            <OrderHeader>
              <OrderInfo>
                <OrderNumber>Order #{order.number}</OrderNumber>
                <OrderMeta>
                  <MetaItem>Placed on {formatDate(order.date_placed)}</MetaItem>
                  <MetaItem>{order.lines?.length || 0} items</MetaItem>
                </OrderMeta>
                <StatusBadge status={order.status}>
                  {order.status}
                </StatusBadge>
              </OrderInfo>
              
              <OrderActions>
                <Button 
                  as={Link} 
                  to={`/orders/${order.number}`}
                  variant="secondary"
                  size="small"
                >
                  <Eye size={14} />
                  View
                </Button>
                
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => downloadReceipt(order.number)}
                  disabled={downloadingReceipts[order.number]}
                >
                  <Download size={14} />
                  {downloadingReceipts[order.number] ? 'Downloading...' : 'Receipt'}
                </Button>
              </OrderActions>
            </OrderHeader>

            <OrderItems>
              <ItemsList>
                {order.lines?.slice(0, 3).map((line) => (
                  <OrderItem key={line.id}>
                    <ItemName>{sanitizeText(line.title)}</ItemName>
                    <ItemQuantity>Qty: {line.quantity}</ItemQuantity>
                  </OrderItem>
                ))}
                {order.lines?.length > 3 && (
                  <OrderItem>
                    <ItemName style={{ fontStyle: 'italic', color: '#666' }}>
                      +{order.lines.length - 3} more items
                    </ItemName>
                  </OrderItem>
                )}
              </ItemsList>
              
              <OrderTotal>
                <span>Total</span>
                <span>
                  {formatCurrency(order.total_incl_tax + (order.donation_amount || 0))}
                </span>
              </OrderTotal>
            </OrderItems>
          </OrderCard>
        ))}
      </OrdersList>
    </OrdersContainer>
  );
};

export default Orders;
