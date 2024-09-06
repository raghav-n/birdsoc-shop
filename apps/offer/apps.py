import oscar.apps.offer.apps as apps


class OfferConfig(apps.OfferConfig):
    name = "apps.offer"

    def get_urls(self):
        return []
