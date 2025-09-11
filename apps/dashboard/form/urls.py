from django.urls import path
from apps.dashboard.form import views

app_name = "dashboard-form"

urlpatterns = [
    # Forms
    path("", views.FormListView.as_view(), name="form-list"),
    path("create/", views.FormCreateView.as_view(), name="form-create"),
    path("<int:pk>/", views.FormDetailView.as_view(), name="form-detail"),
    path("<int:pk>/update/", views.FormUpdateView.as_view(), name="form-update"),
    path("<int:pk>/delete/", views.FormDeleteView.as_view(), name="form-delete"),
    # Fields
    path("<int:form_id>/fields/", views.FieldListView.as_view(), name="field-list"),
    path(
        "<int:form_id>/fields/create/",
        views.FieldCreateView.as_view(),
        name="field-create",
    ),
    path(
        "<int:form_id>/fields/<int:pk>/update/",
        views.FieldUpdateView.as_view(),
        name="field-update",
    ),
    path(
        "<int:form_id>/fields/<int:pk>/delete/",
        views.FieldDeleteView.as_view(),
        name="field-delete",
    ),
    # Submissions
    path(
        "<int:form_id>/submissions/",
        views.SubmissionListView.as_view(),
        name="submission-list",
    ),
    path(
        "<int:form_id>/submissions/<int:pk>/",
        views.SubmissionDetailView.as_view(),
        name="submission-detail",
    ),
]

