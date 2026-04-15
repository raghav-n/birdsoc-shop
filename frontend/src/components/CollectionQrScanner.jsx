import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { Camera, CameraOff, ScanLine } from 'lucide-react';
import { parseCollectionQrValue } from '../utils/collectionQr';

const ScannerCard = styled.div`
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 1rem 1.25rem;
`;

const Header = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.9rem;

  @media (max-width: 640px) {
    flex-direction: column;
  }
`;

const TitleWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const IconWrap = styled.div`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(23, 54, 43, 0.08);
  color: #17362b;
  flex-shrink: 0;
`;

const Title = styled.h2`
  font-size: 1rem;
  margin: 0;
`;

const Description = styled.p`
  margin: 0.15rem 0 0;
  font-size: 0.9rem;
  color: #666;
`;

const Actions = styled.div`
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
`;

const ActionButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.55rem 0.85rem;
  border-radius: 999px;
  border: 1px solid ${props => props.$secondary ? '#d0d0d0' : '#17362b'};
  background: ${props => props.$secondary ? '#fff' : '#17362b'};
  color: ${props => props.$secondary ? '#17362b' : '#fff'};
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.65;
    cursor: wait;
  }
`;

const Viewport = styled.div`
  position: relative;
  overflow: hidden;
  min-height: 260px;
  border-radius: 16px;
  border: 1px solid #dcdcdc;
  background:
    linear-gradient(180deg, rgba(23, 54, 43, 0.08), rgba(23, 54, 43, 0.02)),
    #f8faf8;
`;

const Video = styled.video`
  width: 100%;
  min-height: 260px;
  display: block;
  object-fit: cover;
  background: #0f1714;
`;

const Placeholder = styled.div`
  min-height: 260px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  padding: 1.5rem;
  text-align: center;
  color: #4a4a4a;
`;

const ScanFrame = styled.div`
  position: absolute;
  inset: 50% auto auto 50%;
  width: min(64vw, 220px);
  height: min(64vw, 220px);
  max-width: calc(100% - 2rem);
  max-height: calc(100% - 2rem);
  transform: translate(-50%, -50%);
  border: 2px solid rgba(255, 255, 255, 0.92);
  border-radius: 18px;
  box-shadow: 0 0 0 999px rgba(10, 16, 13, 0.2);
  pointer-events: none;

  &::after {
    content: '';
    position: absolute;
    left: 10%;
    right: 10%;
    top: 18%;
    height: 2px;
    background: rgba(121, 255, 183, 0.95);
    box-shadow: 0 0 18px rgba(121, 255, 183, 0.85);
    animation: scanner-sweep 2.2s linear infinite;
  }

  @keyframes scanner-sweep {
    0% {
      transform: translateY(0);
    }

    50% {
      transform: translateY(120px);
    }

    100% {
      transform: translateY(0);
    }
  }
`;

const StatusRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-top: 0.85rem;
`;

const StatusPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.7rem;
  border-radius: 999px;
  font-size: 0.82rem;
  background: ${props => props.$tone === 'error' ? '#fff1f0' : '#eef7f1'};
  color: ${props => props.$tone === 'error' ? '#b42318' : '#166534'};
  border: 1px solid ${props => props.$tone === 'error' ? '#f0c4bf' : '#c7ead4'};
`;

const getCameraSupportError = () => {
  if (typeof window === 'undefined') {
    return 'Camera scanning is only available in the browser.';
  }

  if (!window.isSecureContext) {
    return 'Camera scanning requires HTTPS or localhost.';
  }

  if (typeof window.BarcodeDetector === 'undefined') {
    return 'This browser does not support in-page QR scanning.';
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    return 'Camera access is not available on this device.';
  }

  return '';
};

const CollectionQrScanner = ({
  title = 'Scan collection QR',
  buttonLabel = 'Start scanner',
  onScan,
}) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const pollTimeoutRef = useRef(null);
  const scanInFlightRef = useRef(false);
  const handledRef = useRef(false);

  const [isStarting, setIsStarting] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [lastOrderNumber, setLastOrderNumber] = useState('');
  const [videoReady, setVideoReady] = useState(false);

  const clearPendingPoll = useCallback(() => {
    if (pollTimeoutRef.current) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const stopScanner = useCallback(() => {
    clearPendingPoll();
    scanInFlightRef.current = false;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
    setIsStarting(false);
    setVideoReady(false);
  }, [clearPendingPoll]);

  const handleDetectedValue = useCallback(async (rawValue) => {
    const parsed = parseCollectionQrValue(rawValue);
    stopScanner();

    if (!parsed) {
      handledRef.current = false;
      setError('This QR code is not a collection QR code.');
      return;
    }

    try {
      await onScan?.(parsed);
      setError('');
      setLastOrderNumber(parsed.number);
    } catch (scanError) {
      handledRef.current = false;
      setError(scanError?.message || 'The QR code was scanned, but the order could not be opened.');
    }
  }, [onScan, stopScanner]);

  const pollForCode = useCallback(async () => {
    if (!isScanning || !videoReady || handledRef.current || scanInFlightRef.current || !videoRef.current || !detectorRef.current) {
      return;
    }

    if (videoRef.current.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      pollTimeoutRef.current = window.setTimeout(pollForCode, 180);
      return;
    }

    scanInFlightRef.current = true;

    try {
      const detectedCodes = await detectorRef.current.detect(videoRef.current);
      const rawValue = detectedCodes.find(code => code.rawValue)?.rawValue;

      if (rawValue) {
        handledRef.current = true;
        await handleDetectedValue(rawValue);
        return;
      }
    } catch (scanError) {
      console.error('QR scan failed:', scanError);
      setError('QR scanning failed. Please try again.');
      handledRef.current = false;
      stopScanner();
      return;
    } finally {
      scanInFlightRef.current = false;
    }

    pollTimeoutRef.current = window.setTimeout(pollForCode, 180);
  }, [handleDetectedValue, isScanning, stopScanner, videoReady]);

  const startScanner = useCallback(async () => {
    const supportError = getCameraSupportError();
    if (supportError) {
      setError(supportError);
      return;
    }

    setError('');
    setIsStarting(true);
    handledRef.current = false;
    setLastOrderNumber('');

    try {
      detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
        },
      });

      streamRef.current = stream;
      setIsScanning(true);
      setIsStarting(false);
    } catch (startError) {
      console.error('Unable to start QR scanner:', startError);
      setError(startError?.name === 'NotAllowedError'
        ? 'Camera access was denied.'
        : 'Unable to start the camera scanner.');
      handledRef.current = false;
      stopScanner();
    }
  }, [pollForCode, stopScanner]);

  useEffect(() => {
    if (!isScanning || !streamRef.current || !videoRef.current) {
      return undefined;
    }

    let cancelled = false;

    const bindVideoStream = async () => {
      try {
        const video = videoRef.current;
        if (!video) {
          return;
        }

        video.srcObject = streamRef.current;
        await video.play();

        if (cancelled) {
          return;
        }

        setVideoReady(true);
        pollTimeoutRef.current = window.setTimeout(pollForCode, 120);
      } catch (playError) {
        console.error('Unable to play camera preview:', playError);
        setError('Unable to display the camera preview.');
        stopScanner();
      }
    };

    bindVideoStream();

    return () => {
      cancelled = true;
    };
  }, [isScanning, pollForCode, stopScanner]);

  useEffect(() => () => {
    stopScanner();
  }, [stopScanner]);

  return (
    <ScannerCard>
      <Header>
        <TitleWrap>
          <IconWrap>
            <ScanLine size={18} />
          </IconWrap>
          <div>
            <Title>{title}</Title>
          </div>
        </TitleWrap>

        <Actions>
          <ActionButton type="button" onClick={startScanner} disabled={isStarting || isScanning}>
            <Camera size={16} />
            {isStarting ? 'Starting…' : buttonLabel}
          </ActionButton>
          {(isScanning || isStarting) && (
            <ActionButton type="button" $secondary onClick={stopScanner}>
              <CameraOff size={16} />
              Stop
            </ActionButton>
          )}
        </Actions>
      </Header>

      <Viewport>
        {isScanning ? (
          <>
            <Video ref={videoRef} muted playsInline autoPlay />
            <ScanFrame aria-hidden="true" />
          </>
        ) : (
          <Placeholder>
            <ScanLine size={30} />
            <div>Allow camera access, then hold the collection QR inside the frame.</div>
          </Placeholder>
        )}
      </Viewport>

      <StatusRow>
        {error && <StatusPill $tone="error">{error}</StatusPill>}
        {lastOrderNumber && <StatusPill>Opened order #{lastOrderNumber}</StatusPill>}
      </StatusRow>
    </ScannerCard>
  );
};

export default CollectionQrScanner;
