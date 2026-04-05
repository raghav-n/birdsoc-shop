import styled, { createGlobalStyle } from 'styled-components';

export const GlobalStyle = createGlobalStyle`
  :root {
    --page-background: #f8f4f9;
    --page-header-background: #ededed;
    --header-text: #5c4760;
    --link-text: #4c7a2d;
    --link-text-hover: #8bc662;
    --selection-text-highlight: var(--header-text);
    --page-footer-background: var(--page-background);
    --light: var(--page-background);
    --dark: var(--header-text);
    --primary: var(--header-text);
    --success: #387541;
    --danger: #cc330d;
    --warning: #6e9fa5;
    --info: #5c8f94;
  }

  html {
    overflow-x: hidden;
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
    font-family: "Noto Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background-color: var(--page-background);
    color: var(--dark);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    overflow-x: hidden;
  }

  ::selection {
    background-color: var(--page-header-background);
  }

  a {
    color: var(--link-text);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  a:hover {
    color: var(--link-text-hover);
  }

  h1, h2, h3, h4, h5, h6 {
    color: var(--dark);
    font-family: "Libre Franklin", sans-serif;
    font-weight: 600;
    margin: 0 0 1rem 0;
  }

  h1 {
    font-size: 2rem;
  }

  h2 {
    font-size: 1.5rem;
  }

  h3 {
    font-size: 1.25rem;
  }

  button {
    font-family: inherit;
  }

  input, textarea, select {
    font-family: inherit;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  @media (max-width: 768px) {
    .container {
      padding: 0 0.5rem;
    }
  }
`;

export const Button = styled.button.withConfig({
  shouldForwardProp: (prop) => !['variant', 'size', 'fullWidth'].includes(prop),
})`
  background-color: ${props => props.variant === 'secondary' ? 'transparent' : 'var(--link-text)'};
  color: ${props => props.variant === 'secondary' ? 'var(--link-text)' : 'white'};
  border: 2px solid var(--link-text);
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;

  &:hover {
    background-color: ${props => props.variant === 'secondary' ? 'var(--link-text)' : 'var(--link-text-hover)'};
    color: white;
    border-color: ${props => props.variant === 'secondary' ? 'var(--link-text)' : 'var(--link-text-hover)'};
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  ${props => props.size === 'small' && `
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
  `}

  ${props => props.size === 'large' && `
    padding: 1rem 2rem;
    font-size: 1.125rem;
  `}

  ${props => props.fullWidth && `
    width: 100%;
  `}
`;

export const Card = styled.div`
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border: 1px solid #e1e1e1;
  transition: box-shadow 0.2s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

export const Input = styled.input`
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 4px;
  font-size: 1rem;
  background-color: #f1f1f1;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: var(--link-text);
    background-color: white;
  }

  &::placeholder {
    color: #999;
  }

  ${props => props.hasError && `
    border-color: var(--danger);
  `}
`;

export const TextArea = styled.textarea`
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 4px;
  font-size: 1rem;
  background-color: #f1f1f1;
  transition: border-color 0.2s ease;
  resize: vertical;
  min-height: 100px;

  &:focus {
    outline: none;
    border-color: var(--link-text);
    background-color: white;
  }

  &::placeholder {
    color: #999;
  }

  ${props => props.hasError && `
    border-color: var(--danger);
  `}
`;

export const Select = styled.select`
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #e1e1e1;
  border-radius: 4px;
  font-size: 1rem;
  background-color: #f1f1f1;
  transition: border-color 0.2s ease;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--link-text);
    background-color: white;
  }

  ${props => props.hasError && `
    border-color: var(--danger);
  `}
`;

export const FormGroup = styled.div`
  margin-bottom: 1rem;
`;

export const Label = styled.label`
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--dark);
`;

export const ErrorMessage = styled.div`
  color: var(--danger);
  font-size: 0.875rem;
  margin-top: 0.25rem;
`;

export const LoadingSpinner = styled.div`
  border: 3px solid #f3f3f3;
  border-top: 3px solid var(--link-text);
  border-radius: 50%;
  width: ${props => props.size || '40px'};
  height: ${props => props.size || '40px'};
  animation: spin 1s linear infinite;
  margin: ${props => props.center ? '0 auto' : '0'};

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(${props => props.minWidth || '280px'}, 1fr));
  gap: ${props => props.gap || '1.5rem'};
  margin: ${props => props.margin || '0'};
`;

export const Flex = styled.div`
  display: flex;
  align-items: ${props => props.align || 'center'};
  justify-content: ${props => props.justify || 'flex-start'};
  gap: ${props => props.gap || '1rem'};
  flex-direction: ${props => props.direction || 'row'};
  flex-wrap: ${props => props.wrap || 'nowrap'};

  @media (max-width: 768px) {
    flex-direction: ${props => props.mobileDirection || props.direction || 'column'};
  }
`;

export const Badge = styled.span.withConfig({
  shouldForwardProp: (prop) => prop !== 'variant',
})`
  background-color: var(--link-text);
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
  display: inline-block;

  ${props => props.variant === 'secondary' && `
    background-color: var(--page-header-background);
    color: var(--dark);
  `}

  ${props => props.variant === 'success' && `
    background-color: var(--success);
  `}

  ${props => props.variant === 'warning' && `
    background-color: var(--warning);
  `}

  ${props => props.variant === 'danger' && `
    background-color: var(--danger);
  `}
`;
