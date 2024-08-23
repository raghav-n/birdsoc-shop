from oscar.apps.shipping import methods


class SelfCollectHW2024(methods.NoShippingRequired):
    code = "SELFCOLLECTHW2024"
    name = "Self-collect at Henderson Waves Raptor Watch: 2024"  # must be unique
    description = (
        "<p>Please collect your merchandise from our booth at Henderson Waves on 20 October, 27 October, or 3 November.</p>"
        "<p><strong>Unfortunately, we are unable to offer refunds for items left unclaimed after 3 November.</strong></p>"
    )
    email_description = (
        "Your items can be collected from our Raptor Watch booth at Henderson Waves on 20 October, 27 October, and 3 November. "
        "Please come to our booth to collect items on any of these three dates; we will be in touch to share collection details in October. "
        "Unfortunately, we are unable to offer refunds for items left unclaimed after the three Raptor Watch dates at Henderson Waves."
    )

    def to_dict(self):
        return {"code": self.code, "name": self.name, "description": self.description}
