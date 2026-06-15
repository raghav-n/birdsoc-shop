import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, BarChart2, AlertCircle, Activity, Package, ArrowRightLeft } from 'lucide-react';
import { dashboardService } from '../services/dashboard';
import { Card } from '../styles/GlobalStyles';
import Loading from '../components/Loading';
import HelpModal from '../components/HelpModal';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
`;

const PageTitle = styled.h1`
  font-size: 2rem;
  margin-bottom: 0.5rem;
  color: var(--dark);
`;

const PageSubtitle = styled.p`
  color: #666;
  margin-bottom: 1.25rem;
`;

const FiltersBar = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
  padding: 1rem 1.25rem;
  background: #f8f9fa;
  border: 1px solid #eee;
  border-radius: 8px;
`;

const FilterGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const FilterLabel = styled.span`
  font-size: 0.85rem;
  font-weight: 600;
  color: #555;
  white-space: nowrap;
`;

const DateInput = styled.input`
  padding: 0.3rem 0.6rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.85rem;
  color: var(--dark);
  &:focus {
    outline: none;
    border-color: var(--link-text);
  }
`;

const Select = styled.select`
  padding: 0.3rem 0.6rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.85rem;
  color: var(--dark);
  background: white;
  min-width: 200px;
  &:focus {
    outline: none;
    border-color: var(--link-text);
  }
`;

const ApplyButton = styled.button`
  padding: 0.3rem 0.8rem;
  background: var(--link-text);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  &:hover { opacity: 0.9; }
`;

const CompareToggle = styled.button`
  padding: 0.3rem 0.7rem;
  background: ${props => props.$active ? 'var(--link-text)' : 'none'};
  color: ${props => props.$active ? 'white' : 'var(--link-text)'};
  border: 1px solid var(--link-text);
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  &:hover { background: ${props => props.$active ? 'var(--link-text)' : '#f0f4ff'}; }
`;

const CategoryHeader = styled.tr`
  background: #f0f4ff;
  td {
    font-weight: 700;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--link-text);
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #e0e8ff;
    white-space: nowrap;
  }
`;

const PartnerBadge = styled.button`
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  border: 2px solid ${props => props.$active ? 'var(--link-text)' : '#ddd'};
  background: ${props => props.$active ? 'var(--link-text)' : 'white'};
  color: ${props => props.$active ? 'white' : '#555'};
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  &:hover {
    border-color: var(--link-text);
    color: ${props => props.$active ? 'white' : 'var(--link-text)'};
  }
`;

const SummaryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2.5rem;
`;

const StatCard = styled(Card)`
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const StatIcon = styled.div`
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: ${props => props.$bg || '#f0f4ff'};
  color: ${props => props.$color || 'var(--link-text)'};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 0.25rem;
`;

const StatLabel = styled.div`
  font-size: 0.85rem;
  color: #666;
  font-weight: 500;
`;

const StatValue = styled.div`
  font-size: 1.75rem;
  font-weight: 700;
  color: ${props => props.$color || 'var(--dark)'};
  line-height: 1.1;
`;

const StatSub = styled.div`
  font-size: 0.8rem;
  color: #999;
`;

const ComparePair = styled.div`
  display: flex;
  gap: 1rem;
  align-items: baseline;

  ${() => VelocityValue} {
    font-size: 1.1rem;
  }
  ${() => StatValue} {
    font-size: 1.35rem;
  }
`;

const CompareItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
`;

const CompareTag = styled.span`
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${props => props.$color || '#999'};
`;

const Section = styled.div`
  margin-bottom: 2.5rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--dark);
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ExportButton = styled.button`
  margin-left: auto;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--link-text);
  background: none;
  border: 1px solid var(--link-text);
  border-radius: 6px;
  padding: 0.2rem 0.65rem;
  cursor: pointer;
  &:hover { background: #f0f4ff; }
`;

const Table = styled.div`
  overflow-x: auto;
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
`;

const Th = styled.th`
  text-align: ${props => props.$right ? 'right' : 'left'};
  padding: 0.75rem 1rem;
  font-weight: 600;
  color: #555;
  border-bottom: 2px solid #eee;
  white-space: nowrap;
  cursor: ${props => props.$sortable ? 'pointer' : 'default'};
  user-select: none;
  &:hover {
    color: ${props => props.$sortable ? 'var(--link-text)' : '#555'};
  }
`;

const Td = styled.td`
  text-align: ${props => props.$right ? 'right' : 'left'};
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f0f0f0;
  color: ${props => props.$muted ? '#999' : props.$positive ? '#16a34a' : props.$negative ? '#dc2626' : 'inherit'};
  font-weight: ${props => props.$bold ? '600' : 'normal'};
`;

const Tr = styled.tr`
  &:last-child td { border-bottom: none; }
  &:hover td { background: #fafafa; }
`;

const MarginBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
`;

const BarTrack = styled.div`
  width: 60px;
  height: 6px;
  background: #eee;
  border-radius: 3px;
  overflow: hidden;
`;

const BarFill = styled.div`
  height: 100%;
  width: ${props => Math.max(0, Math.min(100, props.$pct))}%;
  background: ${props => props.$color || (props.$pct >= 40 ? '#16a34a' : props.$pct >= 20 ? '#d97706' : '#dc2626')};
  border-radius: 3px;
`;

const NoCostBadge = styled.span`
  font-size: 0.75rem;
  color: #999;
  font-style: italic;
`;

const VariantRow = styled.tr`
  td { background: #fafafa; border-bottom: none; padding: 2px 12px 2px 28px; }
  &:last-child td { padding-bottom: 8px; }
`;

const VariantLabel = styled.span`
  font-size: 0.75rem;
  color: #666;
`;

const VariantQty = styled.span`
  font-size: 0.75rem;
  color: #888;
`;

const NoCostNote = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #92400e;
  background: #fef3c7;
  border: 1px solid #fde68a;
  border-radius: 6px;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  margin-bottom: 1rem;
`;

const MonthlyNote = styled.div`
  font-size: 0.8rem;
  color: #999;
  margin-bottom: 0.5rem;
`;

const SplitBar = styled.div`
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  width: 80px;
`;

const SplitFillA = styled.div`
  height: 100%;
  width: ${props => props.$pct}%;
  background: var(--link-text);
`;

const SplitFillB = styled.div`
  height: 100%;
  width: ${props => props.$pct}%;
  background: #ccc;
`;

const SplitCell = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: flex-end;
`;

const SizeGrid = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const SizeCard = styled.div`
  background: white;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  text-align: center;
  min-width: 70px;
  flex: 1;
`;

const SizeName = styled.div`
  font-size: 0.8rem;
  font-weight: 600;
  color: #555;
  margin-bottom: 0.25rem;
`;

const SizeUnits = styled.div`
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--dark);
`;

const SizePct = styled.div`
  font-size: 0.75rem;
  color: #999;
`;

const VelocityGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
`;

const VelocityCard = styled(Card)`
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const VelocityLabel = styled.div`
  font-size: 0.8rem;
  color: #666;
  font-weight: 500;
`;

const VelocityValue = styled.div`
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--dark);
  white-space: nowrap;
`;

const formatSGD = (val) => {
  if (val == null) return '—';
  return `$${parseFloat(val).toFixed(2)}`;
};

const SORT_KEYS = ['revenue', 'cost', 'profit', 'margin', 'units_sold'];

const sum = (arr, key) => arr.reduce((acc, x) => acc + parseFloat(x[key] ?? 0), 0);

const diffLabels = (nameA, nameB) => {
  if (!nameA || !nameB) return [nameA || 'A', nameB || 'B'];
  const sepRe = /[-–—_\s]+/;
  const partsA = nameA.split(sepRe);
  const partsB = nameB.split(sepRe);
  const common = new Set();
  const countB = {};
  for (const t of partsB) { const k = t.toLowerCase(); countB[k] = (countB[k] || 0) + 1; }
  for (const t of partsA) {
    const k = t.toLowerCase();
    if (countB[k]) { common.add(k); countB[k]--; }
  }
  const uniqueA = partsA.filter(t => !common.has(t.toLowerCase()));
  const uniqueB = partsB.filter(t => !common.has(t.toLowerCase()));
  const a = uniqueA.join(' ').trim() || nameA;
  const b = uniqueB.join(' ').trim() || nameB;
  return [a, b];
};

const Dashboard = () => {
  const [periods, setPeriods] = useState([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [selectedPeriodA, setSelectedPeriodA] = useState('');
  const [selectedPeriodB, setSelectedPeriodB] = useState('');
  const [compareMode, setCompareMode] = useState(false);

  const [customStartA, setCustomStartA] = useState('');
  const [customEndA, setCustomEndA] = useState('');
  const [customStartB, setCustomStartB] = useState('');
  const [customEndB, setCustomEndB] = useState('');

  const [dataA, setDataA] = useState(null);
  const [dataB, setDataB] = useState(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [error, setError] = useState(null);

  const [sortKey, setSortKey] = useState('revenue');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedPartners, setSelectedPartners] = useState(new Set());

  useEffect(() => {
    dashboardService.getPeriods()
      .then(p => {
        setPeriods(p);
        if (p.length > 0) {
          setSelectedPeriodA(String(p[p.length - 1].id));
          if (p.length > 1) {
            setSelectedPeriodB(String(p[p.length - 2].id));
          }
        }
      })
      .catch(() => {})
      .finally(() => setPeriodsLoading(false));
  }, []);

  const getDatesForSelection = useCallback((periodId, customStart, customEnd) => {
    if (periodId === 'custom') {
      return { start: customStart, end: customEnd };
    }
    const period = periods.find(p => String(p.id) === periodId);
    if (period) {
      return { start: period.start, end: period.end };
    }
    return { start: '', end: '' };
  }, [periods]);

  const fetchA = useCallback(() => {
    const { start, end } = getDatesForSelection(selectedPeriodA, customStartA, customEndA);
    if (!start || !end) return;
    setLoadingA(true);
    setError(null);
    dashboardService.getAnalytics({ start, end })
      .then(d => { setDataA(d); setSelectedPartners(new Set()); })
      .catch(() => setError('Failed to load analytics data.'))
      .finally(() => setLoadingA(false));
  }, [selectedPeriodA, customStartA, customEndA, getDatesForSelection]);

  const fetchB = useCallback(() => {
    if (!compareMode) { setDataB(null); return; }
    const { start, end } = getDatesForSelection(selectedPeriodB, customStartB, customEndB);
    if (!start || !end) return;
    setLoadingB(true);
    dashboardService.getAnalytics({ start, end })
      .then(d => setDataB(d))
      .catch(() => {})
      .finally(() => setLoadingB(false));
  }, [selectedPeriodB, customStartB, customEndB, compareMode, getDatesForSelection]);

  useEffect(() => {
    if (!periodsLoading && selectedPeriodA) fetchA();
  }, [periodsLoading, selectedPeriodA]);

  useEffect(() => {
    if (!periodsLoading && compareMode && selectedPeriodB) fetchB();
  }, [periodsLoading, compareMode, selectedPeriodB]);

  const handleApplyA = () => fetchA();
  const handleApplyB = () => fetchB();

  const handlePeriodAChange = (val) => {
    setSelectedPeriodA(val);
    if (val !== 'custom') {
      const period = periods.find(p => String(p.id) === val);
      if (period) {
        setLoadingA(true);
        setError(null);
        dashboardService.getAnalytics({ start: period.start, end: period.end })
          .then(d => { setDataA(d); setSelectedPartners(new Set()); })
          .catch(() => setError('Failed to load analytics data.'))
          .finally(() => setLoadingA(false));
      }
    }
  };

  const handlePeriodBChange = (val) => {
    setSelectedPeriodB(val);
    if (val !== 'custom') {
      const period = periods.find(p => String(p.id) === val);
      if (period) {
        setLoadingB(true);
        dashboardService.getAnalytics({ start: period.start, end: period.end })
          .then(d => setDataB(d))
          .catch(() => {})
          .finally(() => setLoadingB(false));
      }
    }
  };

  const toggleCompare = () => {
    if (compareMode) {
      setCompareMode(false);
      setDataB(null);
    } else {
      setCompareMode(true);
      if (selectedPeriodB && selectedPeriodB !== 'custom') {
        const period = periods.find(p => String(p.id) === selectedPeriodB);
        if (period) {
          setLoadingB(true);
          dashboardService.getAnalytics({ start: period.start, end: period.end })
            .then(d => setDataB(d))
            .catch(() => {})
            .finally(() => setLoadingB(false));
        }
      }
    }
  };

  const productMapB = useMemo(() => {
    if (!dataB) return {};
    const map = {};
    for (const p of dataB.by_product) {
      map[p.product_id] = p;
    }
    return map;
  }, [dataB]);

  const loading = (loadingA || loadingB) && !dataA;
  if (loading || periodsLoading) return <Loading text="Loading dashboard..." />;
  if (error && !dataA) return <Container><p style={{ color: 'var(--danger)' }}>{error}</p></Container>;
  if (!dataA) return <Container><p style={{ color: '#666' }}>Select a sales period to view analytics.</p></Container>;

  const { partners, categories: orderedCategories = [], by_product, by_month, variant_distribution = [] } = dataA;
  const summaryA = dataA.summary;
  const summaryB = dataB?.summary;
  const variantDistB = dataB?.variant_distribution || [];

  const isFiltered = selectedPartners.size > 0;

  const togglePartner = (name) => {
    setSelectedPartners(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const filteredProducts = isFiltered
    ? by_product.filter(p => selectedPartners.has(p.partner))
    : by_product;

  const filtRevenue = sum(filteredProducts, 'revenue');
  const filtCost = sum(filteredProducts.filter(p => p.cost != null), 'cost');
  const filtProfit = filtRevenue - filtCost;
  const filtMargin = filtRevenue > 0 ? (filtProfit / filtRevenue * 100) : 0;
  const filtOrders = isFiltered ? '—' : summaryA.total_orders;
  const filtDonations = isFiltered ? null : parseFloat(summaryA.total_donations ?? 0);
  const filtCollected = isFiltered ? null : parseFloat(summaryA.total_collected ?? 0);
  const filtProfitWithDonations = filtDonations == null ? null : filtProfit + filtDonations;

  const hasAnyCost = filteredProducts.some(p => p.cost != null);
  const missingCostCount = filteredProducts.filter(p => p.cost == null).length;

  const handleSort = (key) => {
    if (!SORT_KEYS.includes(key)) return;
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const av = parseFloat(a[sortKey] ?? -Infinity);
    const bv = parseFloat(b[sortKey] ?? -Infinity);
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const groupedProducts = (() => {
    const groups = [];
    const seen = new Set();
    const categoryOrder = [...orderedCategories, ''];

    for (const cat of categoryOrder) {
      const items = sortedProducts.filter(p => p.category === cat);
      if (items.length === 0) continue;
      if (seen.has(cat)) continue;
      seen.add(cat);
      const totals = items.reduce((acc, p) => ({
        units: acc.units + (p.units_sold || 0),
        revenue: acc.revenue + parseFloat(p.revenue || 0),
        cost: acc.cost + (p.cost != null ? parseFloat(p.cost) : 0),
        hasCost: acc.hasCost || p.cost != null,
        profit: acc.profit + (p.profit != null ? parseFloat(p.profit) : 0),
        hasProfit: acc.hasProfit || p.profit != null,
      }), { units: 0, revenue: 0, cost: 0, hasCost: false, profit: 0, hasProfit: false });
      totals.margin = totals.hasCost && totals.revenue > 0 ? Math.round(totals.profit / totals.revenue * 1000) / 10 : null;
      groups.push({ category: cat || 'Other', items, totals });
    }
    const remaining = sortedProducts.filter(p => !seen.has(p.category));
    if (remaining.length > 0) {
      const totals = remaining.reduce((acc, p) => ({
        units: acc.units + (p.units_sold || 0),
        revenue: acc.revenue + parseFloat(p.revenue || 0),
        cost: acc.cost + (p.cost != null ? parseFloat(p.cost) : 0),
        hasCost: acc.hasCost || p.cost != null,
        profit: acc.profit + (p.profit != null ? parseFloat(p.profit) : 0),
        hasProfit: acc.hasProfit || p.profit != null,
      }), { units: 0, revenue: 0, cost: 0, hasCost: false, profit: 0, hasProfit: false });
      totals.margin = totals.hasCost && totals.revenue > 0 ? Math.round(totals.profit / totals.revenue * 1000) / 10 : null;
      groups.push({ category: 'Other', items: remaining, totals });
    }
    return groups;
  })();

  const sortIndicator = (key) => sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  const periodALabel = (() => {
    if (selectedPeriodA === 'custom') return `${customStartA} → ${customEndA}`;
    const p = periods.find(p => String(p.id) === selectedPeriodA);
    return p ? p.name : '';
  })();

  const periodBLabel = (() => {
    if (selectedPeriodB === 'custom') return `${customStartB} → ${customEndB}`;
    const p = periods.find(p => String(p.id) === selectedPeriodB);
    return p ? p.name : '';
  })();

  const [tagA, tagB] = compareMode ? diffLabels(periodALabel, periodBLabel) : [periodALabel, periodBLabel];

  const exportCSV = () => {
    const rows = [['Category', 'Product', 'Partner', 'Sale Price', 'Units', 'Revenue', 'Cost', 'Profit', 'Margin']];
    for (const { category, items } of groupedProducts) {
      for (const p of items) {
        rows.push([
          category,
          p.title,
          p.partner || '',
          p.unit_price ?? '',
          p.units_sold,
          p.revenue,
          p.cost ?? '',
          p.profit ?? '',
          p.margin != null ? `${p.margin}%` : '',
        ]);
        for (const v of p.variants || []) {
          rows.push([category, `  ${p.title} – ${v.label}`, '', '', v.units_sold, '', '', '', '']);
        }
      }
    }
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${periodALabel.replace(/[^a-zA-Z0-9-]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const PeriodSelector = ({ value, onChange, customStart, customEnd, onCustomStartChange, onCustomEndChange, onApply, label }) => (
    <FilterGroup>
      <FilterLabel>{label}:</FilterLabel>
      <Select value={value} onChange={e => onChange(e.target.value)}>
        <option value="" disabled>Select period…</option>
        {periods.map(p => (
          <option key={p.id} value={String(p.id)}>{p.name}</option>
        ))}
        <option value="custom">Custom dates…</option>
      </Select>
      {value === 'custom' && (
        <>
          <DateInput type="date" value={customStart} onChange={e => onCustomStartChange(e.target.value)} />
          <span style={{ color: '#999', fontSize: '0.85rem' }}>to</span>
          <DateInput type="date" value={customEnd} onChange={e => onCustomEndChange(e.target.value)} />
          <ApplyButton onClick={onApply}>Apply</ApplyButton>
        </>
      )}
    </FilterGroup>
  );

  return (
    <Container>
      <HelpModal title="How to use: Sales Dashboard">
        <h3>Sales Periods</h3>
        <p>Select a <strong>sales period</strong> from the dropdown to view analytics for that period. Periods are managed in the backend sales report tool. You can also choose <strong>Custom dates</strong> for a specific range.</p>
        <h3>Comparison mode</h3>
        <p>Click <strong>Compare</strong> to select a second period. Summary cards, velocity metrics, size distribution, and the product table will show both periods' values side-by-side for easy comparison.</p>
        <h3>Production Planning</h3>
        <p>The <strong>Velocity</strong> section shows daily averages — useful for estimating demand over a future period. The <strong>Size Distribution</strong> section shows the breakdown of variant sizes sold — use this to plan your next production run's size ratio.</p>
        <h3>Partner filter</h3>
        <p>If there are multiple partners, click a partner badge to filter the product table to that partner's items.</p>
        <h3>By Product table</h3>
        <ul>
          <li>Click any column header (Units, Revenue, Cost, Profit, Margin) to sort.</li>
          <li>Expand a product row to see per-variant unit counts.</li>
          <li>Click <strong>Export CSV</strong> to download the full table.</li>
        </ul>
      </HelpModal>

      <Link to="/console" style={{ fontSize: '0.8rem', color: 'var(--link-text)', display: 'inline-block', marginBottom: '0.5rem' }}>← Back to Console</Link>
      <PageTitle>Sales Dashboard</PageTitle>
      <PageSubtitle>
        {(loadingA || loadingB) ? 'Updating…' : (
          compareMode && dataB
            ? `Comparing: ${periodALabel} vs ${periodBLabel}`
            : periodALabel
        )}
      </PageSubtitle>

      {/* Filters bar */}
      <FiltersBar>
        <PeriodSelector
          value={selectedPeriodA}
          onChange={handlePeriodAChange}
          customStart={customStartA}
          customEnd={customEndA}
          onCustomStartChange={setCustomStartA}
          onCustomEndChange={setCustomEndA}
          onApply={handleApplyA}
          label={compareMode ? tagA : 'Period'}
        />

        <CompareToggle $active={compareMode} onClick={toggleCompare}>
          <ArrowRightLeft size={14} />
          Compare
        </CompareToggle>

        {compareMode && (
          <PeriodSelector
            value={selectedPeriodB}
            onChange={handlePeriodBChange}
            customStart={customStartB}
            customEnd={customEndB}
            onCustomStartChange={setCustomStartB}
            onCustomEndChange={setCustomEndB}
            onApply={handleApplyB}
            label={tagB}
          />
        )}

        {partners.length > 1 && (
          <FilterGroup>
            <FilterLabel>Partner:</FilterLabel>
            <PartnerBadge $active={!isFiltered} onClick={() => setSelectedPartners(new Set())}>
              All
            </PartnerBadge>
            {partners.map(name => (
              <PartnerBadge
                key={name}
                $active={selectedPartners.has(name)}
                onClick={() => togglePartner(name)}
              >
                {name}
              </PartnerBadge>
            ))}
          </FilterGroup>
        )}
      </FiltersBar>

      {/* Summary cards */}
      <SummaryGrid>
        <StatCard>
          <StatIcon $bg="#f0f4ff" $color="var(--link-text)"><ShoppingBag size={20} /></StatIcon>
          <StatLabel>Total Orders</StatLabel>
          {compareMode && summaryB && !isFiltered ? (
            <ComparePair>
              <CompareItem><CompareTag $color="var(--link-text)">{tagA}</CompareTag><StatValue>{filtOrders}</StatValue></CompareItem>
              <CompareItem><CompareTag>{tagB}</CompareTag><StatValue>{summaryB.total_orders}</StatValue></CompareItem>
            </ComparePair>
          ) : (
            <StatValue>{filtOrders}</StatValue>
          )}
          {isFiltered && <StatSub>n/a when filtering by partner</StatSub>}
        </StatCard>

        <StatCard>
          <StatIcon $bg="#f0fdf4" $color="#16a34a"><DollarSign size={20} /></StatIcon>
          <StatLabel>Total Revenue</StatLabel>
          {compareMode && summaryB ? (
            <ComparePair>
              <CompareItem><CompareTag $color="var(--link-text)">{tagA}</CompareTag><StatValue>{formatSGD(filtRevenue)}</StatValue></CompareItem>
              <CompareItem><CompareTag>{tagB}</CompareTag><StatValue>{formatSGD(summaryB.total_revenue)}</StatValue></CompareItem>
            </ComparePair>
          ) : (
            <StatValue>{formatSGD(filtRevenue)}</StatValue>
          )}
          <StatSub>
            {isFiltered ? 'Merchandise only, incl. tax' : `With donations: ${formatSGD(filtCollected)}`}
          </StatSub>
        </StatCard>

        <StatCard>
          <StatIcon $bg="#fff7ed" $color="#d97706"><TrendingDown size={20} /></StatIcon>
          <StatLabel>Total Cost</StatLabel>
          {compareMode && summaryB && hasAnyCost ? (
            <ComparePair>
              <CompareItem><CompareTag $color="var(--link-text)">{tagA}</CompareTag><StatValue>{formatSGD(filtCost)}</StatValue></CompareItem>
              <CompareItem><CompareTag>{tagB}</CompareTag><StatValue>{formatSGD(summaryB.total_cost)}</StatValue></CompareItem>
            </ComparePair>
          ) : (
            <StatValue $color={hasAnyCost ? 'var(--dark)' : '#bbb'}>
              {hasAnyCost ? formatSGD(filtCost) : '—'}
            </StatValue>
          )}
          {!hasAnyCost && <StatSub>Enter cost prices to see this</StatSub>}
        </StatCard>

        <StatCard>
          <StatIcon $bg="#f0fdf4" $color="#16a34a"><TrendingUp size={20} /></StatIcon>
          <StatLabel>Total Profit</StatLabel>
          {compareMode && summaryB && hasAnyCost ? (
            <ComparePair>
              <CompareItem><CompareTag $color="var(--link-text)">{tagA}</CompareTag><StatValue $color={filtProfit >= 0 ? '#16a34a' : '#dc2626'}>{formatSGD(filtProfit)}</StatValue></CompareItem>
              <CompareItem><CompareTag>{tagB}</CompareTag><StatValue $color={parseFloat(summaryB.total_profit) >= 0 ? '#16a34a' : '#dc2626'}>{formatSGD(summaryB.total_profit)}</StatValue></CompareItem>
            </ComparePair>
          ) : (
            <StatValue $color={hasAnyCost ? (filtProfit >= 0 ? '#16a34a' : '#dc2626') : '#bbb'}>
              {hasAnyCost ? formatSGD(filtProfit) : '—'}
            </StatValue>
          )}
          {hasAnyCost && !compareMode && (
            <StatSub>
              {isFiltered ? (
                <>
                  <BarChart2 size={12} style={{ display: 'inline', verticalAlign: 'middle' }} />{' '}
                  {filtMargin.toFixed(1)}% margin
                </>
              ) : (
                <>With donations: {formatSGD(filtProfitWithDonations)}</>
              )}
            </StatSub>
          )}
        </StatCard>
      </SummaryGrid>

      {/* Velocity / production planning */}
      <Section>
        <SectionTitle><Activity size={20} /> Sales Velocity</SectionTitle>
        <VelocityGrid>
          <VelocityCard>
            <VelocityLabel>Avg Order Value</VelocityLabel>
            {compareMode && summaryB ? (
              <ComparePair>
                <CompareItem><CompareTag $color="var(--link-text)">{tagA}</CompareTag><VelocityValue>{formatSGD(summaryA.avg_order_value)}</VelocityValue></CompareItem>
                <CompareItem><CompareTag>{tagB}</CompareTag><VelocityValue>{formatSGD(summaryB.avg_order_value)}</VelocityValue></CompareItem>
              </ComparePair>
            ) : (
              <VelocityValue>{formatSGD(summaryA.avg_order_value)}</VelocityValue>
            )}
          </VelocityCard>
          <VelocityCard>
            <VelocityLabel>Units per Order</VelocityLabel>
            {compareMode && summaryB ? (
              <ComparePair>
                <CompareItem><CompareTag $color="var(--link-text)">{tagA}</CompareTag><VelocityValue>{summaryA.avg_units_per_order ?? '—'}</VelocityValue></CompareItem>
                <CompareItem><CompareTag>{tagB}</CompareTag><VelocityValue>{summaryB.avg_units_per_order ?? '—'}</VelocityValue></CompareItem>
              </ComparePair>
            ) : (
              <VelocityValue>{summaryA.avg_units_per_order ?? '—'}</VelocityValue>
            )}
          </VelocityCard>
          {(summaryA.daily_revenue != null || (summaryB?.daily_revenue != null && compareMode)) && (
            <VelocityCard>
              <VelocityLabel>Revenue / Day</VelocityLabel>
              {compareMode && summaryB ? (
                <ComparePair>
                  <CompareItem><CompareTag $color="var(--link-text)">{tagA}</CompareTag><VelocityValue>{summaryA.daily_revenue != null ? formatSGD(summaryA.daily_revenue) : '—'}</VelocityValue></CompareItem>
                  <CompareItem><CompareTag>{tagB}</CompareTag><VelocityValue>{summaryB.daily_revenue != null ? formatSGD(summaryB.daily_revenue) : '—'}</VelocityValue></CompareItem>
                </ComparePair>
              ) : (
                <VelocityValue>{formatSGD(summaryA.daily_revenue)}</VelocityValue>
              )}
            </VelocityCard>
          )}
          {(summaryA.daily_units != null || (summaryB?.daily_units != null && compareMode)) && (
            <VelocityCard>
              <VelocityLabel>Units / Day</VelocityLabel>
              {compareMode && summaryB ? (
                <ComparePair>
                  <CompareItem><CompareTag $color="var(--link-text)">{tagA}</CompareTag><VelocityValue>{summaryA.daily_units ?? '—'}</VelocityValue></CompareItem>
                  <CompareItem><CompareTag>{tagB}</CompareTag><VelocityValue>{summaryB.daily_units ?? '—'}</VelocityValue></CompareItem>
                </ComparePair>
              ) : (
                <VelocityValue>{summaryA.daily_units}</VelocityValue>
              )}
            </VelocityCard>
          )}
          <VelocityCard>
            <VelocityLabel>Total Units Sold</VelocityLabel>
            {compareMode && summaryB ? (
              <ComparePair>
                <CompareItem><CompareTag $color="var(--link-text)">{tagA}</CompareTag><VelocityValue>{summaryA.total_units ?? '—'}</VelocityValue></CompareItem>
                <CompareItem><CompareTag>{tagB}</CompareTag><VelocityValue>{summaryB.total_units ?? '—'}</VelocityValue></CompareItem>
              </ComparePair>
            ) : (
              <VelocityValue>{summaryA.total_units ?? '—'}</VelocityValue>
            )}
          </VelocityCard>
          {(summaryA.period_days != null || (summaryB?.period_days != null && compareMode)) && (
            <VelocityCard>
              <VelocityLabel>Period Length</VelocityLabel>
              {compareMode && summaryB ? (
                <ComparePair>
                  <CompareItem><CompareTag $color="var(--link-text)">{tagA}</CompareTag><VelocityValue>{summaryA.period_days ?? '—'} days</VelocityValue></CompareItem>
                  <CompareItem><CompareTag>{tagB}</CompareTag><VelocityValue>{summaryB.period_days ?? '—'} days</VelocityValue></CompareItem>
                </ComparePair>
              ) : (
                <VelocityValue>{summaryA.period_days} days</VelocityValue>
              )}
            </VelocityCard>
          )}
        </VelocityGrid>
      </Section>

      {/* Size distribution */}
      {variant_distribution.length > 0 && (
        <Section>
          <SectionTitle><Package size={20} /> Size Distribution</SectionTitle>
          <Card style={{ padding: '1.25rem' }}>
            <SizeGrid>
              {variant_distribution.map(v => {
                const vB = compareMode ? variantDistB.find(x => x.label === v.label) : null;
                return (
                  <SizeCard key={v.label}>
                    <SizeName>{v.label}</SizeName>
                    {compareMode && vB ? (
                      <>
                        <ComparePair style={{ justifyContent: 'center' }}>
                          <CompareItem style={{ alignItems: 'center' }}>
                            <CompareTag $color="var(--link-text)">{tagA}</CompareTag>
                            <SizeUnits>{v.units}</SizeUnits>
                            <SizePct>{v.pct}%</SizePct>
                          </CompareItem>
                          <CompareItem style={{ alignItems: 'center' }}>
                            <CompareTag>{tagB}</CompareTag>
                            <SizeUnits>{vB.units}</SizeUnits>
                            <SizePct>{vB.pct}%</SizePct>
                          </CompareItem>
                        </ComparePair>
                        <div style={{ margin: '0.25rem 0', display: 'flex', gap: '2px' }}>
                          <BarTrack style={{ flex: 1 }}>
                            <BarFill $pct={v.pct} $color="var(--link-text)" />
                          </BarTrack>
                          <BarTrack style={{ flex: 1 }}>
                            <BarFill $pct={vB.pct} $color="#999" />
                          </BarTrack>
                        </div>
                      </>
                    ) : (
                      <>
                        <SizeUnits>{v.units}</SizeUnits>
                        <SizePct>{v.pct}%</SizePct>
                        <div style={{ margin: '0.25rem 0' }}>
                          <BarTrack style={{ width: '100%' }}>
                            <BarFill $pct={v.pct} $color="var(--link-text)" />
                          </BarTrack>
                        </div>
                      </>
                    )}
                  </SizeCard>
                );
              })}
            </SizeGrid>
          </Card>
        </Section>
      )}

      {/* By product */}
      <Section>
        <SectionTitle>By Product <ExportButton onClick={exportCSV}>Export CSV</ExportButton></SectionTitle>
        {missingCostCount > 0 && (
          <NoCostNote>
            <AlertCircle size={16} />
            {missingCostCount} product{missingCostCount > 1 ? 's have' : ' has'} no cost price set.
          </NoCostNote>
        )}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Table>
            <StyledTable>
              <thead>
                <tr>
                  <Th>Product</Th>
                  {!isFiltered && <Th>Partner</Th>}
                  <Th $right $sortable onClick={() => handleSort('units_sold')}>{compareMode && dataB ? `Units (${tagA})` : 'Units'}{sortIndicator('units_sold')}</Th>
                  {compareMode && dataB && <Th $right>Units ({tagB})</Th>}
                  <Th $right $sortable onClick={() => handleSort('revenue')}>{compareMode && dataB ? `Revenue (${tagA})` : 'Revenue'}{sortIndicator('revenue')}</Th>
                  {compareMode && dataB && <Th $right>Revenue ({tagB})</Th>}
                  <Th $right $sortable onClick={() => handleSort('cost')}>Cost{sortIndicator('cost')}</Th>
                  <Th $right $sortable onClick={() => handleSort('profit')}>Profit{sortIndicator('profit')}</Th>
                  <Th $right $sortable onClick={() => handleSort('margin')}>Margin{sortIndicator('margin')}</Th>
                </tr>
              </thead>
              <tbody>
                {groupedProducts.map(({ category, items, totals }) => {
                  const totalsB = compareMode && dataB ? items.reduce((acc, p) => {
                    const pB = productMapB[p.product_id];
                    if (!pB) return acc;
                    return {
                      units: acc.units + (pB.units_sold || 0),
                      revenue: acc.revenue + parseFloat(pB.revenue || 0),
                    };
                  }, { units: 0, revenue: 0 }) : null;
                  return (
                  <React.Fragment key={category}>
                    <CategoryHeader>
                      <td colSpan={isFiltered ? 1 : 2}>{category}</td>
                      <td style={{ textAlign: 'right' }}>{totals.units}</td>
                      {compareMode && dataB && <td style={{ textAlign: 'right' }}>{totalsB?.units ?? '—'}</td>}
                      <td style={{ textAlign: 'right' }}>{formatSGD(totals.revenue)}</td>
                      {compareMode && dataB && <td style={{ textAlign: 'right' }}>{totalsB ? formatSGD(totalsB.revenue) : '—'}</td>}
                      <td style={{ textAlign: 'right' }}>{totals.hasCost ? formatSGD(totals.cost) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{totals.hasProfit ? formatSGD(totals.profit) : '—'}</td>
                      <td style={{ textAlign: 'right' }}>{totals.margin != null ? `${totals.margin}%` : '—'}</td>
                    </CategoryHeader>
                    {items.map(p => {
                      const margin = p.margin;
                      const profit = parseFloat(p.profit ?? 0);
                      const pB = productMapB[p.product_id];
                      const totalCols = (isFiltered ? 6 : 7) + (compareMode && dataB ? 2 : 0);
                      return (
                        <React.Fragment key={p.product_id}>
                          <Tr>
                            <Td>{p.title}</Td>
                            {!isFiltered && <Td $muted>{p.partner}</Td>}
                            <Td $right>{p.units_sold}</Td>
                            {compareMode && dataB && (
                              <Td $right>{pB?.units_sold ?? '—'}</Td>
                            )}
                            <Td $right $bold>{formatSGD(p.revenue)}</Td>
                            {compareMode && dataB && (
                              <Td $right $bold>{pB ? formatSGD(pB.revenue) : '—'}</Td>
                            )}
                            <Td $right>{p.cost != null ? formatSGD(p.cost) : <NoCostBadge>no cost</NoCostBadge>}</Td>
                            <Td $right $positive={p.profit != null && profit >= 0} $negative={p.profit != null && profit < 0}>
                              {p.profit != null ? formatSGD(p.profit) : <NoCostBadge>—</NoCostBadge>}
                            </Td>
                            <Td $right>
                              {margin != null ? (
                                <MarginBar>
                                  <span style={{ color: margin >= 40 ? '#16a34a' : margin >= 20 ? '#d97706' : '#dc2626' }}>
                                    {margin}%
                                  </span>
                                  <BarTrack>
                                    <BarFill $pct={margin} />
                                  </BarTrack>
                                </MarginBar>
                              ) : <NoCostBadge>—</NoCostBadge>}
                            </Td>
                          </Tr>
                          {p.variants && p.variants.length > 0 && (
                            <VariantRow>
                              <td colSpan={totalCols}>
                                {p.variants.map(v => (
                                  <span key={v.label} style={{ marginRight: '1rem' }}>
                                    <VariantLabel>{v.label}</VariantLabel>
                                    <VariantQty> {v.units_sold}</VariantQty>
                                  </span>
                                ))}
                              </td>
                            </VariantRow>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );})}
              </tbody>
            </StyledTable>
          </Table>
        </Card>
      </Section>

      {/* Units split */}
      {compareMode && dataB && (
        <Section>
          <SectionTitle>Units Split: {tagA} vs {tagB}</SectionTitle>
          <MonthlyNote>For each product, what share of combined units came from each period.</MonthlyNote>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <Table>
              <StyledTable>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th $right>{tagA}</Th>
                    <Th $right>{tagB}</Th>
                    <Th $right>Total</Th>
                    <Th $right>{tagA} %</Th>
                    <Th $right>{tagB} %</Th>
                    <Th $right style={{ width: 100 }}>Split</Th>
                  </tr>
                </thead>
                <tbody>
                  {groupedProducts.map(({ category, items }) => {
                    const catTotA = items.reduce((s, p) => s + (p.units_sold || 0), 0);
                    const catTotB = items.reduce((s, p) => s + (productMapB[p.product_id]?.units_sold || 0), 0);
                    const catTotal = catTotA + catTotB;
                    const catPctA = catTotal > 0 ? Math.round(catTotA / catTotal * 1000) / 10 : 0;
                    const catPctB = catTotal > 0 ? Math.round(catTotB / catTotal * 1000) / 10 : 0;
                    return (
                    <React.Fragment key={category}>
                      <CategoryHeader>
                        <td>{category}</td>
                        <td style={{ textAlign: 'right' }}>{catTotA}</td>
                        <td style={{ textAlign: 'right' }}>{catTotB}</td>
                        <td style={{ textAlign: 'right' }}>{catTotal}</td>
                        <td style={{ textAlign: 'right' }}>{catPctA}%</td>
                        <td style={{ textAlign: 'right' }}>{catPctB}%</td>
                        <td style={{ textAlign: 'right' }}>
                          <SplitCell>
                            <SplitBar>
                              <SplitFillA $pct={catPctA} />
                              <SplitFillB $pct={catPctB} />
                            </SplitBar>
                          </SplitCell>
                        </td>
                      </CategoryHeader>
                      {items.map(p => {
                        const pB = productMapB[p.product_id];
                        const unitsA = p.units_sold || 0;
                        const unitsB = pB?.units_sold || 0;
                        const total = unitsA + unitsB;
                        if (total === 0) return null;
                        const pctA = Math.round(unitsA / total * 1000) / 10;
                        const pctB = Math.round(unitsB / total * 1000) / 10;
                        return (
                          <Tr key={p.product_id}>
                            <Td>{p.title}</Td>
                            <Td $right>{unitsA}</Td>
                            <Td $right>{unitsB}</Td>
                            <Td $right $bold>{total}</Td>
                            <Td $right>{pctA}%</Td>
                            <Td $right>{pctB}%</Td>
                            <Td $right>
                              <SplitCell>
                                <SplitBar>
                                  <SplitFillA $pct={pctA} />
                                  <SplitFillB $pct={pctB} />
                                </SplitBar>
                              </SplitCell>
                            </Td>
                          </Tr>
                        );
                      })}
                    </React.Fragment>
                    );
                  })}
                </tbody>
              </StyledTable>
            </Table>
          </Card>
        </Section>
      )}

      {/* Revenue mix */}
      {compareMode && dataB && (() => {
        const totalRevA = parseFloat(dataA.summary.total_revenue || 0);
        const totalRevB = parseFloat(dataB.summary.total_revenue || 0);
        return (
        <Section>
          <SectionTitle>Revenue Mix: {tagA} vs {tagB}</SectionTitle>
          <MonthlyNote>What % of each period's total revenue came from each product.</MonthlyNote>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <Table>
              <StyledTable>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th $right>{tagA}</Th>
                    <Th $right>% of {tagA}</Th>
                    <Th $right>{tagB}</Th>
                    <Th $right>% of {tagB}</Th>
                    <Th $right>Diff</Th>
                  </tr>
                </thead>
                <tbody>
                  {groupedProducts.map(({ category, items }) => {
                    const catRevA = items.reduce((s, p) => s + parseFloat(p.revenue || 0), 0);
                    const catRevB = items.reduce((s, p) => s + parseFloat(productMapB[p.product_id]?.revenue || 0), 0);
                    const catMixA = totalRevA > 0 ? Math.round(catRevA / totalRevA * 1000) / 10 : 0;
                    const catMixB = totalRevB > 0 ? Math.round(catRevB / totalRevB * 1000) / 10 : 0;
                    const catDiff = Math.round((catMixA - catMixB) * 10) / 10;
                    return (
                    <React.Fragment key={category}>
                      <CategoryHeader>
                        <td>{category}</td>
                        <td style={{ textAlign: 'right' }}>{formatSGD(catRevA)}</td>
                        <td style={{ textAlign: 'right' }}>{catMixA}%</td>
                        <td style={{ textAlign: 'right' }}>{formatSGD(catRevB)}</td>
                        <td style={{ textAlign: 'right' }}>{catMixB}%</td>
                        <td style={{ textAlign: 'right' }}>{catDiff > 0 ? '+' : ''}{catDiff}pp</td>
                      </CategoryHeader>
                      {items.map(p => {
                        const pB = productMapB[p.product_id];
                        const revA = parseFloat(p.revenue || 0);
                        const revB = parseFloat(pB?.revenue || 0);
                        if (revA === 0 && revB === 0) return null;
                        const mixA = totalRevA > 0 ? Math.round(revA / totalRevA * 1000) / 10 : 0;
                        const mixB = totalRevB > 0 ? Math.round(revB / totalRevB * 1000) / 10 : 0;
                        const diff = Math.round((mixA - mixB) * 10) / 10;
                        return (
                          <Tr key={p.product_id}>
                            <Td>{p.title}</Td>
                            <Td $right>{formatSGD(revA)}</Td>
                            <Td $right $bold>{mixA}%</Td>
                            <Td $right>{formatSGD(revB)}</Td>
                            <Td $right $bold>{mixB}%</Td>
                            <Td $right $muted={diff === 0} style={diff !== 0 ? { color: '#555' } : undefined}>
                              {diff > 0 ? '+' : ''}{diff}pp
                            </Td>
                          </Tr>
                        );
                      })}
                    </React.Fragment>
                    );
                  })}
                </tbody>
              </StyledTable>
            </Table>
          </Card>
        </Section>
        );
      })()}

      {/* By month */}
      <Section>
        <SectionTitle>By Month</SectionTitle>
        {isFiltered && (
          <MonthlyNote>Monthly totals are across all partners.</MonthlyNote>
        )}
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <Table>
            <StyledTable>
              <thead>
                <tr>
                  <Th>Month</Th>
                  <Th $right>Orders</Th>
                  <Th $right>Revenue</Th>
                  <Th $right>Donations</Th>
                  <Th $right>Collected</Th>
                  <Th $right>Cost</Th>
                  <Th $right>Profit</Th>
                </tr>
              </thead>
              <tbody>
                {[...by_month].reverse().map(m => {
                  const profit = parseFloat(m.profit);
                  return (
                    <Tr key={m.month}>
                      <Td $bold>{m.month}</Td>
                      <Td $right>{m.orders}</Td>
                      <Td $right $bold>{formatSGD(m.revenue)}</Td>
                      <Td $right>{formatSGD(m.donations)}</Td>
                      <Td $right $bold>{formatSGD(m.collected)}</Td>
                      <Td $right $muted={!hasAnyCost}>{hasAnyCost ? formatSGD(m.cost) : '—'}</Td>
                      <Td $right $positive={hasAnyCost && profit >= 0} $negative={hasAnyCost && profit < 0}>
                        {hasAnyCost ? formatSGD(m.profit) : '—'}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </StyledTable>
          </Table>
        </Card>
      </Section>
    </Container>
  );
};

export default Dashboard;
