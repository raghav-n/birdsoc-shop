from django.contrib import messages
from oscar.apps.dashboard.orders.views import OrderDetailView as CoreOrderDetailView
from oscar.apps.dashboard.orders.views import OrderListView as CoreOrderListView
from oscar.apps.order.exceptions import InvalidOrderStatus
from oscar.apps.payment.exceptions import PaymentError
from django.utils.translation import gettext_lazy as _
from oscar.core.loading import get_model

OrderNote = get_model("order", "OrderNote")


class OrderDetailView(CoreOrderDetailView):
    def change_order_status(self, request, order):
        form = self.get_order_status_form()
        if not form.is_valid():
            return self.reload_page(error=_("Invalid form submission"))

        old_status, new_status = order.status, form.cleaned_data["new_status"]
        handler = self.get_handler(user=request.user)

        success_msg = _(
            "Order status changed from '%(old_status)s' to '%(new_status)s'"
        ) % {"old_status": old_status, "new_status": new_status}
        try:
            handler.handle_order_status_change(
                order, new_status, note_msg=success_msg, user=request.user
            )
        except PaymentError as e:
            messages.error(
                request,
                _("Unable to change order status due to payment error: %s") % e,
            )
        except InvalidOrderStatus:
            # The form should validate against this, so we should only end up
            # here during race conditions.
            messages.error(
                request,
                _(
                    "Unable to change order status as the requested "
                    "new status is not valid"
                ),
            )
        else:
            messages.info(request, success_msg)
        return self.reload_page()


class OrderListView(CoreOrderListView):
    def change_order_status(self, request, order):
        # This method is pretty similar to what
        # OrderDetailView.change_order_status does. Ripe for refactoring.
        new_status = request.POST["new_status"].strip()
        if not new_status:
            messages.error(request, _("The new status '%s' is not valid") % new_status)
        elif new_status not in order.available_statuses():
            messages.error(
                request,
                _("The new status '%s' is not valid for this order") % new_status,
            )
        else:
            handler = self.get_handler(user=request.user)
            old_status = order.status
            try:
                handler.handle_order_status_change(order, new_status, user=request.user)
            except PaymentError as e:
                messages.error(
                    request,
                    _("Unable to change order status due to payment error: %s") % e,
                )
            else:
                msg = _(
                    "Order status changed from '%(old_status)s' to '%(new_status)s'"
                ) % {"old_status": old_status, "new_status": new_status}
                messages.info(request, msg)
                order.notes.create(
                    user=request.user, message=msg, note_type=OrderNote.SYSTEM
                )
