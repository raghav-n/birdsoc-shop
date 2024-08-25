from oscar.apps.customer.views import AccountAuthView


class LoginOnlyAccountAuthView(AccountAuthView):
    template_name = "oscar/customer/login.html"
