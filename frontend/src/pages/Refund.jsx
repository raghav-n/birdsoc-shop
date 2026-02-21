import React, { useState } from 'react';
import styled from 'styled-components';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Button, Card, Input, FormGroup, Label, ErrorMessage } from '../styles/GlobalStyles';
import Alert from '../components/Alert';
import { refundService } from '../services/misc';
import { showToast } from '../utils/toast.jsx';

const RefundContainer = styled.div`
  max-width: 600px;
  margin: 2rem auto;
  padding: 0 1rem;
`;

const RefundCard = styled(Card)`
  padding: 2rem;
`;

const RefundHeader = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const RefundTitle = styled.h1`
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: var(--dark);
`;

const RefundSubtitle = styled.p`
  color: #666;
  margin: 0;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 4px;
  font-size: 1rem;
  background-color: #f1f1f1;
  min-height: 100px;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--link-text);
    background-color: white;
  }

  ${props => props.hasError && `
    border-color: var(--danger);
  `}
`;

const SuccessCard = styled(Card)`
  padding: 2rem;
  text-align: center;
`;

const Refund = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors }
  } = useForm();

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await refundService.createRefundRequest(data);
      setSubmitted(true);
    } catch (error) {
      if (error.response?.data) {
        const serverErrors = error.response.data;
        Object.entries(serverErrors).forEach(([field, messages]) => {
          const msg = Array.isArray(messages) ? messages[0] : messages;
          setError(field, { type: 'server', message: msg });
        });
      } else {
        showToast.error('Failed to submit refund request. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <RefundContainer>
        <SuccessCard>
          <Alert variant="success" title="Thank you">
            Your refund request has been submitted successfully.
          </Alert>
          <p>
            We have received your refund request and will process it as soon as possible.
            A confirmation email has been sent to the email address you provided.
          </p>
          <p>
            If you have any questions, please <Link to="/contact">contact us</Link>.
          </p>
          <Link to="/">
            <Button style={{ marginTop: '1rem' }}>Return to Home</Button>
          </Link>
        </SuccessCard>
      </RefundContainer>
    );
  }

  return (
    <RefundContainer>
      <RefundCard>
        <RefundHeader>
          <RefundTitle>Request a Refund</RefundTitle>
          <RefundSubtitle>
            Please fill out this form to request a refund for your order. We'll review your request and get back to you shortly.
          </RefundSubtitle>
        </RefundHeader>

        <Form onSubmit={handleSubmit(onSubmit)}>
          <FormGroup>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your full name"
              hasError={errors.name}
              {...register('name', { required: 'Name is required' })}
            />
            {errors.name && <ErrorMessage>{errors.name.message}</ErrorMessage>}
          </FormGroup>

          <FormGroup>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="your.email@example.com"
              hasError={errors.email}
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Please enter a valid email address'
                }
              })}
            />
            {errors.email && <ErrorMessage>{errors.email.message}</ErrorMessage>}
          </FormGroup>

          <FormGroup>
            <Label htmlFor="paynow_phone">PayNow Phone Number *</Label>
            <Input
              id="paynow_phone"
              type="tel"
              placeholder="e.g. 91234567"
              hasError={errors.paynow_phone}
              {...register('paynow_phone', {
                required: 'PayNow phone number is required'
              })}
            />
            {errors.paynow_phone && <ErrorMessage>{errors.paynow_phone.message}</ErrorMessage>}
          </FormGroup>

          <FormGroup>
            <Label htmlFor="order_number">Order Number *</Label>
            <Input
              id="order_number"
              type="text"
              placeholder="e.g. 100001"
              hasError={errors.order_number}
              {...register('order_number', {
                required: 'Order number is required'
              })}
            />
            {errors.order_number && <ErrorMessage>{errors.order_number.message}</ErrorMessage>}
          </FormGroup>

          <FormGroup>
            <Label htmlFor="amount">Refund Amount ($) *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              hasError={errors.amount}
              {...register('amount', {
                required: 'Refund amount is required',
                min: { value: 0.01, message: 'Amount must be greater than 0' }
              })}
            />
            {errors.amount && <ErrorMessage>{errors.amount.message}</ErrorMessage>}
          </FormGroup>

          <FormGroup>
            <Label htmlFor="reason">Reason for Refund *</Label>
            <TextArea
              id="reason"
              placeholder="Please describe the reason for your refund request..."
              hasError={errors.reason}
              {...register('reason', {
                required: 'Reason is required',
                minLength: { value: 10, message: 'Please provide more detail (at least 10 characters)' }
              })}
            />
            {errors.reason && <ErrorMessage>{errors.reason.message}</ErrorMessage>}
          </FormGroup>

          <Button type="submit" disabled={isSubmitting} style={{ marginTop: '0.5rem' }}>
            {isSubmitting ? 'Submitting...' : 'Submit Refund Request'}
          </Button>
        </Form>
      </RefundCard>
    </RefundContainer>
  );
};

export default Refund;
