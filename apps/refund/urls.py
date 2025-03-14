from django.urls import path
from . import views

app_name = "refund"

urlpatterns = [
    path("", views.RefundRequestView.as_view(), name="request"),
    path("thanks/", views.RefundThanksView.as_view(), name="thanks"),
]
