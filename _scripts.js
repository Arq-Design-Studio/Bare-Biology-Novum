var ReCharge = {};
ReCharge.Novum = {
    get sidebarHeading() {
        return document.querySelector("#te-modal-heading span");
    },
    get sidebarContent() {
        return document.getElementById("te-modal-content");
    },
    get backBtn() {
        return document.querySelector('.js-back-btn');
    }
};

{% include '_components.js' %}

ReCharge.Utils = {
    getParamValue: function(param) {
        var value = new RegExp("[?&]" + param + "=([^&#]*)", "i").exec(window.location.href);
        return value ? value[1] : null;
    },
    hasMinimumOrderAmount: function(orders) {
        const minimumOrderCount = {{ settings.customer_portal.subscription.cancellation_minimum_order_count }};

        return minimumOrderCount === 0 || orders.length >= minimumOrderCount;
    },
    checkIfStoreAllowsCancellation: async function() {
        const cancelBtn = document.querySelector(".js-cancel-sub-btn") || null;
        if (!cancelBtn) return;

        const { cancel_subscription, cancellation_minimum_order_count, cancellation_enable_pause_options, cancellation_enable_pause_options_values } = {{ settings | json }}.customer_portal.subscription;
        const subscription = ReCharge.Novum.subscription;

        const { orders, charges, retention_strategies } = await ReCharge.Novum.Helpers.fetchCharges();

        sessionStorage.setItem('rc_retention_strategies', JSON.stringify(retention_strategies));

        const hasPauseSubscriptionEnabled = cancellation_enable_pause_options && cancellation_enable_pause_options_values.length;

        if (
            cancel_subscription &&
            this.hasMinimumOrderAmount(orders) &&
            hasPauseSubscriptionEnabled
        ) {
            cancelBtn.addEventListener("click", pauseSubscriptionFlow);
            return;
        } else if (cancel_subscription && this.hasMinimumOrderAmount(orders) && !hasPauseSubscriptionEnabled) {
            cancelBtn.addEventListener("click", cancelSubscriptionFlow);
            return;
        } else {
            ReCharge.Utils.contactStoreWording(
                cancelBtn,
                ReCharge.Utils.renderCancelSubscriptionLayout(),
                `{{ 'cp_cancel_cancel_title' | t }}`
            );
        }
    },
    contactStoreWording: function(element, message, title) {
        element.addEventListener('click', () => {
            ReCharge.Novum.sidebarHeading.innerHTML = title;
            ReCharge.Novum.sidebarContent.innerHTML = `<div class="text-center"><br>${message}</div>`;
            ReCharge.Novum.toggleSidebar(element);
        });
    },
    renderContactStoreLayout: function(message) {
        return `
            <p class="text-center">
                {{ 'cp_please_contact_us_at' | t }}
                <span class="address-info-msg title-bold">
                    {{ settings.customer_portal.subscription.cancellation_email_contact }}
                </span> {{ 'cp_to_update_prefix' | t }} ${message.toLowerCase()}.
            </p>
        `;
    },
    renderCancelSubscriptionLayout: function() {
        return `
            <span class="title-bold">
                {{ 'cp_cancel_message_to_user' | t }}
            </span>
            {{ 'cp_to_cancel_your_subscription_please_email_us_at' | t }}
            <span class="address-info-msg title-bold">
                {{ settings.customer_portal.subscription.cancellation_email_contact }}
            </span>
            {{ 'cp_process_your_cancellation_no_charged_for_this_subscription' | t }}
        `;
    },
    renderNoProductsLayout: function() {
        return `
            <h2>{{ 'cp_try_something_new' | t }}</h2>
            <div>{{ 'cp_add_product_to_next_package' | t }}</div>
            <div class="text-center margin-top-10" id="upsells--loader"> {{ 'cp_no_products_to_show' | t }}</div>
        `;
    },
    renderErrorFetchingProductsLayout: function() {
        return `
            <h2>{{ 'cp_try_something_new' | t }}</h2>
            <div class="margin-bottom-10">{{ 'cp_add_product_to_next_package' | t }}</div>

            <div class="rc-card mb-5 cursor-pointer">
                <p class="text-font-14 margin-bottom-20 error-message">{{ 'cp_error_fetching_products' | t }}</p>
                <button
                    class="rc_btn rc_btn--primary bbrc-btn text-uppercase title-bold text-center"
                    onclick="window.location.reload()">{{ 'cp_try_again' | t }}
                </button>
            </div>
        `;
    },
    renderChargeProcessSuccessLayout(type, data = {}) {
        if (type === 'one') {
            ReCharge.Novum.sidebarContent.innerHTML = `
                <div>
                    {{ 'cp_your_order_of' | t }}
                    <strong class="title-bold"> ${ReCharge.Novum.subscription.product_title.replace('Auto renew', '')} </strong>
                    ${
                        ReCharge.Novum.subscription.variant_title &&
                        ReCharge.Novum.subscription.variant_title !== `Default title`
                            ? `<strong class="title-bold"> ${ReCharge.Novum.subscription.variant_title} </strong>`
                            : ``
                    }
                    {{ 'cp_will_be_processed_today' | t }}
                </div>
                <br>
                <button
                    class="rc_btn rc_btn--primary bbrc-btn text-uppercase title-bold margin-top-10"
                    onclick="window.location.reload()"
                >
                    {{ 'cp_i_understand_button' | t }}
                </button>
            `;

        } else {
            const dateData = ReCharge.Utils.calculateNextChargeDate(
                new Date(),
                ReCharge.Novum.subscription.order_interval_unit,
                Number(ReCharge.Novum.subscription.order_interval_frequency)
            );

            const { charge } = data;
            const updatedProductText = charge
                ? charge.line_items.map(item => `<strong class="title-bold">${item.title}</strong>`).join(', ')
                :   `
                    <strong class="title-bold">${ReCharge.Novum.subscription.product_title.replace('Auto renew', '')}</strong>
                    ${ReCharge.Novum.subscription.variant_title &&
                    ReCharge.Novum.subscription.variant_title !== `Default title`
                        ? `<strong class="title-bold"> ${ReCharge.Novum.subscription.variant_title} </strong>`
                        : ``}
                `;

            ReCharge.Novum.sidebarContent.innerHTML = `
                <div>
                    {{ 'cp_your_order_of' | t }}
                    ${updatedProductText}
                    {{ 'cp_has_been_successfully_processed_to_see_info_browse_to' | t }}
                    <a href="{{ order_list_url }}" class="title-bold">
                        {{ 'Purchase_History_Tab' | t }}
                    </a>.
                    {{ 'cp_next_order_processed_on' | t }}
                </div>
                <br>
                <h3 class="color-light-green text-center">
                    ${dateData.month} ${dateData.futureDate.getDate()}${dateData.futureDateSuffix}
                </h3>
                <button
                    class="rc_btn text-uppercase title-bold margin-top-10"
                    onclick="ReCharge.Utils.redirectToPurchaseHistoryPage(event)"
                >
                    {{ 'cp_i_understand_button' | t }}
                </button>
            `;
        }
    },
    redirectToPurchaseHistoryPage(ev) {
        ev.preventDefault();
        ReCharge.Forms.toggleSubmitButton(ev.target);
        window.location.href = "{{ order_list_url }}";
    },
    calculateNextChargeDate(dateValue, unit, frequency) {
        let shipmentDate = new Date(dateValue);
        let futureDate = new Date(dateValue);

        if (unit === 'day' || unit === 'days') {
            futureDate.setDate(futureDate.getDate() + frequency);
        } else if (unit === 'week' || unit === 'weeks') {
            const newUnit = frequency * 7
            futureDate.setDate(futureDate.getDate() + newUnit);
        } else {
            futureDate.setMonth(futureDate.getMonth() + frequency);
        }

        const month = futureDate.toLocaleString('default', { month: 'long' });
        const shipmentDateSuffix = ReCharge.Novum.Utils.getNumberSuffix(shipmentDate.getDate());
        const futureDateSuffix = ReCharge.Novum.Utils.getNumberSuffix(futureDate.getDate());
        const formattedDate = ReCharge.Utils.formatISODate(shipmentDate);

        return {
            formattedDate,
            month,
            futureDate,
            shipmentDate,
            shipmentDateSuffix,
            futureDateSuffix
        }
    }
};

ReCharge.Toast = {
    addToastListener: function(toaster) {
        toaster.addEventListener('animationend', function(e) {
            if (e.animationName === 'hide') {
                return toaster.removeChild(e.target);
            }
        });
    },
    buildToaster: function() {
        var toaster = document.createElement('ul');
        toaster.className = 'rc_toaster';
        ReCharge.Toast.addToastListener(toaster);

        return toaster;
    },
    buildToast: function(type, message) {
        type = typeof(type) === 'undefined'
            ? `{{ 'cp_toast_error'  | t }}`
            : type;
        message = typeof(message) === 'undefined'
            ? `{{ 'cp_toast_message_failed' | t }}`
            : message;

        // Build elements
        var notice = document.createElement('li'),
            category = document.createElement('span'),
            content = document.createElement('p');

        // Add content
        category.innerHTML = type.charAt(0).toUpperCase() + type.slice(1);
        content.innerHTML = message;

        // Assemble notice
        notice.className = 'rc_toast rc_toast--' + type;
        notice.appendChild(category).className = 'rc_toast__type';
        notice.appendChild(content).className = 'rc_toast__message';

        return notice;
    },
    addToast: function (type, message) {
        var notice = ReCharge.Toast.buildToast(type, message);
        try {
            document.querySelector('.rc_toaster').appendChild(notice);
        } catch (e) {
            document.querySelector('body')
                .appendChild(ReCharge.Toast.buildToaster())
                .appendChild(notice);
        }
    }
};

ReCharge.Helpers = {
    toggle: function(id) {
        var element = document.getElementById(id);
        element.style.display = element.style.display === 'none' ? '' : 'none';
        return false;
    }
}

ReCharge.Forms = {
    getCountries: (type = 'shipping') => {
        // If no countries try to get the generic countries to work on all pages
        return JSON.parse(sessionStorage.getItem(`rc_${type}_countries` || sessionStorage.getItem('rc_countries'))) || [];
    },
    prettyError: message => {
        message = message.split('_').join(' ');
        return message.charAt(0).toUpperCase() + message.slice(1);
    },
    printError: (form, input, error) => {
        const elementSelector = input == 'general' ? 'button[type="submit"]' : `input[name="${input}"]`;
        const inputElem = form.querySelector(elementSelector);
        const errorMessage = document.createElement('p');

        errorMessage.className = 'error-message';
        errorMessage.innerText = ReCharge.Forms.prettyError(error);

        try {
            inputElem.className = inputElem.className += ' error';
            inputElem.parentNode.insertBefore(errorMessage, inputElem.nextSibling);
        } catch (e) {
            console.warn(form, input, error, e);
            ReCharge.Toast.addToast(`{{ 'cp_toast_warning' | t }}`, ReCharge.Forms.prettyError(error));
        }
    },
    printAllErrors: (form, errors) => {
        Object.keys(errors).forEach(input => {
            const input_errors = Array.isArray(errors[input]) ? errors[input] : [errors[input]];
            input_errors.forEach(error => {
                ReCharge.Forms.printError(form, input, error);
            });
        });
    },
    updatePropertyElements: (name, value) => {
        document.querySelectorAll(`[data-property="${name}"]`).forEach(elem => elem.innerText = value);
    },
    updateAllProperties: elements => {
        Object.keys(elements).forEach(key => {
            const elem = elements[key];
            ReCharge.Forms.updatePropertyElements(elem.name, elem.value);
        });
    },
    resetErrors: () => {
        document.querySelectorAll('input.error').forEach(elem => {
            elem.className = elem.className.replace('error', '');
        });
        document.querySelectorAll('p.error-message').forEach(elem => {
            elem.parentNode.removeChild(elem);
        });
    },
    buildCountries: function(type = 'shipping') {
        let countries = ReCharge.Forms.getCountries(type);

        const countryEl = document.getElementById('country');
        if ( !countries.length || !countryEl) { return; }
        var activeCountry = countryEl.getAttribute('data-value'),
            options = `<option value="">{{ 'cp_please_select_a_country' | t }}</option>`;
        options += countries.map(function(country) {
            var selected = (country.name === activeCountry) ? ' selected' : '';
            return '<option value="' + country.name + '"' + selected + '>' + country.name + '</option>';
        }).join('\n');
        countryEl.innerHTML = options;

        ReCharge.Forms.updateProvinces(countryEl, type);
    },
    showProvinceDropdown: function() {
        if (!document.querySelector('#province') || !document.querySelector('#province_selector')) { return; }
        document.querySelector('#province').setAttribute('style', 'display: none;');
        document.querySelector('#province_selector').setAttribute('style', 'display: inline-block;');
    },
    hideProvinceDropdown: function() {
        if (!document.querySelector('#province') || !document.querySelector('#province_selector')) { return; }
        document.querySelector('#province').setAttribute('style', 'display: inline-block;');
        document.querySelector('#province_selector').setAttribute('style', 'display: none;');
    },
    updateProvinceInput: function(elem) {
        if (!document.querySelector('#province')) { return; }
        document.querySelector('#province').value = elem.value;
    },
    updateProvinces: function(elem, type = 'billing') { // default is billing to keep default behavior
        const countries = ReCharge.Forms.getCountries(type);

        if (!countries.length || !document.querySelector('#province')) { return; }
        const country = countries.find(function(country) {
            return country.name === elem.value;
        });
        if (!country || !country.provinces.length) {
            window.ReCharge.Forms.hideProvinceDropdown();
            return;
        }
        var provinces = country.provinces,
            activeProvince = document.querySelector('#province').value,
            options = `<option value="">{{ 'cp_select_province' | t }}</option>`;
        options +=  provinces.map(function(province) {
            var selected = (province.name === activeProvince) ? ' selected' : '';
            return '<option value="' + province.name + '"' + selected + '>' + province.name + '</option>';
        }).join('\n');
        document.querySelector('#province_selector').innerHTML = options;
        ReCharge.Forms.showProvinceDropdown();
    },
    toggleSubmitButton: function(elem) {
        elem.disabled = !elem.disabled;
        let newText = elem.getAttribute('data-text') || `{{ "cp_processing_message" | t }}`;
        if (elem.disabled) {
            elem.innerHTML = `
                <div class="title-bold" style="display: flex; justify-content: center; align-items: center;">
                    ${newText}
                    <img src="https://static.rechargecdn.com/static/images/spinner-anim-3.gif?rev={{ REVISION }}" style="width: 30px; height: 12px;" class="margin-left-10">
                </div>
            `;
        } else {
            elem.innerHTML = newText;
        }
    },
    toggleButtonLoading(buttonEl) {
        // Will save the previous text and reapply it when toggled back
        const isDisabled = buttonEl.disabled;

        let originalText = buttonEl.getAttribute('data-original-text');
        if (!originalText) {
            originalText = buttonEl.innerText;
            buttonEl.setAttribute('data-original-text', originalText);
        }

        if(isDisabled) {
            buttonEl.innerHTML = originalText;
            // Reset height/width to original values
            buttonEl.style.width = '';
            buttonEl.style.height = '';
        } else {
            // Set the width/height so it doesn't change sizes when showing spinner
            buttonEl.style.width = buttonEl.offsetWidth;
            buttonEl.style.height = buttonEl.offsetHeight;
            buttonEl.replaceChildren(ReCharge.Novum.spinner);
        }
        buttonEl.toggleAttribute('disabled');
    },
    decodeResponse: function(response) {
        if (typeof(response) === 'string') {
            return response;
        }

        return response['error'] || response['errors'];
    },
    populateAddressData: function(address) {
        const requiredAddressData =  [ "first_name", "last_name", "address1", "address2", "company", "city", "zip", "phone", "province"];

        for (const prop in address) {
            requiredAddressData.includes(prop)
                ? document.querySelector(`#${prop}`).value = address[prop]
                : '';
        }

        document.querySelector("#country")
                .setAttribute("data-value", address.country);
    },
    getFormData: function(form) {
        const formEntries = new FormData(form).entries();
        let data = Object.assign(
            ...Array.from(
                formEntries,
                ([x, y]) => ({ [x] : y })
            )
        );

        return data;
    }
};

ReCharge.Endpoints = {
    base: "{{ shopify_proxy_url if proxy_redirect else '' }}/portal/{{ customer.hash }}/",
    request_objects: function() {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}request_objects`);
    },
    // Addresses endpoints
    list_addresses_url: function() {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}addresses`);
    },
    create_address_url: function() {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}addresses/new`);
    },
    show_address_url: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}addresses/${id}`);
    },
    // Subscriptions endpoints
    list_subscriptions_url: function() {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}subscriptions`);
    },
    create_subscription_url: function() {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}subscriptions/new`);
    },
    show_subscription_url: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}subscriptions/${id}`);
    },
    update_subscription_url: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}subscriptions/${id}`);
    },
    // Subscription action endpoints
    activate_subscription_url: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}subscriptions/${id}/activate`);
    },
    skip_subscription_url: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}subscriptions/${id}/skip`);
    },
    delay_order_url: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}orders/${id}/delay`);
    },
    unskip_subscription_url: function (id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}subscriptions/${id}/unskip`);
    },
    swap_subscription_url: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}subscriptions/${id}/swap`);
    },
    subscription_charge_date_url: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}subscriptions/${id}/set_next_charge_date`);
    },
    delay_subscription_url: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}subscriptions/${id}/delay`);
    },
    update_subscription_payment_method: function(subscriptionId, paymentMethodId) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}subscriptions/${subscriptionId}/move/payment_method/${paymentMethodId}`);
    },
    update_subscription_address: function(subscriptionId, addressId) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}subscriptions/${subscriptionId}/move/address/${addressId}`);
    },
    subscription_pause: function(id){
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}subscriptions/${id}/set_next_charge_date?pause=true`);
    },
    // Subscription cancel endpoints
    cancel_subscription_url: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}subscriptions/${id}/cancel`);
    },
    retention_strategy_url: function(data) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}subscriptions/${data['id']}/cancel/${data['strategy']}`);
    },
    // Discount endpoints
    apply_discount_to_address_url: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}addresses/${id}/apply_discount`);
    },
    remove_discount_from_address_url: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}addresses/${id}/remove_discount`);
    },
    // One-time endpoints
    cancel_onetime_product: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}onetimes/${id}/cancel`);
    },
  	// process charge
  	process_charge: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}charges/${id}/process`);
    },
    create_onetime: function() {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}onetimes`);
    },
    update_onetime: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}onetimes/${id}`);
    },
    update_next_charge_date: function(url) {
        return ReCharge.Novum.Utils.attachQueryParams(url);
    },
    onetime_charge_date_url: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}onetimes/${id}/set_next_charge_date`);
    },
    update_billing_address: function(id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}payment_source/${id ? id : '1'}/address`);
    },
    create_billing_address: function() {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}payment_source/address`);
    },
    get_payment_method_form: function(id="") {
        // {# We need to get the url from the server since it can correctly builds the url for #}
        // {# different environments like preprod/prestage. #}
        var url = "{{ payment_source_iframe_url }}";
        url = url.replace("--payment_method_id_placeholder--", id ?? "")
        return ReCharge.Novum.Utils.attachQueryParams(url)
    },
    send_shopify_connector_email: function() {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}notifications`);
    },
    shipping: function (id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}shipping/${id}`);
    },
    payment_methods: function (id) {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}payment_methods/${id}`);
    },
    customer: function () {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}customer`);
    },
    logout: function () {
        return ReCharge.Novum.Utils.attachQueryParams(`${this.base}logout`);
    }
};

ReCharge.Api = {
    /** Pending api requests */
    pendingRequests: {},
    /** Submits a promise, updates the form's loading state, and only allows the request to be submitted once */
    submitRequest: async (...args) => {
       return ReCharge.Api._.submitRequest(...args);
    },
    getPaymentMethods: () => {
        return ReCharge.Api._.getPaymentMethods();
    },
    getCreditAccounts: () => {
        return ReCharge.Api._.getCreditAccounts();
    },
    getShippingAddresses: (...args) => {
        return ReCharge.Api._.getShippingAddresses(...args);
    },
    getShippingAddress: async (...args) => {
        return ReCharge.Api._.getShippingAddress(...args);
    },
    getSubscriptions: () => {
        return ReCharge.Api._.getSubscriptions();
    },
    createShippingAddress: async (...args) => {
        return ReCharge.Api._.createShippingAddress(...args);
    },
    updateShippingAddress: async (...args) => {
        return ReCharge.Api._.updateShippingAddress(...args);
    },
    deleteShippingAddress: async (id) => {
        return axios.delete(ReCharge.Endpoints.shipping(id))
    },
    updateCustomer: async (customer) => {
        const { data } = await axios.post(ReCharge.Endpoints.customer(), customer);
        return data.customer;
    },
    updateSubscriptionAddress: (...args) => {
        return ReCharge.Api._.updateSubscriptionAddress(...args);
    },
    createUpdateSubscriptionAddress: (...args) => {
        return ReCharge.Api._.createUpdateSubscriptionAddress(...args);
    },
    updatePaymentMethodForSelectedSubscriptionOnly: (...args) => {
        return ReCharge.Api._.updatePaymentMethodForSelectedSubscriptionOnly(...args);
    },
    getFirstQueuedOrderBySubscriptionId: (...args) => {
        return ReCharge.Api._.getFirstQueuedOrderBySubscriptionId(...args);
    }
};

ReCharge.Actions = {
    get: async function(endpoint, id, schema) {
        if (window.locked) { return false; } else { window.locked = true; }
        if (typeof(endpoint) === 'undefined' || typeof(id) === 'undefined' || typeof(schema) === 'undefined') {
            return false;
        }

        let url = ReCharge.Endpoints[endpoint](id);
        console.log('get', url);

        const dataUrl = ReCharge.Novum.Utils.attachQueryParams(`${ReCharge.Endpoints.request_objects()}&schema=${schema}`);

        try {
            const response = await axios(dataUrl);
            console.log(response.data);
        } catch(error) {
            console.error(error);
        } finally {
            delete window.locked;
        }
    },
    post: async function(endpoint, id, data) {
        if (window.locked) { return false; } else { window.locked = true; }
        if (typeof(endpoint) === 'undefined') { return false; }

        var url = ReCharge.Endpoints[endpoint](id, data);
        console.log('post', url);
        let dataUrl = ReCharge.Novum.Utils.attachQueryParams(url);

        try {
            const response = await axios({
                url: dataUrl,
                method: 'post',
                data
            });
            return response.data;
        } catch(error) {
            const msg = error.response?.data?.error;
            // String matching the error coming back from the api
            const errorStringKey = 'Inventory unavailable';
            const isOutOfStockError = msg?.includes(errorStringKey);
            const errorMessage = isOutOfStockError ? `{{ "cp_order_now_out_of_stock" | t }}` : `{{ "cp_something_went_wrong" | t }}`;
            ReCharge.Toast.addToast(`{{ 'cp_toast_error' | t }}`, errorMessage);
            throw new Error(error);
        } finally {
            delete window.locked;
        }
    },
    put: async function(endpoint, id, data, productTitle = null) {
        if (window.locked) { return false; } else { window.locked = true; }
        if (typeof(endpoint) === 'undefined' || typeof(id) === 'undefined') { return false; }

        var url = ReCharge.Endpoints[endpoint](id, data);
        console.log('put', url);
        let dataUrl = ReCharge.Novum.Utils.attachQueryParams(url);

        let translation = `{{ 'cp_product_added' | t }}`;
        translation = translation.replace('{cp_placeholder}', productTitle);
        let successMessage = productTitle ? translation : `{{ "cp_updated_successfully" | t }}`;

        try {
            const response = await axios({
                url: dataUrl,
                method: 'post',
                data
            });
            console.log(response.data);
            ReCharge.Toast.addToast(
                `{{ 'cp_toast_success' | t }}`, successMessage);
            if (data && data.redirect_url) {
                window.location.href = ReCharge.Novum.Utils.attachQueryParams(data.redirect_url);
            } else {
                window.location.reload();
            }
        } catch(error) {
            console.error(error.response.data.error);
            ReCharge.Toast.addToast(`{{ 'cp_toast_error' | t }}`, error.response.data.error);
        } finally {
            delete window.locked;
        }
    },
    sendRequest: async function(evt, dataToSend = null) {
        evt.preventDefault();
        if (window.locked) {
            return false;
        }

        ReCharge.Forms.resetErrors();
        const form = evt.target;
        let url = form.getAttribute('action');
        let submitBtn = evt.target.querySelector('[type="submit"]');
        let buttonText = submitBtn.innerText;

        ReCharge.Forms.toggleSubmitButton(submitBtn);

        let dataUrl = ReCharge.Novum.Utils.attachQueryParams(url);
        let redirectUrl = form.querySelector('[name="redirect_url"]') || null;

        try {
            const response = await axios({
                url: dataUrl,
                method: 'post',
                data: dataToSend ? dataToSend : new FormData(form)
            });
            console.log(response.data);

            ReCharge.Toast.addToast(`{{ 'rc_toast_success' | t }}`, `{{ "cp_updates_saved_successfully" | t }}`);
            if (redirectUrl !== null) {
                if (dataToSend && dataToSend.redirect_url) {
                    return window.location.href = dataToSend.redirect_url;
                }
                window.location.href = ReCharge.Novum.Utils.attachQueryParams(redirectUrl.value.split('?')[0]);
            } else {
                window.location.reload();
            }
        } catch(errorData) {
            ReCharge.Forms.toggleSubmitButton(submitBtn);
            submitBtn.innerText = buttonText;

            const errors = ReCharge.Forms.decodeResponse(errorData.response.data);
            console.error('errors', errors);

            if (typeof (errors) === 'object') {
                ReCharge.Forms.printAllErrors(evt.target, errors);
                ReCharge.Toast.addToast(`{{ 'rc_toast_error' | t }}`, `{{ "cp_fix_form_errors" | t }}`);
            } else {
                ReCharge.Toast.addToast(`{{ 'rc_toast_error' | t }}`, ReCharge.Forms.prettyError(errors));
            }
        } finally {
            delete window.locked;
        }
    },
    getProducts: async function(limit = 6, productsSchema = null, url = null, requestedActionType = 'add_product') {
        const schema = productsSchema || ReCharge.Schemas.products.list(limit, requestedActionType);

        let dataUrl = ReCharge.Novum.Utils.attachQueryParams(`
            ${ReCharge.Endpoints.request_objects()}&schema=${schema}`
        );

        ReCharge.Novum.Pagination.limit = limit;

        if (url) {
            dataUrl = url;
        }

        try {
            const response = await axios(dataUrl);
            ReCharge.Novum.products = response.data.products;
            if (
                response.data.meta &&
                response.data.meta.products
            ) {
                ReCharge.Novum.meta = response.data.meta.products;
                if (limit === 12) {
                    ReCharge.Novum.upsellMeta = response.data.meta.products;
                    ReCharge.Novum.Pagination.limit = 12;
                } else if (limit === 6) {
                    ReCharge.Novum.addMeta = response.data.meta.products;
                    ReCharge.Novum.Pagination.limit = 6;
                }
            }
            if (
                response.data.products &&
                !Array.isArray(response.data.products)
            ) {
                ReCharge.Novum.products = [response.data.products];
                response.data.products = [response.data.products];
            }

            return response.data;
        } catch(error) {
            console.error(error);
            return [];
        } finally {
            delete window.locked;
        }
    }
}

ReCharge.Schemas = {
    subscriptions: function(id) {
        if (id) {
        return '{ "subscription": { "id": ' + id + ' } }';
        }
        return '{ "subscriptions": { "product": {} } }' ;
    },
    products: {
        list(limit = 6, requestedActionType = 'add_product', page = 1) {
            let actionType = `, "action_type": "${requestedActionType}"`;

            return `{ "products": { "base_source": "store_settings", "limit": ${limit}, "page": ${page} ${actionType} } }`;
        },
        search(query, limit = 6, page = 1, requestedActionType = "add_product") {
            let title = ``;
            let excludePrepaids = `, "exclude_prepaids": true`;
            let actionType = `, "action_type": "${requestedActionType}"`;

            if (query.length > 0) {
                title = `"title": "${query}",`;
            }

            if (requestedActionType != "swap_product") {
                excludePrepaids = ``;
            }

            return `{ "products": { ${title} "base_source": "store_settings", "limit": ${limit}, "page": ${page} ${excludePrepaids} ${actionType}  } }`;
        },
        getProduct(id) {
            return `{ "products": { "shopify_product_id": ${id} } }`;
        }
    },
    charges: {
        perSubscription(addressId, subId) {
            return `{ "charges": { "address_id": "${addressId}", "subscription_id": "${subId}", "status": "QUEUED" }, "orders": { "status": "SUCCESS", "subscription_id": "${subId}" }, "retention_strategies": { "subscription_id": "${subId}", "sort_by":"id-asc" } }`;
        },
        plusOnetimes(addressId, subId) {
            return `{ "charges": { "address_id": "${ addressId }", "subscription_id": "${ subId }", "status": "QUEUED" }, "onetimes": { "product": {} } }`;
        }
    },
    addresses: {
        countries: function() {
            return `{ "shipping_countries": [], "billing_countries": [] }`;
        }
    },
    discounts: {
        list: function(id) {
            if (id) {
                return `{ "discounts": {"id": ${id} } }`;
            }
            return `{ "discounts": [] }`;
        }
    }
};

ReCharge.Subscription = {
    list: function() {
        return ReCharge.Actions.get('request_objects', null, ReCharge.Schemas.subscriptions());
    },
    get: function(id) {
        return ReCharge.Actions.get('request_objects', null, ReCharge.Schemas.subscriptions(id));
    },
    create: function(data) {
        return ReCharge.Actions.put('create_subscription_url', null, data);
    },
    update: function(id, data) {
        return ReCharge.Actions.put('update_subscription_url', id, data);
    },
    activate: function(id) {
        return ReCharge.Actions.put('activate_subscription_url', id, {});
    },
    skip: function(id, charge_id, date) {
        return ReCharge.Actions.put('skip_subscription_url', id, { charge_id: charge_id, date: date });
    },
    pause: function(id, date) {
        return ReCharge.Actions.put('update_subscription_pause_url', id, {date: date})
    },
    unskip: function(id, charge_id) {
        return ReCharge.Actions.put('unskip_subscription_url', id, { charge_id: charge_id });
    },
    setChargeDate: function(id, date) {
        return ReCharge.Actions.put('subscription_charge_date_url', id, { date: date });
    },
    delay: function(id, delay) {
        return ReCharge.Actions.put('delay_subscription_url', id, { days: delay });
    },
    swap: function(id, variant_id) {
        return ReCharge.Actions.put('swap_subscription_url', id, { shopify_variant_id: variant_id });
    },
    cancel: function(id, strategy, data) {
        if (typeof(data) === 'undefined') { data = {}; }
        return ReCharge.Actions.put('retention_strategy_url', { id: id, strategy: strategy }, data);
    },
};

ReCharge.Discount = {
    apply: function(id, discount_code) {
        return ReCharge.Actions.put('apply_discount_to_address_url', id, { 'discount_code': discount_code });
    },
    remove: function(id, discount_code) {
        return ReCharge.Actions.put('remove_discount_from_address_url', id, { 'discount_code': discount_code });
    },
    calculateDiscountedPrice: function (product, price) {
        let discountedPrice = price;
        if (product.subscription_defaults) {
            discountedPrice = ReCharge.Utils.getPriceWithDiscount(product, discountedPrice);
        }

        return discountedPrice;
    }
};

ReCharge.Drawer = {
    setHeader: (header) => {
        document.querySelector('#te-modal-heading span').innerHTML = header;
    },
    setContent: (content) => {
        if(typeof content === 'string') {
            document.getElementById('te-modal-content').innerHTML = content;
        } else {
            document.getElementById('te-modal-content').replaceChildren(content);
        }
    },
    setOnBack: (onBack) => {
        // If an onBack is passed, add the event
        const backBtn = document.querySelector('#te-modal .back-btn');
        if(onBack && backBtn){
            // Use onclick so we completely replace event
            backBtn.onclick = () => {
                if (window.locked) return;

                onBack();
            }
        }
    },
    open: ({ header, content, onBack } = {}) => {
        ReCharge.Drawer.setHeader(header);
        ReCharge.Drawer.setContent(content);

        // Set focus to the drawer
        document.getElementById('te-modal').focus();
        // Set the content height to fill the rest of the space based on header height
        const modalContent = document.getElementById('te-modal-content');
        if (window.matchMedia('(max-width: 460px)').matches) {
            modalContent.style.height = `calc(100% - ${document.getElementById('te-modal-heading').offsetHeight+70}px)`
        } else {
            modalContent.style.height = `calc(100% - ${document.getElementById('te-modal-heading').offsetHeight}px)`;
        }

        document.body.classList.add('locked');
        document.getElementById('sidebar-underlay').classList.add('visible');
        document.getElementById('te-modal').classList.add('visible');
        document.querySelectorAll('.close-sidebar').forEach(sidebar => sidebar.addEventListener('click', ReCharge.Drawer.close));

        ReCharge.Drawer.toggleBackBtn(false);
        ReCharge.Drawer.setOnBack(onBack);
    },
    close: ({unlockWindow} = {unlockWindow: false}) => {
        if (unlockWindow) delete window.locked;

        if (window.locked) return;

        document.querySelector('body').classList.remove('locked');
        document.getElementById('sidebar-underlay').classList.remove('visible');
        document.getElementById('te-modal').classList.remove('visible');
        setTimeout(() => {
            // Clear contents after the drawer is closed
            if(!document.getElementById('te-modal').classList.contains('visible')){
                ReCharge.Drawer.setHeader('');
                ReCharge.Drawer.setContent('');
            }
        }, 300);
    },
    toggleBackBtn: (isShown, onBack) => {
        const modal = document.getElementById('te-modal');
        modal.querySelector('.back-btn').style.visibility = !isShown ? 'hidden' : '';
        // If an onBack is passed, set it on the drawer
        ReCharge.Drawer.setOnBack(onBack)
    }
}

// Standalone modal utility that can render an accessible modal anywhere (Only 1 can be open at a time)
ReCharge.Modal = {
    open({
      title,
      content,
      cancelBtnText = ReCharge.translations.common.modal.cancel,
      confirmBtnText = ReCharge.translations.common.modal.confirm,
      onConfirm
    }) {
      // Creating overlay
      const modalOverlay = document.createElement('div');
      modalOverlay.id = 'rc-modal--overlay'
      modalOverlay.classList.add('rc-modal__overlay');

      // Creating modal container
      const modal = document.createElement('div');
      modal.id = 'rc-modal';
      modal.classList.add('rc-modal');
      modal.innerHTML = `
        <section class="rc-modal__content" id="rc-modal--content" aria-modal="true" aria-labelledby="rc-modal--header" aria-describedby="rc-modal--body" tabIndex="-1">
            <header class="rc-modal__header" id="rc-modal--header"></header>
            <button class="rc-modal__close-btn" aria-label="${ReCharge.translations.common.modal.close}">
                <svg width="14" height="14" viewBox="0 0 14 14" focusable="false" fill="none" aria-hidden="true"><path d="M14 1.41L12.59 0L7 5.59L1.41 0L0 1.41L5.59 7L0 12.59L1.41 14L7 8.41L12.59 14L14 12.59L8.41 7L14 1.41Z" fill="#67727A"/></svg>
            </button>
            <div class="rc-modal__body" id="rc-modal--body"></div>
            <footer class="rc-modal__footer">
                <button type="button" class="rc-modal__cancel-btn rc-btn rc-btn--primary-text"></button>
                <button type="button" class="rc-modal__confirm-btn rc-btn rc-btn--primary"></button>
            </footer>
        </section>
      `;

      // Adding all the configurable content
      modal.querySelector('#rc-modal--header').innerHTML = title;
      modal.querySelector('#rc-modal--body').innerHTML = content;
      modal.querySelector('.rc-modal__confirm-btn').innerHTML = confirmBtnText;
      modal.querySelector('.rc-modal__cancel-btn').innerHTML = cancelBtnText;

      // Initial style for the transition
      const modalContent = modal.querySelector('#rc-modal--content');
      modalContent.style.transition = 'all 200ms ease-in-out'
      modalContent.style.opacity = 0;
      modalContent.style.transform = 'translateY(20%)';

      // Add all the modal elements to the page
      const container = document.getElementById('recharge-te')
      container.append(modalOverlay, modal)

      // Trigger the animation once everything is rendered
      setTimeout(() => {
        modalContent.style.opacity = 1;
        modalContent.style.transform = 'translateY(0%)';
      }, 0)

      // Adding event listeners
      const confirmBtn = modal.querySelector('.rc-modal__confirm-btn');
      const cancelBtn = modal.querySelector('.rc-modal__cancel-btn');
      const modalCloseBtn = modal.querySelector('.rc-modal__close-btn');
      confirmBtn.addEventListener('click', onConfirm);
      cancelBtn.addEventListener('click', ReCharge.Modal.close);
      modalCloseBtn.addEventListener('click', ReCharge.Modal.close);
    },
    close() {
      const modalContent = document.getElementById('rc-modal--content');
      modalContent.style.opacity = 0;
      modalContent.style.transform = 'translateY(20%)';
      // Transition the modal out and remove it once complete
      setTimeout(() => {
        document.getElementById('rc-modal').remove();
        document.getElementById('rc-modal--overlay').remove();
      }, 200);
    }
}

ReCharge.Novum.spinner = ReCharge.Novum.DomCreators.createSpinner();

if (window.location.pathname.indexOf("{{ shopify_proxy_url if proxy_redirect else '' }}") == -1) {
    ReCharge.Endpoints.base = '/portal/{{ customer.hash }}/';
}

document.addEventListener('submit', async evt => {
    const formId = 'ReChargeForm_';

    if (!evt.target.id.toString().includes(formId)) {
        return;
    }

    ReCharge.Actions.sendRequest(evt);
});

// Translations that are used in the js files.
{% include '_translations.js' %}

function initLogoutListener() {
    const logoutLink = `/account/logout`;
    const logoutSelector = '#rc_account_logout';
    const backToAccountSelector = '[data-rc-account-link]';

    async function _logout (e, redirectUrl) {
        e.preventDefault();
        try {
            await axios(ReCharge.Endpoints.logout())
        } catch (err) {
            console.log(err)
        } finally {
            window.location.href = redirectUrl;
        }
    }

    const logoutLinks = document.querySelectorAll(`[href="${logoutLink}"`) || null ;
    if (logoutLinks) {
        logoutLinks.forEach(e => {
            e.addEventListener('click', (event) => _logout(event, logoutLink))
        });
    }

    const logoutElement = document.querySelector(logoutSelector) || null;
    if (logoutElement) {
        logoutElement.addEventListener('click', (event) => _logout(event, document.querySelector(backToAccountSelector).href))
    }
};

document.addEventListener('DOMContentLoaded', initLogoutListener);
