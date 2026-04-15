// Format currency values
export const formatCurrency = (amount, currency = 'SGD') => {
  if (amount === null || amount === undefined) return '--';
  
  return new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

// Format date
export const formatDate = (date) => {
  if (!date) return '--';
  
  return new Intl.DateTimeFormat('en-SG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
};

// Debounce function
export const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
};

// Get image URL
export const getImageUrl = (imagePath, baseUrl = '') => {
  if (!imagePath) return null;
  if (imagePath.startsWith('http')) return imagePath;
  return `${baseUrl}${imagePath}`;
};

// Check if product is in stock
export const isProductInStock = (product) => {
  return product?.stock?.is_available && product?.stock?.num_in_stock > 0;
};

// Get stock status text
export const getStockStatus = (product) => {
  if (!product?.stock) return 'Unknown';
  
  const { is_available, num_in_stock, low_stock_threshold } = product.stock;
  
  if (!is_available || num_in_stock <= 0) {
    return 'Out of Stock';
  }
  
  if (num_in_stock <= low_stock_threshold) {
    return 'Low Stock';
  }
  
  return 'In Stock';
};

// Handle file download
export const downloadFile = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
