import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';
import { renderQrCodeToCanvas } from '../utils/qr';

const QRCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
`;

const QRCanvasWrap = styled.div`
  min-height: 240px;
  display: flex;
  align-items: center;
  justify-content: center;

  canvas {
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
`;

const CodeLabel = styled.code`
  display: inline-block;
  padding: 0.35rem 0.5rem;
  border-radius: 6px;
  background: #f5f5f5;
  color: var(--dark);
  font-size: 0.85rem;
  word-break: break-all;
`;

const CollectionQR = ({ content, orderNumber }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const renderQr = async () => {
      if (!content || !canvasRef.current) {
        return;
      }

      try {
        await renderQrCodeToCanvas(canvasRef.current, content, {
          width: 240,
          nodeQrCodeOptions: {
            color: {
              dark: '#17362b',
              light: '#ffffff',
            },
            errorCorrectionLevel: 'H',
          },
        });
        if (cancelled || !canvasRef.current) {
          return;
        }
      } catch (error) {
        console.error('Failed to render collection QR code:', error);
      }
    };

    renderQr();

    return () => {
      cancelled = true;
    };
  }, [content]);

  return (
    <QRCard>
      <QRCanvasWrap>
        <canvas ref={canvasRef} width="240" height="240" />
      </QRCanvasWrap>
      <CodeLabel>Order {orderNumber}</CodeLabel>
    </QRCard>
  );
};

export default CollectionQR;
