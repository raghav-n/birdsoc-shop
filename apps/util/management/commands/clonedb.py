"""
Management command: clonedb

Creates a copy of the current Postgres database for quick local testing.
All pg_dump / createdb / psql calls run on the remote server via SSH
so there are no version mismatch issues.

Usage:
    python manage.py clonedb                   # clones 'shop' -> 'shop_backup'
    python manage.py clonedb --dest mydb       # clones 'shop' -> 'mydb'
    python manage.py clonedb --drop            # drop dest first if it exists
    python manage.py clonedb --ssh other-host  # override SSH alias
"""

import subprocess

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError


SSH_HOST = "birdsociety"


class Command(BaseCommand):
    help = "Clone the current Postgres database into a new database for testing (runs on the remote server via SSH)."

    def add_arguments(self, parser):
        db_name = settings.DATABASES["default"].get("NAME", "shop")
        parser.add_argument(
            "--dest",
            default=f"{db_name}_backup",
            help="Name of the destination database (default: <source>_backup)",
        )
        parser.add_argument(
            "--drop",
            action="store_true",
            help="Drop the destination database first if it already exists",
        )
        parser.add_argument(
            "--ssh",
            default=SSH_HOST,
            help=f"SSH alias/host to run commands on (default: {SSH_HOST})",
        )
        parser.add_argument(
            "--pg-user",
            default="postgres",
            help="Unix user to sudo -u as for pg commands (default: postgres, set to '' to disable)",
        )

    def handle(self, *args, **options):
        db = settings.DATABASES["default"]
        engine = db.get("ENGINE", "")
        if "postgresql" not in engine:
            raise CommandError(
                f"clonedb only supports PostgreSQL (current engine: {engine})"
            )

        src = db["NAME"]
        dest = options["dest"]
        ssh = options["ssh"]

        # When sudoing to a pg superuser, omit -U so peer auth uses that Unix user
        pg_flags = self._pg_flags(db, omit_user=bool(options["pg_user"]))
        sudo_prefix = f"sudo -u {options['pg_user']} " if options["pg_user"] else ""

        def remote(cmd):
            """Run a shell command on the remote server via SSH."""
            result = subprocess.run(
                ["ssh", ssh, cmd],
                capture_output=True,
                text=True,
            )
            return result

        if options["drop"]:
            self.stdout.write(f"Dropping '{dest}' on {ssh} (if exists)...")
            remote(f"{sudo_prefix}dropdb --if-exists {pg_flags} {dest}")

        self.stdout.write(f"Creating '{dest}' on {ssh}...")
        result = remote(f"{sudo_prefix}createdb {pg_flags} {dest}")
        if result.returncode != 0:
            raise CommandError(
                f"createdb failed:\n{result.stderr.strip()}\n"
                "Tip: use --drop to overwrite an existing database."
            )

        self.stdout.write(f"Copying '{src}' → '{dest}' on {ssh}...")
        result = remote(f"{sudo_prefix}pg_dump {pg_flags} {src} | {sudo_prefix}psql {pg_flags} {dest}")
        if result.returncode != 0:
            raise CommandError(
                f"Clone failed:\n{result.stderr.strip()}"
            )

        self.stdout.write(self.style.SUCCESS(f"Done. '{dest}' is ready on {ssh}."))

    def _pg_flags(self, db, omit_user=False):
        """Build pg connection flags from DATABASES settings."""
        flags = []
        if not omit_user and db.get("USER"):
            flags += ["-U", db["USER"]]
        if db.get("HOST") and db["HOST"] not in ("127.0.0.1", "localhost"):
            flags += ["-h", db["HOST"]]
        if db.get("PORT"):
            flags += ["-p", str(db["PORT"])]
        return " ".join(flags)
