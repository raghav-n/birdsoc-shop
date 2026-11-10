from __future__ import annotations

from django.contrib.auth import get_user_model
from django.utils.text import slugify
from rest_framework.test import APITestCase
from oscar.core.loading import get_model

from apps.api.tests.utils import create_product


Category = get_model("catalogue", "Category")
User = get_user_model()
Product = get_model("catalogue", "Product")


class CatalogueExtraTests(APITestCase):
    def test_categories_list_tree_and_retrieve(self):
        # Build category tree
        root = Category.objects.add_root({"name": "Root"})
        child = Category.objects.add_child(root, {"name": "Child"})

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
        cat = Category.objects.add_root({"name": "Birds"})
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

        # is_public=false is ignored for the public: hidden products never list
        p2.is_public = False
        p2.save(update_fields=["is_public"])
        r = self.client.get("/api/v1/products", {"is_public": "false"})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(all(i["is_public"] for i in r.data["results"]))
        self.assertFalse(any(i["id"] == p2.id for i in r.data["results"]))

        # ...but staff can filter for them
        staff = User.objects.create_user("staff", "staff@example.com", "pw", is_staff=True)
        self.client.force_authenticate(staff)
        r = self.client.get("/api/v1/products", {"is_public": "false"})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(any(i["id"] == p2.id for i in r.data["results"]))
        self.client.force_authenticate(None)

        # ordering by title
        r = self.client.get("/api/v1/products", {"ordering": "title"})
        self.assertEqual(r.status_code, 200)
        titles = [i["title"] for i in r.data["results"]]
        self.assertEqual(sorted(titles), titles)

    def test_product_retrieve_not_found(self):
        r = self.client.get("/api/v1/products/999999")
        self.assertEqual(r.status_code, 404)

    def test_category_retrieve_not_found(self):
        r = self.client.get("/api/v1/categories/no-such-slug")
        self.assertEqual(r.status_code, 404)

    def test_non_public_product_is_hidden_from_detail_endpoints(self):
        p = create_product(title="Hidden Heron", price=10)
        p.is_public = False
        p.save(update_fields=["is_public"])

        for url in (
            f"/api/v1/products/{p.id}",
            f"/api/v1/products/{p.slug}",
            f"/api/v1/products/slug/{p.slug}",
        ):
            r = self.client.get(url)
            self.assertEqual(r.status_code, 404, url)

        # Staff can still open it (preview)
        staff = User.objects.create_user("staff2", "staff2@example.com", "pw", is_staff=True)
        self.client.force_authenticate(staff)
        r = self.client.get(f"/api/v1/products/{p.id}")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data["is_public"])

    def test_child_of_non_public_parent_is_hidden(self):
        parent = create_product(title="Hidden Parent", price=10)
        parent.structure = "parent"
        parent.is_public = False
        parent.save(update_fields=["structure", "is_public"])
        child = Product.objects.create(
            title="Hidden Parent - M", slug="hidden-parent-m", structure="child", parent=parent
        )
        r = self.client.get(f"/api/v1/products/{child.id}")
        self.assertEqual(r.status_code, 404)

    def test_public_product_detail_still_works(self):
        p = create_product(title="Visible Vireo", price=10)
        self.assertEqual(self.client.get(f"/api/v1/products/{p.id}").status_code, 200)
        self.assertEqual(self.client.get(f"/api/v1/products/slug/{p.slug}").status_code, 200)
