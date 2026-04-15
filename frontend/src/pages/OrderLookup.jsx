import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';
import toast from 'react-hot-toast';
import api from '../services/api';
import CollectionQrScanner from '../components/CollectionQrScanner';
import { buildOrderLookupPath } from '../utils/collectionQr';

const Page = styled.div`
  max-width: 640px;
  margin: 2rem auto;
  padding: 0 1rem 3rem;
`;

const Title = styled.h1`
  font-size: 1.5rem;
  margin: 0 0 1rem;
`;

const SearchCard = styled.div`
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 1rem 1.25rem;
  margin-bottom: 1rem;
`;

const ScannerWrap = styled.div`
  margin-bottom: 1rem;
`;

const Label = styled.label`
  display: block;
  font-size: 0.8rem;
  color: #555;
  margin-bottom: 0.35rem;
`;

const Input = styled.input`
  width: 100%;
  padding: 0.55rem 0.75rem;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 1rem;
  box-sizing: border-box;
`;

const OrderCard = styled.div`
  background: ${props => props.$collected ? '#f0f0f0' : '#fff'};
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  overflow: hidden;
  opacity: ${props => props.$collected ? 0.7 : 1};
`;

const OrderHeader = styled.div`
  padding: 0.75rem 1rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  user-select: none;

  &:hover {
    background: ${props => props.$collected ? 'transparent' : '#fafafa'};
  }
`;

const OrderTitle = styled.div`
  font-weight: 600;
  font-size: 1rem;
`;

const StatusBadge = styled.span`
  display: inline-block;
  font-size: 0.75rem;
  padding: 2px 8px;
  border-radius: 12px;
  background: ${props => props.$collected ? '#c8c8c8' : '#e2e2e2'};
  color: ${props => props.$collected ? '#666' : '#333'};
  align-self: flex-start;
`;

const OrderBody = styled.div`
  padding: 0 1rem 0.75rem;
  border-top: 1px solid #f0f0f0;
`;

const Table = styled.table`
  width: 100%;
  font-size: 0.95rem;
  border-collapse: collapse;
  margin: 0.5rem 0 0.75rem;

  td { padding: 2px 0; }
  td:last-child { text-align: right; }
`;

const CategoryRow = styled.td`
  padding-top: 0.5rem !important;
  font-size: 0.75rem;
  font-weight: 600;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: left !important;
`;

const Button = styled.button`
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  border: none;
  font-size: 0.85rem;
  cursor: pointer;
  color: white;
  margin-right: 0.4rem;
  background: ${props =>
    props.$variant === 'confirm' ? '#2e7d32' :
    props.$variant === 'cancel' ? '#c62828' :
    props.$variant === 'secondary' ? '#ccc' :
    '#333'};

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const Empty = styled.p`
  color: #888;
  text-align: center;
  padding: 1.5rem 0;
`;

const COLLECTED = 'Collected';

const OrderLookup = () => {
  const navigate = useNavigate();
  const { number: numberParam } = useParams();
  const [searchParams] = useSearchParams();
  const accessId = searchParams.get('id') || '';

  const [query, setQuery] = useState(numberParam || '');
  const [orders, setOrders] = useState([]);
  const [openCard, setOpenCard] = useState(null);
  const [pendingCollect, setPendingCollect] = useState(null);
  const debounceRef = useRef(null);
  const hydratedLookupRef = useRef('');

  const runSearch = useCallback(async (params) => {
    try {
      const resp = await api.get('/orders/search', { params });
      setOrders(resp.data.orders || []);
      if ((resp.data.orders || []).length > 0) {
        setOpenCard(resp.data.orders[0].number);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('Invalid access ID');
      } else {
        toast.error('Search failed');
      }
      setOrders([]);
      throw err;
    }
  }, []);

  const lookupOrder = useCallback(async ({ number, accessId: lookupAccessId = '', replaceUrl = false }) => {
    const nextNumber = String(number ?? '').trim();
    const nextAccessId = String(lookupAccessId ?? '').trim();

    if (!nextNumber) {
      return;
    }

    setQuery(nextNumber);

    if (replaceUrl) {
      navigate(buildOrderLookupPath({ number: nextNumber, accessId: nextAccessId }), { replace: true });
    }

    await runSearch(nextAccessId ? { number: nextNumber, id: nextAccessId } : { number: nextNumber });
  }, [navigate, runSearch]);

  // QR scan deep link: /console/order-lookup/<number>?id=<access_id>
  useEffect(() => {
    if (!numberParam) {
      return;
    }

    const lookupKey = `${numberParam}:${accessId}`;
    if (hydratedLookupRef.current === lookupKey) {
      return;
    }

    hydratedLookupRef.current = lookupKey;
    lookupOrder({ number: numberParam, accessId }).catch(() => {});
  }, [numberParam, accessId, lookupOrder]);

  const onInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    const trimmed = val.trim();
    const isNumber = /^\d+$/.test(trimmed);
    const numReady = isNumber && trimmed.length >= 5;
    const nameReady = !isNumber && trimmed.length >= 4;

    clearTimeout(debounceRef.current);
    if (!numReady && !nameReady) {
      setOrders([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      runSearch(isNumber ? { number: trimmed } : { name: trimmed }).catch(() => {});
    }, 250);
  };

  const handleScannedLookup = useCallback(async ({ number, accessId: scannedAccessId }) => {
    await lookupOrder({ number, accessId: scannedAccessId, replaceUrl: true });
    toast.success(`Opened order ${number}`);
  }, [lookupOrder]);

  const handleCollect = async (orderNumber) => {
    if (pendingCollect !== orderNumber) {
      setPendingCollect(orderNumber);
      return;
    }
    try {
      await api.post(`/orders/${orderNumber}/collect`);
      setOrders(prev =>
        prev.map(o => o.number === orderNumber ? { ...o, status: COLLECTED } : o)
      );
      toast.success(`Order ${orderNumber} marked as collected`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to mark collected');
    } finally {
      setPendingCollect(null);
    }
  };

  const groupedOrders = useMemo(() => orders.map(o => {
    const catMap = {};
    const catOrder = [];
    (o.items || []).forEach(item => {
      const cat = item.category || 'Other';
      if (!catMap[cat]) { catMap[cat] = []; catOrder.push(cat); }
      catMap[cat].push(item);
    });
    return { ...o, catMap, catOrder };
  }), [orders]);

  return (
    <Page>
      <Title>Order lookup</Title>

      <ScannerWrap>
        <CollectionQrScanner
          description="Scan a collection QR code to load the matching order here."
          buttonLabel="Scan collection QR"
          onScan={handleScannedLookup}
        />
      </ScannerWrap>

      <SearchCard>
        <Label htmlFor="lookup-input">Order number or customer name</Label>
        <Input
          id="lookup-input"
          type="text"
          placeholder="5+ digits or 4+ characters…"
          value={query}
          onChange={onInputChange}
          autoComplete="off"
        />
      </SearchCard>

      {groupedOrders.length === 0 ? (
        query.trim().length > 0 && <Empty>No matching orders found.</Empty>
      ) : (
        groupedOrders.map(o => {
          const collected = o.status === COLLECTED;
          const isOpen = openCard === o.number;
          return (
            <OrderCard key={o.number} $collected={collected}>
              <OrderHeader
                $collected={collected}
                onClick={() => setOpenCard(isOpen ? null : o.number)}
              >
                <OrderTitle>#{o.number}  {o.customer_name}</OrderTitle>
                <StatusBadge $collected={collected}>{o.status}</StatusBadge>
              </OrderHeader>
              {isOpen && (
                <OrderBody>
                  <Table>
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left', fontSize: '0.8rem', color: '#555' }}>Item</th>
                        <th style={{ textAlign: 'right', fontSize: '0.8rem', color: '#555' }}>Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.catOrder.length === 0 ? (
                        <tr><td colSpan={2} style={{ color: '#999' }}>No items.</td></tr>
                      ) : o.catOrder.map(cat => (
                        <React.Fragment key={cat}>
                          <tr><CategoryRow colSpan={2}>{cat}</CategoryRow></tr>
                          {o.catMap[cat].map((item, i) => (
                            <tr key={i}>
                              <td style={{ paddingLeft: '0.5rem' }}>{item.title}</td>
                              <td>{item.quantity}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </Table>
                  {collected ? (
                    <Button $variant="secondary" disabled>Collected</Button>
                  ) : pendingCollect === o.number ? (
                    <>
                      <Button $variant="confirm" onClick={() => handleCollect(o.number)}>
                        Confirm
                      </Button>
                      <Button $variant="cancel" onClick={() => setPendingCollect(null)}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => handleCollect(o.number)}>
                      Mark as collected
                    </Button>
                  )}
                </OrderBody>
              )}
            </OrderCard>
          );
        })
      )}
    </Page>
  );
};

export default OrderLookup;
