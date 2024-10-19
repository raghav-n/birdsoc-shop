from datetime import date

from oscar.apps.shipping import methods


class SelfCollectHW2024(methods.NoShippingRequired):
    active = False
    end_date = date(year=2024, month=9, day=29)
    code = "SELFCOLLECTHW2024"
    name = "Self-collect at Henderson Waves Raptor Watch: 2024"  # must be unique
    description = (
        "<p>Please collect your merchandise from our booth at Henderson Waves between 9:00am and noon on 20 October, 27 October, 3 November, or 10 November.</p>"
        "<p><strong>Unfortunately, we are unable to offer refunds for items left unclaimed after 10 November.</strong></p>"
    )
    email_description = (
        "Your items can be collected from our Raptor Watch booth at Henderson Waves between 9:00am and noon on 20 October, 27 October, 3 November, or 10 November. "
        "Please come to our booth to collect items on any of these four dates; we will be in touch to share collection details in October. "
        "Unfortunately, we are unable to offer refunds for items left unclaimed after the four Raptor Watch dates at Henderson Waves."
    )
    email_description_full = (
        "Collection location: Henderson Waves Bridge (https://maps.app.goo.gl/dwfTVU8FMKD32Cdb9?g_st=ac\n"
        "Collection dates: 20th October 2024, 27th October 2024, 3rd November 2024, and 10th November 2024 (Sundays)\n"
        "Collection times: 0900–1200 hrs on the above dates\n"
        "In the case of rain, collection will still proceed here: https://maps.app.goo.gl/2LdWM9b2pADaoTQ36?g_st=ac\n"
    )
    website_home_description = (
        "<div class='alert alert-info mt-0'>"
        f"<strong>For this round of merchandise sales, we're accepting orders from now until {end_date.strftime('%d %b %Y')}</strong>. Collection will be at Henderson Waves, "
        "where we'll be hosting the third edition of our Raptor Watch booth on these dates, from <strong>9:00am to noon:</strong>"
        "<ul class='mt-2 pl-4 mb-2'>"
        "<li>20 October</li>"
        "<li>27 October</li>"
        "<li>3 November</li>"
        "<li>10 November</li>"
        "</ul>"
        "This event is <a class='font-weight-bold' href='https://birdsociety.sg/2023/11/09/henderson-waves-raptor-watch-2023/' target='_blank'>always really popular</a>, "
        "and you can join us for a session of raptor watching and collect your merchandise at the same time! BirdSoc SG is a fully volunteer-run "
        "organization, and all proceeds from these merchandise sales, including donations, will go towards our signature projects, funding our events, "
        "and web server expenses for our websites."
        "</div>"
    )
    website_faq_description = (
        "Please come down to Henderson Waves, where we'll be hosting our Raptor Watch event for the"
        '<a class="font-weight-bold" href="https://birdsociety.sg/2023/11/09/henderson-waves-raptor-watch-2023/'
        'target="_blank">third year running</a> on these Sundays, from 9:00am until noon:'
        "<ul class='mt-2 pl-4 mb-2'>"
        "<li>20 October</li>"
        "<li>27 October</li>"
        "<li>3 November</li>"
        "<li>10 November</li>"
        "</ul>"
        "There's no need to register in advance for a collection date – you can collect on any of the"
        "four dates at your convenience. Please have your order number ready for collection."
    )

    def to_dict(self):
        return {"code": self.code, "name": self.name, "description": self.description}


class SelfCollectHW2024Round2(methods.NoShippingRequired):
    active = True
    end_date = date(year=2024, month=10, day=28)
    code = "SELFCOLLECTHW2024ROUND2"
    name = "Self-collect at Henderson Waves Raptor Watch: 2024 (10 Nov only)"  # must be unique
    description = (
        "<p>Please collect your merchandise from our booth at Henderson Waves between 9:00am and noon on 10 November.</p>"
        "<p><strong>Unfortunately, we are unable to offer refunds for items left unclaimed.</strong></p>"
    )
    email_description = (
        "Your items can be collected from our Raptor Watch booth at Henderson Waves between 9:00am and noon on 10 November. "
        "Unfortunately, we are unable to offer refunds for items left unclaimed."
    )
    email_description_full = (
        "Collection location: Henderson Waves Bridge (https://maps.app.goo.gl/dwfTVU8FMKD32Cdb9?g_st=ac\n"
        "Collection date/time: 10th November 2024 (Sunday), 0900–1200hrs\n"
        "In the case of rain, collection will still proceed here: https://maps.app.goo.gl/2LdWM9b2pADaoTQ36?g_st=ac\n"
    )
    website_home_description = (
        "<div class='alert alert-info mt-0'>"
        f"<strong>For this round of merchandise sales, we're accepting orders from now until {end_date.strftime('%d %b %Y')}</strong>. "
        f"Collection will be at Henderson Waves, on 10 Nov, where we'll be hosting the third edition of our Raptor Watch "
        f"booth, from <strong>9:00am to noon.</strong> "
        "If you placed an order through our site in the first round of orders (until 29 Sep), you can collect on any of "
        "the other Raptor Watch dates (20 Oct, 27 Oct, or 3 Nov) as well, but this doesn't apply for new orders placed "
        "between 20 Oct and 28 Oct. <br><br>"
        "This event is <a class='font-weight-bold' href='https://birdsociety.sg/2023/11/09/henderson-waves-raptor-watch-2023/' target='_blank'>always really popular</a>, "
        "and you can join us for a session of raptor watching and collect your merchandise at the same time! BirdSoc SG is a fully volunteer-run "
        "organization, and all proceeds from these merchandise sales, including donations, will go towards our signature projects, funding our events, "
        "and web server expenses for our websites."
        "</div>"
    )
    website_faq_description = (
        "Please come down to Henderson Waves where we'll be hosting the third edition of our Raptor Watch booth "
        "on 10 Nov from <strong>9:00am to noon.</strong> "
        "If you placed an order through our site in the first round of orders (until 29 Sep), you can collect "
        "on any of the other Raptor Watch dates (20 Oct, 27 Oct, or 3 Nov) as well, but this doesn't apply for "
        "new orders placed between 20 Oct and 28 Oct. "
    )

    def to_dict(self):
        return {"code": self.code, "name": self.name, "description": self.description}
