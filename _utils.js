// Return a string URL with "?token=asd2310&preview_standard_theme=2" or "?token=asd2310&preview_theme=1111" params
// attached if they exist on the current location
const attachQueryParams = (address) => {
    let url = new URL(address, window.location);
    let params = new URLSearchParams(url.search);

    let token = (new URLSearchParams(window.location.search)).get("token");
    if (token && !params.get("token")) {
        params.set("token", token)
    }

    let preview_theme = (new URLSearchParams(window.location.search)).get("preview_standard_theme");
    if (preview_theme && !params.get("preview_standard_theme")) {
        params.set("preview_standard_theme", preview_theme);
    }

    let themeEnginePreview = (new URLSearchParams(window.location.search)).get("preview_theme");
    if (themeEnginePreview && !params.get("preview_theme")) {
        params.set("preview_theme", themeEnginePreview);
    }

    let previewToken = (new URLSearchParams(window.location.search)).get("preview_token");
    if (previewToken && !params.get("preview_token")) {
        params.set("preview_token", previewToken);
    }

    if(params.toString() === '') {
        url.search = params.toString().concat('?preview=false');
    } else {
        url.search = params.toString();
    }

    return url.toString();
};

ReCharge.Novum.Utils = {
    attachQueryParams: attachQueryParams,
    capitalize: str => ReCharge.Utils.capitalize(str),
    getFormattedBrand: paymentMethod => ReCharge.Utils.formatReadable(paymentMethod.payment_details?.brand),
    /** Adds an accessible click event to the element that adds everything needed to meet accessibility requirements */
    addAccessibleClickListener: (element, onClick) => ReCharge.Utils.addAccessibleClickListener(element, onClick),
    formatDate: (date) => ReCharge.Utils.formatISODate(date),
    getImageUrl: (product, shopifyVariantId) => ReCharge.Utils.getProductImageUrl(product, 'small', shopifyVariantId),
    toggleSubscriptionUI: function() {
        const onetime = document.querySelector('[name="purchase_type"]:checked')?.value ===
            "onetime";
        document.querySelector("#product_schedule_container").style.display = onetime ? 'none' : 'block';
    },
    updateFormAction: function() {
        let subscriptionForm = document.querySelector("#subscriptionNewForm");

        if (
            document.querySelector('[name="purchase_type"]:checked').value ===
                "onetime"
        ) {
            subscriptionForm
                .setAttribute("action", "{{ onetime_list_url }}");

            document
                .querySelector('#js-add-product-redirect')
                .value = "{{ schedule_url }}";

        } else {
            subscriptionForm
                .setAttribute("action", "{{ subscription_list_url }}");

            document
                .querySelector('#js-add-product-redirect')
                .value = window.location.href;
        }
    },
    optionChangeCallback: function(evt) {
        // Trigger the variant change callback to ensure correct price display
        ReCharge.Novum.Helpers.triggerVariantUpdate();
        ReCharge.Novum.Utils.toggleSubscriptionUI();
        ReCharge.Novum.Utils.updateFormAction();
    },
    informCustomerHandler: function(evt) {
        evt.preventDefault();
        const value = evt.target.value;

        if (value === "ok") {
            document.querySelector("body").classList.toggle("locked");
            document
                .querySelectorAll(".info-modal")
                .forEach(el => el.setAttribute("style", "display: none;"));
        } else if (value === "cancel") {
            window.close();
        }
    },
    getCurrency: function() {
        let moneySign = 'USD';

        const store = {{ store | json }};

        if (store.currency) {
            moneySign = store.currency;
        } else {
            const price = `{{ 0.00 | money_localized }}`;
            const pattern = (/([\D|a-z]+)/);
            let priceSign = price.match(pattern);

            moneySign = priceSign[0];
        }

        switch (moneySign) {
            case 'USD':
            case 'AUD':
            case 'CAD':
                moneySign = '$';
                break;
            case 'GBP':
                moneySign = '£';
                break;
            case 'EUR':
                moneySign = '€';
                break;
            case 'INR':
                moneySign = '₹';
                break;
            case 'SEK':
                moneySign = 'kr';
                break;
            case 'JPY':
                moneySign = '¥';
                break;
            default:
                moneySign = moneySign;
        }

        return moneySign;
    },
    getZipLabel: function(country = "United States") {
        let zipLabel, provinceLabel;

        if (country === "US" || country === "United States") {
            zipLabel = `{{ 'zip_code' | t }}`;
            provinceLabel = `{{ 'Province_State' | t }}`;
        } else if (country === "UK" || country === "United Kingdom") {
            zipLabel = `{{ 'cp_post_code' | t }}`;
            provinceLabel = `{{ 'cp_region' | t }}`;
        } else {
            zipLabel = `{{ 'Postal_Code' | t }}`;
            provinceLabel = `{{ 'cp_region' | t }}`;
        }

        let labels = document.querySelectorAll(".js-zipcode");
        if (labels) {
            labels.forEach(zip => {
                zip.innerHTML = zipLabel;
            });
        }

        let stateLabels = document.querySelectorAll('.js-statelabel');
        if (stateLabels) {
            stateLabels.forEach(state => {
                state.innerHTML = provinceLabel;
            });
        }
    },
    isPrepaid: function(subscription) {
        return subscription.is_prepaid;
    },
    isPrepaidProduct: function(products){ 
        return products.filter(prod => {
            if (prod.subscription_defaults) {
                if (prod.subscription_defaults.order_interval_frequency_options.length === 1) {
                    return prod.subscription_defaults.charge_interval_frequency === Number(prod.subscription_defaults.order_interval_frequency_options[0])
                }

                return products;
            }
        })
    },
    getNumberSuffix: function(num) {
        let j = num % 10;
        let k = num % 100;

        if (j == 1 && k != 11) {
            return `{{ 'cp_st_suffix' | t }}`;
        }
        if (j == 2 && k != 12) {
            return `{{ 'cp_nd_suffix' | t }}`;
        }
        if (j == 3 && k != 13) {
            return `{{ 'cp_rd_suffix' | t }}`;
        }
        return `{{ 'cp_th_suffix' | t }}`;
    },
    renderSubOnetimes: function(products) {
        return products.map(prod => {
            const { product, shopify_variant_id, product_title, status, variant_title, quantity, price } = prod;

            return `
                <div class="display-flex">
                    <div class="rc_photo_container margin-right-20 margin-bottom-10">
                        <img src="${ReCharge.Utils.getProductImageUrl(product, "small", shopify_variant_id)}" alt="${product_title.replace('Auto renew', '')}">
                    </div>

                    <div class="rc_schedule_wrapper">
                        <div class="rc_order_title_container">
                            <span class="rc_order_title">${product_title.replace('Auto renew', '')}</span>
                        </div>

                        <p>
                            ${status == "ACTIVE" ? `{% include '_subscription-icon.svg' %} {{ "cp_subscription" | t }}` :
                            `{% include '_onetime-icon.svg' %} {{ 'cp_onetime' | t }}`
                            }
                        </p>

                        ${!variant_title ? '' :
                            `<p>${variant_title}</p>`
                        }

                        <p>
                            {{ 'Quantity' }}: ${quantity}
                        </p>

                        <p class="text-font-14">
                            ${ReCharge.Novum.Utils.getCurrency()}${price.toFixed(2)}
                        </p>
                    </div>
                </div>
            `;
        }).join('');
    },
    triggerSingleProductUpdate: function(evt, actionUrl, name, value) {
        ReCharge.Forms.toggleSubmitButton(evt.target);
        const dataToSend = { date: value };
        ReCharge.Actions.put('update_next_charge_date', actionUrl, dataToSend);
    },
    bulkUpdateOnetimes: async function(event, name, value, url) {
        event.preventDefault();
        ReCharge.Forms.toggleSubmitButton(event.target);

        if (window.locked) { return false; } else { window.locked = true; };
        const onetimes = JSON.parse(sessionStorage.getItem("rc_onetimes"));
        const data = { next_charge_scheduled_at: value };
        let subOnetimes;

        subOnetimes = onetimes
            .filter( otp =>
                otp.next_charge_scheduled_at === ReCharge.Novum.subscription.next_charge_scheduled_at &&
                otp.address_id === ReCharge.Novum.subscription.address_id
            );

        try {
            await axios({
                url,
                method: "post",
                data: { date: value }
            });

            syncUpload.upload(subOnetimes, data, 'onetime_charge_date_url');

        } catch (error) {
            console.error(error.response.data.error);
            ReCharge.Toast.addToast(`{{ 'cp_toast_error' | t }}`, `{{ "cp_unable_to_perform_update" | t }}`);
            ReCharge.Forms.toggleSubmitButton(event.target);
        } finally {
            delete window.locked;
        }
    },
    bulkCancelAddonProducts: async function(evt, url) {
        evt.preventDefault();
        ReCharge.Forms.toggleSubmitButton(evt.target.querySelector('button'));

        if (window.locked) { return false; } else { window.locked = true; };

        const { id, next_charge_scheduled_at, address_id } = ReCharge.Novum.subscription;
        let onetimes = JSON.parse(sessionStorage.getItem("rc_onetimes"));

        const onetimesToCancel = onetimes
            .filter(otp =>
                otp.next_charge_scheduled_at === next_charge_scheduled_at &&
                otp.address_id === address_id
            )
            .filter(otp => {
                if (otp.properties.length) {
                    let propertiesAsString = JSON.stringify(otp.properties);
                    if (
                        propertiesAsString.includes('add_on_subscription_id') &&
                        propertiesAsString.includes(id)
                    ) {
                        return otp;
                    } else if (
                        propertiesAsString.includes('add_on') &&
                        propertiesAsString.includes('True')
                    ) {
                        return otp;
                    }
                }
            }
        );

        try {
            await axios({
                url,
                method: "post",
                data: {
                    'cancellation_reason': document.querySelector('[name=cancellation_reason]').value,
                    'cancellation_reason_comments': document.querySelector('[name=cancellation_reason_comments]').value || ''
                }
            });

            if (onetimesToCancel.length) {
                syncUpload.upload(onetimesToCancel, null, 'cancel_onetime_product', true);
            } else {
                window.location.href = "{{ subscription_list_url }}";            
            }


        } catch (error) {
            console.error(error);
            
            ReCharge.Toast.addToast(`{{ 'cp_toast_error' | t }}`, `{{ 'cp_unable_to_perform_update' | t }}`);
            ReCharge.Forms.toggleSubmitButton(evt.target);
        } finally {
            delete window.locked;
        }
    },
    checkInventory: variant => ReCharge.Utils.checkInventory(variant, ReCharge.Novum.settings.customer_portal),
    getAvailableVariants: product => ReCharge.Utils.getAvailableVariants(product, ReCharge.Novum.settings.customer_portal),
    renderOrderFrequencyOptions: (unit, frequency) => ReCharge.Utils.renderOrderFrequencyOptions(unit, frequency),
    translateOrderIntervalUnit: (orderIntervalUnit, frequency) => ReCharge.Utils.formatIntervalFrequency(frequency, orderIntervalUnit, false),
    translateMonth: function(unit) {
        const month = unit.toLowerCase();

        if (month.includes('january')) {
            return `${month.replace('january', `{{ 'January' | t }}` )}`;
        } else if(month.includes('february')) {
            return `${month.replace('february', `{{ 'February' | t }}`)}`;
        } else if(month.includes('march')) {
            return `${month.replace('march', `{{ 'March' | t }}`)}`;
        } else if(month.includes('april')) {
            return `${month.replace('april', `{{ 'April' | t }}`)}`;
        } else if(month.includes('may')) {
            return `${month.replace('may', `{{ 'May' | t }}`)}`;
        } else if(month.includes('june')) {
            return `${month.replace('june', `{{ 'June' | t }}`)}`;
        } else if(month.includes('july')) {
            return `${month.replace('july', `{{ 'July' | t }}`)}`;
        } else if(month.includes('august')) {
            return `${month.replace('august', `{{ 'August' | t }}`)}`;
        } else if(month.includes('september')) {
            return `${month.replace('september', `{{ 'September' | t }}`)}`;
        } else if(month.includes('october')) {
            return `${month.replace('october', `{{ 'October' | t }}`)}`;
        } else if(month.includes('november')) {
            return `${month.replace('november', `{{ 'November' | t }}`)}`;
        } else if(month.includes('december')) {
            return `${month.replace('december', `{{ 'December' | t }}`)}`;
        } else {
            return unit;
        }
    },
    getLocalDate: (rawDate, format, options) => ReCharge.Utils.formatLocalDate(rawDate, format, options),
    addProductDetailsHandler: async function(ev) {
        ev.preventDefault();

        const productId = ev.target.dataset.productId;
        const schema = ReCharge.Schemas.products.getProduct(productId);
        const data =  await ReCharge.Actions.getProducts(6, schema);

        ReCharge.Novum.sidebarHeading.innerHTML = `{{ 'cp_edit_details' | t }}`;
        ReCharge.Novum.sidebarContent.innerHTML = `{% include '_add_product_details.html' %}`;
      
        renderAddProductDetails(data.products[0]);
    },
    createProduct: async function(evt, shopifyId, message = 'create', variants) {
        evt.preventDefault();

        let url = evt.target.getAttribute('action');
        url = attachQueryParams(url);
        const submitBtn = evt.target.querySelector('[type="submit"]');
        const formEntries = new FormData(evt.target).entries();
        const data = Object.assign(
            ...Array.from(
                formEntries,
                ([key, value]) => (
                    { [key] : value }
                )
            )
        );
      
        if (
            data['purchase_type'] && 
            data['purchase_type'] === 'onetime'
        ) {
            delete data['order_interval_unit'];
            delete data['charge_interval_frequency'];
            delete data['order_interval_frequency'];
            delete data['expire_after_specific_number_of_charges'];
        }

        const chosenVariant = variants.find(
            variant => variant.shopify_id == data["shopify_variant_id"]
        );

       const isInStock = ReCharge.Novum.Utils.checkInventory(chosenVariant);

        if (!isInStock) {
            submitBtn.disabled = true;
            submitBtn.textContent = `{{ 'cp_out_of_stock' | t }}`;
            ReCharge.Toast.addToast(`{{ 'cp_toast_error' | t }}`, `{{ 'cp_product_out_of_stock' | t }}`);
        } else {
            ReCharge.Forms.toggleSubmitButton(submitBtn);
            try {
                const response = await axios({
                    url,
                    method: "post",
                    data
                });

                if (message === 'create') {
                    ReCharge.Toast.addToast(
                        `{{ 'cp_toast_success' | t }}`,
                        `{{ 'cp_product_created_successfully' | t }}`
                    );
                } else {
                    ReCharge.Toast.addToast(
                        `{{ 'cp_toast_success' | t }}`,
                        `{{ 'cp_swapped_product_successfully' | t }}`
                    );
                }

                const store = {{ store | json }};
                
                let bundleResponse = null;

                if(store.my_shopify_domain && store.bundles_enabled) {
                    try {
                        const subscriptionId = response.data?.subscription?.id
                        const onetimeId = response.data?.onetime?.id;

                        const isSubscription = !!subscriptionId;

                        const id = subscriptionId || onetimeId;

                        const data = {
                            id,
                            schema: {
                                [isSubscription ? 'subscription' : 'onetime']: {
                                    "id": id,
                                    "bundle_product": {}
                                }
                            }
                        };

                        bundleResponse = await axios({
                            url: ReCharge.Endpoints.request_objects(),
                            params: {
                                token: window.customerToken,
                                schema: JSON.stringify(data.schema)
                            }
                        });

                        if (bundleResponse.data?.subscription?.bundle_product?.id || bundleResponse.data?.onetime?.bundle_product?.id) {
                            return window.location.href = ReCharge.Endpoints.show_subscription_url(data.id);
                        }
                        
                    } catch (error) {
                        console.log(error);
                    }
                }

                if (data.redirect_url) {
                    window.location.href = data.redirect_url;
                } else {
                    window.location.reload();
                }
            } catch (error) {
                console.error(error);
                if (message === 'create') {
                    ReCharge.Toast.addToast(
                        `{{ 'cp_toast_error' | t }}`,
                        `{{ 'cp_unable_to_create_product' | t }}`
                    );
                } else {
                    ReCharge.Toast.addToast(
                        `{{ 'cp_toast_error' | t }}`,
                        `{{ 'cp_unable_to_swap_product' | t }}`
                    );
                }
                submitBtn.disabled = true;
            }
        }
    }
}

const syncUpload = {
    queue: [],
    upload: async function (otps, data, typeUrl, redirect = false) {
        otps.forEach(otp => {
            let url = ReCharge.Endpoints[typeUrl]([otp.id]);

            let request = {
                url,
                method: "post",
                data
            }

            this.queue.push(request);
        });

        this.uploadNext(redirect);
    },
    uploadNext: async function (redirect = false) {
        let queue = this.queue;
        if (queue && queue.length) {
            try {
                await axios(queue.shift(0));
                this.uploadNext(redirect);
            } catch (error) {
                console.error(error);
                ReCharge.Toast.addToast(`{{ 'cp_toast_error' | t }}`, `{{ 'cp_unable_to_perform_update' | t }}`);
                //ReCharge.Forms.toggleSubmitButton(event.target);
            }
        } else {
            ReCharge.Toast.addToast(`{{ 'cp_toast_success' | t }}`, '{{ "cp_updates_saved_successfully" | t }}');

            if(redirect){
                window.location.href = "{{ schedule_url }}";
            }else{
                window.location.reload();
            }
        }
    }
}

ReCharge.Novum.Pagination = {
    currentUpsellPage: 1,
    currentAddPage: 1,
    type: 'add',
    limit: 6,
    hasPrevMeta: function(type) {
        if (type === 'add') {
            return ( 
                ReCharge.Novum.addMeta &&
                ReCharge.Novum.addMeta.previous
            )
        }

        return (
            ReCharge.Novum.upsellMeta &&
            ReCharge.Novum.upsellMeta.previous
        )
    },
    hasNextMeta: function(type) {
        if (type === 'add') {
            return ( 
                ReCharge.Novum.addMeta &&
                ReCharge.Novum.addMeta.next
            )
        }

        return (
            ReCharge.Novum.upsellMeta &&
            ReCharge.Novum.upsellMeta.next
        )
    },
    previousPageHandler: function(ev) {     
        const handlerType = ev.target.closest('[data-handler-type]').dataset.handlerType;

        if (this.hasPrevMeta(handlerType)) {
            if (handlerType === 'add') {
                url = ReCharge.Novum.addMeta.previous;
                this.currentAddPage > 1
                    ? this.currentAddPage -= 1
                    : ''
                ;
            } else {
                url = ReCharge.Novum.upsellMeta.previous;
                this.currentUpsellPage > 1
                    ? this.currentUpsellPage -= 1
                    : ''
                ;
            } 
            this.goToPageHandler(
                handlerType,
                ev,
                url
            );
        }
    },
    nextPageHandler: function(ev) {
        const handlerType = ev.target.closest('[data-handler-type]').dataset.handlerType;
        if (this.hasNextMeta(handlerType)) { 
            let url = '';
            if (handlerType === 'add') {
                url = ReCharge.Novum.addMeta.next;
                this.currentAddPage += 1;
            } else {
                url = ReCharge.Novum.upsellMeta.next;
                this.currentUpsellPage += 1;
            }     
            this.goToPageHandler(
                handlerType,
                ev,
                url
            );
        }
    },
    goToPageHandler: async function(handlerType, ev, url) {
        this.disableButtons(handlerType);
        this.type = handlerType;

        let schema = ReCharge.Schemas.products.list(6, `upsell_product`);

        if (handlerType === 'upsell') {
            const data =  await ReCharge.Actions.getProducts(12, schema, url);
            ReCharge.Novum.Helpers.renderUpsells(data.products);
        } else {
            let type = 'add';
            if (ReCharge.Novum.isSwap) {
                ev.target.closest('[data-handler-type]').dataset.handlerType;
                type = 'swap';
            }
            schema = ReCharge.Schemas.products.list(6, `${type}_product`);

            const data =  await ReCharge.Actions.getProducts(6, schema, url);
            ReCharge.Novum.Helpers.renderProducts(data.products, type);
        }
        
        const page = handlerType === 'upsell' 
            ? this.currentUpsellPage 
            : this.currentAddPage;

        this.updateButtonState(handlerType);

        this.updateCurrentPageNumber(page, handlerType);
    },
    disableButtons: function(type) {
        document
            .querySelector(`.rct_pagination__prev--${type}`)
            .classList.add('rct_pagination__prev--disabled');

        document
            .querySelector(`.rct_pagination__next--${type}`)
            .classList.add('rct_pagination__next--disabled');
    },
    enableButtons: function(type) {
        document
            .querySelector(`.rct_pagination__prev--${type}`)
            .classList.remove('rct_pagination__prev--disabled');

        document
            .querySelector(`.rct_pagination__next--${type}`)
            .classList.remove('rct_pagination__next--disabled');  
    },
    updateButtonState(type) {
        const prevBtnAction = this.hasPrevMeta(type) ? 'remove' : 'add';
        const nextBtnAction = this.hasNextMeta(type) ? 'remove' : 'add';

        document
            .querySelector(`.rct_pagination__prev--${type}`)
            .classList[prevBtnAction]('rct_pagination__prev--disabled');

        document
            .querySelector(`.rct_pagination__next--${type}`)
            .classList[nextBtnAction]('rct_pagination__next--disabled');
    },
    updateCurrentPageNumber: function(page = null, type) {
        if (ReCharge.Novum.isSwap) {
            document
                .querySelector(`.rct_pagination__current--${type}`)
                .innerText = page;
            return;
        }

        return document
            .querySelector(`.rct_pagination__current--${type}`)
            .innerText = page;
    },
    toggle: function(shouldShow = null) {
        if (shouldShow) {
            return document
                .querySelector(`.rct_pagination__container--${this.type}`)
                .classList.remove('rct_pagination__container--hidden');
        }

        document
            .querySelector(`.rct_pagination__container--${this.type}`)
            .classList.add('rct_pagination__container--hidden');
    },
    updatePagination: function() {
        this.currentAddPage = 1;
        this.updateButtonState('add');
        this.updateCurrentPageNumber(this.currentAddPage, 'add');
        if (!this.hasNextMeta(this.type)) {
           return this.toggle();
        }         
    },
    renderInitialPagination: function() {
        let page = this.currentAddPage;
        if (ReCharge.Novum.Pagination.type === 'upsell') {
            page = this.currentUpsellPage
        }

        if (
            page === 1 &&
            !this.hasNextMeta(this.type)
        ) {
            this.toggle();
        } else {
            this.toggle(true);
        }
    },
    updateBtnProps: function(type) {
        let btn = document.querySelector(`.rct_pagination__${type}--add`);
        if (btn) {
            btn.classList.remove(`rct_pagination__${type}--add`);
            btn.classList.add(`rct_pagination__${type}--upsell`);
            btn.dataset.handlerType = 'upsell';
        }
    }
}
