import { fireEvent, render, screen } from '@testing-library/react';
import CollectionQrScanner from '../CollectionQrScanner';

describe('CollectionQrScanner', () => {
  it('keeps the camera instructions collapsed until scan is requested', () => {
    const originalSecureContext = window.isSecureContext;
    const originalBarcodeDetector = window.BarcodeDetector;

    try {
      Object.defineProperty(window, 'isSecureContext', {
        configurable: true,
        value: false,
      });
      window.BarcodeDetector = undefined;

      render(<CollectionQrScanner />);

      expect(screen.queryByText(/allow camera access, then hold the collection qr inside the frame\./i)).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /start scanner/i }));

      expect(screen.getByText(/allow camera access, then hold the collection qr inside the frame\./i)).toBeInTheDocument();
    } finally {
      if (originalSecureContext === undefined) {
        delete window.isSecureContext;
      } else {
        Object.defineProperty(window, 'isSecureContext', {
          configurable: true,
          value: originalSecureContext,
        });
      }

      if (originalBarcodeDetector === undefined) {
        delete window.BarcodeDetector;
      } else {
        window.BarcodeDetector = originalBarcodeDetector;
      }
    }
  });
});
