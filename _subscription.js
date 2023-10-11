
// IIFE to not muddy up the global context
(function () {
  let customer = {{ customer | json }};
  const { translations } = ReCharge;
  const { addAccessibleClickListener } = ReCharge.Utils;

  function onEditEmailClick() {
    ReCharge.Drawer.open({
      header: translations.email.updateHeader,
      content: `
        <p class="rc-subtext text-center">${translations.email.info}</p>
        <form id="RechargeEmailForm">
          <div role="group" class="rc-form-control mt-2">
            <label id="email-label" for="email" class="rc-form__label">{{ 'Email' | t }}</label>
            <input type="text" id="email" class="rc-input" type="text" name="email" value="${customer.email}">
          </div>
          <button type="submit" class="update-email rc_btn rc_btn--primary bbrc-btn">${translations.common.updateBtn}</button>
        </form>
      ` });

    document.forms.RechargeEmailForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const email = document.getElementById('email').value;
        const updatedCustomer = await ReCharge.Api.submitRequest(() => ReCharge.Api.updateCustomer({ email }), {
          key: 'updateEmail',
          submitButton: e.target.querySelector('button[type="submit"]'),
          successMessage: translations.email.success
        });
        // Update the customers email
        customer = updatedCustomer;
        document.querySelector('.customer-email .email').innerHTML = customer.email;
        ReCharge.Drawer.close();
      } catch (err) { }
      return false;
    });
  }

  function onEditPhoneClick() {
    ReCharge.Drawer.open({
      header: translations.phone.updateHeader,
      content: `
        <p class="rc-subtext text-center">${translations.phone.info}</p>
        <form id="RechargePhoneForm">
          <div role="group" class="rc-form-control mt-2">
            <label id="phone-label" for="phone" class="rc-form__label">${translations.phone.label}</label>
            <input type="text" id="phone" class="rc-input" type="text" name="phone" value="${customer.phone ?? ''}">
          </div>
          <button type="submit" class="update-phone rc-btn rc-btn--primary">${translations.common.updateBtn}</button>
        </form>
      ` });

    document.forms.RechargePhoneForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const phone = document.getElementById('phone').value;
        const updatedCustomer = await ReCharge.Api.submitRequest(() => ReCharge.Api.updateCustomer({ phone }), {
          key: 'updatePhone',
          submitButton: e.target.querySelector('button[type="submit"]'),
          successMessage: translations.phone.success
        });

        customer = updatedCustomer;
        document.querySelector('.customer-phone .phone').innerHTML = customer.phone;
        ReCharge.Drawer.close();
      } catch (err) { }
      return false;
    });
  }


  addAccessibleClickListener(document.querySelector('.customer-email'), onEditEmailClick);
  addAccessibleClickListener(document.querySelector('.customer-phone'), onEditPhoneClick);

})()
