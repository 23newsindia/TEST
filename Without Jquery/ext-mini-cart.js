document.addEventListener('DOMContentLoaded', function() {
    "use strict";

    // ==================================================
    // Mini Cart Functions
    // ==================================================

    // Check if a node is blocked
    function mini_cart_ext_is_blocked(node) {
        return node.classList.contains('processing') || 
               node.closest('.processing') !== null;
    }

    // Block a node visually
    function mini_cart_ext_block(node) {
        document.body.dispatchEvent(new Event('nasa_publish_coupon_refresh'));
        
        if (!mini_cart_ext_is_blocked(node)) {
            const color = document.body.classList.contains('nasa-dark') ? '#000' : '#fff';
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: ${color};
                opacity: 0.6;
                z-index: 999;
            `;
            node.classList.add('processing');
            node.style.position = 'relative';
            node.appendChild(overlay);
        }
    }

    // Unblock a node
    function mini_cart_ext_unblock(node) {
        node.classList.remove('processing');
        const overlay = node.querySelector('div[style*="opacity: 0.6"]');
        if (overlay) overlay.remove();
    }

    // Get WooCommerce nonce
    function getWooCommerceNonce() {
        const nonceElement = document.querySelector('#woocommerce-process-checkout-nonce');
        return nonceElement ? nonceElement.value : '';
    }

    // Update fragments in DOM
    function updateFragments(fragments) {
        if (fragments) {
            Object.entries(fragments).forEach(([selector, html]) => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    // Create a temporary container
                    const temp = document.createElement('div');
                    temp.innerHTML = html;
                    
                    // Replace the old element with the new one
                    const newElement = temp.firstElementChild;
                    if (newElement && element.parentNode) {
                        element.parentNode.replaceChild(newElement, element);
                    }
                });
            });
        }
    }

    // Show message in the page
    function showMessage(message, isError = false) {
        // Remove any existing messages
        const existingMessages = document.querySelectorAll('.woocommerce-error, .woocommerce-message, .woocommerce-info');
        existingMessages.forEach(msg => msg.remove());

        // Create new message element
        const messageDiv = document.createElement('div');
        messageDiv.className = isError ? 'woocommerce-error' : 'woocommerce-message';
        messageDiv.setAttribute('role', 'alert');
        messageDiv.style.display = 'block';
        messageDiv.textContent = message;

        // Insert message after the coupon form
        const couponForm = document.querySelector('.coupon-clone-wrap');
        if (couponForm) {
            couponForm.insertAdjacentElement('afterend', messageDiv);
        }
    }

    // Extract messages from HTML response
    function extractMessages(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        const messages = temp.querySelectorAll('.woocommerce-error li, .woocommerce-message, .woocommerce-info');
        return Array.from(messages).map(msg => msg.textContent).join('\n');
    }

    // Refresh cart totals
    function refreshCartTotals() {
        document.body.dispatchEvent(new Event('update_checkout'));
    }

    // Apply Coupon Handler
    document.body.addEventListener('click', function(e) {
        if (e.target.matches('#apply_coupon_clone')) {
            e.preventDefault();
            
            const couponInput = document.querySelector('input[name="coupon_code_clone"]');
            const reviewOrder = document.querySelector('.woocommerce-checkout-review-order');
            
            if (!couponInput || !couponInput.value.trim()) {
                showMessage('Please enter a coupon code', true);
                return;
            }

            // Block the order review
            if (reviewOrder) {
                mini_cart_ext_block(reviewOrder);
            }

            const formData = new URLSearchParams();
            formData.append('security', wc_checkout_params.apply_coupon_nonce);
            formData.append('coupon_code', couponInput.value.trim());
            formData.append('_wpnonce', getWooCommerceNonce());

            fetch(wc_checkout_params.wc_ajax_url.toString().replace('%%endpoint%%', 'apply_coupon'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.text();
            })
            .then(html => {
                try {
                    const data = JSON.parse(html);
                    if (data.messages) {
                        const message = typeof data.messages === 'string' ? data.messages : Object.values(data.messages).join('\n');
                        showMessage(message, html.includes('error'));
                    }
                    if (data.fragments) {
                        updateFragments(data.fragments);
                    }
                } catch (e) {
                    // If not JSON, handle as HTML
                    const messages = extractMessages(html);
                    if (messages) {
                        showMessage(messages, html.includes('error'));
                    }
                    // Update the entire order review if we got HTML
                    const orderReview = document.querySelector('#order_review');
                    if (orderReview) {
                        orderReview.innerHTML = html;
                    }
                }

                // Clear input if successful
                if (!html.includes('error')) {
                    couponInput.value = '';
                    refreshCartTotals();
                }
            })
            .catch(error => {
                console.error('Error applying coupon:', error);
                showMessage('Error applying coupon. Please try again.', true);
            })
            .finally(() => {
                if (reviewOrder) {
                    mini_cart_ext_unblock(reviewOrder);
                }
            });
        }
    });

    // Remove Coupon Handler
    document.body.addEventListener('click', function(e) {
        const removeBtn = e.target.closest('.woocommerce-remove-coupon');
        if (removeBtn) {
            e.preventDefault();
            
            const couponCode = removeBtn.dataset.coupon;
            const reviewOrder = document.querySelector('.woocommerce-checkout-review-order');

            if (reviewOrder) {
                mini_cart_ext_block(reviewOrder);
            }

            const formData = new URLSearchParams();
            formData.append('security', wc_checkout_params.remove_coupon_nonce);
            formData.append('coupon', couponCode);
            formData.append('_wpnonce', getWooCommerceNonce());

            fetch(wc_checkout_params.wc_ajax_url.toString().replace('%%endpoint%%', 'remove_coupon'), {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: formData
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.text();
            })
            .then(html => {
                try {
                    const data = JSON.parse(html);
                    if (data.messages) {
                        const message = typeof data.messages === 'string' ? data.messages : Object.values(data.messages).join('\n');
                        showMessage(message, html.includes('error'));
                    }
                    if (data.fragments) {
                        updateFragments(data.fragments);
                    }
                } catch (e) {
                    const messages = extractMessages(html);
                    if (messages) {
                        showMessage(messages, html.includes('error'));
                    }
                    // Update the entire order review if we got HTML
                    const orderReview = document.querySelector('#order_review');
                    if (orderReview) {
                        orderReview.innerHTML = html;
                    }
                }

                // Update coupon button states
                const couponBtn = document.querySelector(`.publish-coupon[data-code="${couponCode}"]`);
                if (couponBtn) {
                    couponBtn.classList.remove('nasa-active', 'nasa-added');
                }
                
                refreshCartTotals();
            })
            .catch(error => {
                console.error('Error removing coupon:', error);
                showMessage('Error removing coupon. Please try again.', true);
            })
            .finally(() => {
                if (reviewOrder) {
                    mini_cart_ext_unblock(reviewOrder);
                }
            });
        }
    });

    // Toggle Coupon Form
    document.addEventListener('click', function(e) {
        if (e.target.closest('.showcoupon-clone')) {
            e.preventDefault();
            
            const couponWrap = document.querySelector('.coupon-clone-wrap');
            const addCouponBtn = document.querySelector('.ns-add-coupon');
            
            if (couponWrap) {
                couponWrap.classList.toggle('hidden-tag');
                
                if (addCouponBtn) {
                    const isOpen = !couponWrap.classList.contains('hidden-tag');
                    addCouponBtn.textContent = isOpen ? addCouponBtn.dataset.close : addCouponBtn.dataset.add;
                    addCouponBtn.classList.toggle('cp-open', isOpen);
                    
                    if (isOpen) {
                        const couponInput = couponWrap.querySelector('input[name="coupon_code_clone"]');
                        if (couponInput) couponInput.focus();
                    }
                }
            }
        }
    });

    // Handle Coupon Publish Buttons
    document.addEventListener('click', function(e) {
        const publishBtn = e.target.closest('.publish-coupon:not(.nasa-actived)');
        if (publishBtn) {
            const couponCode = publishBtn.dataset.code;
            const couponInput = document.querySelector('input[name="coupon_code_clone"]');
            if (couponInput) {
                couponInput.value = couponCode;
                const applyButton = document.querySelector('#apply_coupon_clone');
                if (applyButton) {
                    applyButton.click();
                }
            }
        }
    });

    // Update fragments when they're refreshed
    document.body.addEventListener('wc_fragments_refreshed', function() {
        const cartSidebar = document.getElementById('cart-sidebar');
        if (cartSidebar) {
            cartSidebar.classList.remove('ext-loading');
        }

        // Update coupon display
        document.querySelectorAll('.publish-coupon').forEach(btn => {
            const code = btn.dataset.code;
            const isActive = document.querySelector(`.coupon-wrap[data-code="${code}"]`) !== null;
            btn.classList.toggle('nasa-actived', isActive);
        });
    });
});