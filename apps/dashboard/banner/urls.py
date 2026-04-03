from django.urls import path
from apps.dashboard.banner import views

app_name = "banner-dashboard"

urlpatterns = [
    path("", views.BannerListView.as_view(), name="banner-list"),
    path("create/", views.BannerCreateView.as_view(), name="banner-create"),
    path("<int:pk>/update/", views.BannerUpdateView.as_view(), name="banner-update"),
    path("<int:pk>/delete/", views.BannerDeleteView.as_view(), name="banner-delete"),
    path("text/", views.TextBannerView.as_view(), name="banner-text"),
]
