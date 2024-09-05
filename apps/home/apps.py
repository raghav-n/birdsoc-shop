from oscar import config


class MyShop(config.Shop):
    name = "apps.home"

    def get_urls(self):
        return super().get_urls()[1:]
