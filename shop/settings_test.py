"""
Test settings for shop project - used by runserver_test command
"""
from shop.settings import *

# Use test database instead of production
DATABASES['default']['NAME'] = 'shop_test'

# Debug mode for development
DEBUG = True

# Static files settings
STATIC_URL = '/static/'

# Properly configure static files for development
if SESSION_ENVIRONMENT_PRODUCTION:
    STATIC_ROOT = os.path.join(PROJECT_DIR, "static/")
    STATICFILES_DIRS = []
else:
    STATIC_ROOT = None
    STATICFILES_DIRS = [os.path.join(PROJECT_DIR, "static/")]

# Make it clear we're using a test database
OSCAR_SHOP_NAME = "BirdSoc SG Shop [TEST MODE]"
