#!/bin/bash
# Simple script to run the development server with test database

# Set environment variables
export DJANGO_SETTINGS_MODULE=shop.settings_test

# Run the test server
python manage.py runserver "$@"

# Alternative way to run:
# python manage.py runserver --settings=shop.settings_test "$@"
