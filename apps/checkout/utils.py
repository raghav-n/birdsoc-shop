from oscar.apps.checkout.utils import CheckoutSessionData as CoreCheckoutSessionData

class CheckoutSessionData(CoreCheckoutSessionData):
    def set_order_paynow_payment_id(self, order_paynow_payment_id):
        self._set("submission", "order_paynow_payment_id", order_paynow_payment_id)

    def get_order_paynow_payment_id(self):
        return self._get("submission", "order_paynow_payment_id")