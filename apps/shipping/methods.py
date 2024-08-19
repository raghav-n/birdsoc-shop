from oscar.apps.shipping import methods

class SelfCollectHW2024(methods.NoShippingRequired):
    code = 'SELFCOLLECTHW2024'
    name = 'Self-collect at Henderson Waves Raptor Watch: 2024' # must be unique
    description = (
        "<p>Please collect your merchandise from our booth at Henderson Waves on 20 October, 27 October, or 3 November.</p>"
        "<p><strong>Unfortunately, we are unable to offer refunds for items left unclaimed after 3 November.</strong></p>"
    )

    def to_dict(self):
        return {
            "code": self.code,
            "name": self.name,
            "description": self.description
        }