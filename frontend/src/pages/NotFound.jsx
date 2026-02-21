import React from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { Button } from '../styles/GlobalStyles';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 50vh;
  text-align: center;
  padding: 2rem 1rem;
`;

const Code = styled.h1`
  font-size: 6rem;
  font-weight: 700;
  color: var(--dark);
  margin: 0;
  line-height: 1;
`;

const Message = styled.p`
  font-size: 1.25rem;
  color: #666;
  margin: 1rem 0 2rem;
`;

const NotFound = () => (
  <Container>
    <Code>404</Code>
    <Message>Page not found.</Message>
    <Link to="/"><Button>Back Home</Button></Link>
  </Container>
);

export default NotFound;
