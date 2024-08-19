import oscar.apps.customer.apps as apps


class CustomerConfig(apps.CustomerConfig):
    name = 'apps.customer'

    def get_urls(self):
        current_urls = super().get_urls()

        to_remove = [
            'email-list', 'email-detail',  'alerts-list', 'alert-create', 'alerts-confirm', 'alerts-cancel-by-key', 'alerts-cancel-by-pk',
            'notifications-inbox', 'notifications-archive', 'notifications-update', 'notifications-detail', 'address-list', 'address-create',
            'address-detail', 'address-delete', 'address-change-status',
        ]

        return [url for url in current_urls if url.name not in to_remove]
