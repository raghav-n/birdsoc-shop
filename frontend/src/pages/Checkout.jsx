import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useForm } from 'react-hook-form';
import { CreditCard, Upload, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { checkoutService } from '../services/checkout';
import { Button, Card, FormGroup, Label, Input, Select } from '../styles/GlobalStyles';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import PayNowQR from '../components/PayNowQR';
import SafeHtml from '../components/SafeHtml';
import { sanitizeText } from '../utils/safeContent';
import { formatCurrency } from '../utils/helpers';
import toast from 'react-hot-toast';

const CheckoutContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
`;

const CheckoutHeader = styled.div`
  margin-bottom: 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
`;

const BackButton = styled.button`
  background: none;
  border: none;
  color: var(--link-text);
  cursor: pointer;
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

const CheckoutTitle = styled.h1`
  font-size: 2rem;
  margin: 0;
`;

const CheckoutGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const CheckoutSteps = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const Step = styled(Card)`
  padding: 1.5rem;
  
  ${props => props.completed && `
    border-color: var(--success);
    background-color: rgba(34, 197, 94, 0.05);
  `}
  
  ${props => props.disabled && `
    opacity: 0.6;
    pointer-events: none;
  `}
`;

const StepHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
`;

const StepNumber = styled.div`
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: ${props => props.completed ? 'var(--success)' : 'var(--link-text)'};
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
`;

const StepTitle = styled.h3`
  margin: 0;
  color: var(--dark);
`;

const StepContent = styled.div`
  margin-left: 3rem;

  @media (max-width: 600px) {
    margin-left: 0;
  }
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const FileUploadArea = styled.div`
  border: 2px dashed #ddd;
  border-radius: 8px;
  padding: 2rem;
  text-align: center;
  background-color: #fafafa;
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    border-color: var(--link-text);
    background-color: #f0f0f0;
  }

  ${props => props.dragOver && `
    border-color: var(--link-text);
    background-color: rgba(0, 123, 255, 0.05);
  `}

  ${props => props.hasFile && `
    border-color: var(--success);
    background-color: rgba(34, 197, 94, 0.05);
  `}
`;

const FileUploadIcon = styled.div`
  font-size: 2rem;
  color: #666;
  margin-bottom: 0.5rem;
`;

const FileUploadText = styled.p`
  margin: 0;
  color: #666;
`;

const FileUploadSubtext = styled.p`
  margin: 0.5rem 0 0 0;
  font-size: 0.85rem;
  color: #999;
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const SelectedFile = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
`;

const DonationSection = styled.div`
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  margin-top: 1rem;
`;

const DonationTitle = styled.h4`
  margin: 0 0 0.75rem 0;
  color: var(--dark);
  font-size: 1rem;
`;

const DonationOptions = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 0.5rem;
  margin-bottom: 1rem;
`;

const DonationOption = styled.button`
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--link-text);
  }

  ${props => props.selected && `
    border-color: var(--link-text);
    background-color: var(--link-text);
    color: white;
  `}
`;

const ShippingMethodCard = styled.div`
  border: 2px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: white;

  &:hover {
    border-color: var(--link-text);
  }

  ${props => props.selected && `
    border-color: var(--link-text);
    background-color: rgba(0, 123, 255, 0.05);
  `}
`;

const ShippingMethodHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
`;

const ShippingMethodRadio = styled.input`
  width: 18px;
  height: 18px;
  accent-color: var(--link-text);
`;

const ShippingMethodName = styled.h4`
  margin: 0;
  font-size: 1rem;
  color: var(--dark);
`;

const ShippingMethodDescription = styled.p`
  margin: 0;
  font-size: 0.9rem;
  color: #666;
  line-height: 1.4;
`;

const ShippingMethodPrice = styled.div`
  font-weight: 600;
  color: var(--link-text);
  font-size: 0.9rem;
  margin-top: 0.5rem;
`;

const OrderSummary = styled(Card)`
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

const CartItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0.75rem 0;
  border-bottom: 1px solid #f0f0f0;
  
  &:last-child {
    border-bottom: none;
  }
`;

const ItemDetails = styled.div`
  flex: 1;
`;

const ItemName = styled.h4`
  margin: 0 0 0.25rem 0;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--dark);
  line-height: 1.3;
`;

const ItemVariant = styled.p`
  margin: 0 0 0.25rem 0;
  font-size: 0.8rem;
  color: #666;
`;

const ItemQuantity = styled.span`
  font-size: 0.8rem;
  color: #666;
`;

const ItemPrice = styled.div`
  font-weight: 500;
  color: var(--dark);
  font-size: 0.9rem;
  margin-left: 1rem;
`;

const SummarySection = styled.div`
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid #f0f0f0;
`;

const PaymentLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2rem;
  align-items: start;
  margin-bottom: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const PaymentConfirmSection = styled.div`
  background-color: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  padding: 1rem;
  margin: 1rem 0;
`;

const CheckboxContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
`;

const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
`;

const CheckboxLabel = styled.label`
  font-weight: 500;
  color: var(--dark);
  cursor: pointer;
  user-select: none;
`;

const PollingStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: #e3f2fd;
  border: 1px solid #2196f3;
  border-radius: 6px;
  font-size: 0.9rem;
  color: #1976d2;
`;

const LoadingSpinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid #e3f2fd;
  border-top: 2px solid #1976d2;
  border-radius: 50%;
  animation: spin 1s linear infinite;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
`;

const ModalTitle = styled.h3`
  margin: 0 0 1rem 0;
  color: var(--dark);
`;

const ModalText = styled.p`
  margin: 0 0 1.5rem 0;
  color: #666;
  line-height: 1.5;
`;

const ModalButtons = styled.div`
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
`;

const ModalButton = styled(Button)`
  margin: 0;
`;

const Checkout = () => {
  const { cart, loading: cartLoading, getCartCount, clearCart } = useCart();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [shippingMethods, setShippingMethods] = useState([]);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState('');
  const [isSelectedMethodSelfCollect, setIsSelectedMethodSelfCollect] = useState(false);
  const [paymentFile, setPaymentFile] = useState(null);
  const [paymentProofUploaded, setPaymentProofUploaded] = useState(false);
  const [tempKey, setTempKey] = useState('');
  const [orderReference, setOrderReference] = useState('');
  const [donation, setDonation] = useState(0);
  const [customDonation, setCustomDonation] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [hasPaid, setHasPaid] = useState(false);
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const [pollingTimeoutId, setPollingTimeoutId] = useState(null);
  const [oneMinuteTimeoutId, setOneMinuteTimeoutId] = useState(null);
  const [showManualConfirmation, setShowManualConfirmation] = useState(false);
  
  // Check environment variable for auto payment confirmation feature
  const autoPaymentConfirmationEnabled = import.meta.env.VITE_AUTO_PAYMENT_CONFIRMATION !== 'false';
  
  // Debug log for environment variable
  console.log('VITE_AUTO_PAYMENT_CONFIRMATION:', import.meta.env.VITE_AUTO_PAYMENT_CONFIRMATION);
  console.log('autoPaymentConfirmationEnabled:', autoPaymentConfirmationEnabled);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    setValue,
    watch
  } = useForm({
    defaultValues: {
      email: user?.email || '',
      firstName: '',
      lastName: '',
      address1: '',
      address2: '',
      city: '',
      state: '',
      postcode: '',
      country: 'Singapore',
      phone: ''
    }
  });

  const watchDonationType = watch('donationType');

  useEffect(() => {
    if (!cart || cart.lines?.length === 0) {
      navigate('/cart');
      return;
    }
    
    loadShippingMethods();
  }, [cart, navigate]);

  useEffect(() => {
    if (watchDonationType === 'custom') {
      setDonation(0);
    } else if (watchDonationType && watchDonationType !== 'custom') {
      setDonation(parseInt(watchDonationType));
      setCustomDonation('');
    }
  }, [watchDonationType]);

  // Generate order reference when reaching payment step
  useEffect(() => {
    if (currentStep === 4 && !orderReference && cart?.id) {
      // Generate proper MER- reference format like the backend
      // Format: MER-{100000 + basket_id}
      const properRef = `MER-${100000 + parseInt(cart.id)}`;
      setOrderReference(properRef);
    }
  }, [currentStep, cart?.id, orderReference]);

  const loadShippingMethods = async () => {
    try {
      const methods = await checkoutService.getShippingMethods();
      setShippingMethods(methods);
      if (methods.length > 0) {
        setSelectedShippingMethod(methods[0].code);
        setIsSelectedMethodSelfCollect(methods[0].is_self_collect || false);
      }
    } catch (error) {
      console.error('Failed to load shipping methods:', error);
      toast.error('Failed to load shipping methods');
    }
  };

  const handleShippingMethodChange = (methodCode) => {
    setSelectedShippingMethod(methodCode);
    const selectedMethod = shippingMethods.find(method => method.code === methodCode);
    setIsSelectedMethodSelfCollect(selectedMethod?.is_self_collect || false);
  };

  const handleStepComplete = async (step) => {
    if (step === 1) {
      // Contact information step
      const formData = getValues();
      if (!isAuthenticated && !formData.email) {
        toast.error('Email is required for guest checkout');
        return;
      }
      
      if (!isAuthenticated) {
        try {
          await checkoutService.setCheckoutEmail(formData.email);
        } catch (error) {
          toast.error('Failed to save email');
          return;
        }
      }
      
      setCurrentStep(2);
    } else if (step === 2) {
      // Shipping/Collection method selection step
      if (!selectedShippingMethod) {
        toast.error('Please select a shipping method');
        return;
      }
      
      // If self-collection, skip shipping info and go to payment
      if (isSelectedMethodSelfCollect) {
        setCurrentStep(4);
      } else {
        setCurrentStep(3);
      }
    } else if (step === 3) {
      // Shipping information step - validate required fields
      const formData = getValues();
      const requiredFields = ['firstName', 'lastName', 'address1', 'city', 'postcode'];
      const missingFields = requiredFields.filter(field => !formData[field]?.trim());
      
      if (missingFields.length > 0) {
        toast.error('Please fill in all required fields');
        return;
      }

      const addressData = {
        first_name: formData.firstName,
        last_name: formData.lastName,
        line1: formData.address1,
        line2: formData.address2 || '',
        line4: formData.city,
        state: formData.state || '',
        postcode: formData.postcode,
        country: formData.country || 'Singapore',
        phone_number: formData.phone || ''
      };

      try {
        await checkoutService.setShippingAddress({
          basket_id: cart.id,
          address: addressData
        });
        setCurrentStep(4);
      } catch (error) {
        console.error('Shipping address save failed:', error);
        toast.error('Failed to save shipping address');
      }
    } else if (step === 4) {
      // Payment step - upload proof or use "I've paid" confirmation
      if (!paymentFile && (!hasPaid || !autoPaymentConfirmationEnabled)) {
        toast.error(autoPaymentConfirmationEnabled 
          ? 'Please upload payment proof or check "I\'ve made the payment"'
          : 'Please upload payment proof'
        );
        return;
      }

      setLoading(true);
      try {
        if (paymentFile) {
          // Traditional file upload flow
          const formData = new FormData();
          formData.append('payment_proof', paymentFile);
          formData.append('basket_id', cart.id);
          formData.append('donation', donation.toString());

          const response = await checkoutService.uploadPayNowProof(formData);
          setPaymentProofUploaded(true);
          setTempKey(response.temp_key);
          setOrderReference(response.reference);
        } else if (hasPaid && autoPaymentConfirmationEnabled) {
          // "I've paid" checkbox flow - use existing order reference
          // We'll set tempKey to indicate this is a payment confirmation without proof upload
          setTempKey(`confirmed-${orderReference}`);
        }
        
        setCurrentStep(5);
        toast.success(paymentFile ? 'Payment proof uploaded successfully' : 'Payment confirmation recorded');
      } catch (error) {
        console.error('Payment step failed:', error);
        toast.error(error.response?.data?.detail || 'Failed to process payment step');
      } finally {
        setLoading(false);
      }
    }
  };

  const handlePlaceOrder = async () => {
    setLoading(true);
    try {
      const orderData = {
        basket_id: cart.id,
        temp_key: tempKey,
        shipping_method_code: selectedShippingMethod,
        donation: donation
      };

      if (!isAuthenticated) {
        orderData.email = getValues().email;
      }

      const order = await checkoutService.placeOrder(orderData);
      
      // Clear cart after successful order
      clearCart();
      
      toast.success('Order placed successfully!');
      
      // Redirect to success page with order info
      navigate('/order-success', { 
        replace: true,
        state: {
          orderNumber: order.number,
          orderTotal: totalWithDonation
        }
      });
    } catch (error) {
      console.error('Order placement failed:', error);
      toast.error(error.response?.data?.detail || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (file) => {
    if (file && file.type.startsWith('image/')) {
      setPaymentFile(file);
    } else {
      toast.error('Please upload an image file');
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileUpload(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    handleFileUpload(file);
  };

  const handleDonationAmountChange = (e) => {
    const value = e.target.value;
    setCustomDonation(value);
    const amount = parseInt(value) || 0;
    setDonation(amount);
    setValue('donationType', 'custom');
  };

  const startPaymentPolling = () => {
    // Wait a bit if order reference was just generated
    setTimeout(() => {
      if (!orderReference) {
        toast.error('Order reference not available');
        return;
      }

      setIsPollingPayment(true);
      
      // Set up 1-minute timeout
      const oneMinTimeout = setTimeout(() => {
        stopPaymentPolling();
        setShowManualConfirmation(true);
      }, 60000); // 1 minute
      
      setOneMinuteTimeoutId(oneMinTimeout);

      // Start polling every 5 seconds
      const pollPayment = async () => {
        try {
          const result = await checkoutService.checkPayNowEmail(orderReference);
          if (result.confirmed) {
            stopPaymentPolling();
            toast.success('Payment confirmed! Proceeding to place order...');
            // Automatically proceed to place order
            setTimeout(() => {
              handlePlaceOrder();
            }, 1000);
            return;
          }
          
          // Schedule next poll - check if we're still supposed to be polling
          const timeoutId = setTimeout(() => {
            // Check if polling should continue before making next call
            if (document.querySelector('#hasPaid')?.checked) {
              pollPayment();
            }
          }, 5000);
          setPollingTimeoutId(timeoutId);
        } catch (error) {
          console.error('Error checking payment:', error);
          // Continue polling even if there's an error
          const timeoutId = setTimeout(() => {
            // Check if polling should continue before making next call
            if (document.querySelector('#hasPaid')?.checked) {
              pollPayment();
            }
          }, 5000);
          setPollingTimeoutId(timeoutId);
        }
      };

      // Start first poll immediately
      pollPayment();
    }, 100); // Small delay to ensure state is updated
  };

  const stopPaymentPolling = () => {
    setIsPollingPayment(false);
    if (pollingTimeoutId) {
      clearTimeout(pollingTimeoutId);
      setPollingTimeoutId(null);
    }
    if (oneMinuteTimeoutId) {
      clearTimeout(oneMinuteTimeoutId);
      setOneMinuteTimeoutId(null);
    }
  };

  const handleHasPaidChange = (checked) => {
    setHasPaid(checked);
    if (checked && autoPaymentConfirmationEnabled) {
      // Generate order reference if we don't have one
      if (!orderReference) {
        // Generate proper MER- reference format like the backend
        // Format: MER-{100000 + basket_id}
        const properRef = `MER-${100000 + parseInt(cart.id)}`;
        setOrderReference(properRef);
      }
      startPaymentPolling();
    } else {
      stopPaymentPolling();
      setShowManualConfirmation(false);
    }
  };

  const handleManualConfirm = () => {
    toast.success('Thank you for confirming. We will verify your payment manually within 1 business day.');
    setShowManualConfirmation(false);
    setHasPaid(false);
    // Proceed to place order since they confirmed
    handlePlaceOrder();
  };

  const handleManualCancel = () => {
    setShowManualConfirmation(false);
    setHasPaid(false);
    stopPaymentPolling();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPaymentPolling();
    };
  }, []);

  if (cartLoading) {
    return (
      <CheckoutContainer>
        <Loading text="Loading checkout..." />
      </CheckoutContainer>
    );
  }

  if (!cart || cart.lines?.length === 0) {
    return null; // Will redirect to cart
  }

  const cartCount = getCartCount();
  const subtotal = cart?.total_excl_tax || 0;
  const selectedMethod = shippingMethods.find(method => method.code === selectedShippingMethod);
  const shippingCost = selectedMethod ? (selectedMethod.is_self_collect ? 0 : parseFloat(selectedMethod.price) || 0) : 0;
  const totalWithDonation = subtotal + shippingCost + donation;

  // Calculate visible step numbers based on whether shipping info is shown
  const getStepNumber = (stepIndex) => {
    if (isSelectedMethodSelfCollect && stepIndex >= 3) {
      return stepIndex - 1; // Skip step 3 for self-collect
    }
    return stepIndex;
  };

  const getMaxSteps = () => {
    return isSelectedMethodSelfCollect ? 4 : 5;
  };

  return (
    <CheckoutContainer>
      <CheckoutHeader>
        <BackButton onClick={() => navigate('/cart')}>
          <ArrowLeft size={20} />
          Back to Cart
        </BackButton>
        <CheckoutTitle>Checkout</CheckoutTitle>
      </CheckoutHeader>

      <CheckoutGrid>
        <CheckoutSteps>
          {/* Step 1: Contact Information */}
          <Step completed={currentStep > 1} disabled={currentStep < 1}>
            <StepHeader>
              <StepNumber completed={currentStep > 1}>
                {currentStep > 1 ? <CheckCircle size={16} /> : getStepNumber(1)}
              </StepNumber>
              <StepTitle>Contact Information</StepTitle>
            </StepHeader>
            
            {currentStep >= 1 && (
              <StepContent>
                {!isAuthenticated && (
                  <FormGroup>
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      {...register('email', { 
                        required: 'Email is required',
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: 'Invalid email address'
                        }
                      })}
                      error={errors.email}
                    />
                    {errors.email && <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{errors.email.message}</span>}
                  </FormGroup>
                )}

                {isAuthenticated && (
                  <Alert variant="info">
                    Signed in as {user?.email}
                  </Alert>
                )}

                {currentStep === 1 && (
                  <div style={{ marginTop: '1rem' }}>
                    <Button onClick={() => handleStepComplete(1)}>
                      Continue to Shipping Method
                    </Button>
                  </div>
                )}
              </StepContent>
            )}
          </Step>

          {/* Step 2: Shipping/Collection Method */}
          <Step completed={currentStep > 2} disabled={currentStep < 2}>
            <StepHeader>
              <StepNumber completed={currentStep > 2}>
                {currentStep > 2 ? <CheckCircle size={16} /> : getStepNumber(2)}
              </StepNumber>
              <StepTitle>Shipping/Collection Method</StepTitle>
            </StepHeader>
            
            {currentStep >= 2 && (
              <StepContent>
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ margin: '0 0 1rem 0', color: '#666' }}>
                    Choose how you would like to receive your order:
                  </p>
                  
                  {shippingMethods.map((method) => (
                    <ShippingMethodCard
                      key={method.code}
                      selected={selectedShippingMethod === method.code}
                      onClick={() => handleShippingMethodChange(method.code)}
                    >
                      <ShippingMethodHeader>
                        <ShippingMethodRadio
                          type="radio"
                          name="shippingMethod"
                          value={method.code}
                          checked={selectedShippingMethod === method.code}
                          onChange={() => handleShippingMethodChange(method.code)}
                        />
                        <ShippingMethodName>
                          {sanitizeText(method.name)}
                        </ShippingMethodName>
                      </ShippingMethodHeader>
                      
                      {method.description && (
                        <ShippingMethodDescription>
                          <SafeHtml 
                            html={method.description}
                            tag="div"
                            allowedTags={['strong', 'b', 'em', 'i', 'u', 'span', 'p', 'br']}
                            allowedAttributes={{}}
                          />
                        </ShippingMethodDescription>
                      )}
                      
                      <ShippingMethodPrice>
                        {method.is_self_collect ? 'Free' : formatCurrency(parseFloat(method.price) || 0)}
                      </ShippingMethodPrice>
                    </ShippingMethodCard>
                  ))}
                </div>

                {currentStep === 2 && (
                  <div style={{ marginTop: '1rem' }}>
                    <Button onClick={() => handleStepComplete(2)}>
                      {isSelectedMethodSelfCollect ? 'Continue to Payment' : 'Continue to Shipping Information'}
                    </Button>
                  </div>
                )}
              </StepContent>
            )}
          </Step>

          {/* Step 3: Shipping Information (only for delivery methods) */}
          <Step 
            completed={currentStep > 3} 
            disabled={currentStep < 3 || isSelectedMethodSelfCollect}
            style={{ display: isSelectedMethodSelfCollect ? 'none' : 'block' }}
          >
            <StepHeader>
              <StepNumber completed={currentStep > 3}>
                {currentStep > 3 ? <CheckCircle size={16} /> : getStepNumber(3)}
              </StepNumber>
              <StepTitle>Shipping Information</StepTitle>
            </StepHeader>
            
            {currentStep >= 3 && !isSelectedMethodSelfCollect && (
              <StepContent>
                <FormRow>
                  <FormGroup>
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      {...register('firstName', { required: 'First name is required' })}
                      error={errors.firstName}
                    />
                    {errors.firstName && <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{errors.firstName.message}</span>}
                  </FormGroup>
                  
                  <FormGroup>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      {...register('lastName', { required: 'Last name is required' })}
                      error={errors.lastName}
                    />
                    {errors.lastName && <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{errors.lastName.message}</span>}
                  </FormGroup>
                </FormRow>

                <FormGroup>
                  <Label htmlFor="address1">Address Line 1 *</Label>
                  <Input
                    id="address1"
                    {...register('address1', { required: 'Address is required' })}
                    error={errors.address1}
                  />
                  {errors.address1 && <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{errors.address1.message}</span>}
                </FormGroup>

                <FormGroup>
                  <Label htmlFor="address2">Address Line 2</Label>
                  <Input
                    id="address2"
                    {...register('address2')}
                  />
                </FormGroup>

                <FormRow>
                  <FormGroup>
                    <Label htmlFor="city">City *</Label>
                    <Input
                      id="city"
                      {...register('city', { required: 'City is required' })}
                      error={errors.city}
                    />
                    {errors.city && <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{errors.city.message}</span>}
                  </FormGroup>
                  
                  <FormGroup>
                    <Label htmlFor="postcode">Postal Code *</Label>
                    <Input
                      id="postcode"
                      {...register('postcode', { required: 'Postal code is required' })}
                      error={errors.postcode}
                    />
                    {errors.postcode && <span style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{errors.postcode.message}</span>}
                  </FormGroup>
                </FormRow>

                <FormRow>
                  <FormGroup>
                    <Label htmlFor="state">State/Province</Label>
                    <Input
                      id="state"
                      {...register('state')}
                    />
                  </FormGroup>
                  
                  <FormGroup>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      {...register('phone')}
                    />
                  </FormGroup>
                </FormRow>

                {currentStep === 3 && (
                  <div style={{ marginTop: '1rem' }}>
                    <Button onClick={() => handleStepComplete(3)}>
                      Continue to Payment
                    </Button>
                  </div>
                )}
              </StepContent>
            )}
          </Step>

          {/* Step 4: Payment */}
          <Step completed={currentStep > 4} disabled={currentStep < 4}>
            <StepHeader>
              <StepNumber completed={currentStep > 4}>
                {currentStep > 4 ? <CheckCircle size={16} /> : getStepNumber(4)}
              </StepNumber>
              <StepTitle>Payment</StepTitle>
            </StepHeader>
            
            {currentStep >= 4 && (
              <StepContent>
                <Alert variant="info" style={{ marginBottom: '1rem' }}>
                  For now, we only accept payment via PayNow – either via QR code or UEN number.
                </Alert>

                <PaymentLayout>
                  <div>
                    <p style={{ margin: '0 0 1rem 0', color: '#666' }}>
                      <strong>BirdSoc SG's UEN number is T23SS0038A.</strong>
                    </p>
                    <p style={{ margin: '0 0 1rem 0', color: '#666' }}>
                      Your order total is shown below. <strong>Please make payment before uploading proof.</strong>
                    </p>
                    
                    <Alert variant="warning" style={{ marginBottom: '1rem' }}>
                      Please upload your PayNow payment proof after making the payment.
                    </Alert>
                  </div>
                  
                  
                  <PayNowQR 
                    amount={subtotal + shippingCost} 
                    referenceId={orderReference} 
                    donation={donation}
                  />
                </PaymentLayout>

                <DonationSection>
                  <SafeHtml 
                    html="<strong><u><a href='https://birdsociety.sg/support-us/' target='_blank'>Add a donation</a></u> (optional)</strong>"
                    tag="h4"
                    style={{ 
                      margin: '0 0 1rem 0',
                      fontSize: '1.125rem',
                      color: 'var(--dark)'
                    }}
                  />
                  <SafeHtml 
                    html="<span style='color: #17a2b8; font-weight: 600;'>Learn more about donating to the Bird Society of Singapore <u><a href='https://birdsociety.sg/support-us/' target='_blank'>here</a></u>.</span>"
                    tag="p"
                    style={{ 
                      margin: '0 0 1rem 0',
                      fontSize: '0.9rem'
                    }}
                  />
                  <DonationOptions>
                    <DonationOption
                      type="button"
                      selected={donation === 0}
                      onClick={() => {
                        setDonation(0);
                        setValue('donationType', '0');
                        setCustomDonation('');
                      }}
                    >
                      $0
                    </DonationOption>
                    <DonationOption
                      type="button"
                      selected={donation === 5}
                      onClick={() => {
                        setDonation(5);
                        setValue('donationType', '5');
                        setCustomDonation('');
                      }}
                    >
                      $5
                    </DonationOption>
                    <DonationOption
                      type="button"
                      selected={donation === 10}
                      onClick={() => {
                        setDonation(10);
                        setValue('donationType', '10');
                        setCustomDonation('');
                      }}
                    >
                      $10
                    </DonationOption>
                    <DonationOption
                      type="button"
                      selected={donation === 20}
                      onClick={() => {
                        setDonation(20);
                        setValue('donationType', '20');
                        setCustomDonation('');
                      }}
                    >
                      $20
                    </DonationOption>
                  </DonationOptions>
                  
                  <FormGroup style={{ margin: 0 }}>
                    <Label htmlFor="customDonation">Custom amount</Label>
                    <Input
                      id="customDonation"
                      type="number"
                      min="0"
                      placeholder="Enter custom amount"
                      value={customDonation}
                      onChange={handleDonationAmountChange}
                    />
                  </FormGroup>
                </DonationSection>

                {autoPaymentConfirmationEnabled && (
                  <PaymentConfirmSection>
                    <CheckboxContainer>
                      <Checkbox
                        type="checkbox"
                        id="hasPaid"
                        checked={hasPaid}
                        onChange={(e) => handleHasPaidChange(e.target.checked)}
                      />
                      <CheckboxLabel htmlFor="hasPaid">
                        I've made the payment
                      </CheckboxLabel>
                    </CheckboxContainer>
                    
                    {isPollingPayment && (
                      <PollingStatus>
                        <LoadingSpinner />
                        Checking for payment confirmation... This may take up to 1 minute.
                      </PollingStatus>
                    )}
                    
                    <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                      Check this after making your PayNow payment to automatically verify it via email
                    </p>
                  </PaymentConfirmSection>
                )}

                <FileUploadArea
                  dragOver={dragOver}
                  hasFile={!!paymentFile}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleFileDrop}
                  onClick={() => document.getElementById('payment-file-input').click()}
                  style={{ opacity: (hasPaid && autoPaymentConfirmationEnabled) ? 0.6 : 1 }}
                >
                  <FileUploadIcon>
                    {paymentFile ? <CheckCircle color="var(--success)" /> : <Upload />}
                  </FileUploadIcon>
                  <FileUploadText>
                    {paymentFile ? 'Payment proof uploaded' : 'Click to upload or drag and drop payment proof'}
                    {hasPaid && !paymentFile && autoPaymentConfirmationEnabled && (
                      <span style={{ display: 'block', marginTop: '0.5rem', fontStyle: 'italic', color: '#666' }}>
                        (Optional when using "I've paid" confirmation)
                      </span>
                    )}
                  </FileUploadText>
                  <FileUploadSubtext>
                    PNG, JPG up to 10MB
                  </FileUploadSubtext>
                </FileUploadArea>

                <HiddenFileInput
                  id="payment-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                />

                {paymentFile && (
                  <SelectedFile>
                    <CheckCircle size={16} color="var(--success)" />
                    <span>{sanitizeText(paymentFile.name)}</span>
                  </SelectedFile>
                )}

                {currentStep === 4 && (
                  <div style={{ marginTop: '1rem' }}>
                    <Button 
                      onClick={() => handleStepComplete(4)}
                      disabled={(!paymentFile && (!hasPaid || !autoPaymentConfirmationEnabled)) || loading}
                    >
                      {loading ? 'Uploading...' : 
                       (hasPaid && autoPaymentConfirmationEnabled) ? 'Continue to Review' : 
                       'Upload Payment Proof'}
                    </Button>
                  </div>
                )}
              </StepContent>
            )}
          </Step>

          {/* Step 5: Review & Place Order */}
          <Step completed={false} disabled={currentStep < 5}>
            <StepHeader>
              <StepNumber>{getStepNumber(5)}</StepNumber>
              <StepTitle>Review & Place Order</StepTitle>
            </StepHeader>
            
            {currentStep >= 5 && (
              <StepContent>
                <Alert variant="success" style={{ marginBottom: '1rem' }}>
                  <CheckCircle size={16} />
                  {paymentFile ? 'Payment proof uploaded successfully!' : 'Payment confirmation recorded!'} Reference: {orderReference}
                </Alert>

                <p style={{ marginBottom: '1rem', color: '#666' }}>
                  {paymentFile 
                    ? 'Please review your order details and click "Place Order" to complete your purchase.'
                    : 'Please review your order details. If payment confirmation was successful, you can proceed to place your order.'
                  }
                </p>

                <Button 
                  onClick={handlePlaceOrder}
                  disabled={loading}
                  size="large"
                >
                  {loading ? 'Placing Order...' : 'Place Order'}
                </Button>
              </StepContent>
            )}
          </Step>
        </CheckoutSteps>

        {/* Order Summary */}
        <OrderSummary>
          <SummaryTitle>Order Summary</SummaryTitle>
          
          {/* Cart Items */}
          <div>
            {cart.lines?.map((line, index) => {
              // Use the correct property names based on the actual data structure
              const productTitle = line.product_title || 
                                   line.product?.title || 
                                   line.title || 
                                   'Product';
              
              // Use the correct price property name
              const linePrice = line.line_price_incl_tax || 
                               line.line_price_excl_tax ||
                               line.unit_price_incl_tax ||
                               0;
              
              return (
                <CartItem key={line.id || index}>
                  <ItemDetails>
                    <ItemName>{sanitizeText(productTitle)}</ItemName>
                    {line.product?.attributes && Object.entries(line.product.attributes).map(([key, value]) => (
                      <ItemVariant key={key}>
                        {sanitizeText(key)}: {sanitizeText(value)}
                      </ItemVariant>
                    ))}
                    {/* Also check for top-level attributes */}
                    {line.attributes && Object.entries(line.attributes).map(([key, value]) => (
                      <ItemVariant key={key}>
                        {sanitizeText(key)}: {sanitizeText(value)}
                      </ItemVariant>
                    ))}
                    <ItemQuantity>Qty: {line.quantity || 1}</ItemQuantity>
                  </ItemDetails>
                  <ItemPrice>{formatCurrency(linePrice)}</ItemPrice>
                </CartItem>
              );
            })}
          </div>

          <SummarySection>
            <SummaryRow>
              <span>Subtotal ({cartCount} items)</span>
              <span>{formatCurrency(subtotal)}</span>
            </SummaryRow>

            <SummaryRow>
              <span>Shipping</span>
              <span>{selectedMethod?.is_self_collect ? 'Free' : formatCurrency(shippingCost)}</span>
            </SummaryRow>

            {donation > 0 && (
              <SummaryRow>
                <span>Donation</span>
                <span>{formatCurrency(donation)}</span>
              </SummaryRow>
            )}

            <SummaryRow total>
              <span>Total</span>
              <span>{formatCurrency(totalWithDonation)}</span>
            </SummaryRow>
          </SummarySection>

          {orderReference && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>Order Reference:</div>
              <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{orderReference}</div>
            </div>
          )}
        </OrderSummary>
      </CheckoutGrid>
      
      {/* Manual Confirmation Modal */}
      {showManualConfirmation && (
        <ModalOverlay>
          <ModalContent>
            <ModalTitle>Payment Confirmation</ModalTitle>
            <ModalText>
              We couldn't automatically detect your payment within 1 minute. 
              Are you sure the payment went through? If yes, it might be a technical error on our side 
              and we'll verify your payment manually within 1 business day.
            </ModalText>
            <ModalButtons>
              <ModalButton 
                variant="secondary" 
                onClick={handleManualCancel}
              >
                No, I'll try again
              </ModalButton>
              <ModalButton 
                onClick={handleManualConfirm}
              >
                Yes, I've paid
              </ModalButton>
            </ModalButtons>
          </ModalContent>
        </ModalOverlay>
      )}
    </CheckoutContainer>
  );
};

export default Checkout;
