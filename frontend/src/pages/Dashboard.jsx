import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { TrendingUp, TrendingDown, DollarSign, ShoppingBag, BarChart2, AlertCircle } from 'lucide-react';
import { dashboardService } from '../services/dashboard';
import { Card } from '../styles/GlobalStyles';
import Loading from '../components/Loading';

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

const ClearButton = styled.button`
  padding: 0.3rem 0.6rem;
  background: none;
  color: #999;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
  &:hover { color: var(--dark); border-color: #bbb; }
`;

const PresetButton = styled.button`
  padding: 0.3rem 0.7rem;
  background: none;
  color: var(--link-text);
  border: 1px solid var(--link-text);
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  &:hover { background: var(--link-text); color: white; }
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
  background: ${props => props.$pct >= 40 ? '#16a34a' : props.$pct >= 20 ? '#d97706' : '#dc2626'};
  border-radius: 3px;
`;

const NoCostBadge = styled.span`
  font-size: 0.75rem;
  color: #999;
  font-style: italic;
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

const formatSGD = (val) => {
  if (val == null) return '—';
  return `$${parseFloat(val).toFixed(2)}`;
};

const SORT_KEYS = ['revenue', 'cost', 'profit', 'margin', 'units_sold'];

const sum = (arr, key) => arr.reduce((acc, x) => acc + parseFloat(x[key] ?? 0), 0);

const Dashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('revenue');
  const [sortDir, setSortDir] = useState('desc');
  const [selectedPartners, setSelectedPartners] = useState(new Set());
  const getThisMonthRange = () => {
    const now = new Date();
    const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const today = now.toISOString().slice(0, 10);
    return { first, today };
  };

  const { first: defaultStart, today: defaultEnd } = getThisMonthRange();

  const [startInput, setStartInput] = useState(defaultStart);
  const [endInput, setEndInput] = useState(defaultEnd);
  const [appliedStart, setAppliedStart] = useState(defaultStart);
  const [appliedEnd, setAppliedEnd] = useState(defaultEnd);

  const fetchData = (start, end) => {
    setLoading(true);
    setError(null);
    dashboardService.getAnalytics({ start, end })
      .then(d => { setData(d); setSelectedPartners(new Set()); })
      .catch(() => setError('Failed to load analytics data.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(defaultStart, defaultEnd); }, []);

  const handleApply = () => {
    setAppliedStart(startInput);
    setAppliedEnd(endInput);
    fetchData(startInput, endInput);
  };

  const handleClear = () => {
    const { first, today } = getThisMonthRange();
    setStartInput(first);
    setEndInput(today);
    setAppliedStart(first);
    setAppliedEnd(today);
    fetchData(first, today);
  };

  const handleCurrentMonth = () => {
    const now = new Date();
    const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const today = now.toISOString().slice(0, 10);
    setStartInput(first);
    setEndInput(today);
    setAppliedStart(first);
    setAppliedEnd(today);
    fetchData(first, today);
  };

  const isDateFiltered = !!(appliedStart || appliedEnd);

  if (loading && !data) return <Loading text="Loading dashboard..." />;
  if (error && !data) return <Container><p style={{ color: 'var(--danger)' }}>{error}</p></Container>;

  const { partners, categories: orderedCategories = [], by_product, by_month } = data;
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

  // Recompute summary from filtered products
  const filtRevenue = sum(filteredProducts, 'revenue');
  const filtCost = sum(filteredProducts.filter(p => p.cost != null), 'cost');
  const filtProfit = filtRevenue - filtCost;
  const filtMargin = filtRevenue > 0 ? (filtProfit / filtRevenue * 100) : 0;
  const filtOrders = isFiltered ? '—' : data.summary.total_orders;
  const filtDonations = isFiltered ? null : parseFloat(data.summary.total_donations ?? 0);
  const filtCollected = isFiltered ? null : parseFloat(data.summary.total_collected ?? 0);
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

  // Group sorted products by category, preserving homepage category order
  const groupedProducts = (() => {
    const groups = [];
    const seen = new Set();
    const categoryOrder = [...orderedCategories, ''];  // '' = uncategorised last

    for (const cat of categoryOrder) {
      const items = sortedProducts.filter(p => p.category === cat);
      if (items.length === 0) continue;
      if (seen.has(cat)) continue;
      seen.add(cat);
      groups.push({ category: cat || 'Other', items });
    }
    // Any products whose category wasn't in orderedCategories
    const remaining = sortedProducts.filter(p => !seen.has(p.category));
    if (remaining.length > 0) {
      groups.push({ category: 'Other', items: remaining });
    }
    return groups;
  })();

  const sortIndicator = (key) => sortKey === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : '';

  return (
    <Container>
      <PageTitle>Sales Dashboard</PageTitle>
      <PageSubtitle>
        {loading ? 'Updating…' : (isDateFiltered ? `${appliedStart || '…'} → ${appliedEnd || '…'}` : 'All-time revenue, cost, and profit across orders.')}
      </PageSubtitle>

      {/* Filters bar */}
      <FiltersBar>
        <FilterGroup>
          <FilterLabel>Date:</FilterLabel>
          <DateInput
            type="date"
            value={startInput}
            onChange={e => setStartInput(e.target.value)}
            placeholder="From"
          />
          <span style={{ color: '#999', fontSize: '0.85rem' }}>to</span>
          <DateInput
            type="date"
            value={endInput}
            onChange={e => setEndInput(e.target.value)}
            placeholder="To"
          />
          <PresetButton onClick={handleCurrentMonth}>This Month</PresetButton>
          <ApplyButton onClick={handleApply}>Apply</ApplyButton>
          {isDateFiltered && <ClearButton onClick={handleClear}>Clear</ClearButton>}
        </FilterGroup>

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
          <StatValue>{filtOrders}</StatValue>
          {isFiltered && <StatSub>n/a when filtering by partner</StatSub>}
        </StatCard>

        <StatCard>
          <StatIcon $bg="#f0fdf4" $color="#16a34a"><DollarSign size={20} /></StatIcon>
          <StatLabel>Total Revenue</StatLabel>
          <StatValue>{formatSGD(filtRevenue)}</StatValue>
          <StatSub>
            {isFiltered ? 'Merchandise only, incl. tax' : `With donations: ${formatSGD(filtCollected)}`}
          </StatSub>
        </StatCard>

        <StatCard>
          <StatIcon $bg="#fff7ed" $color="#d97706"><TrendingDown size={20} /></StatIcon>
          <StatLabel>Total Cost</StatLabel>
          <StatValue $color={hasAnyCost ? 'var(--dark)' : '#bbb'}>
            {hasAnyCost ? formatSGD(filtCost) : '—'}
          </StatValue>
          {!hasAnyCost && <StatSub>Enter cost prices to see this</StatSub>}
        </StatCard>

        <StatCard>
          <StatIcon $bg="#f0fdf4" $color="#16a34a"><TrendingUp size={20} /></StatIcon>
          <StatLabel>Total Profit</StatLabel>
          <StatValue $color={hasAnyCost ? (filtProfit >= 0 ? '#16a34a' : '#dc2626') : '#bbb'}>
            {hasAnyCost ? formatSGD(filtProfit) : '—'}
          </StatValue>
          {hasAnyCost && (
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

      {/* By product */}
      <Section>
        <SectionTitle>By Product</SectionTitle>
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
                  <Th $right $sortable onClick={() => handleSort('units_sold')}>Units{sortIndicator('units_sold')}</Th>
                  <Th $right $sortable onClick={() => handleSort('revenue')}>Revenue{sortIndicator('revenue')}</Th>
                  <Th $right $sortable onClick={() => handleSort('cost')}>Cost{sortIndicator('cost')}</Th>
                  <Th $right $sortable onClick={() => handleSort('profit')}>Profit{sortIndicator('profit')}</Th>
                  <Th $right $sortable onClick={() => handleSort('margin')}>Margin{sortIndicator('margin')}</Th>
                </tr>
              </thead>
              <tbody>
                {groupedProducts.map(({ category, items }) => (
                  <React.Fragment key={category}>
                    <CategoryHeader>
                      <td colSpan={isFiltered ? 6 : 7}>{category}</td>
                    </CategoryHeader>
                    {items.map(p => {
                      const margin = p.margin;
                      const profit = parseFloat(p.profit ?? 0);
                      return (
                        <Tr key={p.product_id}>
                          <Td>{p.title}</Td>
                          {!isFiltered && <Td $muted>{p.partner}</Td>}
                          <Td $right>{p.units_sold}</Td>
                          <Td $right $bold>{formatSGD(p.revenue)}</Td>
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
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </StyledTable>
          </Table>
        </Card>
      </Section>

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
