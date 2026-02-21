import React from 'react';
import DOMPurify from 'dompurify';

/**
 * SafeHtml component for rendering sanitized HTML content
 * This replaces Django's |safe filter functionality
 */
const SafeHtml = ({ 
  html, 
  tag = 'div', 
  className = '', 
  style = {},
  allowedTags = [
    'a', 'strong', 'b', 'em', 'i', 'u', 'p', 'br', 'span', 
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
    'div', 'img', 'blockquote'
  ],
  allowedAttributes = {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    '*': ['class', 'style']
  },
  ...props
}) => {
  if (!html) return null;

  // Build flat list of allowed attributes for DOMPurify
  const attrList = new Set();
  Object.values(allowedAttributes).forEach(attrs => {
    attrs.forEach(a => attrList.add(a));
  });

  // Configure DOMPurify
  const config = {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: [...attrList],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    ADD_ATTR: ['target', 'rel'],
  };

  // Add target/rel to external links after sanitization
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') || '';
      if (href && !href.startsWith('/') && !href.startsWith('#')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
  });

  const sanitizedHtml = DOMPurify.sanitize(html, config);

  DOMPurify.removeAllHooks();
  const Component = tag;

  return (
    <Component
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      {...props}
    />
  );
};

export default SafeHtml;
