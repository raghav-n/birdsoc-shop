const gtag = (...args) => {
  if (typeof window.gtag === 'function') {
    window.gtag(...args);
  }
};

export const trackPageView = (path) => {
  gtag('event', 'page_view', { page_path: path });
};

export const trackViewItem = (product, selectedChild = null) => {
  const price = selectedChild?.price || product.price;
  gtag('event', 'view_item', {
    currency: price?.currency || 'SGD',
    value: parseFloat(price?.incl_tax || 0),
    items: [{
      item_id: String(selectedChild?.id || product.id),
      item_name: product.title,
      price: parseFloat(price?.incl_tax || 0),
      quantity: 1,
    }],
  });
};

export const trackAddToCart = (product, selectedChild, quantity, price) => {
  gtag('event', 'add_to_cart', {
    currency: price?.currency || 'SGD',
    value: parseFloat(price?.incl_tax || 0) * quantity,
    items: [{
      item_id: String(selectedChild?.id || product.id),
      item_name: product.title,
      price: parseFloat(price?.incl_tax || 0),
      quantity,
    }],
  });
};

export const trackRemoveFromCart = (line) => {
  const unitPrice = parseFloat(line.unit_price_incl_tax || 0);
  gtag('event', 'remove_from_cart', {
    currency: 'SGD',
    value: unitPrice * (line.quantity || 1),
    items: [{
      item_id: String(line.product?.id || line.product_id || ''),
      item_name: line.product_title || line.product?.title || line.description || '',
      price: unitPrice,
      quantity: line.quantity || 1,
    }],
  });
};

export const trackBeginCheckout = (cart) => {
  const items = (cart.lines || []).map(line => ({
    item_id: String(line.product?.id || line.product_id || ''),
    item_name: line.product_title || line.product?.title || '',
    price: parseFloat(line.unit_price_incl_tax || 0),
    quantity: line.quantity || 1,
  }));
  gtag('event', 'begin_checkout', {
    currency: 'SGD',
    value: parseFloat(cart.total_excl_tax || 0),
    items,
  });
};

export const trackPurchase = (orderNumber, total, cartLines, shippingCost) => {
  const items = (cartLines || []).map(line => ({
    item_id: String(line.product?.id || line.product_id || ''),
    item_name: line.product_title || line.product?.title || line.description || '',
    price: parseFloat(line.unit_price_incl_tax || 0),
    quantity: line.quantity || 1,
  }));
  gtag('event', 'purchase', {
    transaction_id: String(orderNumber),
    affiliation: 'BirdSoc Shop',
    value: parseFloat(total || 0),
    currency: 'SGD',
    shipping: parseFloat(shippingCost || 0),
    items,
  });
};
