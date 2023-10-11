let rcPaymentMethods = {{ payment_methods | json }};
const customer = {{ customer | json }};
let allsubscriptions = {{ subscriptions | json }};
const useMultiplePaymentMethods = {{ useMultiplePaymentMethods | json }};

// Remove old countries in case it still exists
sessionStorage.removeItem('rc_billing_countries');
// Used by the country/province select utils
sessionStorage.setItem('rc_billing_countries', JSON.stringify({{ billing_countries | json }}));

// IIFE to not muddy up the global context
(function () {
  const { MoveSubscriptions } = window.ReCharge.pages;
  const { createCardLogo, createPaymentMethodDetails, addTooltip, renderExpandableCard, createAddress } = ReCharge.Components;
  const { translations } = ReCharge;
  const { getAddressDom, getAssociatedSubscriptionsDom, render, createSpinner } = ReCharge.Novum.DomCreators;
  const { formatReadable, capitalize, isShopify} = ReCharge.Utils;
  let isApiRequestPending = false; // Is there a request pending on this page?

  function findAndReplacePaymentMethod(paymentMethod) {
    const idx = rcPaymentMethods.findIndex(pm => pm.id === paymentMethod.id);
    rcPaymentMethods[idx] = { ...rcPaymentMethods[idx], ...paymentMethod };
  }

// Creating the v-dom for payment methods
  const paymentMethodCardsEl = document.createElement('div');
  paymentMethodCardsEl.classList.add('payment-method-cards');
  document.getElementById('PaymentMethodsPage')?.append(paymentMethodCardsEl);

  // Will recalculate all the content that needs to change to not require a reload
  function getDynamicPaymentMethodContent(paymentMethod) {
    const paymentDetails = paymentMethod.payment_details;
    var paymentType = paymentMethod.payment_type;
    const paymentStatus = paymentMethod.status;

    if (!paymentType && paymentStatus === 'empty') {
      paymentType = 'CREDIT_CARD'
      paymentMethod.payment_type = 'CREDIT_CARD'
    }

    const brand = ReCharge.Utils.formatReadable(paymentMethod.payment_details?.brand);
    // Implemented translation for Expires and Brand Last4
    const capitalizeLast4 = brand && `${capitalize(brand)} ••••${paymentDetails.last4}`;
    const translatedLast4 = brand && translations.paymentMethod.last4
      .replace('{brand}', capitalize(brand))
      .replace('{last4}', paymentDetails.last4);
    const translatedExpires = createPaymentMethodDetails(paymentMethod).includes('Expires') &&
      createPaymentMethodDetails(paymentMethod).replace('Expires', translations.paymentMethod.expires);
    const translatedCardSummaryLayout = brand && translatedExpires ?
      translatedExpires.replace(capitalizeLast4, translatedLast4) : 
      createPaymentMethodDetails(paymentMethod);


    if(brand) {
      paymentType = translatedLast4;
    } else {
      paymentType = formatReadable(paymentType, { capitalize: true });
    }

    return {
      address: paymentType === 'SHOP_PAY' ? translations.paymentMethod.shopPay.unavailable : getAddressDom(paymentMethod.billing_address),
      isVaulted: ReCharge.Utils.isVaulted(paymentMethod),
      paymentType,
      cardSummary: `
        <span class="mr-2 d-flex">
         ${translatedCardSummaryLayout}
        </span>
      `
    }
  }

  function createRemovePMBtnTooltip(el, isShopifyPM) {
    const {
      paymentMethods: {
        removeBtnTooltip: { nonSci, sci },
      },
    } = translations;
    const removeSelector = '.remove-payment-method';
    addTooltip(el.querySelector(removeSelector), {
      content: isShopifyPM ? sci : nonSci,
    });
  };

  function renderPaymentMethods() {
    const isSinglePM = rcPaymentMethods.length === 1;
    const paymentMethodsInUse = allsubscriptions.reduce((uniquePMIds, subscription) => {
      const paymentMethodId = subscription.address?.include?.payment_methods[0]?.id;
      if (paymentMethodId) {
          uniquePMIds.add(paymentMethodId);
      }
      return uniquePMIds;
    }, new Set());
    // Check if any subscriptions don't have a PM
    const anySubscriptionsWithoutPM = allsubscriptions.some(sub => !sub.address?.include?.payment_methods.length);

    rcPaymentMethods.forEach((paymentMethod) => {
      const associatedSubscriptions = paymentMethod.subscriptions;
      const isShopifyPM = isShopify(paymentMethod);
      let element = document.querySelector(`.payment-method[data-payment-method-id="${paymentMethod.id}"]`);
      const hasRendered = !!element;
      const content = getDynamicPaymentMethodContent(paymentMethod);

      /* Disabled when:
       * This is the only payment method that exists
       * There are subscriptions using this payment method
       * This is a Shopify payment method
       */
      {% if useMultiplePaymentMethods %}
      const mpmIsDeleteDisabled = associatedSubscriptions.length;
      {% else %}
      const spmIsDeleteDisabled = !!associatedSubscriptions.find(sub => !sub.cancelled_at);
      {% endif %}
      const isDeleteDisabled = isShopifyPM || 
        {% if useMultiplePaymentMethods %}
        mpmIsDeleteDisabled;
        {% else %}
        spmIsDeleteDisabled; 
        {% endif %}
      // Generate the element if it hasn't been rendered yet
      if (!hasRendered) {
        element = document.createElement('div');
        element.classList.add('payment-method', 'rc-expandable-card');
        element.setAttribute('data-payment-method-id', paymentMethod.id);

        // Generate the payment method
        element.innerHTML = `
          <div class="rc-expandable-card--summary">
            <span class="mr-2 d-flex align-items-center">
              <span class="payment-method-logo">${createCardLogo(paymentMethod)}</span>
              <span class="description flex-1">
                <div class="payment-type primary-font">
                  ${content.isVaulted ? translations.subscription.vaultedPaymentMethod : content.paymentType}
                </div>
              </span>
            </span>
          </div>
          <div class="rc-expandable-card--details primary-font">
            <div class="grid-250">
              <div class="payment-method-details">
                <h4 class="rc-subheading mt-4">${translations.paymentMethod.header}</h4>
                <div class="card-summary mb-2">
                  ${content.cardSummary}
                </div>
              </div>
              <div class="billing-address-container">
                <h4 class="rc-subheading mt-4">${translations.paymentMethods.addressHeader}</h4>
                <div class="billing-address mb-2">${content.address}</div>
              </div>
            </div>
            <div class="associated-subscriptions-container">
              ${getAssociatedSubscriptionsDom(associatedSubscriptions)}
            </div>
            <div class="actions d-flex justify-end mt-5">
              <button type="button" class="edit-payment-method rc_btn--link secondary-font">
                ${translations.paymentMethods.editBtn}
              </button>
              ${render(`
                <button type="button" class="remove-payment-method rc_btn--link secondary-font" ${render(isDeleteDisabled && 'disabled')}>
                  ${translations.paymentMethods.removeBtn}
                </button>
              `)}
              {% if useMultiplePaymentMethods %}
                ${render(`
                  <button type="button" class="move-payment-method-subs rc_btn--link secondary-font">
                    ${translations.paymentMethods.moveBtn}
                  </button>
                `)}
              {% endif %}
            </div>
          </div>
        `;
        renderExpandableCard(element, rcPaymentMethods.length === 1);
        paymentMethodCardsEl.append(element);
        element.querySelector('.edit-payment-method')?.addEventListener('click', onEditPaymentMethod);
        element.querySelector('.edit-billing-address')?.addEventListener('click', onEditBillingAddress);
        element.querySelector('.remove-payment-method')?.addEventListener('click', onRemovePaymentMethod);

        // Add a tooltip if we are allowed, but it's disabled aren't allowed to remove
        if(isDeleteDisabled) {
          createRemovePMBtnTooltip(element, isShopifyPM);
        }
      } else {
        // If it has already been rendered lets just update the dynamic content
        element.querySelector('.payment-method-logo').innerHTML = createCardLogo(paymentMethod);
        element.querySelector('.payment-type').innerHTML = content.paymentType;
        element.querySelector('.billing-address').innerHTML = content.address;
        element.querySelector('.card-summary').innerHTML = content.cardSummary;
        element.querySelector('.associated-subscriptions').innerHTML = getAssociatedSubscriptionsDom(associatedSubscriptions);

        const removeActionEl = element.querySelector('.remove-payment-method');
        const isRemoveElDisabled = removeActionEl?.hasAttribute('disabled');

        // Enable button if it was previously disabled and it should now be enabled
        if (isRemoveElDisabled && !isDeleteDisabled) {
          removeActionEl.removeAttribute('disabled');

          // Add click listener in case it wasn't added previously because of disabled state
          removeActionEl.addEventListener('click', onRemovePaymentMethod);

          // Remove tooltip
          const tooltipContainer = removeActionEl.parentElement;
          // verify tooltip element exists and that it is actually the tooltip element
          if (tooltipContainer && tooltipContainer.classList.contains('rc-tooltip-container')) {
            tooltipContainer.replaceWith(tooltipContainer.children[0]);
          }
        }

        // Disable button if it was previously enabled and should now be disabled
        if (!isRemoveElDisabled && isDeleteDisabled) {
          removeActionEl.setAttribute('disabled', '');

          createRemovePMBtnTooltip(element, isShopifyPM);
        }
      }

      // Move payment methods logic
      const movePaymentMethodBtn = element.querySelector(".move-payment-method-subs");
      const allSubscriptionsUsingPM = paymentMethodsInUse.size === 1 && paymentMethodsInUse.has(paymentMethod.id) && !anySubscriptionsWithoutPM;

      
      if (movePaymentMethodBtn) {
        const moveParentEl = movePaymentMethodBtn.parentElement;
        const hasTooltip = moveParentEl && moveParentEl.classList.contains('rc-tooltip-container');

        movePaymentMethodBtn.addEventListener('click', (e) => {
          onMoveSubscriptions(getPaymentMethodFromEvent(e));
        });

        // Disable move subscriptions button if single PM or all subscriptions are already using the PM
        if (allSubscriptionsUsingPM) {
          movePaymentMethodBtn.setAttribute('disabled', '');
        } else {
          movePaymentMethodBtn.hasAttribute('disabled') && movePaymentMethodBtn.removeAttribute('disabled');
        }

        // Remove tooltip if element already has a tooltip and subscriptions are using different payment methods
        if (hasTooltip && !allSubscriptionsUsingPM) {
          // Replace tooltip container with the button itself to remove the tooltip all together
          moveParentEl.replaceWith(movePaymentMethodBtn);
        }

        // Add tooltip if all subscriptions are currently using the same payment method AND there is multiple payment methods
        if (allSubscriptionsUsingPM && !isSinglePM && !hasTooltip) {
          addTooltip(movePaymentMethodBtn, {
              content: translations.paymentMethods.allSubscriptionsUsingPMTooltip
          });
        }

        
      }

    });

    const renderedPaymentMethods = document.querySelectorAll('.payment-method[data-payment-method-id]');
    if (renderedPaymentMethods.length) {
      // Remove all payment methods that no longer exist
      renderedPaymentMethods.forEach((el) => {
        if (!rcPaymentMethods.some(pm => pm.id === Number(el.getAttribute('data-payment-method-id')))) {
          paymentMethodCardsEl.removeChild(el);
        }
      });
    }

    // If there are no payment methods rendered, show empty message
    const emptyEl = paymentMethodCardsEl.querySelector('.empty');
    if (!document.querySelector('.payment-method[data-payment-method-id]')) {
      const canAddPaymentMethod = customer.can_add_payment_method || !useMultiplePaymentMethods;
      if(canAddPaymentMethod) {
        // Remove the original add payment method button since we are moving it inside this card
        document.querySelector('.add-payment-method')?.remove();
        paymentMethodCardsEl.innerHTML = `
          <div class="empty rc-card text-center text-body-2">
            <div class="text-center mb-5 mx-auto" style="max-width: 430px;">${translations.paymentMethods.noResults}</div>
            <button class="add-payment-method rc_btn rc_btn--primary bbrc-btn">${translations.paymentMethods.addBtn}</button>
          </div>`;

        const addPaymentMethodButton = document.querySelector('.add-payment-method');
        addPaymentMethodButton.addEventListener('click', onAddPaymentMethod);
      } else {
        const { domain } = window.ReCharge.Novum.store;
        paymentMethodCardsEl.innerHTML = `
          <div class="empty rc-card text-center text-body-2">
            <div class="text-center mb-5 mx-auto" style="max-width: 430px;">${translations.paymentMethods.noResultsAddCheckout}</div>
            <a class="rc-btn rc-btn--primary" href="https://${domain}" target="_blank">${translations.paymentMethods.newSubscriptionBtn}</a>
          </div>`;
      }
    } else if (emptyEl) {
      // Remove the no shipping text if it exists and there are addresses to show
      paymentMethodCardsEl.removeChild(emptyEl);
    }
  }

  function getAddressFormData() {
    return {
      first_name: document.getElementById('first_name').value,
      last_name: document.getElementById('last_name').value,
      company: document.getElementById('company').value,
      address1: document.getElementById('address1').value,
      address2: document.getElementById('address2').value,
      country: document.getElementById('country').value,
      city: document.getElementById('city').value,
      province: document.getElementById('province').value,
      zip: document.getElementById('zip').value,
      phone: document.getElementById('phone').value,
    };
  }

  async function sendUpdateEmail(e) {
    e.preventDefault();
    if (isApiRequestPending) {
      return false;
    }
    isApiRequestPending = true;
    const buttonEl = e.target;
    ReCharge.Forms.toggleButtonLoading(buttonEl);

    try {
      const addressId = Number(buttonEl.getAttribute('data-address-id')) || undefined;
      await axios.post(ReCharge.Endpoints.send_shopify_connector_email(), {
        template_type: 'shopify_update_payment_information',
        type: 'email',
        address_id: addressId
      });

      ReCharge.Toast.addToast(`{{ 'cp_toast_success' | t }}`, `{{ 'cp_update_email_sent' | t }}`);
      ReCharge.Drawer.close();
    } catch (error) {
      let errorMessage = `{{ "cp_something_went_wrong" | t }}`;
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error;
      }
      ReCharge.Forms.toggleButtonLoading(buttonEl);
      ReCharge.Toast.addToast(`{{ 'cp_toast_error' | t }}`, errorMessage);
    } finally {
      isApiRequestPending = false;
    }
  }

  function onEditShopifyPaymentMethod(e) {
    const paymentMethodId = getPaymentMethodIdFromEvent(e);
    const drawerContent = `{% include '_edit_shopify_payment_method.html' %}`;

    ReCharge.Drawer.open({
      header: translations.paymentMethods.edit.header,
      content: drawerContent,
    });

    const paymentSummaryEl = e.composedPath().find(el => el.classList.contains('rc-expandable-card--details')).querySelector('.payment-type');
    document.querySelector('.edit-shopify-payment-method-container .payment-method').innerHTML = paymentSummaryEl.innerHTML;
    const addressId = rcPaymentMethods.find(pm => pm.id === paymentMethodId)?.subscriptions[0]?.address_id
    const sendButton = document.querySelector('.shopify-send-update-email');
    if (addressId) {
      sendButton.setAttribute('data-address-id', addressId);
    }
    sendButton?.addEventListener('click', sendUpdateEmail);
  }

  async function saveBillingAddress(e) {
    e.preventDefault();
    if (isApiRequestPending) {
      return false;
    }
    isApiRequestPending = true;
    const buttonEl = e.target.querySelector('.update-billing-address');
    ReCharge.Forms.toggleButtonLoading(buttonEl);
    try {
      window.locked = true;
      const id = getPaymentMethodIdFromEvent(e);
      const { data: { payment_method } } = await axios.post(ReCharge.Endpoints.payment_methods(id), {
        billing_address: getAddressFormData()
      });

      findAndReplacePaymentMethod(payment_method);
      renderPaymentMethods();
      ReCharge.Toast.addToast(`{{ 'cp_toast_success' | t }}`, translations.paymentMethods.editAddress.success);
      ReCharge.Drawer.close({unlockWindow: true});
    } catch (error) {
      console.error(error);
      let errorMessage = `{{ "cp_something_went_wrong" | t }}`;
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error;
      }
      ReCharge.Forms.toggleButtonLoading(buttonEl);
      ReCharge.Toast.addToast(`{{ 'cp_toast_error' | t }}`, errorMessage);
    } finally {
      isApiRequestPending = false;
      delete window.locked;
    }
    return false;
  }

  function getPaymentMethodIdFromEvent(e) {
    return Number(e.composedPath().find(el => el.getAttribute('data-payment-method-id')).getAttribute('data-payment-method-id')); // Get the current payment method id
  }

  function getPaymentMethodFromEvent(e) {
    const paymentMethodId = getPaymentMethodIdFromEvent(e);
    return rcPaymentMethods.find(pm => pm.id === paymentMethodId);
  }

  function onEditBillingAddress(e) {
    const id = getPaymentMethodIdFromEvent(e);
    const paymentMethod = rcPaymentMethods.find(pm => pm.id === id);
    const numOfSubs = paymentMethod.subscriptions.length;
    const subscriptionText = translations.paymentMethods.editAddress[numOfSubs === 1 ? 'singularAssociatedSubscriptions' : 'pluralAssociatedSubscriptions'].replace('{numOfSubs}', numOfSubs);

    ReCharge.Drawer.open({
      header: translations.paymentMethods.editAddress.header,
      content: `
        <form action="" method="post" id="Recharge_Address_Form">
          <p class="subs-update-text rc-subtext text-center mb-5">
            ${subscriptionText}
          </p>

          <h3 class="rc-subheading">${translations.paymentMethods.addressHeader}</h3>
          {% set addressType = 'billing' %}
          {% include '_address_fields.html' %}
          <button type="submit" class="update-billing-address rc_btn rc_btn--primary bbrc-btn">
            ${translations.common.updateBtn}
          </button>
        </form>
      ` });

    ReCharge.formUtils.setupCountryProvinceSelectors('billing');
    // Update all the values to be what is current used
    ReCharge.formUtils.populateAddressData(paymentMethod.billing_address);

    // Update the countries/province dropdowns

    // Add id to form to easily get current payment method
    document.forms.Recharge_Address_Form.setAttribute('data-payment-method-id', id);

    // Add submit handler
    document.getElementById('Recharge_Address_Form').addEventListener('submit', saveBillingAddress);
  }

  function onRemovePaymentMethod(e) {
    const id = getPaymentMethodIdFromEvent(e);

    const paymentMethod = rcPaymentMethods.find(pm => pm.id === id);

    // If we are a shopify payment method, submit an email to remove
    if (isShopify(paymentMethod)) {
      onEditShopifyPaymentMethod(e);
      ReCharge.Drawer.setHeader('Remove payment method');
      return;
    }

    ReCharge.Modal.open({
      title: translations.paymentMethods.remove.title,
      content: translations.paymentMethods.remove.text,
      confirmBtnText: translations.paymentMethods.remove.confirmBtn,
      onConfirm: async (e) => {
        if (isApiRequestPending) {
          return false;
        }
        isApiRequestPending = true;
        const buttonEl = e.target;
        ReCharge.Forms.toggleButtonLoading(buttonEl);
        try {
          await axios.delete(ReCharge.Endpoints.payment_methods(id));

          // Remove paymentMethod from the cache and then syncing the dom
          const idx = rcPaymentMethods.findIndex(pm => pm.id === id);
          rcPaymentMethods.splice(idx, 1);
          renderPaymentMethods();

          ReCharge.Toast.addToast(`{{ 'cp_toast_success' | t }}`, translations.paymentMethods.remove.success);
          ReCharge.Modal.close();
        } catch (error) {
          console.error(error);
          let errorMessage = `{{ "cp_something_went_wrong" | t }}`;
          if (error.response && error.response.data && error.response.data.error) {
            errorMessage = error.response.data.error;
          }

          ReCharge.Forms.toggleButtonLoading(buttonEl);
          ReCharge.Toast.addToast(`{{ 'cp_toast_error' | t }}`, errorMessage);
        } finally {
          isApiRequestPending = false;
        }
      },
    });
  }

  function addCardWindowListener(onSuccess) {
    const listener = (event) => {
      if (
        event.origin.includes('shopifysubscriptions.com') ||
        event.origin.includes('.rechargeapps.com')
      ) {
        if (event.data?.error) {
          ReCharge.Toast.addToast('error', event.data.error);
          return;
        }

        if (event.data?.billingComplete) {
          const {
            newPaymentMethodId,
            shouldUpdateAllSubs
          } = event.data;
          onSuccess(newPaymentMethodId, shouldUpdateAllSubs);
          window.removeEventListener('message', listener);
          return;
        }
      }
    }
    window.addEventListener('message', listener, false);
  }

  function createDrawerSpinner() {
    const drawerSpinner = createSpinner({ size: 50 });
    drawerSpinner.style.position = 'absolute';
    drawerSpinner.style.top = '24px';
    drawerSpinner.style.left = 'calc(50% - 25px)';
    return drawerSpinner;
  }

  function onEditPaypal(e) {
    const drawerContent = `{% include '_edit_paypal_payment_method.html' %}`;

    ReCharge.Drawer.open({
      header: translations.paymentMethods.edit.header,
      content: drawerContent,
    });

    const paymentSummaryEl = e.composedPath().find(el => el.classList.contains('rc-expandable-card--details')).querySelector('.payment-type');
    document.querySelector('.edit-paypal-payment-method-container .payment-method').innerHTML = paymentSummaryEl.innerHTML;
  }

  function onEditPaymentMethod(e) {
    const paymentMethodId = getPaymentMethodIdFromEvent(e);
    const selectedPaymentMethod = rcPaymentMethods.find(pm => pm.id === paymentMethodId);

    if (selectedPaymentMethod?.payment_type === 'PAYPAL') {
      onEditPaypal(e);
      return;
    }

    // Get the card url and add the id to it before the query
    let url = '{{ payment_methods_card_form_url }}';
    url = url.includes('?') ? url.replace('?', `/${paymentMethodId}?`) : `${url}/${paymentMethodId}`;
    ReCharge.Drawer.open({ header: translations.paymentMethods.edit.header, content: `<iframe src="${url}" id="customer-card-form" name="customer-card-form" frameborder="0" allowtransparency="true" style="display: none;"></iframe>` });

    // Get the frame and setup a spinner to display while loading
    const frameEl = document.getElementById('customer-card-form');
    const drawerSpinner = createDrawerSpinner();
    frameEl.insertAdjacentElement('afterend', drawerSpinner);

    if(isShopify(selectedPaymentMethod)) {
      onEditShopifyPaymentMethod(e);
      return;
    }

    onEditBillingAddress(e);
  }

  function createLoadingPaymentMethodCard() {
    const card = document.createElement('div');
    card.classList.add('rc-card', 'd-flex', 'justify-center');
    card.style.position = 'relative';
    const spinner = createSpinner({ size: 24 });
    card.append(spinner);
    return card;
  }

  function updateAllSubsToNewPaymentMethod(paymentMethodId) {
    return Promise.all(
      ReCharge.Novum.addresses.map(address =>
        ReCharge.Api.updateShippingAddress({
          id: address.id,
          payment_method_id: paymentMethodId
        })
      )
    );
  }

  async function renderNewPaymentMethod() {
    try {
      const loader = createLoadingPaymentMethodCard();
      {% if not useMultiplePaymentMethods %}
      paymentMethodCardsEl.replaceChildren(loader);
      {% else %}
      paymentMethodCardsEl.append(loader)
      {% endif %}
      rcPaymentMethods = (await ReCharge.Api.getPaymentMethods()).data.payment_methods;
      allsubscriptions = (await ReCharge.Api.getSubscriptions()).data.subscriptions;
      loader.remove();
      renderPaymentMethods();
    } catch (e) {
      console.log(e)
      window.location.reload();
    }
  }

  function onAddPaymentMethod() {
    ReCharge.Drawer.open({
      header: translations.paymentMethods.add.header,
      content: `
        <iframe
          src="{{ payment_methods_card_form_url }}"
          id="customer-card-form"
          name="customer-card-form"
          frameborder="0"
          allowtransparency="true"
          style="display: none;"
        ></iframe>
      `
    });

    // Get the frame and setup a spinner to display while loading
    const frameEl = document.getElementById('customer-card-form');
    const drawerSpinner = createDrawerSpinner();
    frameEl.insertAdjacentElement('afterend', drawerSpinner);

    frameEl.addEventListener('load', () => {
      // Hide the spinner and show the frame once it's loaded
      drawerSpinner.style.display = 'none';
      frameEl.style.display = 'block';
    });

    // When the card update is successful, try to fetch it and rerender. Otherwise reload the page as a fallback
    addCardWindowListener(async function onSuccess(newPaymentMethodId, shouldUpdateAllSubs = false) {
      ReCharge.Toast.addToast(`{{ 'cp_toast_success' | t }}`, translations.paymentMethods.add.success);

      try {
        if (shouldUpdateAllSubs || !useMultiplePaymentMethods) {
          await updateAllSubsToNewPaymentMethod(newPaymentMethodId);
          await renderNewPaymentMethod();
          ReCharge.Drawer.close();
        } else {
          await renderNewPaymentMethod();
          const newPaymentMethod = rcPaymentMethods.find(pm => pm.id === newPaymentMethodId);
          await onMoveSubscriptions(newPaymentMethod);
        }
      } catch (e) {
        console.error(e);
        window.location.reload();
      }
    });
  }

  let fetchedAddresses;
  async function onMoveSubscriptions(paymentMethod) {
    try {
      ReCharge.Drawer.open({ 
        header: translations.paymentMethods.move.header, 
        content: `
          <div
            id="PaymentMethodsMoveSubscriptions"
            class="payment-methods-move-subscriptions mb-5"
          >
            <h3 class="payment-method-header rc-subheading mb-5">
               ${translations.paymentMethods.move.selectedPaymentMethodHeader}
            </h3>
            <div data-payment-method></div>
            <div class="rc-divider mt-5 mb-4"></div>
            <h3 class="payment-method-subs-header rc-subheading">
              ${translations.paymentMethods.move.subscriptionsHeader}
            </h3>
            <div data-subscriptions class="mb-5">
              <div class="loader d-flex justify-center"></div>
            </div>
            <div class="d-flex flex-column">
                <button class="move-btn rc-btn rc_btn rc_btn--primary bbrc-btn mb-0" disabled>
                  ${translations.paymentMethods.move.submitBtn}
                </button>
                <button class="skip-btn rc-btn rc-btn--link py-4">
                  ${translations.paymentMethods.move.skipBtn}
                </button>
            </div>
          </div>
        `});

      const paymentMethodEl = document.querySelector('[data-payment-method]');
      const subscriptionsEl = document.querySelector('[data-subscriptions]');
      const moveButtonEl = document.querySelector('.move-btn');
      const skipButtonEl = document.querySelector('.skip-btn');

      if (moveButtonEl) {
        moveButtonEl.addEventListener('click', () => skipButtonEl.setAttribute('disabled', ''));
      }

      subscriptionsEl.querySelector('.loader').append(createSpinner({ size: 44 }));
      skipButtonEl.addEventListener('click', ReCharge.Drawer.close);

      MoveSubscriptions.renderPaymentMethod(paymentMethodEl, paymentMethod);
      MoveSubscriptions.addUpdateAddressesEventListener({
        element: moveButtonEl,
        paymentMethod,
        onSubscriptionsMoved: async () => {
          try {
            rcPaymentMethods = (await ReCharge.Api.getPaymentMethods()).data.payment_methods;
            allsubscriptions = (await ReCharge.Api.getSubscriptions()).data.subscriptions;
            renderPaymentMethods();
            ReCharge.Drawer.close({unlockWindow: true});
            fetchedAddresses = undefined; // Require the addresses to be refetched, since this got updated
          } catch (e) {
            console.error(e);
            ReCharge.Toast.addToast(`{{ 'cp_toast_error' | t }}`, `{{ "cp_something_went_wrong" | t }}`);
          } finally {
            delete window.locked;
          }
        } 
      });

      const templates = {
        notSupported: translations.paymentMethods.move.notSupported,
        noAddresses: translations.paymentMethods.move.noAddresses,
        addressCheckbox: ({ address, subscriptionsList, paymentMethod , checkbox }) => {
          const displayAddress = createAddress(address);
          return `
            <div class="mb-4 d-flex text-body-2">
              <div class="mr-2">${checkbox}</div>
              <div>
                <div class="subscriptions mb-3">${subscriptionsList}</div>
                <div class="font-bold">${translations.paymentMethod.header}</div>
                <div class="mb-3">${paymentMethod}</div>
                <div class="font-bold">${translations.shipping.addressHeader}</div>
                ${displayAddress}
              </div>
            </div>
          `
        }
      };
      // If we already fetched the addreses, use them
      fetchedAddresses = fetchedAddresses || (await ReCharge.Api.getShippingAddresses({ includeSubscriptions: true })).data.addresses;
      MoveSubscriptions.renderAddressCheckboxes(subscriptionsEl, fetchedAddresses, paymentMethod, templates);
    } catch(e) {
      console.error(e);
    }
  }

  renderPaymentMethods();

  if (customer.can_add_payment_method || !useMultiplePaymentMethods) {
    const addPaymentMethodButton = document.querySelector('.add-payment-method');

    addPaymentMethodButton.classList.remove("d-none");
    addPaymentMethodButton.addEventListener('click', onAddPaymentMethod);

    const urlParams = new URLSearchParams(window.location.search)
    const autoOpenAdd = urlParams.get('add') === 'true';
    if(autoOpenAdd) {
      setTimeout(() => onAddPaymentMethod(), 100);
    }
  }
})();
