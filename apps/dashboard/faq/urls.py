from django.urls import path
from apps.dashboard.faq import views

app_name = "faq-dashboard"

urlpatterns = [
    path("", views.FAQListView.as_view(), name="faq-list"),
    path("create/", views.FAQCreateView.as_view(), name="faq-create"),
    path("<int:pk>/update/", views.FAQUpdateView.as_view(), name="faq-update"),
    path("<int:pk>/delete/", views.FAQDeleteView.as_view(), name="faq-delete"),
]
