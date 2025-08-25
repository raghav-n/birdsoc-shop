import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Input, FormGroup, Label, ErrorMessage } from '../styles/GlobalStyles';
import Alert from '../components/Alert';

const LoginContainer = styled.div`
  min-height: calc(100vh - 200px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
`;

const LoginCard = styled(Card)`
  width: 100%;
  max-width: 400px;
`;

const LoginHeader = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const LoginTitle = styled.h1`
  font-size: 2rem;
  margin-bottom: 0.5rem;
`;

const LoginSubtitle = styled.p`
  color: #666;
  margin-bottom: 0;
`;

const Form = styled.form`
  margin-bottom: 1.5rem;
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

const LoginFooter = styled.div`
  text-align: center;
  
  p {
    margin: 0;
    color: #666;
  }
  
  a {
    color: var(--link-text);
    text-decoration: none;
    font-weight: 500;
    
    &:hover {
      color: var(--link-text-hover);
    }
  }
`;

const ForgotPassword = styled(Link)`
  display: block;
  text-align: center;
  margin-top: 1rem;
  color: var(--link-text);
  text-decoration: none;
  font-size: 0.9rem;
  
  &:hover {
    color: var(--link-text-hover);
  }
`;

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const from = location.state?.from?.pathname || '/';

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm();

  const onSubmit = async (data) => {
    setIsLoading(true);
    const result = await login(data.email, data.password);
    setIsLoading(false);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError('root', { 
        type: 'manual', 
        message: result.error 
      });
    }
  };

  return (
    <LoginContainer>
      <LoginCard>
        <LoginHeader>
          <LoginTitle>Sign In</LoginTitle>
          <LoginSubtitle>Welcome back to BirdSoc Shop</LoginSubtitle>
        </LoginHeader>

        {errors.root && (
          <Alert variant="error">
            {errors.root.message}
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)}>
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
                  message: 'Please enter a valid email address'
                }
              })}
            />
            {errors.email && (
              <ErrorMessage>{errors.email.message}</ErrorMessage>
            )}
          </FormGroup>

          <FormGroup>
            <Label htmlFor="password">Password</Label>
            <PasswordInputContainer>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                hasError={errors.password}
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters'
                  }
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

          <Button
            type="submit"
            fullWidth
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Button>
        </Form>

        <ForgotPassword to="/forgot-password">
          Forgot your password?
        </ForgotPassword>

        <LoginFooter>
          <p>
            Don't have an account?{' '}
            <Link to="/register" state={{ from: location.state?.from }}>
              Create one here
            </Link>
          </p>
        </LoginFooter>
      </LoginCard>
    </LoginContainer>
  );
};

export default Login;
