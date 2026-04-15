import {
  buildCollectionQrUrl,
  buildOrderLookupPath,
  parseCollectionQrValue,
} from '../collectionQr';

describe('collectionQr helpers', () => {
  it('builds the order lookup path with an access id', () => {
    expect(buildOrderLookupPath({ number: '12345', accessId: 'abc-123' }))
      .toBe('/console/order-lookup/12345?id=abc-123');
  });

  it('builds the full collection QR URL', () => {
    expect(buildCollectionQrUrl({
      origin: 'https://shop.example.com',
      number: '12345',
      accessId: 'access-token',
    })).toBe('https://shop.example.com/console/order-lookup/12345?id=access-token');
  });

  it('parses a full collection QR URL', () => {
    expect(parseCollectionQrValue('https://shop.example.com/console/order-lookup/12345?id=secret'))
      .toEqual({ number: '12345', accessId: 'secret' });
  });

  it('parses a relative collection QR URL', () => {
    expect(parseCollectionQrValue('/console/order-lookup/54321?id=guest'))
      .toEqual({ number: '54321', accessId: 'guest' });
  });

  it('rejects non-collection QR payloads', () => {
    expect(parseCollectionQrValue('https://shop.example.com/orders/12345')).toBeNull();
    expect(parseCollectionQrValue('not-a-url')).toBeNull();
  });
});
