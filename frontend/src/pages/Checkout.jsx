import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useForm } from 'react-hook-form';
import { Upload, CheckCircle, ArrowLeft, Truck, MapPin } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { checkoutService } from '../services/checkout';
import { Button as RawButton, FormGroup as RawFormGroup, Label as RawLabel, Input as RawInput, Select as RawSelect } from '../styles/GlobalStyles';
import { BsPage, BsOverline, BsPill, BsButton } from '../styles/birdsoc';
import Loading from '../components/Loading';
import Alert from '../components/Alert';
import PayNowQR from '../components/PayNowQR';
import SafeHtml from '../components/SafeHtml';
import { sanitizeText } from '../utils/safeContent';
import { formatCurrency } from '../utils/helpers';
import { trackBeginCheckout, trackPurchase } from '../utils/analytics';
import toast from 'react-hot-toast';

const CheckoutContainer = styled(BsPage)`
  > div {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2.5rem 2rem 4rem;

    @media (max-width: 768px) {
      padding: 1.25rem 1rem 1.5rem;
    }
  }
`;

const CheckoutHeader = styled.div`
  margin-bottom: 2rem;

  @media (max-width: 600px) {
    margin-bottom: 1.25rem;
  }
`;

const BackButton = styled.button`
  background: none;
  border: none;
  padding: 0;
  margin-bottom: 1rem;
  color: var(--bs-text-mute);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-family: var(--bs-sans);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: -0.1px;
  transition: color 0.15s ease;

  &:hover {
    color: var(--bs-accent-dim);
  }
`;

const CheckoutTitle = styled.h1`
  font-family: var(--bs-display);
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.8px;
  line-height: 1.1;
  color: var(--bs-text);
  margin: 0;

  @media (max-width: 768px) {
    font-size: 1.4rem;
    letter-spacing: -0.5px;
  }
`;

const CheckoutGrid = styled.div`
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 2.5rem;
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
`;

const CheckoutSteps = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
`;

const Step = styled.div`
  background: var(--bs-panel);
  border: 1px solid var(--bs-rule-soft);
  border-radius: 14px;
  padding: 1.5rem;
  transition: border-color 0.15s ease;

  ${props => props.completed && `
    border-color: var(--bs-accent);
  `}

  ${props => props.disabled && `
    opacity: 0.6;
    pointer-events: none;
  `}

  @media (max-width: 600px) {
    border-radius: 12px;
    padding: 1.1rem;
  }
`;

const StepHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-bottom: 1.1rem;
`;

const StepNumber = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: ${props => props.completed ? 'var(--bs-accent-soft)' : 'var(--bs-accent)'};
  color: ${props => props.completed ? 'var(--bs-accent-dim)' : 'var(--bs-on-accent)'};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--bs-mono);
  font-weight: 700;
  font-size: 0.8rem;
  flex-shrink: 0;
`;

const StepTitle = styled.h3`
  font-family: var(--bs-sans);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--bs-text-mute);
  letter-spacing: 1.4px;
  text-transform: uppercase;
  margin: 0;
`;

const StepContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
`;

const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const FileUploadArea = styled.div`
  border: 2px dashed var(--bs-rule);
  border-radius: 12px;
  padding: 1.75rem 1rem;
  text-align: center;
  background-color: var(--bs-body);
  transition: all 0.15s ease;
  cursor: pointer;

  &:hover {
    border-color: var(--bs-accent);
    background: var(--bs-accent-tint);
  }

  ${props => props.dragOver && `
    border-color: var(--bs-accent);
    background: var(--bs-accent-tint);
  `}

  ${props => props.hasFile && `
    border-color: var(--bs-accent);
    background: var(--bs-accent-soft);
  `}
`;

const FileUploadIcon = styled.div`
  color: var(--bs-text-mute);
  margin-bottom: 0.4rem;
  display: flex;
  justify-content: center;
`;

const FileUploadText = styled.p`
  margin: 0;
  color: var(--bs-text);
  font-size: 0.84rem;
  font-weight: 600;
`;

const FileUploadSubtext = styled.p`
  margin: 0.4rem 0 0 0;
  font-size: 0.75rem;
  color: var(--bs-text-mute);
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const SelectedFile = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.85rem;
  padding: 0.65rem 0.85rem;
  background: var(--bs-panel);
  border: 1px solid var(--bs-rule-soft);
  border-radius: 8px;
  font-size: 0.81rem;
  color: var(--bs-text);
`;

const DonationSection = styled.div`
  background: var(--bs-body);
  border: 1px solid var(--bs-rule-soft);
  border-radius: 12px;
  padding: 1rem;
  margin-top: 0.5rem;
`;

const DonationTitle = styled.h4`
  margin: 0 0 0.75rem 0;
  color: var(--bs-text);
  font-size: 0.84rem;
  font-weight: 600;
`;

const DonationOptions = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
  gap: 0.5rem;
  margin-bottom: 0.85rem;
`;

const DonationOption = styled.button`
  padding: 0.55rem 0.5rem;
  border: 1.5px solid ${props => props.selected ? 'var(--bs-accent)' : 'var(--bs-rule)'};
  border-radius: 8px;
  background: ${props => props.selected ? 'var(--bs-accent-tint)' : 'var(--bs-panel)'};
  color: ${props => props.selected ? 'var(--bs-accent-dim)' : 'var(--bs-text)'};
  cursor: pointer;
  font-family: var(--bs-sans);
  font-size: 0.82rem;
  font-weight: 600;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--bs-accent);
  }
`;

const ShippingMethodCard = styled.div`
  border: 1.5px solid ${props => props.selected ? 'var(--bs-accent)' : 'var(--bs-rule)'};
  background: ${props => props.selected ? 'var(--bs-accent-tint)' : 'var(--bs-body)'};
  border-radius: 12px;
  padding: 0.9rem 1.1rem;
  margin-bottom: 0.75rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--bs-accent);
  }
`;

const ShippingMethodHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
`;

const ShippingMethodRadio = styled.input`
  width: 18px;
  height: 18px;
  accent-color: var(--bs-accent);
  flex-shrink: 0;
`;

const ShippingMethodName = styled.h4`
  margin: 0;
  font-family: var(--bs-sans);
  font-size: 0.91rem;
  font-weight: 600;
  color: var(--bs-text);
`;

const ShippingMethodDescription = styled.p`
  margin: 0;
  font-size: 0.78rem;
  color: var(--bs-text-mute);
  line-height: 1.4;
`;

const ShippingMethodPrice = styled.div`
  font-family: var(--bs-mono);
  font-weight: 700;
  color: var(--bs-text);
  font-size: 0.8rem;
  margin-top: 0.3rem;
  letter-spacing: 0.4px;
`;

const OrderSummary = styled.div`
  background: var(--bs-panel);
  border: 1px solid var(--bs-rule-soft);
  border-radius: 14px;
  padding: 1.4rem;
  height: fit-content;
  position: sticky;
  top: 5rem;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;

  @media (max-width: 900px) {
    position: static;
  }

  @media (max-width: 600px) {
    border-radius: 12px;
    padding: 1rem;
  }
`;

const SummaryTitle = styled.h3`
  font-family: var(--bs-sans);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--bs-text-mute);
  letter-spacing: 1.4px;
  text-transform: uppercase;
  margin: 0;
`;

const SummaryRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.84rem;
  color: var(--bs-text-dim);

  ${props => props.total && `
    font-weight: 700;
    font-size: 1rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--bs-rule-soft);
    color: var(--bs-text);

    span:last-child {
      font-size: 1.4rem;
      letter-spacing: -0.5px;
    }
  `}
`;

const CartItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--bs-rule-soft);

  &:last-child {
    border-bottom: none;
  }
`;

const ItemDetails = styled.div`
  flex: 1;
  min-width: 0;
`;

const ItemName = styled.h4`
  margin: 0 0 0.2rem 0;
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--bs-text);
  letter-spacing: -0.1px;
  line-height: 1.3;
`;

const ItemVariant = styled.p`
  margin: 0 0 0.2rem 0;
  font-size: 0.72rem;
  color: var(--bs-text-mute);
  font-family: var(--bs-mono);
  letter-spacing: 0.3px;
  text-transform: uppercase;
`;

const ItemQuantity = styled.span`
  font-size: 0.72rem;
  color: var(--bs-text-mute);
  font-family: var(--bs-mono);
  letter-spacing: 0.3px;
`;

const ItemPrice = styled.div`
  font-weight: 600;
  color: var(--bs-text);
  font-size: 0.84rem;
`;

const SummarySection = styled.div`
  margin-top: 0.4rem;
  padding-top: 0.85rem;
  border-top: 1px solid var(--bs-rule-soft);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const Input = styled(RawInput)`
  height: 42px;
  padding: 0 12px;
  border: 1.5px solid var(--bs-rule);
  background: var(--bs-body);
  color: var(--bs-text);
  border-radius: 8px;
  font-family: var(--bs-sans);
  font-size: 0.84rem;
  letter-spacing: -0.1px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &::placeholder { color: var(--bs-text-mute); }

  &:focus {
    border-color: var(--bs-accent);
    background: var(--bs-body);
    box-shadow: 0 0 0 3px var(--bs-accent-tint);
  }
`;

const Select = styled(RawSelect)`
  height: 42px;
  padding: 0 32px 0 12px;
  border: 1.5px solid var(--bs-rule);
  background: var(--bs-body);
  color: var(--bs-text);
  border-radius: 8px;
  font-family: var(--bs-sans);
  font-size: 0.84rem;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234A5C52' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  &:focus {
    border-color: var(--bs-accent);
    background: var(--bs-body);
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%232E6B5A' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 12px center;
    box-shadow: 0 0 0 3px var(--bs-accent-tint);
  }
`;

const Label = styled(RawLabel)`
  font-family: var(--bs-sans);
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--bs-text-dim);
  letter-spacing: 0.1px;
  margin-bottom: 6px;
`;

const FormGroup = styled(RawFormGroup)`
  margin-bottom: 0;
`;

const Button = styled(RawButton)`
  background: ${(p) => p.variant === 'secondary' ? 'var(--bs-panel)' : 'var(--bs-accent)'};
  color: ${(p) => p.variant === 'secondary' ? 'var(--bs-text)' : 'var(--bs-on-accent)'};
  border: 1.5px solid ${(p) => p.variant === 'secondary' ? 'var(--bs-rule)' : 'var(--bs-accent)'};
  border-radius: 8px;
  font-family: var(--bs-sans);
  font-weight: 600;
  padding: 0.7rem 1.4rem;
  letter-spacing: -0.1px;
  transition: background 0.15s ease, border-color 0.15s ease;

  &:hover:not(:disabled) {
    background: ${(p) => p.variant === 'secondary' ? 'var(--bs-panel-hi)' : 'var(--bs-accent-dim)'};
    color: ${(p) => p.variant === 'secondary' ? 'var(--bs-text)' : 'var(--bs-on-accent)'};
    border-color: ${(p) => p.variant === 'secondary' ? 'var(--bs-accent)' : 'var(--bs-accent-dim)'};
  }

  ${(p) => p.size === 'small' && `padding: 0.5rem 0.9rem; font-size: 0.82rem;`}
  ${(p) => p.size === 'large' && `padding: 0.85rem 1.5rem; font-size: 0.95rem;`}
`;

const PaymentLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 2rem;
  align-items: start;
  margin-bottom: 1.5rem;

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
  const orderNumber = cart?.id ? String(100000 + parseInt(cart.id, 10)) : '';
  const orderReference = orderNumber ? `MER-${orderNumber}` : '';
  const [donation, setDonation] = useState(0);
  const [customDonation, setCustomDonation] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [isSendingTestPaymentEmail, setIsSendingTestPaymentEmail] = useState(false);
  const handledPaymentConfirmationRef = useRef(false);
  const isCheckingPaymentConfirmationRef = useRef(false);
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

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
      phone: '',
      donationType: '0'
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
            product_id: item.product_id,
            stockrecord_id: item.stockrecord_id,
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

  const handlePresetDonationToggle = (amount) => {
    if (donation === amount) {
      setDonation(0);
      setValue('donationType', '0');
      setCustomDonation('');
      return;
    }

    setDonation(amount);
    setValue('donationType', String(amount));
    setCustomDonation('');
  };

  const handleSendTestPaymentEmail = async () => {
    if (!orderNumber || isSendingTestPaymentEmail) {
      return;
    }

    setIsSendingTestPaymentEmail(true);
    try {
      const result = await checkoutService.sendPayNowTestEmail(orderNumber);
      toast.success(
        `Test PayNow email sent to ${result.recipient}. Automatic confirmation polling is active.`
      );
    } catch (error) {
      toast.error(
        error.response?.data?.detail || 'Failed to send test PayNow email'
      );
    } finally {
      setIsSendingTestPaymentEmail(false);
    }
  };

  const cartCount = getCartCount();
  const cartItems = cart?.lines || [];
  const lineTotal = cartItems.reduce((sum, item) => sum + parseFloat(item.line_price_incl_tax || 0), 0);
  const discounts = cart?.offer_discounts || [];
  const subtotal = cart?.total_excl_tax || 0;
  const selectedMethod = shippingMethods.find(method => method.code === selectedShippingMethod);
  const shippingCost = selectedMethod ? (selectedMethod.is_self_collect ? 0 : parseFloat(selectedMethod.price) || 0) : 0;
  const totalWithDonation = subtotal + shippingCost + donation;
  const isFreeOrder = subtotal + shippingCost === 0;
  const needsPayment = !isFreeOrder || donation > 0;

  useEffect(() => {
    handledPaymentConfirmationRef.current = false;
  }, [orderNumber]);

  useEffect(() => {
    if (currentStep !== 4 || !orderNumber || !needsPayment) {
      return;
    }

    const checkPaymentConfirmation = async () => {
      if (
        handledPaymentConfirmationRef.current ||
        isCheckingPaymentConfirmationRef.current
      ) {
        return;
      }

      isCheckingPaymentConfirmationRef.current = true;

      try {
        const result = await checkoutService.checkPayNowEmail(orderNumber);
        if (!result.confirmed) {
          return;
        }

        handledPaymentConfirmationRef.current = true;
        trackPurchase(orderNumber, totalWithDonation, cart?.lines || [], shippingCost);
        clearCart();
        navigate('/order-success', {
          replace: true,
          state: {
            orderNumber,
            orderTotal: totalWithDonation,
            autoConfirmedPayment: true,
          },
        });
      } catch (error) {
        const statusCode = error.response?.status;
        if (statusCode !== 404 && statusCode !== 501 && statusCode !== 502) {
          console.error('Automatic payment confirmation check failed:', error);
        }
      } finally {
        isCheckingPaymentConfirmationRef.current = false;
      }
    };

    checkPaymentConfirmation();
    const intervalId = window.setInterval(checkPaymentConfirmation, 10000);

    return () => {
      window.clearInterval(intervalId);
      isCheckingPaymentConfirmationRef.current = false;
    };
  }, [
    cart,
    clearCart,
    currentStep,
    navigate,
    needsPayment,
    orderNumber,
    shippingCost,
    totalWithDonation,
  ]);

  if (cartLoading) {
    return (
      <CheckoutContainer>
        <div><Loading text="Loading checkout..." /></div>
      </CheckoutContainer>
    );
  }

  if (!cart || cart.lines?.length === 0) {
    return null; // Will redirect to cart
  }

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
      <div>
      <CheckoutHeader>
        <BackButton onClick={() => navigate('/cart')}>
          <ArrowLeft size={13} strokeWidth={2.2} />
          Back to cart
        </BackButton>
        <BsOverline>Step 2 of 3 · Checkout</BsOverline>
        <CheckoutTitle>Your details &amp; payment</CheckoutTitle>
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
                  <p style={{ margin: '0 0 1rem 0', color: 'var(--bs-text-mute)' }}>
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
                    {errors.firstName && <span style={{ color: 'var(--bs-danger)', fontSize: '0.78rem', fontWeight: 600 }}>{errors.firstName.message}</span>}
                  </FormGroup>
                  
                  <FormGroup>
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      {...register('lastName', { required: 'Last name is required' })}
                      error={errors.lastName}
                    />
                    {errors.lastName && <span style={{ color: 'var(--bs-danger)', fontSize: '0.78rem', fontWeight: 600 }}>{errors.lastName.message}</span>}
                  </FormGroup>
                </FormRow>

                <FormGroup>
                  <Label htmlFor="address1">Address Line 1 *</Label>
                  <Input
                    id="address1"
                    {...register('address1', { required: 'Address is required' })}
                    error={errors.address1}
                  />
                  {errors.address1 && <span style={{ color: 'var(--bs-danger)', fontSize: '0.78rem', fontWeight: 600 }}>{errors.address1.message}</span>}
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
                    {errors.city && <span style={{ color: 'var(--bs-danger)', fontSize: '0.78rem', fontWeight: 600 }}>{errors.city.message}</span>}
                  </FormGroup>
                  
                  <FormGroup>
                    <Label htmlFor="postcode">Postal Code *</Label>
                    <Input
                      id="postcode"
                      {...register('postcode', { required: 'Postal code is required' })}
                      error={errors.postcode}
                    />
                    {errors.postcode && <span style={{ color: 'var(--bs-danger)', fontSize: '0.78rem', fontWeight: 600 }}>{errors.postcode.message}</span>}
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
                  return (
                    <>
                      {needsPayment && (
                        <Alert variant="info" style={{ marginBottom: '1rem' }}>
                          For now, we only accept payment via PayNow – either via QR code or UEN number.
                        </Alert>
                      )}

                      {needsPayment && isLocalhost && (
                        <div style={{ marginBottom: '1rem' }}>
                          <Alert variant="info" style={{ marginBottom: '1rem' }}>
                            Local testing: automatic PayNow confirmation polling is active on this step.
                          </Alert>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleSendTestPaymentEmail}
                            disabled={!orderNumber || isSendingTestPaymentEmail}
                          >
                            {isSendingTestPaymentEmail
                              ? 'Sending Test Email...'
                              : 'Send Local Test PayNow Email'}
                          </Button>
                        </div>
                      )}

                      <PaymentLayout>
                        <DonationSection>
                          <SafeHtml
                            html="<strong><u><a href='https://birdsociety.sg/support-us/' target='_blank'>Add a donation</a></u> (optional)</strong>"
                            tag="h4"
                            style={{
                              margin: '0 0 0.75rem 0',
                              fontSize: '0.95rem',
                              color: 'var(--bs-text)',
                              fontWeight: 700,
                              letterSpacing: '-0.2px',
                            }}
                          />
                          <SafeHtml
                            html="<span>Learn more about donating to the Bird Society of Singapore <u><a href='https://birdsociety.sg/support-us/' target='_blank'>here</a></u>.</span>"
                            tag="p"
                            style={{
                              margin: '0 0 1rem 0',
                              fontSize: '0.82rem',
                              color: 'var(--bs-text-mute)',
                              lineHeight: 1.5,
                            }}
                          />
                          <DonationOptions>
                            <DonationOption
                              type="button"
                              selected={donation === 5}
                              onClick={() => handlePresetDonationToggle(5)}
                            >
                              $5
                            </DonationOption>
                            <DonationOption
                              type="button"
                              selected={donation === 10}
                              onClick={() => handlePresetDonationToggle(10)}
                            >
                              $10
                            </DonationOption>
                            <DonationOption
                              type="button"
                              selected={donation === 20}
                              onClick={() => handlePresetDonationToggle(20)}
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
                              {paymentFile ? <CheckCircle color="var(--bs-accent)" /> : <Upload />}
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
                              <CheckCircle size={16} color="var(--bs-accent)" />
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
                <span style={{ color: 'var(--bs-accent-dim)', fontSize: '0.84rem' }}>{discount.name}</span>
                <span style={{ color: 'var(--bs-accent-dim)', fontWeight: 600, fontSize: '0.84rem' }}>-{formatCurrency(discount.amount)}</span>
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
            <div style={{
              marginTop: '0.5rem',
              padding: '0.75rem 0.9rem',
              background: 'var(--bs-body)',
              border: '1px solid var(--bs-rule-soft)',
              borderRadius: '8px',
            }}>
              <div style={{
                fontFamily: 'var(--bs-mono)',
                fontSize: '0.68rem',
                fontWeight: 700,
                letterSpacing: '1.2px',
                textTransform: 'uppercase',
                color: 'var(--bs-text-mute)',
                marginBottom: '0.25rem',
              }}>Order Reference</div>
              <div style={{
                fontFamily: 'var(--bs-mono)',
                fontWeight: 600,
                fontSize: '0.88rem',
                color: 'var(--bs-text)',
                letterSpacing: '0.4px',
              }}>{orderReference}</div>
            </div>
          )}
        </OrderSummary>
      </CheckoutGrid>
      </div>
    </CheckoutContainer>
  );
};

export default Checkout;
