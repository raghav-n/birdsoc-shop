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

  // Configure DOMPurify
  const config = {
    ALLOWED_TAGS: allowedTags,
    ALLOWED_ATTR: allowedAttributes,
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    // Add target="_blank" and rel="noopener noreferrer" to external links
    ADD_ATTR: ['target', 'rel'],
    TRANSFORM_ATTRIBUTES: {
      a: function(attributeName, attributeValue) {
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

  const sanitizedHtml = DOMPurify.sanitize(html, config);
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
