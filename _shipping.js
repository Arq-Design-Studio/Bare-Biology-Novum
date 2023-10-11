const rcSettings = {{ settings | json }};
const rcShippingAddresses = {{ addresses | json }};

// Remove old countries in case it still exists
sessionStorage.removeItem('rc_shipping_countries');
// Used by the country/province select utils
sessionStorage.setItem('rc_shipping_countries', JSON.stringify({{ shipping_countries | json }}));
const rcPaymentMethods = {{ payment_methods | json }};
const useMultiplePaymentMethods = {{ useMultiplePaymentMethods | json }};
// IIFE to not muddy up the global context
(function () {
  const { createCardLogo, createPaymentMethodDetails } = ReCharge.Components;

  const { renderExpandableCard, createRadio } = ReCharge.Novum.Components;
  const { getAddressDom, getAssociatedSubscriptionsDom, render } = ReCharge.Novum.DomCreators;
  const { addTooltip } = ReCharge.Components;
  let isApiRequestPending = false; // Is there a request pending on this page?
  const allowEditAddress = rcSettings.customer_portal.edit_shipping_address; // Can the user edit their shipping addresses?
  const allowAddAddress = allowEditAddress && rcPaymentMethods.length > 0; // Allow user to add when using Recharge payment methods and they can edit
  const { translations } = ReCharge;

  // Creating the v-dom for shipping cards
  const shippingInfoCardsEl = document.createElement('div');
  shippingInfoCardsEl.classList.add('shipping-info-cards');
  document.getElementById('ShippingPage')?.append(shippingInfoCardsEl);

  function getAddressIdFromEvent(event) {
    return Number(event.composedPath().find(el => el.getAttribute('data-address-id')).getAttribute('data-address-id')); // Get the current address id
  }

  // Will recalculate all the content that needs to change to not require a reload
  function getDynamicShippingContent(address, paymentMethod) {
    let cardSummary = translations.shipping.noPaymentMethod;

    if (paymentMethod) { // Only show card info if the payment method exists (we can get into a state where one isn't added yet)
      cardSummary = `
        <span class="mr-2 d-flex">
          ${createCardLogo(paymentMethod)}
          ${createPaymentMethodDetails(paymentMethod)}
        </span>
      `;
    }

    return {
      address: getAddressDom(address),
      cardSummary
    }
  }

  // Renders all the cards. We use js so we don't require a complete reload of the page on any changes
  function renderShippingInfoCards(addresses = rcShippingAddresses) {
    addresses.forEach(address => {
      // There can only be one associated, so always picking first
      const paymentMethod = address.include.payment_methods[0];

      let element = document.querySelector(`.shipping-info[data-address-id="${address.id}"]`);
      const hasRendered = !!element;
      const content = getDynamicShippingContent(address, paymentMethod);

      // Disable remove if there are subscriptions, as we can't remove if they have subscriptions tied to them
      const disableRemove = address.subscriptions.length;

      const disablePaymentMethodMove =
        (paymentMethod && rcPaymentMethods.length === 1) ||
        (!paymentMethod && rcPaymentMethods.length === 0);

      // Generate the element if it hasn't been rendered yet
      if (!hasRendered) {
        element = document.createElement('div');
        element.classList.add('shipping-info', 'rc-expandable-card');
        element.classList.add('shipping-info', 'rc_card_custom');
        element.setAttribute('data-address-id', address.id);

        // Generate the shipping info
        element.innerHTML = `
            <div class="address-info rc-expandable-card--summary position-relative">
              <div class="grid-250">
                <div class="shipping-address-container">
                  <h4 class="rc-subheading hidden">${translations.shipping.addressHeader}</h4>
                  <div class="shipping-address primary-font">
                    ${content.address}
                  </div>
                </div>
              </div>
            </div>
            <div class="rc-expandable-card--details">
             {% if useMultiplePaymentMethods %}
                  <div class="payment-method-container">
                    <h4 class="rc-subheading">${translations.shipping.associatedPaymentMethodHeader}</h4>
                    <div class="card-summary primary-font">
                      ${content.cardSummary}
                    </div>
                  </div>
              {% endif %}
              <div class="details-container primary-font">
                ${getAssociatedSubscriptionsDom(address.subscriptions)}
                <div class="actions mt-5 d-flex justify-end secondary-font">
                  <button type="button" class="remove-shipping-info rc_btn--link justify-center" data-address-id="${address.id}" ${render(disableRemove && 'disabled')}>
                    ${translations.shipping.removeAddressBtn}
                  </button>
                  {% if useMultiplePaymentMethods %}
                    ${render(`
                      <button class="change-payment-method rc_btn--link justify-center" type="button" data-address-id="${address.id}" ${disablePaymentMethodMove && 'disabled'}>
                        ${translations.shipping.changePaymentMethodBtn}
                      </button>
                    `)}
                  {% endif %}
                  ${render(allowEditAddress && `
                  <button class="edit-address rc_btn--link justify-center" type="button" data-address-id="${address.id}">
                    ${translations.shipping.editAddressBtn}
                  </button>`)}
                </div>
              </div>
            </div>
          `;

        // Add the element to the dom
        renderExpandableCard(element);
        shippingInfoCardsEl.append(element);
        element.querySelector('.edit-address')?.addEventListener('click', onEditAddress);
        element.querySelector('.change-payment-method')?.addEventListener('click', onChangePaymentMethod);

        // Add a tooltip if we aren't allowed to remove
        if (disableRemove) {
          addTooltip(element.querySelector('.remove-shipping-info'), {
            content: translations.shipping['removeAddressBtnTooltipSubscriptions']
          });
        } else {
          element.querySelector('.remove-shipping-info')?.addEventListener('click', onRemoveShippingInfo);
        }

        if (disablePaymentMethodMove) {
          addTooltip(element.querySelector('.change-payment-method'), {
            content: translations.shipping.updatePaymentMethod.disabledTooltip
          });
        }
      } else {
        // If it has already been rendered lets just update the dynamic content
        element.querySelector('.shipping-address').innerHTML = content.address;
        const cardSumEl = element.querySelector('.card-summary');
        if (cardSumEl) {
          cardSumEl.innerHTML = content.cardSummary;
        }
      }
    });

    const renderedAddresses = document.querySelectorAll('.shipping-info[data-address-id]');
    if (renderedAddresses.length) {
      // Remove all addresses that no longer exist
      renderedAddresses.forEach((el) => {
        const addressId = Number(el.getAttribute('data-address-id'));
        if (!addresses.some(address => address.id === addressId)) {
          shippingInfoCardsEl.removeChild(el);
        }
      });
    }

    // If there are no addresses rendered, show no shipping info 
    const emptyEl = shippingInfoCardsEl.querySelector('.empty');
    if (!document.querySelector('.shipping-info[data-address-id]')) {
      shippingInfoCardsEl.innerHTML = `<p class="empty">${translations.shipping.noResults}</p>`;
    } else if (emptyEl) {
      // Remove the no shipping text if it exists and there are addresses to show
      shippingInfoCardsEl.removeChild(emptyEl);
    }
  }

  function onRemoveShippingInfo(evt) {
    const id = getAddressIdFromEvent(evt);
    ReCharge.Modal.open({
      title: translations.shipping.remove.title,
      content: translations.shipping.remove.text,
      confirmBtnText: translations.shipping.remove.confirm,
      onConfirm: async (e) => {
        try {
          await ReCharge.Api.submitRequest(() => ReCharge.Api.deleteShippingAddress(id), {
            key: `deleteShippingAddress_${id}`,
            submitButton: e.target,
            successMessage: translations.shipping.remove.success
          });

          // Remove the shipping address and update the dom
          const idx = rcShippingAddresses.findIndex(address => address.id === id);
          rcShippingAddresses.splice(idx, 1);
          renderShippingInfoCards();

          ReCharge.Modal.close();
        } catch (error) { }
      },
    });
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

  async function onUpdateAddress(evt) {
    evt.preventDefault();

    const buttonEl = evt.target.querySelector('.save-address');
    ReCharge.Forms.toggleButtonLoading(buttonEl);
    try {
      window.locked = true;
      const id = getAddressIdFromEvent(evt);
      const address = await saveAddress(id)

      const idx = rcShippingAddresses.findIndex(addr => addr.id === address.id);
      rcShippingAddresses[idx] = { ...rcShippingAddresses[idx], ...address };
      renderShippingInfoCards();
      ReCharge.Toast.addToast(`{{ 'cp_toast_success' | t }}`, translations.shipping.edit.success);
      ReCharge.Drawer.close({unlockWindow: true});
    } catch (error) {
      ReCharge.Forms.toggleButtonLoading(buttonEl);
    } finally {
      delete window.locked;
    }
    return false;
  }

  function onEditAddress(evt) {
    const id = getAddressIdFromEvent(evt);
    const address = rcShippingAddresses.find(addr => addr.id === id);

    ReCharge.Drawer.open({
      header: translations.shipping.edit.header,
      content: `
        <form id="Recharge_Address_Form" data-address-id="${id}">
          {% set addressType = 'shipping' %}
          {% include '_address_fields.html' %}
          <button type="submit" class="save-address rc_btn rc_btn--primary bbrc-btn">
            ${translations.common.saveBtn}
          </button>
        </form>
      ` });

    ReCharge.formUtils.setupCountryProvinceSelectors('shipping');
    // Update all the values to be what is current used
    ReCharge.formUtils.populateAddressData(address);

    // Add submit handler
    document.forms.Recharge_Address_Form.addEventListener('submit', onUpdateAddress);
  }

  async function onSavePaymentMethod(evt) {
    evt.preventDefault();
    try {
      window.locked = true;
      const paymentMethodId = Number(document.querySelector('input[name="paymentMethod"]:checked').value);
      const id = getAddressIdFromEvent(evt);
      const address = (await ReCharge.Api.submitRequest(() => ReCharge.Api.updateShippingAddress({ id, payment_method_id: paymentMethodId }), {
        key: `updateShippingAddress_${id}`,
        submitButton: evt.target.querySelector('.save-payment-method'),
        successMessage: translations.shipping.updatePaymentMethod.success
      }))?.data?.address;

      const idx = rcShippingAddresses.findIndex(addr => addr.id === address.id);
      rcShippingAddresses[idx] = {
        ...rcShippingAddresses[idx],
        ...address,
        include: {
          // payment method doesn't come back on resource, so adding it here
          payment_methods: [rcPaymentMethods.find(pm => pm.id === paymentMethodId)]
        }
      };

      renderShippingInfoCards();
      ReCharge.Drawer.close({unlockWindow: true});
    } catch (error) { } finally {
      delete window.locked;
    }
    return false;
  }

  function renderPaymentMethodOptions(paymentMethods, selectedPaymentMethod) {
    const optionContainer = document.querySelector('.payment-method-options');

    paymentMethods.forEach((paymentMethod) => {
      optionContainer.append(createRadio({
        id: paymentMethod.id,
        value: paymentMethod.id,
        isChecked: selectedPaymentMethod?.id === paymentMethod.id,
        name: 'paymentMethod',
        label: createPaymentMethodDetails(paymentMethod),
      }));
    });
  }

  function onChangePaymentMethod(evt) {
    const id = getAddressIdFromEvent(evt);
    const address = rcShippingAddresses.find(addr => addr.id === id);

    ReCharge.Drawer.open({
      header: `${translations.shipping.updatePaymentMethod.header}`,
      content: `
        <form id="RechargePaymentMethodForm" data-address-id="${id}">
          <p class="rc-subtext mb-0">
            ${translations.shipping.updatePaymentMethod.for} ${address.address1}${address.address2 ? ` ${address.address2}` : ''}, ${address.city}, ${address.province} ${address.zip}.
          </p>
          <div class="payment-method-options mb-5"></div>
          <button type="submit" class="save-payment-method rc-btn rc-btn--primary">
            ${translations.common.saveBtn}
          </button>
        </form>
      ` });

    const currentPaymentMethod = address.include.payment_methods[0];
    renderPaymentMethodOptions(rcPaymentMethods, currentPaymentMethod);

    // Add submit handler
    document.forms.RechargePaymentMethodForm.addEventListener('submit', onSavePaymentMethod);
  }

  async function saveAddress(id) {
    if (isApiRequestPending) return;
    isApiRequestPending = true;
    try {
      const addressPromise = id ? ReCharge.Api.updateShippingAddress : ReCharge.Api.createShippingAddress;
      const values = getAddressFormData();
      // For SPM we automatically associate the first PM with the address
      if (!useMultiplePaymentMethods) {
        values.payment_method_id = rcPaymentMethods[0].id
      }
      const address = (await addressPromise(id ? { id, ...values } : values))?.data?.address;
      isApiRequestPending = false;
      return address;
    } catch (error) {
      console.error(error)
      const errorMessage = error.response?.data?.errors?.all || error.response?.data?.errors?.province || `{{ "cp_something_went_wrong" | t }}`;
      ReCharge.Toast.addToast(`{{ 'cp_toast_error' | t }}`, errorMessage);
      isApiRequestPending = false;
      throw error; // rethrow error to allow other functions to adapt
    }
  }

  // Keep track of the wizards state
  let wizardState = {
    backListenerAdded: undefined,
    address: undefined,
    isDone: false
  };

  function onAddShippingInfoClick() {
    // Reset the current wizard state when opened
    wizardState = {
      backListenerAdded: undefined,
      address: undefined,
      isDone: false
    };
    ReCharge.Drawer.open({
      header: translations.shipping.add.addressHeader,
      content: `
        <!-- Step 1 -->
        <form id="RechargeAddressForm">
          <h4 class="rc-subheading mb-5">
            {% if useMultiplePaymentMethods %}
            ${translations.shipping.add.infoHeader}
            {% else %}
            ${translations.shipping.add.addressHeader}
            {% endif %}
          </h4>
          {% set addressType = 'shipping' %}
          {% include '_address_fields.html' %}
          <button type="submit" class="next rc_btn rc_btn--secondary secondary-font">
            {% if useMultiplePaymentMethods %}
            ${translations.shipping.add.nextBtn}
            {% else %}
            ${translations.shipping.add.saveBtn}
            {% endif %}
          </button>
        </form>
        <!-- Step 2 -->
        <form id="RechargePaymentMethodForm" style="display: none;">
          <h4 class="rc-subheading mb-2">${translations.shipping.add.paymentMethodHeader}</h4>
          <p class="rc-subtext mb-0">
           ${translations.shipping.add.associatePaymentMethod}
          </p>
          <div class="payment-method-options mt-5"></div>
          <button type="submit" class="add-payment-method rc-btn rc-btn--primary">
            ${translations.shipping.add.saveBtn}
          </button>
        </form>
      `,
      onBack: () => {
        // If we have an address and we aren't done, this means we are on the payment method step
        if (wizardState.address && !wizardState.isDone) {
          document.forms.RechargeAddressForm.style.display = 'block';
          document.forms.RechargePaymentMethodForm.style.display = 'none';
          ReCharge.Drawer.toggleBackBtn(false);
        }
      }
    });

    // Update the countries/province dropdowns
    ReCharge.formUtils.setupCountryProvinceSelectors('shipping');

    // Add payment methods to dom
    // If there are shopify payment methods, only allows those to be used. Otherwise use the other methods
    renderPaymentMethodOptions(rcPaymentMethods, rcPaymentMethods[0]);

    // Add submit handler for step 1
    document.forms.RechargeAddressForm.addEventListener('submit', async (evt) => {
      evt.preventDefault();
      const buttonEl = evt.target.querySelector('.next');
      ReCharge.Forms.toggleButtonLoading(buttonEl);
      try {
        wizardState.address = await saveAddress(wizardState.address?.id); // If an address exists, lets just update it instead

        if (useMultiplePaymentMethods) {
          // Toggle the steps
          document.forms.RechargeAddressForm.style.display = 'none';
          document.forms.RechargePaymentMethodForm.style.display = 'block';
          ReCharge.Drawer.toggleBackBtn(true);
  
          // Make sure we don't keep readding the listeners
          if (!wizardState.backListenerAdded) {
            const deleteAddressListener = () => {
              if (wizardState.address && !wizardState.isDone) {
                axios.delete(ReCharge.Endpoints.shipping(wizardState.address.id));
                delete wizardState.address;
              }
              document.getElementById('sidebar-underlay').removeEventListener('click', deleteAddressListener);
              document.querySelector('#te-modal .close-btn').removeEventListener('click', deleteAddressListener);
            };
  
            // Add listener to delete address if drawer closes without adding the payment method
            document.getElementById('sidebar-underlay').addEventListener('click', deleteAddressListener);
            document.querySelector('#te-modal .close-btn').addEventListener('click', deleteAddressListener);
            wizardState.backListenerAdded = true;
          }
        } else {
          // Adding the newly created address
          rcShippingAddresses.push({
            ...wizardState.address,
            include: {
              payment_methods: [rcPaymentMethods[0]]
            },
            subscriptions: []
          });

          renderShippingInfoCards();
          ReCharge.Toast.addToast(`{{ 'cp_toast_success' | t }}`, translations.shipping.add.success);
          ReCharge.Drawer.close();
        }

      } catch (e) {
        // Do nothing, as errors are already handled
      } finally {
        ReCharge.Forms.toggleButtonLoading(buttonEl);
      }
      return false;
    });

    // Add submit handler for step 2
    document.forms.RechargePaymentMethodForm.addEventListener('submit', async (evt) => {
      evt.preventDefault();
      if (isApiRequestPending) return false;
      isApiRequestPending = true;
      const buttonEl = evt.target.querySelector('.add-payment-method');
      ReCharge.Forms.toggleButtonLoading(buttonEl);
      try {
        window.locked = true;
        const paymentMethodId = Number(document.querySelector('input[name="paymentMethod"]:checked').value);
        await ReCharge.Api.updateShippingAddress({ id: wizardState.address.id, payment_method_id: paymentMethodId });
        wizardState.isDone = true;

        // Adding the newly created address
        rcShippingAddresses.push({
          ...wizardState.address,
          include: {
            // payment method doesn't come back on resource, so adding it here
            payment_methods: [rcPaymentMethods.find(pm => pm.id === paymentMethodId)]
          },
          subscriptions: []
        });

        renderShippingInfoCards();
        ReCharge.Toast.addToast(`{{ 'cp_toast_success' | t }}`, translations.shipping.add.success);
        ReCharge.Drawer.close({unlockWindow: true});
      } catch (error) {
        console.error(error);
        const errorMessage = error.response?.data?.error || `{{ "cp_something_went_wrong" | t }}`;

        ReCharge.Forms.toggleButtonLoading(buttonEl);
        ReCharge.Toast.addToast(`{{ 'cp_toast_error' | t }}`, errorMessage);
      } finally {
        isApiRequestPending = false;
        delete window.locked;
      }
      return false;
    });
  }

  document.querySelector('.add-shipping-info')?.addEventListener('click', onAddShippingInfoClick);

  renderShippingInfoCards();

  if (allowAddAddress) {
    document.querySelector('.add-shipping-info').classList.remove('d-none');
  }
})();
