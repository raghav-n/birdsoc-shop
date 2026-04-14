import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import styled from 'styled-components';
import { Heart, ChevronRight, Bird } from 'lucide-react';
import { Button, Card, Input, FormGroup, Label, ErrorMessage, TextArea } from '../styles/GlobalStyles';
import PayNowQR from '../components/PayNowQR';
import { donationService } from '../services/donations';

// ── Layout ────────────────────────────────────────────────────────────────────

const PageContainer = styled.div`
  max-width: 1040px;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
`;

const Hero = styled.div`
  text-align: center;
  margin-bottom: 2.5rem;
`;

const HeroIcon = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 1rem;
  color: var(--link-text);
`;

const HeroTitle = styled.h1`
  font-size: 2.2rem;
  margin-bottom: 0.75rem;
`;

const HeroSubtitle = styled.p`
  font-size: 1.1rem;
  color: #666;
  line-height: 1.7;
  max-width: 560px;
  margin: 0 auto;
`;

const AboutSection = styled(Card)`
  padding: 2rem;
`;

const IntroGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 0.95fr);
  gap: 1rem;
  align-items: stretch;
  margin-bottom: 2rem;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const AboutTitle = styled.h2`
  font-size: 1.25rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const AboutText = styled.p`
  color: #555;
  line-height: 1.75;
  margin: 0 0 1rem;

  &:last-child {
    margin: 0;
  }
`;

const CollageWrap = styled.div`
  display: flex;
  align-items: stretch;
`;

const PhotoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem;
  width: 100%;
`;

const PhotoTile = styled.div`
  position: relative;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  border-radius: 10px;
  background: #e9e4eb;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.25s ease;
  }

  &:hover img {
    transform: scale(1.04);
  }
`;

// ── Form card ────────────────────────────────────────────────────────────────

const FormCard = styled(Card)`
  padding: 2rem;
  max-width: 840px;
  margin: 0 auto;
`;

const StepIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1.75rem;
  font-size: 0.85rem;
  color: #888;
`;

const StepDot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${props => props.active ? 'var(--link-text)' : (props.done ? 'var(--success)' : '#ddd')};
  transition: background 0.2s;
`;

const SectionTitle = styled.h3`
  margin: 0 0 1.25rem;
`;

const AmountGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-bottom: 0.75rem;

  @media (max-width: 480px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

const AmountButton = styled.button`
  min-height: 46px;
  padding: 0.6rem 0;
  border-radius: 6px;
  border: 2px solid ${props => props.selected ? 'var(--link-text)' : '#e1e1e1'};
  background: ${props => props.selected ? 'var(--link-text)' : 'transparent'};
  color: ${props => props.selected ? 'white' : 'var(--dark)'};
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    border-color: var(--link-text);
  }
`;

const CustomAmountRow = styled.div`
  margin-top: 0.5rem;
  width: calc((100% - 1.5rem) / 4);

  @media (max-width: 480px) {
    width: calc((100% - 0.5rem) / 2);
  }
`;

const CustomAmountField = styled.div`
  position: relative;
  width: 100%;

  input {
    min-height: 46px;
    padding: 0.6rem 0.75rem 0.6rem 1.9rem;
    font-size: 0.95rem;
    border-radius: 6px;
  }
`;

const DollarPrefix = styled.span`
  position: absolute;
  top: 50%;
  left: 0.8rem;
  transform: translateY(-50%);
  font-size: 1rem;
  color: #777;
  font-weight: 600;
  pointer-events: none;
`;

const QRSection = styled.div`
  display: flex;
  justify-content: center;
  margin: 1.5rem 0;
`;

const ReferenceTag = styled.div`
  background: #f0f0f0;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-family: monospace;
  font-size: 0.9rem;
  color: #444;
  text-align: center;
  margin-bottom: 1rem;
`;

const OptionalBadge = styled.span`
  font-size: 0.75rem;
  font-weight: 400;
  color: #888;
  margin-left: 0.4rem;
`;

const NavRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
  gap: 1rem;
`;

const BackButton = styled.button`
  background: none;
  border: none;
  color: var(--link-text);
  font-size: 0.95rem;
  cursor: pointer;
  padding: 0;

  &:hover {
    color: var(--link-text-hover);
  }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────

const buildReference = (name) => {
  const prefix = 'DONATION-';
  const maxName = 25 - prefix.length;
  return (prefix + name.toUpperCase().replace(/\s+/g, '_')).slice(0, 25);
};

const PRESET_AMOUNTS = [5, 10, 20, 50];
const DONATION_PHOTOS = [
  {
    src: '/img/donate/donate-1.jpg',
    alt: 'BirdSoc Singapore volunteers at an outreach booth',
  },
  {
    src: '/img/donate/donate-2.jpg',
    alt: 'BirdSoc Singapore members speaking with visitors',
  },
  {
    src: '/img/donate/donate-3.jpg',
    alt: 'BirdSoc Singapore activity with bird education materials',
  },
  {
    src: '/img/donate/donate-4.jpg',
    alt: 'BirdSoc Singapore volunteers engaging the public',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

const STEP_NAME = 1;
const STEP_AMOUNT = 2;
const STEP_EXTRAS = 3;

const Donate = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(STEP_NAME);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const amount = selectedPreset !== null ? selectedPreset : parseFloat(customAmount) || 0;
  const reference = buildReference(name || 'DONOR');

  // ── Step 1: Name ─────────────────────────────────────────────────────────

  const handleNameNext = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Please enter your name');
      return;
    }
    if (trimmed.length < 2) {
      setNameError('Name must be at least 2 characters');
      return;
    }
    setNameError('');
    setStep(STEP_AMOUNT);
  };

  // ── Step 2: Amount ───────────────────────────────────────────────────────

  const handleAmountNext = () => {
    if (amount <= 0 || isNaN(amount)) {
      setAmountError('Please enter or select an amount');
      return;
    }
    setAmountError('');
    setStep(STEP_EXTRAS);
  };

  const handlePresetClick = (val) => {
    setSelectedPreset(val);
    setCustomAmount('');
    setAmountError('');
  };

  const handleCustomChange = (e) => {
    setCustomAmount(e.target.value);
    setSelectedPreset(null);
    setAmountError('');
  };

  // ── Step 3: Submit ───────────────────────────────────────────────────────

  const handleDonated = async () => {
    setSubmitting(true);
    try {
      await donationService.recordDonation({
        name: name.trim(),
        amount,
        email: email.trim(),
        note: note.trim(),
        reference,
      });
    } catch (err) {
      // Non-fatal — we still navigate to success even if recording fails
      console.error('Failed to record donation:', err);
    } finally {
      setSubmitting(false);
      navigate('/donate/success', {
        state: { name: name.trim(), amount, reference },
      });
    }
  };

  return (
    <PageContainer>
      {/* ── Hero ── */}
      <Hero>
        <HeroIcon>
          <Heart size={48} fill="currentColor" />
        </HeroIcon>
        <HeroTitle>Support BirdSoc SG</HeroTitle>
        <HeroSubtitle>
          The Bird Society of Singapore is a science-based collective promoting research and
          conservation of our avifauna. We are fully volunteer-driven and funded by membership fees
          and donations. Your support keeps our resources free and accessible to everyone.
        </HeroSubtitle>
      </Hero>

      {/* ── About / impact ── */}
      <IntroGrid>
        <AboutSection>
          <AboutTitle>
            <Bird size={20} />
            What we do
          </AboutTitle>
          <AboutText>
            We maintain the <Link to="https://singaporebirds.com"><em>Birds of Singapore</em></Link> website and the <Link to="https://records.singaporebirds.com">Singapore Bird Database</Link>, the
            only complete repository of rare bird records in Singapore. We also conduct outreach through walks, talks, and booths.
            Our partnership with <Link to="https://ebird.org">eBird</Link> allows us to contribute to global bird research, and our members publish peer-reviewed papers and collaborate with other regional experts to advance regional ornithological knowledge.
          </AboutText>
          <AboutText>
            Keeping our online resources going and running outreach comes at a cost. Your contributions go directly
            towards keeping our resources freely available to the community.
          </AboutText>
          <AboutText style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.5rem' }}>
            Note: as BirdSoc SG is not a registered Charity, donations are not tax deductible.
          </AboutText>
        </AboutSection>

        <CollageWrap>
          <PhotoGrid>
            {DONATION_PHOTOS.map(photo => (
              <PhotoTile key={photo.src}>
                <img src={photo.src} alt={photo.alt} loading="lazy" />
              </PhotoTile>
            ))}
          </PhotoGrid>
        </CollageWrap>
      </IntroGrid>

      {/* ── Multi-step form ── */}
      <FormCard>
        {/* Step indicator */}
        <StepIndicator>
          <StepDot active={step === STEP_NAME} done={step > STEP_NAME} />
          <span>Name</span>
          <ChevronRight size={12} />
          <StepDot active={step === STEP_AMOUNT} done={step > STEP_AMOUNT} />
          <span>Amount &amp; QR</span>
          <ChevronRight size={12} />
          <StepDot active={step === STEP_EXTRAS} done={false} />
          <span>Confirm</span>
        </StepIndicator>

        {/* ── Step 1 ── */}
        {step === STEP_NAME && (
          <>
            <SectionTitle>What's your name?</SectionTitle>
            <FormGroup>
              <Label htmlFor="donor-name">Full name</Label>
              <Input
                id="donor-name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={e => { setName(e.target.value); setNameError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleNameNext()}
                hasError={!!nameError}
                autoFocus
              />
              {nameError && <ErrorMessage>{nameError}</ErrorMessage>}
            </FormGroup>
            <NavRow>
              <span />
              <Button onClick={handleNameNext}>
                Next
                <ChevronRight size={16} />
              </Button>
            </NavRow>
          </>
        )}

        {/* ── Step 2 ── */}
        {step === STEP_AMOUNT && (
          <>
            <SectionTitle>How much would you like to donate?</SectionTitle>

            <FormGroup>
              <Label>Select an amount</Label>
              <AmountGrid>
                {PRESET_AMOUNTS.map(val => (
                  <AmountButton
                    key={val}
                    selected={selectedPreset === val}
                    onClick={() => handlePresetClick(val)}
                    type="button"
                  >
                    ${val}
                  </AmountButton>
                ))}
              </AmountGrid>
              <CustomAmountRow>
                <CustomAmountField>
                  <DollarPrefix>$</DollarPrefix>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Custom amount"
                    value={customAmount}
                    onChange={handleCustomChange}
                    hasError={!!amountError}
                  />
                </CustomAmountField>
              </CustomAmountRow>
              {amountError && <ErrorMessage>{amountError}</ErrorMessage>}
            </FormGroup>

            {amount > 0 && (
              <>
                <ReferenceTag>Reference: {buildReference(name)}</ReferenceTag>
                <QRSection>
                  <PayNowQR amount={amount} referenceId={buildReference(name)} donation={0} />
                </QRSection>
                <p style={{ textAlign: 'center', fontSize: '0.9rem', color: '#666', marginBottom: 0 }}>
                  Scan the QR code above with your banking app, then click <strong>Next</strong> to continue.
                </p>
              </>
            )}

            <NavRow>
              <BackButton onClick={() => setStep(STEP_NAME)}>← Back</BackButton>
              <Button onClick={handleAmountNext}>
                Next
                <ChevronRight size={16} />
              </Button>
            </NavRow>
          </>
        )}

        {/* ── Step 3 ── */}
        {step === STEP_EXTRAS && (
          <>
            <SectionTitle>Almost there!</SectionTitle>

            <p style={{ color: '#555', marginBottom: '1.5rem', marginTop: 0 }}>
              You're donating <strong>${amount.toFixed(2)}</strong> under reference{' '}
              <code style={{ background: '#f0f0f0', padding: '0 4px', borderRadius: 4 }}>
                {buildReference(name)}
              </code>.
              {' '}If you haven't scanned the QR code yet, go back and do so before clicking "I've donated".
            </p>

            <FormGroup>
              <Label htmlFor="donor-email">
                Email address
                <OptionalBadge>(optional)</OptionalBadge>
              </Label>
              <Input
                id="donor-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </FormGroup>

            <FormGroup>
              <Label htmlFor="donor-note">
                Note / comments
                <OptionalBadge>(optional)</OptionalBadge>
              </Label>
              <TextArea
                id="donor-note"
                placeholder="Anything you'd like to tell us?"
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
              />
            </FormGroup>

            <NavRow>
              <BackButton onClick={() => setStep(STEP_AMOUNT)}>← Back</BackButton>
              <Button onClick={handleDonated} disabled={submitting} size="large">
                <Heart size={16} fill="white" />
                {submitting ? 'Recording…' : "I've donated"}
              </Button>
            </NavRow>
          </>
        )}
      </FormCard>
    </PageContainer>
  );
};

export default Donate;
