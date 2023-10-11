function renderOrderDetails(event) {
    event.preventDefault();

    const { formatCurrency } = ReCharge.Utils;

    const orderId = event.target.closest(".rc_card_container").dataset.id;
    const order = ReCharge.Novum.orders.find((order) => order.id == orderId);
    const currencyCode = order.currency;

    ReCharge.Novum.sidebarHeading.textContent = `{{ 'Order_Details' | t }}`;
    ReCharge.Novum.sidebarContent.innerHTML = `{% include '_order_details.html' %}`;

    let shippingPrice = 0.0;

    order.shipping_lines &&
        order.shipping_lines.forEach(
            (item) => (shippingPrice += Number(item.price))
        );

    // Populate values in the modal
    document.querySelector(
        ".order-number"
    ).textContent = `{{ 'Order' | t }} #${order.shopify_order_number}`;

    const localDate = ReCharge.Utils.formatLocalDate(
        order.processed_at,
        "en-us"
    );
    const translatedDate = ReCharge.Novum.Utils.translateMonth(localDate);
    document.querySelector(".order-date").textContent = ` ${translatedDate}`;

    document.querySelector(".order-shipping").textContent = `${formatCurrency(
        shippingPrice,
        order.currency
    )}`;

    const orderDiscounts =
        order.total_discounts != null
            ? Number(order.total_discounts).toFixed(2)
            : "0.00";
    document.querySelector(".order-discounts").textContent = ` ${formatCurrency(
        -orderDiscounts,
        currencyCode
    )}`;

    const orderTaxes = order.total_tax != 0 ? order.total_tax : "0.00";
    document.querySelector(".order-taxes").textContent = ` ${formatCurrency(
        orderTaxes,
        currencyCode
    )}`;

    document.querySelector(".order-total").textContent = ` ${formatCurrency(
        order.total_price,
        order.currency
    )}`;

    order.line_items.forEach((line_item) => {
        const { quantity, title, price, variant_title, images } = line_item;
        const lineItemsContainer = document.querySelector(".order-line-items");
        const variantLine = variant_title
            ? `<p class="order-variant-title">${variant_title}</p>`
            : "";
        const imageSrc =
            images.original ||
            "//static.rechargecdn.com/static/images/no-image.png?rev={{ REVISION }}";

        lineItemsContainer.innerHTML += `
            <div class="rc_card_container">
                <div class="d-flex align-items-center">
                    <span class="order-photo">
                        <img src="${imageSrc}" alt="${title}">
                    </span>
                    <div class="order-details--wrapper">
                        <span class="rc_order_title">${title.replace(
                            "Auto renew",
                            ""
                        )}</span>
                        ${variantLine}
                        <p class="order-quantity">{{ 'Quantity' | t }}: ${quantity}</p>
                        <span class="order-price text-font-14 font-bold">${formatCurrency(
                            price,
                            order.currency
                        )}</span>
                    </div>
                </div>
            </div>
        `;
    });

  const modified_line_items = order.include?.order_modifications[0]?.modifications?.line_items;
    if (modified_line_items) {

        const lineItemModificationsContainer = document.querySelector(".order-line-item-modifications");
        const line_items_by_subscription_id = {};
        order.line_items.forEach((item, i) => line_items_by_subscription_id[item.subscription_id] = item);

        modified_line_items.forEach((line_item_mod) => {

            let product_title = "";
            let variant_title = "";
            let removed_quantity = 0;
            let removed_price = 0.0;
            let image_url = "";

            if (line_item_mod.modification_type == "delete"){
                product_title = getLineItemModificationAttribute(line_item_mod, "product_title")?.previous_value;
                variant_title = getLineItemModificationAttribute(line_item_mod, "variant_title")?.previous_value;
                removed_quantity = getLineItemModificationAttribute(line_item_mod, "quantity")?.previous_value;
                removed_price = getLineItemModificationAttribute(line_item_mod, "price")?.previous_value;
                image_url = getLineItemModificationAttribute(line_item_mod, "image")?.previous_value;
            }
            else if (line_item_mod.modification_type == "update") {
                const corresponding_line_item = line_items_by_subscription_id[line_item_mod.subscription_id];

                product_title = corresponding_line_item.product_title;
                variant_title = corresponding_line_item.variant_title;

                qty_attribute = getLineItemModificationAttribute(line_item_mod, "quantity");
                removed_quantity = qty_attribute.previous_value - qty_attribute.value;

                removed_price = corresponding_line_item.price;

                image_url = corresponding_line_item.images.original;
            }

            const variantLine = variant_title
                ? `<p class="order-variant-title order-removed-details">${variant_title}</p>`
                : "";
            const imageSrc =
                image_url ||
                "//static.rechargecdn.com/static/images/no-image.png?rev={{ REVISION }}";

                lineItemModificationsContainer.innerHTML += `
            <div class="element__border--top rc_card_container">
                <div class="d-flex align-items-center">
                    <span class="order-photo">
                        <img src="${imageSrc}" alt="${product_title}">
                    </span>
                    <div>
                        <span class="rc_order_title order-removed-details">${product_title.replace(
                            "Auto renew",
                            ""
                        )}</span>
                        ${variantLine}
                        <p class="order-quantity order-removed-details">{{ 'Quantity' | t }}: ${removed_quantity}</p>
                    </div>
                </div>
                <span class="order-price text-font-14 order-removed-details">${formatCurrency(
                    removed_price,
                    order.currency
                )}</span>
            </div>
        `;

        });
        const orderModificationContainerStyle = document.querySelector(".order-modification-info")?.style;
        if (orderModificationContainerStyle) {
            orderModificationContainerStyle.display = "block";
        }
    }


    ReCharge.Novum.toggleSidebar(event.currentTarget);
}


function getLineItemModificationAttribute(line_item_mod, attribute_name) {
    return line_item_mod.modifications.find(modified_attr => modified_attr.attribute == attribute_name);
}