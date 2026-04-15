const loadScript = (src) => new Promise((resolve, reject) => {
  const existing = document.querySelector(`script[src="${src}"]`);
  if (existing) {
    if (existing.dataset.loaded === 'true') {
      resolve();
      return;
    }
    existing.addEventListener('load', resolve, { once: true });
    existing.addEventListener('error', reject, { once: true });
    return;
  }

  const script = document.createElement('script');
  script.src = src;
  script.addEventListener('load', () => {
    script.dataset.loaded = 'true';
    resolve();
  }, { once: true });
  script.addEventListener('error', reject, { once: true });
  document.head.appendChild(script);
});

export const ensureQrCodeWithLogo = async () => {
  if (typeof window.QrCodeWithLogo === 'undefined') {
    await loadScript('/js/qrcode-with-logos.min.js');
  }
  return window.QrCodeWithLogo;
};

export const ensurePayNowQrLibraries = async () => {
  if (typeof window.PaynowQR === 'undefined') {
    await loadScript('/js/lib/paynowqr.min.js');
  }

  const QrCodeWithLogo = await ensureQrCodeWithLogo();
  return {
    PaynowQR: window.PaynowQR,
    QrCodeWithLogo,
  };
};

export const renderQrCodeToCanvas = async (canvas, content, options = {}) => {
  const QrCodeWithLogo = await ensureQrCodeWithLogo();
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);

  return new QrCodeWithLogo({
    canvas,
    content,
    ...options,
  });
};

export const renderPayNowQrToContainer = async (container, { amount, donation = 0, referenceId }) => {
  const { PaynowQR } = await ensurePayNowQrLibraries();
  const totalAmount = parseFloat(amount) + parseFloat(donation);

  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  const content = new PaynowQR({
    uen: 'T23SS0038A',
    amount: totalAmount,
    editable: false,
    refNumber: referenceId,
  }).output();

  await renderQrCodeToCanvas(canvas, content, {
    width: 270,
    logo: {
      src: '/img/paynow-logo.png',
      borderWidth: 1,
    },
    nodeQrCodeOptions: {
      color: {
        dark: '#731B6C',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    },
  });

  return canvas;
};
