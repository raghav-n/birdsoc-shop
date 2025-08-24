from __future__ import annotations

from django.utils.text import slugify
from rest_framework.test import APITestCase
from oscar.core.loading import get_model

from apps.api.tests.utils import create_product


Category = get_model("catalogue", "Category")


class CatalogueExtraTests(APITestCase):
    def test_categories_list_tree_and_retrieve(self):
        # Build category tree
        root = Category.add_root(name="Root")
        child = root.add_child(name="Child")

        r = self.client.get("/api/v1/categories")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(any(c["name"] == "Root" for c in r.data["results"]))

        r = self.client.get("/api/v1/categories/tree")
        self.assertEqual(r.status_code, 200)
        # Tree endpoint returns non-paginated list
        self.assertTrue(any(c["name"] == "Root" for c in r.data))

        r = self.client.get(f"/api/v1/categories/{child.slug}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["name"], "Child")

    def test_product_filters_query_category_public_and_ordering(self):
        # Create categories and products
        cat = Category.add_root(name="Birds")
        p1 = create_product(title="Albatross A", price=10)
        p2 = create_product(title="Bluebird B", price=20)
        p1.categories.add(cat)
        p2.categories.add(cat)

        # q filter
        r = self.client.get("/api/v1/products", {"q": "Albatross"})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(any(i["title"] == p1.title for i in r.data["results"]))

        # category filter
        r = self.client.get("/api/v1/products", {"category": cat.slug})
        self.assertEqual(r.status_code, 200)
        self.assertGreaterEqual(r.data["count"], 2)

        # invalid category returns empty
        r = self.client.get("/api/v1/products", {"category": "no-such"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["count"], 0)

        # is_public filter
        p2.is_public = False
        p2.save(update_fields=["is_public"])
        r = self.client.get("/api/v1/products", {"is_public": "false"})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(all(not i["is_public"] for i in r.data["results"]))

        # ordering by title
        r = self.client.get("/api/v1/products", {"ordering": "title"})
        self.assertEqual(r.status_code, 200)
        titles = [i["title"] for i in r.data["results"]]
        self.assertEqual(sorted(titles), titles)
