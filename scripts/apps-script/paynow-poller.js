// PayNow email poller — runs in Google Apps Script on the mailbox that
// receives Maybank PayNow alert emails. For each unprocessed alert it
// extracts the order/event reference + amount and POSTs a signed JWT to
// the matching shop API. Configure the regexes and endpoints via Script
// Properties; sensible defaults are baked in.
//
// Trigger: install a time-driven trigger (every 1–5 minutes) that calls
// `processPayNowEmails`.

const DEFAULTS = {
  ORDER_REGEX: 'OTHR-MER-([A-Za-z0-9-]+)',
  AMOUNT_REGEX: 'S\\$([\\d.]+)',
  EVENT_REG_REF_REGEX: '(OBD25-[A-Za-z0-9-]+)',
  ORDER_API_URL: 'https://shop.birdsociety.sg/api/verify-payment/',
  EVENT_API_URL: 'https://shop.birdsociety.sg/api/verify-event-payment/',
  GMAIL_QUERY: 'subject:"PayNow Alert - You have received a payment via PayNow" newer_than:1d',
};

function loadConfig() {
  const props = PropertiesService.getScriptProperties();
  const get = (key) => props.getProperty(key) || DEFAULTS[key];
  const secret = props.getProperty('JWT_SECRET');
  if (!secret) throw new Error('JWT_SECRET script property is required');
  return {
    secret,
    orderRe: new RegExp(get('ORDER_REGEX')),
    amountRe: new RegExp(get('AMOUNT_REGEX')),
    eventRe: new RegExp(get('EVENT_REG_REF_REGEX')),
    orderUrl: get('ORDER_API_URL'),
    eventUrl: get('EVENT_API_URL'),
    query: get('GMAIL_QUERY'),
  };
}

function b64url(input) {
  const bytes = typeof input === 'string' ? Utilities.newBlob(input).getBytes() : input;
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = Object.assign({ exp: Math.floor(Date.now() / 1000) + 60 }, payload);
  const toSign = b64url(JSON.stringify(header)) + '.' + b64url(JSON.stringify(body));
  const sig = Utilities.computeHmacSha256Signature(toSign, secret);
  return toSign + '.' + b64url(sig);
}

function postSigned(url, payload, secret) {
  return UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { Authorization: 'Bearer ' + signJWT(payload, secret) },
    muteHttpExceptions: true,
  });
}

function processPayNowEmails() {
  const cfg = loadConfig();
  const seen = new Set();
  const threads = GmailApp.search(cfg.query);

  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      const body = msg.getBody();
      const amount = (body.match(cfg.amountRe) || [])[1];
      if (!amount) continue;

      const orderMatch = body.match(cfg.orderRe);
      const eventMatch = !orderMatch && body.match(cfg.eventRe);

      let key, url, payload, label;
      if (orderMatch) {
        key = 'order:' + orderMatch[1];
        url = cfg.orderUrl;
        payload = { order_number: orderMatch[1], amount };
        label = 'Order ' + orderMatch[1];
      } else if (eventMatch) {
        key = 'reg:' + eventMatch[1];
        url = cfg.eventUrl;
        payload = { group_reference: eventMatch[1], amount };
        label = 'Event registration ' + eventMatch[1];
      } else {
        Logger.log('No order or event ref found in message id ' + msg.getId());
        continue;
      }

      if (seen.has(key)) continue;
      const resp = postSigned(url, payload, cfg.secret);
      Logger.log(label + ' -> ' + resp.getResponseCode() + ' : ' + resp.getContentText());
      if (resp.getResponseCode() === 200) seen.add(key);
      Utilities.sleep(1000);
    }
  }
  Logger.log('Done.');
}
