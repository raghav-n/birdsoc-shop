/**
 * Utility functions to handle content that was marked safe in Django templates
 */
import DOMPurify from 'dompurify';

/**
 * Safely render HTML content that was previously marked as safe in Django
 * @param {string} content - The HTML content to render
 * @param {Object} options - Configuration options
 * @returns {string} Sanitized HTML string
 */
export const renderSafeContent = (content, options = {}) => {
  if (!content) return '';

  const defaultConfig = {
    ALLOWED_TAGS: [
      'a', 'strong', 'b', 'em', 'i', 'u', 'p', 'br', 'span', 
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
      'div', 'img', 'blockquote'
    ],
    ALLOWED_ATTR: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      '*': ['class', 'style']
    },
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ['target', 'rel'],
    TRANSFORM_ATTRIBUTES: {
      a: function(attributeName, attributeValue) {
        // Add target="_blank" and rel="noopener noreferrer" to external links
        if (attributeName === 'href' && !attributeValue.startsWith('/') && !attributeValue.startsWith('#')) {
          return {
            name: attributeName,
            value: attributeValue,
            attributes: {
              target: '_blank',
              rel: 'noopener noreferrer'
            }
          };
        }
      }
    }
  };

  const config = { ...defaultConfig, ...options };
  return DOMPurify.sanitize(content, config);
};

/**
 * Check if content contains HTML tags
 * @param {string} content - Content to check
 * @returns {boolean} True if content contains HTML
 */
export const containsHTML = (content) => {
  if (!content) return false;
  return /<[^>]*>/g.test(content);
};

/**
 * Extract plain text from HTML content
 * @param {string} htmlContent - HTML content
 * @returns {string} Plain text content
 */
export const extractPlainText = (htmlContent) => {
  if (!htmlContent) return '';
  
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = renderSafeContent(htmlContent);
  return tempDiv.textContent || tempDiv.innerText || '';
};

/**
 * Handle offer description rendering (from Django templates)
 * These were marked safe for HTML formatting
 */
export const renderOfferDescription = (description) => {
  return renderSafeContent(description);
};

/**
 * Handle shipping method descriptions (from Django templates)
 * These were marked safe for HTML formatting
 */
export const renderShippingMethodDescription = (description) => {
  return renderSafeContent(description);
};

/**
 * Handle alert/toast messages that may contain HTML
 * These were conditionally marked safe in Django templates
 */
export const renderAlertMessage = (message, isSafe = false) => {
  if (!isSafe) {
    return message; // Return as plain text
  }
  return renderSafeContent(message);
};

/**
 * Handle email template content
 * These were marked safe in Django email templates
 */
export const renderEmailContent = (content) => {
  return renderSafeContent(content, {
    // More permissive for email content
    ALLOWED_TAGS: [
      'a', 'strong', 'b', 'em', 'i', 'u', 'p', 'br', 'span', 
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
      'div', 'img', 'blockquote', 'table', 'tr', 'td', 'th', 'tbody', 'thead'
    ],
    ALLOWED_ATTR: {
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      table: ['border', 'cellpadding', 'cellspacing'],
      '*': ['class', 'style', 'align']
    }
  });
};

/**
 * Form field labels that contain HTML (like PDPA agreement)
 */
export const renderFormLabel = (label) => {
  return renderSafeContent(label, {
    ALLOWED_TAGS: ['a', 'strong', 'b', 'em', 'i', 'u', 'span'],
    ALLOWED_ATTR: {
      a: ['href', 'target', 'rel']
    }
  });
};

/**
 * Sanitize plain text content to prevent XSS
 * @param {string} text - Text content to sanitize
 * @returns {string} Sanitized text content
 */
export const sanitizeText = (text) => {
  if (!text) return '';
  
  // Strip all HTML tags and entities, return only plain text
  return DOMPurify.sanitize(text, { 
    ALLOWED_TAGS: [], 
    ALLOWED_ATTR: {},
    KEEP_CONTENT: true 
  });
};
