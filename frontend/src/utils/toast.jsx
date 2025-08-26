import toast from 'react-hot-toast';
import React from 'react';
import SafeHtml from '../components/SafeHtml';
import { renderAlertMessage } from '../utils/safeContent';

/**
 * Enhanced toast notifications that can handle HTML content marked as safe
 * This replaces the Django template's conditional |safe filter functionality
 */

const ToastMessage = ({ message, isSafe = false }) => {
  if (isSafe) {
    return (
      <SafeHtml 
        html={renderAlertMessage(message, true)}
        tag="span"
        allowedTags={['a', 'strong', 'b', 'em', 'i', 'u', 'span']}
        allowedAttributes={{
          a: ['href', 'target', 'rel'],
          '*': []
        }}
      />
    );
  }
  return <span>{message}</span>;
};

export const showToast = {
  success: (message, options = {}) => {
    const { isSafe = false, ...toastOptions } = options;
    return toast.success(
      (t) => <ToastMessage message={message} isSafe={isSafe} />,
      toastOptions
    );
  },

  error: (message, options = {}) => {
    const { isSafe = false, ...toastOptions } = options;
    return toast.error(
      (t) => <ToastMessage message={message} isSafe={isSafe} />,
      toastOptions
    );
  },

  info: (message, options = {}) => {
    const { isSafe = false, ...toastOptions } = options;
    return toast(
      (t) => <ToastMessage message={message} isSafe={isSafe} />,
      { icon: 'ℹ️', ...toastOptions }
    );
  },

  warning: (message, options = {}) => {
    const { isSafe = false, ...toastOptions } = options;
    return toast(
      (t) => <ToastMessage message={message} isSafe={isSafe} />,
      { icon: '⚠️', ...toastOptions }
    );
  },

  custom: (message, options = {}) => {
    const { isSafe = false, ...toastOptions } = options;
    return toast.custom(
      (t) => (
        <div className={`toast-message ${t.visible ? 'entering' : 'exiting'}`}>
          <ToastMessage message={message} isSafe={isSafe} />
        </div>
      ),
      toastOptions
    );
  }
};

/**
 * Process Django-style flash messages that may have 'safe' in their tags
 * This mimics the Django template logic: {% if 'safe' in message.tags %}{{ message|safe }}{% else %}{{ message }}{% endif %}
 */
export const processFlashMessages = (messages) => {
  return messages.map(message => {
    const isSafe = message.tags && message.tags.includes('safe');
    const variant = getVariantFromTags(message.tags);
    
    return {
      ...message,
      isSafe,
      variant,
      display: () => {
        switch (variant) {
          case 'success':
            return showToast.success(message.message, { isSafe });
          case 'error':
          case 'danger':
            return showToast.error(message.message, { isSafe });
          case 'warning':
            return showToast.warning(message.message, { isSafe });
          case 'info':
          default:
            return showToast.info(message.message, { isSafe });
        }
      }
    };
  });
};

const getVariantFromTags = (tags) => {
  if (!tags) return 'info';
  
  if (tags.includes('success')) return 'success';
  if (tags.includes('error') || tags.includes('danger')) return 'error';
  if (tags.includes('warning')) return 'warning';
  return 'info';
};

export default showToast;
