// PayNow email poller — runs in Google Apps Script on the mailbox that
// receives Maybank PayNow alert emails. It scans all unprocessed alerts,
// extracts the order/event reference + amount from each, and POSTs them as a
// single signed JWT batch to the shop's batch-verify API. Configure the
// regexes and endpoint via Script Properties; sensible defaults are baked in.
//
// Trigger: install a time-driven trigger (every 1–5 minutes) that calls
// `processPayNowEmails`.

const DEFAULTS = {
  ORDER_REGEX: 'OTHR-MER-([A-Za-z0-9-]+)',
  AMOUNT_REGEX: 'S\\$([\\d.]+)',
  EVENT_REG_REF_REGEX: '(OBD25-[A-Za-z0-9-]+)',
  BATCH_API_URL: 'https://shop.birdsociety.sg/api/verify-payment-batch/',
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
    batchUrl: get('BATCH_API_URL'),
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
  const items = [];
  const threads = GmailApp.search(cfg.query);

  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      const body = msg.getBody();
      const amount = (body.match(cfg.amountRe) || [])[1];
      if (!amount) continue;

      const orderMatch = body.match(cfg.orderRe);
      const eventMatch = !orderMatch && body.match(cfg.eventRe);

      let key, item;
      if (orderMatch) {
        key = 'order:' + orderMatch[1];
        item = { type: 'order', order_number: orderMatch[1], amount };
      } else if (eventMatch) {
        key = 'reg:' + eventMatch[1];
        item = { type: 'event', group_reference: eventMatch[1], amount };
      } else {
        Logger.log('No order or event ref found in message id ' + msg.getId());
        continue;
      }

      // Dedupe within this run so the same reference isn't sent twice.
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
  }

  if (!items.length) {
    Logger.log('No PayNow alerts to process. Done.');
    return;
  }

  // Single batch call: every reference is verified in one signed request.
  const resp = postSigned(cfg.batchUrl, { items }, cfg.secret);
  const code = resp.getResponseCode();
  Logger.log('Batch (' + items.length + ' items) -> ' + code + ' : ' + resp.getContentText());

  if (code === 200) {
    let results = [];
    try {
      results = JSON.parse(resp.getContentText()).results || [];
    } catch (e) {
      Logger.log('Could not parse batch response: ' + e);
    }
    for (const r of results) {
      Logger.log(
        (r.reference || '(unknown)') + ' [' + r.status + '] ' + (r.success || r.error || '')
      );
    }
  }
  Logger.log('Done.');
}
