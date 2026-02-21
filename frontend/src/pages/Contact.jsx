import React, { useState } from 'react';
import styled from 'styled-components';
import { useForm } from 'react-hook-form';
import { Button, Card, Input, FormGroup, Label, ErrorMessage, Select } from '../styles/GlobalStyles';
import Alert from '../components/Alert';
import SafeCheckbox from '../components/SafeCheckbox';
import Loading from '../components/Loading';
import { showToast } from '../utils/toast.jsx';
import api from '../services/api';

const ContactContainer = styled.div`
  max-width: 600px;
  margin: 2rem auto;
  padding: 0 1rem;
`;

const ContactCard = styled(Card)`
  padding: 2rem;
`;

const ContactHeader = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const ContactTitle = styled.h1`
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: var(--dark);
`;

const ContactSubtitle = styled.p`
  color: #666;
  margin: 0;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const TextArea = styled.textarea`
  padding: 0.75rem;
  border: 2px solid #e9ecef;
  border-radius: 4px;
  font-size: 1rem;
  min-height: 120px;
  resize: vertical;
  font-family: inherit;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--link-text);
  }

  ${props => props.hasError && `
    border-color: #dc3545;
  `}
`;

const Contact = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { errors }
  } = useForm();

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await api.post('/contact', data);
      showToast.success('Thank you for your message! We will get back to you soon.');
      reset();
    } catch (error) {
      if (error.response?.data) {
        const serverErrors = error.response.data;
        Object.entries(serverErrors).forEach(([field, messages]) => {
          const msg = Array.isArray(messages) ? messages[0] : messages;
          setError(field, { type: 'server', message: msg });
        });
      } else {
        showToast.error('Failed to send message. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ContactContainer>
      <ContactCard>
        <ContactHeader>
          <ContactTitle>Contact Us</ContactTitle>
          <ContactSubtitle>
            We'd love to hear from you. Send us a message and we'll respond as soon as possible.
          </ContactSubtitle>
        </ContactHeader>

        <Form onSubmit={handleSubmit(onSubmit)}>
          <FormGroup>
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              type="text"
              placeholder="Your full name"
              hasError={errors.name}
              {...register('name', {
                required: 'Name is required',
                minLength: {
                  value: 2,
                  message: 'Name must be at least 2 characters'
                }
              })}
            />
            {errors.name && (
              <ErrorMessage>{errors.name.message}</ErrorMessage>
            )}
          </FormGroup>

          <FormGroup>
            <Label htmlFor="email">Email Address *</Label>
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
            {errors.email && (
              <ErrorMessage>{errors.email.message}</ErrorMessage>
            )}
          </FormGroup>

          <FormGroup>
            <Label htmlFor="subject">Subject *</Label>
            <Input
              id="subject"
              type="text"
              placeholder="What is this about?"
              hasError={errors.subject}
              {...register('subject', {
                required: 'Subject is required',
                minLength: {
                  value: 5,
                  message: 'Subject must be at least 5 characters'
                }
              })}
            />
            {errors.subject && (
              <ErrorMessage>{errors.subject.message}</ErrorMessage>
            )}
          </FormGroup>

          <FormGroup>
            <Label htmlFor="body">Message *</Label>
            <TextArea
              id="body"
              placeholder="Your message..."
              hasError={errors.body}
              {...register('body', {
                required: 'Message is required',
                minLength: {
                  value: 10,
                  message: 'Message must be at least 10 characters'
                }
              })}
            />
            {errors.body && (
              <ErrorMessage>{errors.body.message}</ErrorMessage>
            )}
          </FormGroup>

          <SafeCheckbox
            id="pdpa_agreement"
            htmlLabel="I have read and agree to the <a href='https://birdsociety.sg/data-protection-notice/' target='_blank'>data protection notice</a>."
            checked={watch('pdpa_agreement')}
            hasError={errors.pdpa_agreement}
            errorMessage={errors.pdpa_agreement?.message}
            register={register('pdpa_agreement', {
              required: 'You must agree to the data protection notice to continue'
            })}
          />

          <Button
            type="submit"
            disabled={isSubmitting}
            style={{ marginTop: '1rem' }}
          >
            {isSubmitting ? 'Sending...' : 'Send Message'}
          </Button>
        </Form>
      </ContactCard>
    </ContactContainer>
  );
};

export default Contact;
