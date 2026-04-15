from __future__ import annotations

from collections import defaultdict

from django.contrib.auth import get_user_model
from django.db import transaction


ONSITE_USERNAME = "onsite_customer"
ONSITE_FIRST_NAME = "Onsite"
ONSITE_LAST_NAME = "Customer"


def get_onsite_customer_queryset():
    user_model = get_user_model()
    return user_model.objects.filter(
        first_name=ONSITE_FIRST_NAME,
        last_name=ONSITE_LAST_NAME,
    )


def get_or_create_onsite_customer_user():
    user_model = get_user_model()
    onsite_users = get_onsite_customer_queryset().order_by("id")
    canonical = onsite_users.filter(username=ONSITE_USERNAME).first() or onsite_users.first()

    if canonical is None:
        canonical = user_model.objects.create(
            username=ONSITE_USERNAME,
            first_name=ONSITE_FIRST_NAME,
            last_name=ONSITE_LAST_NAME,
            is_active=False,
            email="",
        )
        canonical.set_unusable_password()
        canonical.save(update_fields=["password"])
        return canonical, True

    update_fields = []
    if (
        canonical.username != ONSITE_USERNAME
        and not user_model.objects.filter(username=ONSITE_USERNAME).exclude(pk=canonical.pk).exists()
    ):
        canonical.username = ONSITE_USERNAME
        update_fields.append("username")
    if canonical.first_name != ONSITE_FIRST_NAME:
        canonical.first_name = ONSITE_FIRST_NAME
        update_fields.append("first_name")
    if canonical.last_name != ONSITE_LAST_NAME:
        canonical.last_name = ONSITE_LAST_NAME
        update_fields.append("last_name")
    if canonical.is_active:
        canonical.is_active = False
        update_fields.append("is_active")

    if update_fields:
        canonical.save(update_fields=update_fields)

    return canonical, False


@transaction.atomic
def merge_onsite_customer_users():
    target, created = get_or_create_onsite_customer_user()
    sources = list(
        get_onsite_customer_queryset()
        .exclude(pk=target.pk)
        .order_by("id")
    )

    relation_updates = defaultdict(int)
    relation_deletions = defaultdict(int)
    merged_user_ids = []

    for source in sources:
        for relation in source._meta.related_objects:
            rel_model = relation.related_model
            manager = getattr(rel_model, "_default_manager", rel_model.objects)
            field_name = relation.field.name

            if relation.one_to_many:
                updated = manager.filter(**{field_name: source}).update(
                    **{field_name: target}
                )
                relation_updates[f"{rel_model._meta.label}.{field_name}"] += updated
            elif relation.one_to_one:
                source_qs = manager.filter(**{field_name: source})
                if not source_qs.exists():
                    continue
                if manager.filter(**{field_name: target}).exists():
                    if rel_model._meta.label == "analytics.UserRecord":
                        deleted_count, _ = source_qs.delete()
                        relation_deletions[f"{rel_model._meta.label}.{field_name}"] += deleted_count
                        continue
                    raise RuntimeError(
                        f"Cannot merge onsite user {source.pk}: {rel_model._meta.label}.{field_name} "
                        f"already points at target user {target.pk}"
                    )
                updated = source_qs.update(**{field_name: target})
                relation_updates[f"{rel_model._meta.label}.{field_name}"] += updated

        merged_user_ids.append(source.pk)
        source.delete()

    return {
        "target_user_id": target.pk,
        "target_username": target.username,
        "created_target": created,
        "merged_user_ids": merged_user_ids,
        "relation_updates": dict(sorted(relation_updates.items())),
        "relation_deletions": dict(sorted(relation_deletions.items())),
    }
