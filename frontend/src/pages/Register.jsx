import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button, Card, Input, FormGroup, Label, ErrorMessage } from '../styles/GlobalStyles';
import Alert from '../components/Alert';
import SafeCheckbox from '../components/SafeCheckbox';
import { showToast } from '../utils/toast.jsx';

const RegisterContainer = styled.div`
  min-height: calc(100vh - 200px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
`;

const RegisterCard = styled(Card)`
  width: 100%;
  max-width: 450px;
`;

const RegisterHeader = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const RegisterTitle = styled.h1`
  font-size: 2rem;
  margin-bottom: 0.5rem;
`;

const RegisterSubtitle = styled.p`
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

const RegisterFooter = styled.div`
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

const NameRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
    gap: 0;
  }
`;

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setError,
  } = useForm();

  const password = watch('password');

  const onSubmit = async (data) => {
    setIsLoading(true);
    const result = await registerUser({
      email: data.email,
      password: data.password,
      first_name: data.first_name,
      last_name: data.last_name,
    });
    setIsLoading(false);

    if (result.success) {
      navigate('/login', { 
        state: { from: location.state?.from },
        replace: true 
      });
    } else {
      setError('root', { 
        type: 'manual', 
        message: result.error 
      });
    }
  };

  return (
    <RegisterContainer>
      <RegisterCard>
        <RegisterHeader>
          <RegisterTitle>Create Account</RegisterTitle>
          <RegisterSubtitle>Join the BirdSoc Shop community</RegisterSubtitle>
        </RegisterHeader>

        {errors.root && (
          <Alert variant="error">
            {errors.root.message}
          </Alert>
        )}

        <Form onSubmit={handleSubmit(onSubmit)}>
          <NameRow>
            <FormGroup>
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                type="text"
                placeholder="First name"
                hasError={errors.first_name}
                {...register('first_name', {
                  required: 'First name is required',
                  minLength: {
                    value: 2,
                    message: 'First name must be at least 2 characters'
                  }
                })}
              />
              {errors.first_name && (
                <ErrorMessage>{errors.first_name.message}</ErrorMessage>
              )}
            </FormGroup>

            <FormGroup>
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                type="text"
                placeholder="Last name"
                hasError={errors.last_name}
                {...register('last_name', {
                  required: 'Last name is required',
                  minLength: {
                    value: 2,
                    message: 'Last name must be at least 2 characters'
                  }
                })}
              />
              {errors.last_name && (
                <ErrorMessage>{errors.last_name.message}</ErrorMessage>
              )}
            </FormGroup>
          </NameRow>

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
                placeholder="Create a password"
                hasError={errors.password}
                {...register('password', {
                  required: 'Password is required',
                  minLength: {
                    value: 8,
                    message: 'Password must be at least 8 characters'
                  },
                  pattern: {
                    value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                    message: 'Password must contain uppercase, lowercase, and number'
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

          <FormGroup>
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <PasswordInputContainer>
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                hasError={errors.confirmPassword}
                {...register('confirmPassword', {
                  required: 'Please confirm your password',
                  validate: (value) =>
                    value === password || 'Passwords do not match'
                })}
              />
              <PasswordToggle
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </PasswordToggle>
            </PasswordInputContainer>
            {errors.confirmPassword && (
              <ErrorMessage>{errors.confirmPassword.message}</ErrorMessage>
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
            fullWidth
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </Form>

        <RegisterFooter>
          <p>
            Already have an account?{' '}
            <Link to="/login" state={{ from: location.state?.from }}>
              Sign in here
            </Link>
          </p>
        </RegisterFooter>
      </RegisterCard>
    </RegisterContainer>
  );
};

export default Register;
