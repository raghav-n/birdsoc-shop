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

// Format datetime
export const formatDateTime = (date) => {
  if (!date) return '--';
  
  return new Intl.DateTimeFormat('en-SG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

// Truncate text
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Validate email
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generate slug from text
export const generateSlug = (text) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .trim();
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

// Calculate order total with donation
export const calculateOrderTotal = (subtotal, donation = 0) => {
  return subtotal + donation;
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

// Get order status color
export const getOrderStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'pending payment confirmation':
      return 'warning';
    case 'payment confirmed':
    case 'processing':
      return 'info';
    case 'shipped':
    case 'ready for collection':
      return 'success';
    case 'delivered':
    case 'collected':
      return 'success';
    case 'cancelled':
    case 'refunded':
      return 'danger';
    default:
      return 'secondary';
  }
};
