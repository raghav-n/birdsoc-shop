import React, { useEffect, useState } from 'react';
import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;
const slideUp = keyframes`from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); }`;

const Trigger = styled.button`
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: #fff;
  border: 1.5px solid #d1d5db;
  color: var(--text-secondary);
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
  transition: border-color 0.15s, color 0.15s, box-shadow 0.15s;
  &:hover {
    border-color: var(--link-text);
    color: var(--link-text);
    box-shadow: 0 3px 12px rgba(0,0,0,0.15);
  }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  animation: ${fadeIn} 0.15s ease;
`;

const Modal = styled.div`
  background: #fff;
  border-radius: 10px;
  width: 100%;
  max-width: 480px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  animation: ${slideUp} 0.15s ease;
`;

const ModalHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem 0.75rem;
  border-bottom: 1px solid #f3f4f6;
`;

const ModalTitle = styled.h2`
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  font-size: 1.1rem;
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  line-height: 1;
  &:hover { background: #f3f4f6; color: var(--text-primary); }
`;

const ModalBody = styled.div`
  padding: 1rem 1.25rem 1.25rem;
  font-size: 0.875rem;
  color: var(--text-primary);
  line-height: 1.6;

  h3 {
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-secondary);
    margin: 1rem 0 0.4rem;
    &:first-child { margin-top: 0; }
  }

  ul {
    margin: 0;
    padding-left: 1.2rem;
  }

  li {
    margin-bottom: 0.3rem;
  }

  p {
    margin: 0 0 0.5rem;
  }

  strong {
    font-weight: 600;
    color: var(--text-primary);
  }
`;

export default function HelpModal({ title = 'How to use this page', children }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <Trigger onClick={() => setOpen(true)} title="How to use this page" aria-label="Help">
        ?
      </Trigger>
      {open && (
        <Overlay onClick={() => setOpen(false)}>
          <Modal onClick={e => e.stopPropagation()}>
            <ModalHeader>
              <ModalTitle>{title}</ModalTitle>
              <CloseBtn onClick={() => setOpen(false)} aria-label="Close">✕</CloseBtn>
            </ModalHeader>
            <ModalBody>{children}</ModalBody>
          </Modal>
        </Overlay>
      )}
    </>
  );
}
