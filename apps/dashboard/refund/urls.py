from django.urls import path
from . import views

app_name = "dashboard-refund"

urlpatterns = [
    path("", views.RefundListView.as_view(), name="refund-request-list"),
    path("<int:pk>/", views.RefundDetailView.as_view(), name="refund-request-detail"),
    path("treasurer/", views.TreasurerRefundListView.as_view(), name="treasurer-list"),
    path("treasurer/<int:pk>/", views.TreasurerRefundDetailView.as_view(), name="treasurer-detail"),
    path("completed/", views.CompletedRefundListView.as_view(), name="completed-list"),
]
