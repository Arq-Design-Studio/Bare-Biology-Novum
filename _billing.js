function addBillingAddressHandler(ev) {
    ev.preventDefault();

    let title = ev.target.closest("[data-add-billing-address]").dataset.title;
    ReCharge.Novum.sidebarHeading.innerHTML = title;
    ReCharge.Novum.sidebarContent.innerHTML = `{% include '_billing_address_details.html' %}`;

    let actionUrl = ReCharge.Endpoints.create_billing_address();
    
    let billingForm = document.querySelector("#billingAddressForm");
    billingForm.setAttribute("action", actionUrl);
    
    getShippingBillingCountries('billing');
    ReCharge.Novum.Utils.getZipLabel();

    billingForm.querySelector('.rc_btn').innerHTML = `{{ 'cp_create' | t }}`;

    billingForm.addEventListener('submit', createBillingAddressHandler);

    ReCharge.Novum.toggleSidebar(ev.currentTarget);
}

function getRedirectLink() {
    if (window.location.href.includes('/subscriptions/')) {
        return ReCharge.Endpoints.show_subscription_url(ReCharge.Novum.subscription.id);
    }
    
    return `{{ payment_source_list_url }}`;
}

function createBillingAddressHandler(ev) {
    ev.preventDefault();

    let data = ReCharge.Forms.getFormData(ev.target);
    data.redirect_url = getRedirectLink();
    ReCharge.Actions.sendRequest(ev, data); 
}

function renderBillingAddressHandler(event) {
    event.preventDefault();

    let title = `{{ 'cp_edit_billing_address' | t}}`;
    const paymentId = +event.target.closest('.js-edit-billing-address').dataset.billingAddress;
    ReCharge.Novum.sidebarHeading.innerHTML = title;
    ReCharge.Novum.sidebarContent.innerHTML = `{% include '_billing_address_details.html' %}`;

    let paymentSources = ReCharge.Novum.payment_sources;
    let actionUrl = ReCharge.Endpoints.update_billing_address(paymentId);

    // If store is using RCPM or customer has payment_methods included, use payment_methods data instead
    if (
        ReCharge.Novum.settings.customer_portal.view_recharge_payment_methods ||
      	(ReCharge.Novum.customer.include &&
      	ReCharge.Novum.customer.include.payment_methods &&
      	ReCharge.Novum.customer.include.payment_methods.length)    
    ) {
        paymentSources = ReCharge.Novum.payment_methods;
        actionUrl = ReCharge.Endpoints.payment_methods(paymentId);
    }

    let selectedPaymentSource = paymentSources.find(ps => 
        ps.processor_name !== 'shopify_payments' && ps.id === paymentId ||
        ps.processor_name !== 'shopify_payments' && ps.id === 1
    );

    if (selectedPaymentSource) {
        let billingForm = document.querySelector("#billingAddressForm");
        billingForm.setAttribute("action", actionUrl);
        billingForm.addEventListener('submit', updateBillingAddressHandler);

        ReCharge.Forms.populateAddressData(selectedPaymentSource.billing_address);

        getShippingBillingCountries('billing');

        ReCharge.Novum.Utils.getZipLabel(selectedPaymentSource.billing_address.country);

        ReCharge.Novum.toggleSidebar(event.currentTarget);
    }
}

function updateBillingAddressHandler(ev) {
    ev.preventDefault();

    let data = ReCharge.Forms.getFormData(ev.target);

    if (ReCharge.Novum.settings.customer_portal.view_recharge_payment_methods) {
        data = {
            billing_address: data
        }
    }

    data.redirect_url = getRedirectLink();
    ReCharge.Actions.sendRequest(ev, data);
}

function renderPaymentMethod(ev) {
    ev.preventDefault();

    const paymentIdElem =  ev.target.closest('.js-edit-billing-card') || null;

    if (paymentIdElem) {
        const paymentId = paymentIdElem.dataset.billingCard;

        document.querySelector("#te-card-modal-content").innerHTML = `        
            <iframe 
                src="${ReCharge.Endpoints.get_payment_method_form(paymentId)}" 
                id="customer-card-form" 
                name="customer-card-form" 
                frameborder="0" 
                allowtransparency="true">
            </iframe>`;
    }

    document.querySelector("body").classList.toggle("locked");
    document
        .getElementById("sidebar-card-underlay")
        .classList.toggle("visible");
    document
        .getElementById("te-card-modal")
        .classList.toggle("visible");

    window.addEventListener("message", handleCardFrameMessage, false);
}

function handleCardFrameMessage(event) {
    if (
        event.origin.includes('shopifysubscriptions.com') || 
        event.origin.includes('admin.rechargeapps.com')
    ) {
        if (event.data && event.data.billingComplete) {  
            window.location.reload();
        }
    }

    return;
}

{% if settings['has_shopify_connector'] %}
    async function sendEmailRequest(ev) {
        ev.preventDefault();
        if (window.locked) {
            return false;
        }
        window.locked = true;
        const button = ev.target;
        const buttonInitWidth = button.offsetWidth;
        const data = {
            'template_type': 'shopify_update_payment_information',
            'type': 'email'
        };
        const url = ReCharge.Endpoints.send_shopify_connector_email();

        ReCharge.Forms.toggleSubmitButton(button);
        button.setAttribute('data-text', '{{ "cp_send_email_to_update" | t }}');
        button.style.width = `${buttonInitWidth}px`;
        button.style.pointerEvents = 'none';

        try {
            await axios({
                url,
                method: 'post',
                data
            });

            ReCharge.Toast.addToast(`{{ 'cp_toast_success' | t }}`, `{{ 'cp_update_email_sent' | t }}`);
            ReCharge.Forms.toggleSubmitButton(button);
            button.removeAttribute('data-text');
            button.disabled = true;
            button.innerHTML = `{% include '_check-mark-sign.svg' %}`;

            setTimeout(() => {
                button.disabled = false;
                button.innerHTML = `{{ "cp_send_email_to_update" | t }}`;
                button.style.pointerEvents = 'auto';
            }, 180000);
        } catch (error) {
            console.log(error);
            let errorMessage = `{{ "cp_something_went_wrong" | t }}`;
            if (error.response && error.response.data && error.response.data.error) {
                errorMessage = error.response.data.error;
            }
            ReCharge.Forms.toggleSubmitButton(button);
            button.removeAttribute('data-text');
            ReCharge.Toast.addToast(`{{ 'cp_toast_error' | t }}`, errorMessage);
            button.style.pointerEvents = 'auto';
        } finally {
            delete window.locked;
        }
    }
{% endif %}

(function() {
    let closeCardSidebars = document.querySelectorAll(".close-card-sidebar");
    closeCardSidebars.forEach(sidebar => {
        sidebar.addEventListener("click", (event) => {
            window.removeEventListener("message", handleCardFrameMessage, false);
            renderPaymentMethod(event);

            const creditCardForm = window[0].document.getElementById('credit-card-form'),
                  sepaDebitForm = window[0].document.getElementById('sepa-debit-form'),
                  paymentSelector = window[0].document.getElementById('payment-form-selection-page');

            if (paymentSelector) {
                paymentSelector.style.display = 'block';
                creditCardForm.style.display = 'none';
                sepaDebitForm.style.display = 'none';
            }
        });
    });
})();
