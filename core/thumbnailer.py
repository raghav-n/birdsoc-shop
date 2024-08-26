class FakeThumbnailer(object):
    def generate_thumbnail(self, source, **opts):
        return source

    def delete_thumbnails(self, source):
        pass