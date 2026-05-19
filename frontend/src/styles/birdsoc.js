import styled, { css } from 'styled-components';

// Shared layout + UI primitives for the BirdSoc shop redesign.
// Tokens live as CSS custom properties (--bs-*) in GlobalStyles.

export const bsMaxWidth = 1200;
export const bsContentMaxWidth = 1100;

export const BsPage = styled.div`
  background: var(--bs-body);
  color: var(--bs-text);
  font-family: var(--bs-sans);
  min-height: 100%;
`;

export const BsContainer = styled.div`
  max-width: ${(p) => p.$narrow ? bsContentMaxWidth : bsMaxWidth}px;
  margin: 0 auto;
  padding: 2.5rem 2rem 4rem;

  @media (max-width: 768px) {
    padding: 1.25rem 1rem 2rem;
  }
`;

export const BsHero = styled.div`
  border-bottom: 1px solid var(--bs-rule-soft);
  background: linear-gradient(135deg, #EDF5E8 0%, #F8F2EC 100%);
`;

export const BsHeroInner = styled.div`
  max-width: ${bsMaxWidth}px;
  margin: 0 auto;
  padding: 2.75rem 2rem 2.5rem;

  @media (max-width: 768px) {
    padding: 1.5rem 1rem 1.4rem;
  }
`;

export const BsOverline = styled.div`
  font-family: var(--bs-mono);
  font-size: 0.72rem;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: ${(p) => p.$dim ? 'var(--bs-text-mute)' : 'var(--bs-accent-dim)'};
  font-weight: 700;
  margin-bottom: 0.8rem;

  @media (max-width: 768px) {
    font-size: 0.66rem;
    letter-spacing: 1.2px;
  }
`;

export const BsH1 = styled.h1`
  font-family: var(--bs-sans);
  font-size: 2.75rem;
  font-weight: 700;
  letter-spacing: -1.4px;
  line-height: 1.05;
  color: var(--bs-text);
  margin: 0;

  @media (max-width: 768px) {
    font-size: 1.625rem;
    letter-spacing: -0.6px;
    line-height: 1.12;
  }
`;

export const BsH2 = styled.h2`
  font-family: var(--bs-sans);
  font-size: 2.25rem;
  font-weight: 700;
  letter-spacing: -1px;
  line-height: 1.1;
  color: var(--bs-text);
  margin: 0;

  @media (max-width: 768px) {
    font-size: 1.5rem;
    letter-spacing: -0.5px;
  }
`;

export const BsLead = styled.p`
  font-size: 0.95rem;
  color: var(--bs-text-dim);
  line-height: 1.65;
  margin: 1.1rem 0 0;
  max-width: 540px;

  @media (max-width: 768px) {
    font-size: 0.84rem;
    margin-top: 0.75rem;
  }
`;

const pillTones = {
  neutral: css`background: var(--bs-panel-hi); color: var(--bs-text-dim);`,
  amber: css`background: var(--bs-amber-soft); color: var(--bs-amber-fg);`,
  coral: css`background: var(--bs-coral-soft); color: var(--bs-coral-fg);`,
  sage: css`background: var(--bs-accent-soft); color: var(--bs-accent-dim);`,
  sky: css`background: var(--bs-sky-soft); color: var(--bs-sky-fg);`,
  solid: css`background: var(--bs-accent); color: var(--bs-on-accent);`,
  outline: css`background: transparent; color: var(--bs-text); border: 1px solid var(--bs-rule);`,
};

export const BsPill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-family: var(--bs-sans);
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  white-space: nowrap;
  line-height: 1.4;
  ${(p) => pillTones[p.$tone || 'neutral']}
`;

const btnSizeStyles = {
  sm: css`height: 32px; padding: 0 12px; font-size: 12.5px;`,
  md: css`height: 40px; padding: 0 18px; font-size: 13.5px;`,
  lg: css`height: 48px; padding: 0 22px; font-size: 14.5px;`,
};

export const BsButton = styled.button.withConfig({
  shouldForwardProp: (prop) => !['$primary', '$size', '$full', '$ghost'].includes(prop),
})`
  ${(p) => btnSizeStyles[p.$size || 'md']}
  background: ${(p) => p.$primary ? 'var(--bs-accent)' : p.$ghost ? 'transparent' : 'var(--bs-panel)'};
  color: ${(p) => p.$primary ? 'var(--bs-on-accent)' : 'var(--bs-text)'};
  border: ${(p) => p.$primary ? 'none' : p.$ghost ? 'none' : '1px solid var(--bs-rule)'};
  border-radius: 8px;
  font-family: var(--bs-sans);
  font-weight: 600;
  letter-spacing: -0.1px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  white-space: nowrap;
  width: ${(p) => p.$full ? '100%' : 'auto'};
  text-decoration: none;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease, opacity 0.15s ease;

  &:hover:not(:disabled) {
    background: ${(p) => p.$primary ? 'var(--bs-accent-dim)' : p.$ghost ? 'var(--bs-panel-hi)' : 'var(--bs-panel-hi)'};
    border-color: ${(p) => p.$primary || p.$ghost ? undefined : 'var(--bs-accent)'};
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

export const BsCard = styled.div`
  background: var(--bs-panel);
  border: 1px solid var(--bs-rule-soft);
  border-radius: 14px;
  padding: ${(p) => p.$padding || '1.5rem'};

  @media (max-width: 768px) {
    border-radius: 12px;
    padding: ${(p) => p.$mobilePadding || '1rem'};
  }
`;

export const BsSectionLabel = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1.25rem;
  margin-bottom: 1.4rem;
`;

export const BsSectionLabelOverline = styled.div`
  font-family: var(--bs-sans);
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--bs-text-mute);
  letter-spacing: 1.4px;
  text-transform: uppercase;
`;

export const BsSectionLabelSub = styled.div`
  font-size: 0.81rem;
  color: var(--bs-text-mute);
  margin-top: 0.25rem;
  line-height: 1.5;
`;

export const BsSectionLabelLink = styled.a`
  color: var(--bs-accent);
  font-size: 0.81rem;
  font-weight: 600;
  letter-spacing: -0.1px;
  text-decoration: none;
  cursor: pointer;

  &:hover { color: var(--bs-accent-dim); }
`;

export const BsFieldLabel = styled.label`
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--bs-text-dim);
  letter-spacing: 0.1px;
  display: block;
  margin-bottom: 6px;
`;

const bsFieldShape = css`
  width: 100%;
  height: 42px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1.5px solid var(--bs-rule);
  background: var(--bs-body);
  color: var(--bs-text);
  font-family: var(--bs-sans);
  font-size: 0.84rem;
  letter-spacing: -0.1px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &::placeholder {
    color: var(--bs-text-mute);
  }

  &:focus {
    outline: none;
    border-color: var(--bs-accent);
    box-shadow: 0 0 0 3px var(--bs-accent-tint);
  }
`;

export const BsInput = styled.input`
  ${bsFieldShape}
  ${(p) => p.$hasError && css`
    border-color: var(--bs-danger);
    &:focus { box-shadow: 0 0 0 3px rgba(168, 68, 44, 0.15); }
  `}
`;

export const BsTextArea = styled.textarea`
  ${bsFieldShape}
  height: auto;
  min-height: 96px;
  padding: 10px 12px;
  resize: vertical;
  ${(p) => p.$hasError && css`
    border-color: var(--bs-danger);
    &:focus { box-shadow: 0 0 0 3px rgba(168, 68, 44, 0.15); }
  `}
`;

export const BsSelect = styled.select`
  ${bsFieldShape}
  appearance: none;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234A5C52' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 32px;
  ${(p) => p.$hasError && css`border-color: var(--bs-danger);`}
`;

export const BsFieldError = styled.div`
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--bs-danger);
  margin-top: 4px;
`;

export const BsFieldHint = styled.div`
  font-size: 0.7rem;
  color: var(--bs-text-mute);
  margin-top: 4px;
`;

export const BsMono = styled.span`
  font-family: var(--bs-mono);
  letter-spacing: 0.4px;
  text-transform: uppercase;
`;

export const BsDivider = styled.div`
  height: 1px;
  background: var(--bs-rule-soft);
  margin: ${(p) => p.$margin || '1rem 0'};
`;

export const BsCheckbox = styled.label`
  display: inline-flex;
  align-items: ${(p) => p.$top ? 'flex-start' : 'center'};
  gap: 0.55rem;
  font-size: 0.84rem;
  color: var(--bs-text);
  line-height: 1.5;
  cursor: pointer;

  input[type="checkbox"] {
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 4px;
    border: 1.5px solid var(--bs-rule);
    background: var(--bs-panel);
    cursor: pointer;
    flex-shrink: 0;
    position: relative;
    margin: 0;
    transition: background 0.15s, border-color 0.15s;
  }

  input[type="checkbox"]:checked {
    background: var(--bs-accent);
    border-color: var(--bs-accent);
  }

  input[type="checkbox"]:checked::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23F0FAF5' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 12l5 5L20 6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: center;
  }

  input[type="checkbox"]:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--bs-accent-tint);
  }
`;
