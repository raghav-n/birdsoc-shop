import React from 'react';
import styled from 'styled-components';
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';
import SafeHtml from './SafeHtml';

const AlertContainer = styled.div`
  padding: 1rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  border: 1px solid;

  ${props => {
    switch (props.variant) {
      case 'success':
        return `
          background-color: #d4edda;
          border-color: #c3e6cb;
          color: #155724;
        `;
      case 'warning':
        return `
          background-color: #fff3cd;
          border-color: #ffeaa7;
          color: #856404;
        `;
      case 'error':
        return `
          background-color: #f8d7da;
          border-color: #f5c6cb;
          color: #721c24;
        `;
      case 'info':
      default:
        return `
          background-color: #d1ecf1;
          border-color: #bee5eb;
          color: #0c5460;
        `;
    }
  }}
`;

const AlertIcon = styled.div`
  flex-shrink: 0;
`;

const AlertContent = styled.div`
  flex: 1;
`;

const AlertTitle = styled.div`
  font-weight: 600;
  margin-bottom: 0.25rem;
`;

const AlertMessage = styled.div`
  font-size: 0.9rem;
  line-height: 1.4;
`;

const Alert = ({ 
  variant = 'info', 
  title, 
  children, 
  className, 
  html = null, 
  safeHtml = false 
}) => {
  const getIcon = () => {
    switch (variant) {
      case 'success':
        return <CheckCircle size={20} />;
      case 'warning':
        return <AlertTriangle size={20} />;
      case 'error':
        return <AlertCircle size={20} />;
      case 'info':
      default:
        return <Info size={20} />;
    }
  };

  return (
    <AlertContainer variant={variant} className={className}>
      <AlertIcon>{getIcon()}</AlertIcon>
      <AlertContent>
        {title && <AlertTitle>{title}</AlertTitle>}
        <AlertMessage>
          {safeHtml && html ? (
            <SafeHtml html={html} tag="span" />
          ) : (
            children
          )}
        </AlertMessage>
      </AlertContent>
    </AlertContainer>
  );
};

export default Alert;
