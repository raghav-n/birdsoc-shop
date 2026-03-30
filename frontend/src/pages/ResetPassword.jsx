import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
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

const PasswordInputContainer = styled.div`
  position: relative;
`;

const PasswordToggle = styled.button`
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 0.25rem;

  &:hover {
    color: var(--link-text);
  }
`;

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    watch,
  } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    try {
      await authService.confirmPasswordReset(uid, token, data.password);
      navigate('/login', { state: { message: 'Password reset successfully. Please sign in.' } });
    } catch (err) {
      const detail = err.response?.data;
      const message =
        typeof detail === 'string' ? detail
        : detail?.new_password?.[0]
        || detail?.token?.[0]
        || detail?.uid?.[0]
        || detail?.detail
        || 'Reset link is invalid or has expired.';
      setError('root', { type: 'manual', message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <FormCard>
        <Header>
          <Title>Set New Password</Title>
          <Subtitle>Enter your new password below.</Subtitle>
        </Header>

        {errors.root && (
          <Alert variant="error">{errors.root.message}</Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <FormGroup>
            <Label htmlFor="password">New Password</Label>
            <PasswordInputContainer>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter new password"
                hasError={errors.password}
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters',
                  },
                })}
              />
              <PasswordToggle
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </PasswordToggle>
            </PasswordInputContainer>
            {errors.password && (
              <ErrorMessage>{errors.password.message}</ErrorMessage>
            )}
          </FormGroup>

          <FormGroup>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              placeholder="Confirm new password"
              hasError={errors.confirmPassword}
              {...register('confirmPassword', {
                required: 'Please confirm your password',
                validate: (val) =>
                  val === watch('password') || 'Passwords do not match',
              })}
            />
            {errors.confirmPassword && (
              <ErrorMessage>{errors.confirmPassword.message}</ErrorMessage>
            )}
          </FormGroup>

          <Button type="submit" fullWidth disabled={isLoading}>
            {isLoading ? 'Resetting...' : 'Reset Password'}
          </Button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link to="/login" style={{ color: 'var(--link-text)', textDecoration: 'none', fontSize: '0.9rem' }}>
            Back to Sign In
          </Link>
        </div>
      </FormCard>
    </Container>
  );
};

export default ResetPassword;
