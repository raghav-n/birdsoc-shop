import React from 'react';
import styled from 'styled-components';
import SafeHtml from './SafeHtml';

const CheckboxContainer = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 1rem;
`;

const HiddenCheckbox = styled.input.attrs({ type: 'checkbox' })`
  border: 0;
  clip: rect(0 0 0 0);
  clippath: inset(50%);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  white-space: nowrap;
  width: 1px;
`;

const StyledCheckbox = styled.div`
  width: 18px;
  height: 18px;
  border: 2px solid ${props => props.hasError ? '#dc3545' : '#ddd'};
  border-radius: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${props => props.checked ? 'var(--link-text)' : 'white'};
  border-color: ${props => props.checked ? 'var(--link-text)' : (props.hasError ? '#dc3545' : '#ddd')};
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
  margin-top: 0.125rem;

  &:hover {
    border-color: ${props => props.hasError ? '#dc3545' : 'var(--link-text)'};
  }

  svg {
    color: white;
    width: 12px;
    height: 12px;
  }
`;

const CheckboxLabel = styled.label`
  font-size: 0.9rem;
  line-height: 1.4;
  color: var(--dark);
  cursor: pointer;
  flex: 1;

  a {
    color: var(--link-text);
    text-decoration: none;
    font-weight: 500;

    &:hover {
      color: var(--link-text-hover);
      text-decoration: underline;
    }
  }
`;

const ErrorMessage = styled.div`
  color: #dc3545;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  margin-left: 2.25rem;
`;

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
  </svg>
);

const SafeCheckbox = ({
  id,
  label,
  htmlLabel,
  checked,
  onChange,
  hasError,
  errorMessage,
  register,
  ...props
}) => {
  const inputRef = React.useRef(null);

  const registerProps = register || {};
  const { ref: registerRef, ...restRegister } = registerProps;

  const setRef = React.useCallback((el) => {
    inputRef.current = el;
    if (typeof registerRef === 'function') registerRef(el);
  }, [registerRef]);

  const handleContainerClick = (e) => {
    // Let anchor clicks through
    if (e.target.tagName === 'A') return;
    if (inputRef.current) {
      inputRef.current.click();
    } else if (onChange) {
      onChange(!checked);
    }
  };

  return (
    <div>
      <CheckboxContainer onClick={handleContainerClick}>
        <HiddenCheckbox
          id={id}
          ref={setRef}
          {...restRegister}
          {...props}
        />
        <StyledCheckbox checked={checked} hasError={hasError}>
          {checked && <CheckIcon />}
        </StyledCheckbox>
        <CheckboxLabel htmlFor={id}>
          {htmlLabel ? (
            <SafeHtml 
              html={htmlLabel} 
              tag="span"
              allowedTags={['a', 'strong', 'b', 'em', 'i', 'u', 'span']}
              allowedAttributes={{
                a: ['href', 'target', 'rel'],
                '*': []
              }}
            />
          ) : (
            label
          )}
        </CheckboxLabel>
      </CheckboxContainer>
      {hasError && errorMessage && (
        <ErrorMessage>{errorMessage}</ErrorMessage>
      )}
    </div>
  );
};

export default SafeCheckbox;
