import React, { useEffect, useRef, useCallback } from 'react';
import { Download } from 'lucide-react';
import styled from 'styled-components';

const QRContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e9ecef;
`;

const QRTitle = styled.h3`
  margin: 0;
  color: var(--dark);
  font-size: 1.1rem;
  text-align: center;
`;

const QRCanvasWrapper = styled.div`
  canvas {
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

const SaveButton = styled.button`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 0.4rem 0.8rem;
  font-size: 0.85rem;
  color: #555;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--link-text);
    color: var(--link-text);
    background: rgba(0, 0, 0, 0.02);
  }
`;

const PaymentInfo = styled.div`
  text-align: center;
  font-size: 0.9rem;
  color: #666;
  max-width: 270px;
`;

const UENInfo = styled.div`
  background: #f8f9fa;
  padding: 0.75rem;
  border-radius: 6px;
  margin-top: 0.5rem;
  border: 1px solid #e9ecef;
`;

const UENLabel = styled.div`
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.25rem;
`;

const UENNumber = styled.div`
  font-weight: 600;
  color: var(--dark);
  font-family: monospace;
  font-size: 1rem;
`;

const PayNowQR = ({ amount, referenceId, donation = 0 }) => {
  const containerRef = useRef(null);

  // Generate a temporary reference if none provided
  const finalReferenceId = referenceId || `TEMP-${Date.now()}`;

  useEffect(() => {
    const container = containerRef.current;

    const loadQR = () => {
      try {
        // Check if libraries are loaded
        if (typeof window.PaynowQR === 'undefined' || typeof window.QrCodeWithLogo === 'undefined') {
          console.error('PayNow QR libraries not loaded');
          return;
        }

        const totalAmount = parseFloat(amount) + parseFloat(donation);

        // Create a fresh canvas to avoid stacked QR codes from concurrent renders
        container.innerHTML = '';
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);

        const QRstring = new window.PaynowQR({
          uen: 'T23SS0038A',
          amount: totalAmount,
          editable: false,
          refNumber: finalReferenceId,
        }).output();

        new window.QrCodeWithLogo({
          canvas: canvas,
          content: QRstring,
          width: 270,
          logo: {
            src: "/img/paynow-logo.png",
            borderWidth: 1,
          },
          nodeQrCodeOptions: {
            color: {
              dark: "#731B6C",
              light: "#ffffff",
            },
            errorCorrectionLevel: "H"
          }
        });
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };

    // Load scripts if not already loaded
    const loadScripts = async () => {
      if (typeof window.PaynowQR === 'undefined') {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/js/lib/paynowqr.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      if (typeof window.QrCodeWithLogo === 'undefined') {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/js/qrcode-with-logos.min.js';
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      loadQR();
    };

    loadScripts();

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
          <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
            (includes ${donation.toFixed(2)} donation)
          </div>
        )}
        <UENInfo>
          <UENLabel>UEN Number</UENLabel>
          <UENNumber>T23SS0038A</UENNumber>
        </UENInfo>
        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
          Scan this QR code with your banking app to make payment via PayNow
        </div>
      </PaymentInfo>
      <SaveButton onClick={handleSave}>
        <Download size={14} />
        Save QR Code
      </SaveButton>
    </QRContainer>
  );
};

export default PayNowQR;
