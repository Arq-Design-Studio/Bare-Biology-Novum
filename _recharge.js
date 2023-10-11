function configureStore() {
    const settingsStore = {{ settings | json }};
    let store = {{ store | json }};

    // Check if store allows editing shipping address
    const editAddressBtn = document.querySelectorAll(".js-address-edit-btn") || null;
    if (settingsStore.customer_portal.edit_shipping_address) {
        if (editAddressBtn) {
            editAddressBtn.forEach(btn => { ReCharge.Novum.Helpers.showElement(btn) });
            document
                .querySelectorAll(".js-address-edit")
                .forEach(address => {
                    ReCharge.Utils.addAccessibleClickListener(address, renderAddressDetailsHandler)
                });
        }
    } else {
        if (editAddressBtn) {
            editAddressBtn.forEach((btn) => ReCharge.Novum.Helpers.showElement(btn));
            document
                .querySelectorAll(".js-address-edit")
                .forEach(address => {
                    ReCharge.Utils.contactStoreWording(
                        address,
                        ReCharge.Utils.renderContactStoreLayout(`{{ 'shipping_addres' | t }}`),
                        `{{ 'cp_edit_address_label' | t }}`
                    );
                });
        }
    }
    // Check if store allows editing next charge date
    const editNextChargeDateBtn = document.querySelector(".js-edit-next-charge-date-btn") || null;
    const nextDeliveryContainer = document.querySelector(".js-edit-next-charge-date") || null;

    if (settingsStore.customer_portal.subscription.edit_scheduled_date) {
        if (editNextChargeDateBtn) {
            ReCharge.Novum.Helpers.showElement(editNextChargeDateBtn);
            ReCharge.Utils.addAccessibleClickListener(nextDeliveryContainer, editNextShipment);
        }
    } else {
        if (editNextChargeDateBtn) {
            ReCharge.Novum.Helpers.showElement(editNextChargeDateBtn);
            ReCharge.Utils.contactStoreWording(
                nextDeliveryContainer,
                ReCharge.Utils.renderContactStoreLayout(`{{ 'cp_next_shipment' | t }}`),
                `{{ 'cp_next_shipment' | t }}`
            );
        }
    }
    // Check if store allows editing delivery frequency
    const frequencyBtn = document.querySelector(".js-edit-frequency-btn") || null;
    const frequencyContainer = document.querySelector(".js-edit-frequency") || null;

    if (settingsStore.customer_portal.subscription.edit_order_frequency !== "Prohibited") {
        if (frequencyBtn) {
            ReCharge.Novum.Helpers.showElement(frequencyBtn);
            ReCharge.Utils.addAccessibleClickListener(frequencyContainer, editScheduleHandler);
        }
    } else {
        if (frequencyBtn) {
            ReCharge.Novum.Helpers.showElement(frequencyBtn);
            ReCharge.Utils.contactStoreWording(
                frequencyContainer,
                ReCharge.Utils.renderContactStoreLayout(`{{ 'cp_delivery_frequency' | t }}`),
                `{{ 'cp_deliver_every' | t }}`
            );
        }
    }
    // Check if store allows skip
    if (settingsStore.customer_portal.subscription.skip_scheduled_order) {
        const skipBtns = document.querySelectorAll(".js-skip-btn") || null;

        if (skipBtns) {
            const allowSkipPrepaids = settingsStore.customer_portal.subscription.skip_prepaid_order;
            skipBtns.forEach(btn => { 
                if(btn.hasAttribute('data-prepaid')) {
                    // Don't load prepaids until they have this flag
                    if(allowSkipPrepaids) { 
                        ReCharge.Novum.Helpers.showElement(btn); 
                    }
                } else {
                    ReCharge.Novum.Helpers.showElement(btn);
                }
            });
            document
                .querySelectorAll(".js-skip-handler")
                .forEach(btn => {
                    btn.addEventListener("click", skipShipmentHandler)
                });
        }
        const unskipBtns = document.querySelectorAll(".js-unskip-btn") || null;

        if (unskipBtns) {
            unskipBtns.forEach(btn => { ReCharge.Novum.Helpers.showElement(btn); });
            document
                .querySelectorAll(".js-unskip-handler")
                .forEach(btn => {
                    btn.addEventListener("click", unskipShipmentHandler)
                });
        }
    }
    
    // Check if product on edit subscription page is otp addon
    if (ReCharge.Novum.subscription && ReCharge.Novum.subscription.status == "ONETIME") {
        addOnLayout();
    }

    /*==================
      preview link info
    ==================*/
    const currentUrl = window.location.href;
    if (
        currentUrl.includes("preview_standard_theme") ||
        currentUrl.includes("preview_theme")
    ) {
        document
            .querySelectorAll(".info-modal")
            .forEach((el) => el.setAttribute("style", "display: block;"));
        document.querySelector("body").classList.toggle("locked");
    }
    /*===================
      preview link info
    ===================*/
}

function addOnLayout() {
    const { properties } = ReCharge.Novum.subscription;
    let isAddOn;

    if (properties && properties.length) {
        isAddOn = properties.filter(prop => prop.name == "add_on")[0];

        if(isAddOn && isAddOn.name == "add_on") {
            let cards = document.querySelectorAll(".js-edit-next-charge-date, .js-address-edit, .js-edit-billing-address, .js-edit-billing-card");
            cards.forEach(elem => elem.style.pointerEvents = "none");

            let arrows = document.querySelectorAll(".js-edit-next-charge-date-btn, .js-address-edit-btn, .js-billing-edit-btn, .js-billing-card-edit-btn");
            arrows.forEach(arrow => arrow.style.display = "none");
        }
    }
}

function needsToken(address) {
    // Check if the URL requires a token
    if (address.indexOf("{{ shopify_proxy_url if proxy_redirect else '' }}") === -1) {
        return false;
    }
    let url = new URL(address, window.location),
        params = new URLSearchParams(url.search);
        
    return !params.get("token");
}

(function() {
    ReCharge.Novum.toggleSidebar = function(originatingElement) {
        const sidebarElement = document.getElementById('te-modal');
        const mainContent = document.getElementById('rc_te-template-wrapper')
        const focusableElements = 'button:not([aria-hidden=true]), [href], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])';
        let lockFocus;

        document.querySelector("body").classList.toggle("locked");
        document.getElementById("sidebar-underlay").classList.toggle("visible");
        sidebarElement.classList.toggle("visible");

        // if sidebar is open, lock focus in it
        if (sidebarElement.classList.contains('visible')) {
            // get the first and last focusable elements in the sidebar
            const firstFocusableElement = sidebarElement.querySelectorAll(focusableElements)[0];
            const focusableContent = sidebarElement.querySelectorAll(focusableElements);
            const lastFocusableElement = focusableContent[focusableContent.length - 1];

            lockFocus = (e) => {
                let isTabPressed = e.key === 'Tab'
    
                if (!isTabPressed) {
                    return;
                }
    
                if (e.shiftKey) { // if shift key pressed for shift + tab combination
                    if (document.activeElement === firstFocusableElement) {
                        lastFocusableElement.focus(); 
                        e.preventDefault();
                    }
                } else { // if tab key is pressed
                    if (document.activeElement === lastFocusableElement) {
                        e.preventDefault();
                        firstFocusableElement.focus();
                    }
                }
            }

            document.addEventListener('keydown', lockFocus);
            
            firstFocusableElement?.focus();

            sidebarElement.setAttribute('aria-hidden', 'false');
            mainContent.setAttribute('aria-hidden', 'true')
        } else { // sidebar is closed, remove lock focus event and refocus on originating element
            document.removeEventListener('keydown', lockFocus)
            
            if (originatingElement) {
                originatingElement.focus()
            }

            sidebarElement.setAttribute('aria-hidden', 'true')
            mainContent.setAttribute('aria-hidden', 'false')
        }
        
        document.querySelectorAll(".close-sidebar")
            .forEach(sidebar => {
                sidebar.addEventListener('click', () => ReCharge.Novum.toggleSidebar(sidebar));
            })
        ;

        if (ReCharge.Novum.Pagination.type === 'upsell') {
            ReCharge.Novum.Pagination.updateBtnProps('container');
            ReCharge.Novum.Pagination.updateBtnProps('prev');
            ReCharge.Novum.Pagination.updateBtnProps('next');
            ReCharge.Novum.Pagination.updateBtnProps('current');
            ReCharge.Novum.Pagination.limit = 12;
        }
    }
    
    // Trigger configuration code
    document.addEventListener('DOMContentLoaded', configureStore);

    // Update links with tokens
    document.querySelectorAll("a")
        .forEach(function(el) {
            let url = el.href;
            if (needsToken(url)) {
                el.href = ReCharge.Novum.Utils.attachQueryParams(el.href);
            }
        });
    // Update forms with tokens
    document.querySelectorAll("form")
        .forEach(function(form) {
            if (form.action && needsToken(form.action)) {
                form.action = ReCharge.Novum.Utils.attachQueryParams(form.action);
            }
        });
    // Update inputs with tokens
    document.querySelectorAll("input")
        .forEach(function(el) {
            let url = el.value;
            if (needsToken(url)) {
                if (url.includes('/portal')) {
                    el.value = ReCharge.Novum.Utils.attachQueryParams(el.value);
                }
            }
        });
    // Watch for DOM changes and apply tokens as necessary
    if (MutationObserver && !!document.getElementById("#ReCharge")) {
        let callback = function(mutationsList, observer) {
            mutationsList
                .filter(function(mutation) {
                    return mutation.type === "childList";
                })
                .forEach(function(mutation) {
                    Array.prototype.slice
                        .call(mutation.addedNodes)
                        .filter(function(node) {
                            return node.tagName === "A";
                        })
                        .forEach(function(node) {
                            let url = node.href;
                            if (needsToken(url)) {
                                node.href = ReCharge.Novum.Utils.attachQueryParams(node.href);
                            }
                        });
                });
        };
        let observer = new MutationObserver(callback);
        observer.observe(document.querySelector("#ReCharge"), {
            attributes: false,
            childList: true,
            subtree: true,
        });
    }
})();
