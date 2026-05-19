import React, { useEffect, useRef, useCallback } from 'react';
import { Download } from 'lucide-react';
import styled from 'styled-components';
import { renderPayNowQrToContainer } from '../utils/qr';

const QRContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.1rem;
  background: var(--bs-panel);
  border-radius: 12px;
  border: 1px solid var(--bs-rule-soft);
`;

const QRTitle = styled.h3`
  margin: 0;
  color: var(--bs-text-mute);
  font-family: var(--bs-sans);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  text-align: center;
`;

const QRCanvasWrapper = styled.div`
  canvas {
    border-radius: 8px;
    background: #fff;
  }
`;

const SaveButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--bs-panel);
  border: 1px solid var(--bs-rule);
  border-radius: 8px;
  padding: 0.45rem 0.85rem;
  font-family: var(--bs-sans);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: -0.1px;
  color: var(--bs-text);
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;

  &:hover {
    border-color: var(--bs-accent);
    color: var(--bs-accent-dim);
    background: var(--bs-panel-hi);
  }
`;

const PaymentInfo = styled.div`
  text-align: center;
  font-size: 0.84rem;
  color: var(--bs-text);
  max-width: 270px;
`;

const UENInfo = styled.div`
  background: var(--bs-body);
  padding: 0.75rem;
  border-radius: 8px;
  margin-top: 0.5rem;
  border: 1px solid var(--bs-rule-soft);
`;

const UENLabel = styled.div`
  font-family: var(--bs-mono);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--bs-text-mute);
  margin-bottom: 0.25rem;
`;

const UENNumber = styled.div`
  font-family: var(--bs-mono);
  font-weight: 600;
  color: var(--bs-text);
  font-size: 0.95rem;
  letter-spacing: 0.4px;
`;

const PayNowQR = ({ amount, referenceId, donation = 0 }) => {
  const containerRef = useRef(null);

  // Generate a temporary reference if none provided
  const finalReferenceId = referenceId || `TEMP-${Date.now()}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    renderPayNowQrToContainer(container, {
      amount,
      donation,
      referenceId: finalReferenceId,
    }).catch((error) => {
      console.error('Error generating QR code:', error);
    });

    return () => {
      container.innerHTML = '';
    };
  }, [amount, finalReferenceId, donation]);

  const totalAmount = parseFloat(amount) + parseFloat(donation);

  const handleSave = useCallback(() => {
    const canvas = containerRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `paynow-${finalReferenceId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [finalReferenceId]);

  return (
    <QRContainer>
      <QRTitle>PayNow QR Code</QRTitle>
      <QRCanvasWrapper ref={containerRef} />
      <PaymentInfo>
        <div>
          <strong>Amount: ${totalAmount.toFixed(2)}</strong>
        </div>
        {donation > 0 && (
          <div style={{ fontSize: '0.78rem', color: 'var(--bs-text-mute)', marginTop: '0.25rem' }}>
            (includes ${donation.toFixed(2)} donation)
          </div>
        )}
        <UENInfo>
          <UENLabel>UEN Number</UENLabel>
          <UENNumber>T23SS0038A</UENNumber>
        </UENInfo>
      </PaymentInfo>
      <SaveButton onClick={handleSave}>
        <Download size={14} />
        Save QR Code
      </SaveButton>
    </QRContainer>
  );
};

export default PayNowQR;
