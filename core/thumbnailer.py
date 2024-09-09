from oscar.core.thumbnails import SorlThumbnail


class FakeThumbnail(object):
    def generate_thumbnail(self, source, **opts):
        return source

    def delete_thumbnails(self, source):
        pass


class LargeSorlThumbnail(SorlThumbnail):
    def generate_thumbnail(self, source, **opts):
        from sorl.thumbnail import get_thumbnail

        # Sorl can accept only: "width x height", "width", "x height".
        # https://sorl-thumbnail.readthedocs.io/en/latest/template.html#geometry
        # So for example value '50x' must be converted to '50'.
        size = opts.pop("size")
        width, height = size.split("x")
        # Set `size` to `width` if `height` is not provided.

        if height:
            width_int = ""
            if width:
                width_int = int(size.split("x")[0]) * 2
            height_int = int(size.split("x")[1]) * 2
            return get_thumbnail(source, f"{width_int}x{height_int}", **opts)
        else:
            width_int = int(width) * 2
            return get_thumbnail(source, str(width_int), **opts)
