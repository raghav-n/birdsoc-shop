import React from 'react';
import styled from 'styled-components';
import { LoadingSpinner } from '../styles/GlobalStyles';

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
`;

const LoadingText = styled.p`
  margin-top: 1rem;
  color: var(--dark);
  font-size: 1rem;
`;

const Loading = ({ text = 'Loading...' }) => {
  return (
    <LoadingContainer>
      <LoadingSpinner size="50px" center />
      <LoadingText>{text}</LoadingText>
    </LoadingContainer>
  );
};

export default Loading;
