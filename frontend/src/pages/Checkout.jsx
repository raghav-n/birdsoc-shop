import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useForm } from 'react-hook-form';
import { Upload, CheckCircle, ArrowLeft } from 'lucide-react';
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
import { trackBeginCheckout, trackPurchase } from '../utils/analytics';
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


const Checkout = () => {
  const { cart, loading: cartLoading, getCartCount, clearCart } = useCart();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState(2);
  const [loading, setLoading] = useState(false);
  const [shippingMethods, setShippingMethods] = useState([]);
  const [selectedShippingMethod, setSelectedShippingMethod] = useState('');
  const [isSelectedMethodSelfCollect, setIsSelectedMethodSelfCollect] = useState(false);
  const [paymentFile, setPaymentFile] = useState(null);
  const orderReference = cart?.id ? `MER-${100000 + parseInt(cart.id)}` : '';
  const [donation, setDonation] = useState(0);
  const [customDonation, setCustomDonation] = useState('');
  const [dragOver, setDragOver] = useState(false);                    

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    setValue,
    watch
  } = useForm({
    defaultValues: {
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
    if (authLoading || cartLoading) return;
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    if (!cart || cart.lines?.length === 0) {
      navigate('/cart');
      return;
    }

    loadShippingMethods();
    trackBeginCheckout(cart);
  }, [cart, navigate, isAuthenticated, authLoading, cartLoading]);

  useEffect(() => {
    if (watchDonationType === 'custom') {
      setDonation(0);
    } else if (watchDonationType && watchDonationType !== 'custom') {
      setDonation(parseInt(watchDonationType));
      setCustomDonation('');
    }
  }, [watchDonationType]);

  // Save pending checkout when reaching payment step so the order is recorded
  // even if the user makes payment but leaves before uploading proof
  useEffect(() => {
    if (currentStep === 4 && cart?.id) {
      const cartItems = cart?.lines || [];
      const discountsList = cart?.offer_discounts || [];
      const cartSubtotal = cart?.total_excl_tax || 0;
      const method = shippingMethods.find(m => m.code === selectedShippingMethod);
      const shipCost = method ? (method.is_self_collect ? 0 : parseFloat(method.price) || 0) : 0;

      checkoutService.savePendingCheckout({
        basket_id: cart.id,
        shipping_method_code: selectedShippingMethod,
        donation,
        basket_snapshot: {
          lines: cartItems.map(item => ({
            title: item.product_title || item.description,
            quantity: item.quantity,
            price: item.line_price_incl_tax,
          })),
          discounts: discountsList.map(d => ({
            name: d.name || d.description || 'Discount',
            amount: d.amount || d.discount,
          })),
          shipping: String(shipCost),
          total: String(cartSubtotal + shipCost),
        },
      }).catch((err) => console.error('Failed to save pending checkout:', err));
    }
  }, [currentStep, cart?.id, donation]);

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
    if (step === 2) {
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
      const _subtotal = cart?.total_excl_tax || 0;
      const _method = shippingMethods.find(m => m.code === selectedShippingMethod);
      const _shippingCost = _method ? (_method.is_self_collect ? 0 : parseFloat(_method.price) || 0) : 0;
      const isFreeOrder = _subtotal + _shippingCost === 0;
      const needsPayment = !isFreeOrder || donation > 0;

      if (needsPayment && !paymentFile) {
        toast.error('Please upload payment proof');
        return;
      }

      setLoading(true);
      try {
        let tempKey = null;

        if (needsPayment) {
          // Upload proof
          const formData = new FormData();
          formData.append('payment_proof', paymentFile);
          formData.append('basket_id', cart.id);
          formData.append('donation', donation.toString());

          const response = await checkoutService.uploadPayNowProof(formData);
          setOrderReference(response.reference);
          tempKey = response.temp_key;
        }

        // Place order
        const orderData = {
          basket_id: cart.id,
          shipping_method_code: selectedShippingMethod,
          donation: donation,
          ...(tempKey ? { temp_key: tempKey } : {}),
        };

        const order = await checkoutService.placeOrder(orderData);
        trackPurchase(order.number, totalWithDonation, cartItems, shippingCost);
        clearCart();
        toast.success('Order placed successfully!');
        navigate('/order-success', {
          replace: true,
          state: {
            orderNumber: order.number,
            orderTotal: totalWithDonation,
          },
        });
      } catch (error) {
        console.error('Payment step failed:', error);
        toast.error(error.response?.data?.detail || 'Failed to process payment');
      } finally {
        setLoading(false);
      }
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
  const cartItems = cart?.lines || [];
  const lineTotal = cartItems.reduce((sum, item) => sum + parseFloat(item.line_price_incl_tax || 0), 0);
  const discounts = cart?.offer_discounts || [];
  const subtotal = cart?.total_excl_tax || 0;
  const selectedMethod = shippingMethods.find(method => method.code === selectedShippingMethod);
  const shippingCost = selectedMethod ? (selectedMethod.is_self_collect ? 0 : parseFloat(selectedMethod.price) || 0) : 0;
  const totalWithDonation = subtotal + shippingCost + donation;

  // Calculate visible step numbers (contact step removed, so internal 2→1, 3→2, 4→3, 5→4)
  const getStepNumber = (stepIndex) => {
    let num = stepIndex - 1; // offset since contact step is removed
    if (isSelectedMethodSelfCollect && stepIndex >= 3) {
      num -= 1; // Skip shipping info step for self-collect
    }
    return num;
  };

  const getMaxSteps = () => {
    return isSelectedMethodSelfCollect ? 2 : 3;
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
          {/* Step 1: Shipping/Collection Method */}
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
                {(() => {
                  const isFreeOrder = subtotal + shippingCost === 0;
                  const needsPayment = !isFreeOrder || donation > 0;
                  return (
                    <>
                      {needsPayment && (
                        <Alert variant="info" style={{ marginBottom: '1rem' }}>
                          For now, we only accept payment via PayNow – either via QR code or UEN number.
                        </Alert>
                      )}

                      <PaymentLayout>
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

                        {needsPayment && (
                          <PayNowQR
                            amount={subtotal + shippingCost}
                            referenceId={orderReference}
                            donation={donation}
                          />
                        )}
                      </PaymentLayout>

                      {needsPayment && (
                        <>
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
                          >
                            <FileUploadIcon>
                              {paymentFile ? <CheckCircle color="var(--success)" /> : <Upload />}
                            </FileUploadIcon>
                            <FileUploadText>
                              {paymentFile ? 'Payment proof uploaded' : 'Click to upload or drag and drop payment proof'}
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
                        </>
                      )}

                      {currentStep === 4 && (
                        <div style={{ marginTop: '1rem' }}>
                          <Button
                            onClick={() => handleStepComplete(4)}
                            disabled={(needsPayment && !paymentFile) || loading}
                          >
                            {loading
                              ? 'Placing Order...'
                              : needsPayment
                              ? 'Submit Payment Proof & Place Order'
                              : 'Place Order'}
                          </Button>
                        </div>
                      )}
                    </>
                  );
                })()}
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
              <span>{formatCurrency(lineTotal)}</span>
            </SummaryRow>

            {discounts.map((discount, idx) => (
              <SummaryRow key={idx}>
                <span style={{ color: 'var(--success, #2e7d32)', fontSize: '0.9rem' }}>{discount.name}</span>
                <span style={{ color: 'var(--success, #2e7d32)', fontWeight: 600, fontSize: '0.9rem' }}>-{formatCurrency(discount.amount)}</span>
              </SummaryRow>
            ))}

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
      
    </CheckoutContainer>
  );
};

export default Checkout;
