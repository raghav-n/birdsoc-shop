from django.urls import path
from apps.dashboard.donation import views

app_name = "donation-dashboard"

urlpatterns = [
    path("", views.DonationListView.as_view(), name="donation-list"),
]
