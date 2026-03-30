import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { useForm } from 'react-hook-form';
import { ArrowLeft } from 'lucide-react';
import { authService } from '../services/auth';
import { Button, Card, Input, FormGroup, Label, ErrorMessage } from '../styles/GlobalStyles';
import Alert from '../components/Alert';

const Container = styled.div`
  min-height: calc(100vh - 200px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
`;

const FormCard = styled(Card)`
  width: 100%;
  max-width: 400px;
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  font-size: 2rem;
  margin-bottom: 0.5rem;
`;

const Subtitle = styled.p`
  color: #666;
  margin-bottom: 0;
`;

const BackLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--link-text);
  text-decoration: none;
  font-size: 0.9rem;
  margin-top: 1.5rem;

  &:hover {
    color: var(--link-text-hover);
  }
`;

const ForgotPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await authService.requestPasswordReset(data.email);
      setSubmitted(true);
    } catch (err) {
      setError('root', {
        type: 'manual',
        message: err.response?.data?.detail || 'Something went wrong. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <FormCard>
        <Header>
          <Title>Reset Password</Title>
          <Subtitle>
            {submitted
              ? 'Check your email for a reset link.'
              : "Enter your email and we'll send you a reset link."}
          </Subtitle>
        </Header>

        {errors.root && (
          <Alert variant="error">{errors.root.message}</Alert>
        )}

        {submitted ? (
          <Alert variant="success">
            If an account exists with that email, you will receive a password reset link shortly.
          </Alert>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <FormGroup>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                hasError={errors.email}
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Please enter a valid email address',
                  },
                })}
              />
              {errors.email && (
                <ErrorMessage>{errors.email.message}</ErrorMessage>
              )}
            </FormGroup>

            <Button type="submit" fullWidth disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
        )}

        <BackLink to="/login">
          <ArrowLeft size={16} />
          Back to Sign In
        </BackLink>
      </FormCard>
    </Container>
  );
};

export default ForgotPassword;
