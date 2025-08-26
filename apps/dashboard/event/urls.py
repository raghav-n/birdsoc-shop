from django.urls import path
from apps.dashboard.event import views

app_name = "event-dashboard"

urlpatterns = [
    # Event URLs
    path("", views.EventListView.as_view(), name="event-list"),
    path("create/", views.EventCreateView.as_view(), name="event-create"),
    path("<int:pk>/", views.EventDetailView.as_view(), name="event-detail"),
    path("<int:pk>/update/", views.EventUpdateView.as_view(), name="event-update"),
    path("<int:pk>/delete/", views.EventDeleteView.as_view(), name="event-delete"),
    # Participant URLs
    path("participants/", views.ParticipantListView.as_view(), name="participant-list"),
    path(
        "participants/create/",
        views.ParticipantCreateView.as_view(),
        name="participant-create",
    ),
    path(
        "participants/<int:pk>/",
        views.ParticipantDetailView.as_view(),
        name="participant-detail",
    ),
    path(
        "participants/<int:pk>/update/",
        views.ParticipantUpdateView.as_view(),
        name="participant-update",
    ),
    path(
        "participants/<int:pk>/delete/",
        views.ParticipantDeleteView.as_view(),
        name="participant-delete",
    ),
    # Event-Participant Management
    path(
        "<int:pk>/add-participant/",
        views.EventParticipantAddView.as_view(),
        name="event-participant-add",
    ),
    path(
        "<int:pk>/create-participant/",
        views.EventParticipantCreateView.as_view(),
        name="event-participant-create",
    ),
    path(
        "<int:event_pk>/remove-participant/<int:pk>/",
        views.EventParticipantRemoveView.as_view(),
        name="event-participant-remove",
    ),
    path(
        "<int:pk>/batch-email/",
        views.EventBatchEmailView.as_view(),
        name="event-batch-email",
    ),
    path(
        "<int:pk>/batch-email-preview/",
        views.EventBatchEmailPreviewView.as_view(),
        name="event-batch-email-preview",
    ),
    # Registrations
    path(
        "registrations/<int:reg_id>/verify/",
        views.EventRegistrationVerifyView.as_view(),
        name="event-registration-verify",
    ),
]
