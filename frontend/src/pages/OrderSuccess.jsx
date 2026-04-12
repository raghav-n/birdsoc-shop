import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { CheckCircle, Package, ArrowRight } from 'lucide-react';
import { Button, Card } from '../styles/GlobalStyles';
import { formatCurrency } from '../utils/helpers';

const SuccessContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1rem;
  text-align: center;
`;

const SuccessIcon = styled.div`
  font-size: 4rem;
  color: var(--success);
  margin-bottom: 1rem;
  display: flex;
  justify-content: center;
`;

const SuccessTitle = styled.h1`
  font-size: 2.5rem;
  color: var(--dark);
  margin-bottom: 1rem;
`;

const SuccessMessage = styled.p`
  font-size: 1.1rem;
  color: #666;
  margin-bottom: 2rem;
  line-height: 1.6;
`;

const AutoConfirmationMessage = styled(Card)`
  margin-bottom: 2rem;
  padding: 1rem 1.25rem;
  text-align: left;
  border-color: rgba(34, 197, 94, 0.35);
  background-color: rgba(34, 197, 94, 0.08);
  color: var(--dark);
`;

const OrderCard = styled(Card)`
  margin-bottom: 2rem;
  padding: 2rem;
  text-align: left;
`;

const OrderInfo = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
`;

const InfoItem = styled.div``;

const InfoLabel = styled.div`
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.25rem;
`;

const InfoValue = styled.div`
  font-weight: 600;
  color: var(--dark);
  font-size: 1.1rem;
`;

const NextSteps = styled.div`
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  text-align: left;
`;

const NextStepsTitle = styled.h3`
  margin-bottom: 1rem;
  color: var(--dark);
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const StepsList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const Step = styled.li`
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
  
  &:last-child {
    border-bottom: none;
  }
`;

const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
  
  @media (min-width: 600px) {
    flex-direction: row;
    justify-content: center;
  }
`;

const OrderSuccess = () => {
  const location = useLocation();
  const orderNumber = location.state?.orderNumber || 'N/A';
  const orderTotal = location.state?.orderTotal || 0;
  const autoConfirmedPayment = location.state?.autoConfirmedPayment || false;

  return (
    <SuccessContainer>
      <SuccessIcon>
        <CheckCircle size={80} />
      </SuccessIcon>
      
      <SuccessTitle>Order Placed Successfully!</SuccessTitle>
      
      <SuccessMessage>
        Thank you for your order! We've received your payment and will process your order shortly.
        You'll receive an email confirmation with all the details.
      </SuccessMessage>

      {autoConfirmedPayment && (
        <AutoConfirmationMessage>
          We automatically confirmed your PayNow payment.
        </AutoConfirmationMessage>
      )}

      <OrderCard>
        <OrderInfo>
          <InfoItem>
            <InfoLabel>Order Number</InfoLabel>
            <InfoValue>#{orderNumber}</InfoValue>
          </InfoItem>
          
          <InfoItem>
            <InfoLabel>Order Total</InfoLabel>
            <InfoValue>{formatCurrency(orderTotal)}</InfoValue>
          </InfoItem>
          
          <InfoItem>
            <InfoLabel>Payment Method</InfoLabel>
            <InfoValue>PayNow</InfoValue>
          </InfoItem>
          
          <InfoItem>
            <InfoLabel>Status</InfoLabel>
            <InfoValue>Processing</InfoValue>
          </InfoItem>
        </OrderInfo>

        <NextSteps>
          <NextStepsTitle>
            <Package size={20} />
            What happens next?
          </NextStepsTitle>
          
          <StepsList>
            <Step>
              <strong>1. Order Confirmation:</strong> {autoConfirmedPayment
                ? 'Your payment has already been confirmed and your order is now being processed.'
                : "We'll verify your payment and send you an order confirmation email."}
            </Step>
            <Step>
              <strong>2. Collection:</strong> Collect your order. Details are available in our <Link to="/faq">FAQ</Link> page.
            </Step>
          </StepsList>
        </NextSteps>
      </OrderCard>

      <Actions>
        <Button as={Link} to={`/orders/${orderNumber}`} size="large">
          View Order Details
          <ArrowRight size={18} />
        </Button>
        
        <Button as={Link} to="/products" variant="secondary" size="large">
          Continue Shopping
        </Button>
      </Actions>
    </SuccessContainer>
  );
};

export default OrderSuccess;
