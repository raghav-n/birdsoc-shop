/**
 * Handles automatic application of site offers and calculation logic for the onsite purchase page
 */

// Track the current state
let currentTotal = 0;
let currentDiscount = 0;
let currentVoucherCode = '';
let siteOffersApplied = false;
let isCalculating = false;

$(document).ready(function() {
    // Update totals when quantities change
    $('.quantity-input').on('change', function() {
        updateTotals();
        
        // Auto-update QR code if previously generated
        if (qrCodeGenerated) {
            updateQRCode();
        }
    });

    // Initial calculation on page load - but don't show loading state for initial load
    calculateInitialTotals();

    // Register click handler for the generate QR button
    $('#generate-qr-btn').on('click', function(e) {
        e.preventDefault();
        
        // Check if we're in the middle of a calculation or if the button is disabled
        if (isCalculating || $(this).hasClass('btn-processing')) {
            return false;
        }
        
        // Check if at least one product is selected
        let selectedProducts = validateSelection();
        if (!selectedProducts) {
            return false;
        }
        
        // Apply site offers and voucher (if any) before generating QR
        applySiteOffers(function() {
            // Show payment section
            $('#payment-section').show();
            
            // Generate QR code with the final total
            let finalTotal = parseFloat($('#total-amount').text().replace('$', ''));
            let reference = $('input[name="reference_id"]').val();
            
            // Update payment instructions display with current total
            $('#payment-amount').text(finalTotal.toFixed(2));
            
            // Generate QR code with updated amount
            generateQRCode(finalTotal, reference);
            
            // Mark QR code as generated
            qrCodeGenerated = true;
        });
    });

    // Handle voucher/promo code application
    $('#apply-voucher').on('click', function() {
        // Don't allow applying voucher during calculation
        if (isCalculating) {
            return false;
        }
        
        applyVoucher(function() {
            // After voucher is applied, check if we need to update the QR code
            if (qrCodeGenerated) {
                updateQRCode();
            }
        });
    });
    
    // Handle quick voucher buttons
    $('.quick-voucher-btn').on('click', function() {
        // Don't allow applying voucher during calculation
        if (isCalculating) {
            return false;
        }
        
        // Get the code from data-code attribute
        let code = $(this).data('code');
        
        // Fill in the voucher code input
        $('#id_voucher').val(code);
        
        // Apply the voucher
        applyVoucher(function() {
            // Callback after voucher is applied - update QR code if needed
            if (qrCodeGenerated) {
                updateQRCode();
            }
        });
    });

    // Update the form submission handler
    $('#onsite-purchase-form').on('submit', function(e) {
        // Only proceed if it's the confirm order button
        if ($(document.activeElement).attr('name') === 'confirm_order') {
            // Don't allow submission during calculation
            if (isCalculating) {
                e.preventDefault();
                return false;
            }
            
            let selectedProducts = validateSelection();
            if (!selectedProducts) {
                e.preventDefault();
                return false;
            }
            
            // Store current discounts in hidden fields so they can be applied during order creation
            let siteOffersDiscount = 0;
            if (siteOffersApplied && $('#site-offers-row').is(':visible')) {
                siteOffersDiscount = parseFloat($('#site-offers-amount').text().replace('-$', '')) || 0;
            }
            
            let voucherDiscount = 0;
            if ($('#discount-row').is(':visible')) {
                voucherDiscount = parseFloat($('#discount-amount').text().replace('-$', '')) || 0;
            }
            
            // Add hidden fields to store the discount amounts
            $('<input>').attr({
                type: 'hidden',
                name: 'site_offers_discount',
                value: siteOffersDiscount
            }).appendTo($(this));
            
            $('<input>').attr({
                type: 'hidden',
                name: 'voucher_discount',
                value: voucherDiscount
            }).appendTo($(this));
            
            // Also add site offer names if applicable
            if (siteOffersApplied && $('#site-offers-row').is(':visible')) {
                $('<input>').attr({
                    type: 'hidden',
                    name: 'site_offers_description',
                    value: $('#site-offers-description').text()
                }).appendTo($(this));
            }
            
            // Ensure voucher code is included in form submission
            if (currentVoucherCode) {
                $('<input>').attr({
                    type: 'hidden',
                    name: 'voucher_code',
                    value: currentVoucherCode
                }).appendTo($(this));
            }
        }
    });
});

/**
 * Shows the loading overlay for the totals section and disables action buttons
 */
function showLoadingState() {
    isCalculating = true;
    
    // Position the loading overlay to cover from totals to bottom of page
    positionLoadingOverlay();
    
    // Add visual indication that totals are being calculated
    $('tfoot.totals-section').addClass('totals-calculating');
    
    // Show the loading overlay
    $('#totals-loading').addClass('active');
    
    // Disable buttons
    $('#generate-qr-btn, #confirm-order-btn, #apply-voucher, .quick-voucher-btn')
        .addClass('btn-processing')
        .attr('disabled', true);
}

/**
 * Hides the loading overlay for the totals section and re-enables action buttons
 */
function hideLoadingState() {
    isCalculating = false;
    
    // Hide the loading overlay
    $('#totals-loading').removeClass('active');
    
    // Remove visual indication that totals are being calculated
    $('tfoot.totals-section').removeClass('totals-calculating');
    
    // Re-enable buttons
    $('#generate-qr-btn, #apply-voucher, .quick-voucher-btn')
        .removeClass('btn-processing')
        .attr('disabled', false);
        
    // Only enable confirm button if QR code is generated
    if (qrCodeGenerated) {
        $('#confirm-order-btn').removeClass('btn-processing').attr('disabled', false);
    }
}

/**
 * Position the loading overlay to start at the totals section and extend to the bottom
 */
function positionLoadingOverlay() {
    const $tfoot = $('tfoot.totals-section');
    if ($tfoot.length) {
        const tfootPos = $tfoot.offset();
        const tfootHeight = $tfoot.outerHeight();
        const windowHeight = $(window).height();
        const viewportBottom = $(window).scrollTop() + windowHeight;
        
        // Set the overlay to start at the top of the totals section
        $('#totals-loading').css({
            'top': tfootPos.top + 'px',
            'height': (viewportBottom - tfootPos.top) + 'px'
        });
    }
}

// Add window resize handler to reposition overlay if window size changes
$(window).on('resize scroll', function() {
    if (isCalculating) {
        positionLoadingOverlay();
    }
});

/**
 * Apply site offers based on the current cart contents
 * @param {Function} callback - Function to call after offers are applied
 */
function applySiteOffers(callback) {
    let selectedProducts = [];
    
    // Collect all products with quantities > 0
    $('.product-row').each(function() {
        let row = $(this);
        let productId = row.find('.quantity-input').attr('name').replace('quantity_', '');
        let quantity = parseInt(row.find('.quantity-input').val()) || 0;
        let price = parseFloat(row.data('price'));
        
        if (quantity > 0) {
            selectedProducts.push({
                id: productId,
                quantity: quantity,
                price: price
            });
        }
    });
    
    if (selectedProducts.length === 0) {
        // Reset all discount displays
        $('#site-offers-row').hide();
        $('#discount-row').hide();
        $('#total-amount').text('$0.00');
        
        if (typeof callback === 'function') {
            callback();
        }
        return;
    }
    
    // Show loading state
    showLoadingState();
    
    // Make an AJAX request to apply site offers
    $.ajax({
        url: siteOffersUrl,
        method: 'POST',
        data: {
            products: JSON.stringify(selectedProducts),
            voucher: currentVoucherCode,
            csrfmiddlewaretoken: csrfToken
        },
        dataType: 'json',
        success: function(data) {
            // Update display with automatic offers
            if (data.site_offers_applied) {
                siteOffersApplied = true;
                
                // Display the discount information
                if (data.site_offers_discount > 0) {
                    $('#site-offers-row').show();
                    $('#site-offers-amount').text('-$' + data.site_offers_discount.toFixed(2));
                    $('#site-offers-description').text(data.site_offers_description || 'Automatic discount applied');
                } else {
                    $('#site-offers-row').hide();
                }
            } else {
                // Hide site offers discount row if no offers were applied
                $('#site-offers-row').hide();
                siteOffersApplied = false;
            }
            
            // Update the voucher discount if a voucher is applied
            if (data.voucher_discount > 0 && currentVoucherCode) {
                $('#discount-row').show();
                $('#discount-amount').text('-$' + data.voucher_discount.toFixed(2));
            } else if (currentVoucherCode) {
                // If we have a voucher but it doesn't apply any discount,
                // revalidate it by calling the voucher check endpoint
                revalidateVoucher(function() {
                    // Update final total after voucher check
                    updateFinalTotal(data.original_total, data.site_offers_discount, 
                        parseFloat($('#discount-amount').text().replace('-$', '')) || 0);
                    
                    // Hide loading state
                    hideLoadingState();
                    
                    // Call the callback function after processing
                    if (typeof callback === 'function') {
                        callback();
                    }
                });
                return;
            } else {
                $('#discount-row').hide();
            }
            
            // Update the final total with all discounts
            updateFinalTotal(data.original_total, data.site_offers_discount, data.voucher_discount);
            
            // Hide loading state
            hideLoadingState();
            
            // Call the callback function after processing
            if (typeof callback === 'function') {
                callback();
            }
        },
        error: function() {
            console.error('Failed to apply site offers');
            
            // Reset site offers display
            $('#site-offers-row').hide();
            siteOffersApplied = false;
            
            // Hide loading state
            hideLoadingState();
            
            // Call the callback even on error
            if (typeof callback === 'function') {
                callback();
            }
        }
    });
}

/**
 * Update the final total displayed based on subtotal and discounts
 */
function updateFinalTotal(subtotal, siteOffersDiscount, voucherDiscount) {
    let finalTotal = subtotal - siteOffersDiscount - voucherDiscount;
    // Ensure we never go below zero
    finalTotal = Math.max(finalTotal, 0);
    
    $('#total-amount').text('$' + finalTotal.toFixed(2));
    
    // Update payment amount display if QR code is visible
    if ($('#payment-section').is(':visible')) {
        $('#payment-amount').text(finalTotal.toFixed(2));
    }
    
    // Save current discount for later calculations
    currentDiscount = voucherDiscount + siteOffersDiscount;
}

/**
 * Update all totals and apply site offers automatically
 * This function is called when quantities are changed by the user
 */
function updateTotals() {
    let subtotal = 0;
    
    // Calculate subtotal from all products
    $('.product-row').each(function() {
        let price = parseFloat($(this).data('price'));
        let quantity = parseInt($(this).find('.quantity-input').val()) || 0;
        subtotal += price * quantity;
    });
    
    // Update the subtotal display
    $('#subtotal-amount').text('$' + subtotal.toFixed(2));
    
    // Initialize the total to the subtotal
    $('#total-amount').text('$' + subtotal.toFixed(2));
    
    // Track the current total
    currentTotal = subtotal;
    
    // If a voucher is already applied, revalidate it with the updated quantities
    if (currentVoucherCode) {
        revalidateVoucher(function() {
            // After voucher is revalidated, apply site offers
            applySiteOffers();
        });
    } else {
        // No voucher, just apply site offers
        applySiteOffers();
    }
}

/**
 * Revalidate the current voucher code with the updated quantities
 * @param {Function} callback - Function to call after voucher is checked
 */
function revalidateVoucher(callback) {
    // If no voucher is applied, just call the callback
    if (!currentVoucherCode) {
        if (typeof callback === 'function') {
            callback();
        }
        return;
    }
    
    // Get the current selected products
    let selectedProducts = [];
    $('.product-row').each(function() {
        let row = $(this);
        let productId = row.find('.quantity-input').attr('name').replace('quantity_', '');
        let quantity = parseInt(row.find('.quantity-input').val()) || 0;
        
        if (quantity > 0) {
            selectedProducts.push({
                id: productId,
                quantity: quantity
            });
        }
    });
    
    // Call the voucher check endpoint to validate the voucher with current quantities
    $.ajax({
        url: voucherCheckUrl,
        method: 'POST',
        data: {
            voucher: currentVoucherCode,
            products: JSON.stringify(selectedProducts),
            csrfmiddlewaretoken: csrfToken
        },
        dataType: 'json',
        success: function(data) {
            if (data.valid) {
                // Voucher is still valid with new quantities
                $('#discount-amount').text('-$' + data.discount.toFixed(2));
                $('#discount-row').show();
                
                // Update the voucher feedback message
                $('#voucher-feedback').html('<span class="text-success">' + data.message + '</span>');
            } else {
                // Voucher is no longer valid, remove it
                $('#voucher-feedback').html('<span class="text-danger">' + data.message + '</span>');
                $('#id_voucher').val('').prop('readonly', false).removeClass('is-valid').addClass('is-invalid');
                $('#voucher_code').val('');
                $('#discount-row').hide();
                currentVoucherCode = '';
            }
            
            // Call the callback after processing
            if (typeof callback === 'function') {
                callback();
            }
        },
        error: function() {
            console.error('Failed to revalidate voucher');
            
            // Call the callback even on error
            if (typeof callback === 'function') {
                callback();
            }
        }
    });
}

/**
 * Update the QR code with the current total
 */
function updateQRCode() {
    // Get the current final total from the display
    let finalTotal = parseFloat($('#total-amount').text().replace('$', ''));
    let reference = $('input[name="reference_id"]').val();
    
    // Update payment amount display
    $('#payment-amount').text(finalTotal.toFixed(2));
    
    // Generate updated QR code with current total
    generateQRCode(finalTotal, reference);
}

/**
 * Apply a voucher code
 * @param {Function} callback - Function to call after voucher is applied
 */
function applyVoucher(callback) {
    let voucherCode = $('#id_voucher').val().trim();
    if (!voucherCode) {
        $('#voucher-feedback').html('<span class="text-danger">Please enter a voucher code</span>');
        return;
    }
    
    // Get selected products and quantities
    let selectedProducts = [];
    let hasItems = false;
    
    $('.product-row').each(function() {
        let row = $(this);
        let productId = row.find('.quantity-input').attr('name').replace('quantity_', '');
        let quantity = parseInt(row.find('.quantity-input').val()) || 0;
        
        if (quantity > 0) {
            selectedProducts.push({
                id: productId,
                quantity: quantity
            });
            hasItems = true;
        }
    });
    
    if (!hasItems) {
        $('#voucher-feedback').html('<span class="text-danger">Please select at least one product</span>');
        return;
    }
    
    // Show loading state
    showLoadingState();
    
    // Make AJAX request to validate voucher with actual products
    $.ajax({
        url: voucherCheckUrl,
        method: 'POST',
        data: {
            voucher: voucherCode,
            products: JSON.stringify(selectedProducts),
            csrfmiddlewaretoken: csrfToken
        },
        dataType: 'json',
        success: function(data) {
            if (data.valid) {
                // Store voucher code and display success message
                currentVoucherCode = voucherCode;
                $('#voucher_code').val(voucherCode);
                $('#voucher-feedback').html('<span class="text-success">' + data.message + '</span>');
                $('#id_voucher').prop('readonly', true).removeClass('is-invalid').addClass('is-valid');
                
                // Update discount display
                $('#discount-amount').text('-$' + data.discount.toFixed(2));
                $('#discount-row').show();
                
                // Log the voucher application details for debugging
                console.log('Voucher applied successfully:', {
                    code: voucherCode,
                    discount: data.discount,
                    newTotal: data.new_total,
                    message: data.message
                });
                
                // Update site offers with the new voucher
                applySiteOffers(function() {
                    // After site offers are updated, call the callback
                    if (typeof callback === 'function') {
                        callback();
                    }
                });
            } else {
                // Show error message
                $('#voucher-feedback').html('<span class="text-danger">' + data.message + '</span>');
                $('#id_voucher').removeClass('is-valid').addClass('is-invalid');
                $('#voucher_code').val('');
                $('#discount-row').hide();
                currentVoucherCode = '';
                
                // Hide loading state
                hideLoadingState();
                
                // Call the callback
                if (typeof callback === 'function') {
                    callback();
                }
            }
        },
        error: function() {
            $('#voucher-feedback').html('<span class="text-danger">Error checking voucher</span>');
            
            // Hide loading state
            hideLoadingState();
            
            // Call the callback even on error
            if (typeof callback === 'function') {
                callback();
            }
        }
    });
}

/**
 * Generate a QR code with the specified amount and reference
 * @param {Number} amount - The payment amount
 * @param {String} reference - The payment reference 
 */
function generateQRCode(amount, reference) {
    console.log(`Generating QR code with amount: $${amount} and reference: ${reference}`);
    
    // Ensure amount is a valid number
    amount = parseFloat(amount) || 0;
    
    let QRstring = new PaynowQR({
        uen: 'T23SS0038A',
        amount: amount,
        editable: false,
        refNumber: reference,
    }).output();

    new QrCodeWithLogo({
        canvas: document.getElementById("paynowQRCanvas"),
        content: QRstring,
        width: 270,
        logo: {
            src: paynowLogoUrl,
            borderWidth: 1,
        },
        nodeQrCodeOptions: {
            color: {
                dark: "#731B6C",
                light: "#ffffff",
            },
            errorCorrectionLevel: "H"
        }
    });

    qrCodeGenerated = true;

    $('#confirm-order-btn').prop('disabled', false);
}

/**
 * Remove a voucher and update calculations
 */
function removeVoucher() {
    currentVoucherCode = '';
    $('#voucher_code').val('');
    $('#id_voucher').val('').prop('readonly', false).removeClass('is-valid is-invalid');
    $('#voucher-feedback').empty();
    $('#discount-row').hide();
    updateTotals();
}

/**
 * Validates the selection and returns selected products if valid
 * @returns {Array|boolean} Array of selected products or false if no selection
 */
function validateSelection() {
    let hasSelection = false;
    let selectedProducts = [];
    
    $('.product-row').each(function() {
        let row = $(this);
        let productId = row.find('.quantity-input').attr('name').replace('quantity_', '');
        let quantity = parseInt(row.find('.quantity-input').val()) || 0;
        
        if (quantity > 0) {
            hasSelection = true;
            selectedProducts.push({
                id: productId,
                quantity: quantity
            });
        }
    });
    
    if (!hasSelection) {
        alert('Please select at least one product');
        return false;
    }
    
    return selectedProducts;
}

/**
 * Calculates initial totals without showing loading state
 * Used only for the first page load
 */
function calculateInitialTotals() {
    let subtotal = 0;
    
    // Calculate subtotal from all products
    $('.product-row').each(function() {
        let price = parseFloat($(this).data('price'));
        let quantity = parseInt($(this).find('.quantity-input').val()) || 0;
        subtotal += price * quantity;
    });
    
    // Update the subtotal display
    $('#subtotal-amount').text('$' + subtotal.toFixed(2));
    
    // Initialize the total to the subtotal
    $('#total-amount').text('$' + subtotal.toFixed(2));
    
    // Track the current total
    currentTotal = subtotal;
    
    // If any products already have quantities (e.g., from a form resubmission)
    // and we need to apply offers, do it silently without loading spinner
    let hasQuantities = false;
    $('.quantity-input').each(function() {
        if (parseInt($(this).val()) > 0) {
            hasQuantities = true;
            return false; // Break the loop
        }
    });
    
    if (hasQuantities) {
        silentlyApplySiteOffers();
    }
}

/**
 * Apply site offers without showing loading state
 * Used for the initial page load only
 */
function silentlyApplySiteOffers() {
    let selectedProducts = [];
    
    // Collect all products with quantities > 0
    $('.product-row').each(function() {
        let row = $(this);
        let productId = row.find('.quantity-input').attr('name').replace('quantity_', '');
        let quantity = parseInt(row.find('.quantity-input').val()) || 0;
        let price = parseFloat(row.data('price'));
        
        if (quantity > 0) {
            selectedProducts.push({
                id: productId,
                quantity: quantity,
                price: price
            });
        }
    });
    
    if (selectedProducts.length === 0) {
        return;
    }
    
    // Make an AJAX request to apply site offers
    $.ajax({
        url: siteOffersUrl,
        method: 'POST',
        data: {
            products: JSON.stringify(selectedProducts),
            voucher: currentVoucherCode,
            csrfmiddlewaretoken: csrfToken
        },
        dataType: 'json',
        success: function(data) {
            // Update display with automatic offers
            if (data.site_offers_applied) {
                siteOffersApplied = true;
                
                // Display the discount information
                if (data.site_offers_discount > 0) {
                    $('#site-offers-row').show();
                    $('#site-offers-amount').text('-$' + data.site_offers_discount.toFixed(2));
                    $('#site-offers-description').text(data.site_offers_description || 'Automatic discount applied');
                } else {
                    $('#site-offers-row').hide();
                }
            } else {
                // Hide site offers discount row if no offers were applied
                $('#site-offers-row').hide();
                siteOffersApplied = false;
            }
            
            // Update the voucher discount if a voucher is applied
            if (data.voucher_discount > 0 && currentVoucherCode) {
                $('#discount-row').show();
                $('#discount-amount').text('-$' + data.voucher_discount.toFixed(2));
            } else {
                $('#discount-row').hide();
            }
            
            // Update the final total with all discounts
            updateFinalTotal(data.original_total, data.site_offers_discount, data.voucher_discount);
        },
        error: function() {
            console.error('Failed to silently apply site offers on page load');
        }
    });
}
