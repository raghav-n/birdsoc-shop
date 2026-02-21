import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { useParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import {
  Button, Card, Input, FormGroup, Label, ErrorMessage, Select, Badge
} from '../styles/GlobalStyles';
import Alert from '../components/Alert';
import Loading from '../components/Loading';
import PayNowQR from '../components/PayNowQR';
import { eventService } from '../services/misc';
import { showToast } from '../utils/toast.jsx';
import { Calendar, MapPin, Users } from 'lucide-react';

const Container = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1rem;
`;

const EventCard = styled(Card)`
  padding: 2rem;
  margin-bottom: 1.5rem;
`;

const EventTitle = styled.h1`
  font-size: 2rem;
  color: var(--dark);
  margin-bottom: 1rem;
`;

const EventMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
  color: #666;
`;

const MetaItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const Description = styled.div`
  line-height: 1.7;
  margin-bottom: 1.5rem;
  white-space: pre-wrap;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const SectionTitle = styled.h2`
  font-size: 1.3rem;
  margin-bottom: 0.5rem;
`;

const Price = styled.div`
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--dark);
  margin-bottom: 0.5rem;
`;

const SuccessCard = styled(Card)`
  padding: 2rem;
  text-align: center;
`;

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-SG', {
    weekday: 'short', day: 'numeric', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const EventDetail = () => {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedTier, setSelectedTier] = useState(null);
  const [donation, setDonation] = useState(0);

  const {
    register, handleSubmit, setError: setFormError, formState: { errors }
  } = useForm();

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await eventService.getEvent(id);
        setEvent(data);
        if (data.price_tiers?.length) setSelectedTier(data.price_tiers[0]);
      } catch {
        setError('Failed to load event details.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const isPaid = event && (
    selectedTier
      ? parseFloat(selectedTier.price_incl_tax) > 0
      : parseFloat(event.price_incl_tax) > 0
  );

  const unitPrice = selectedTier
    ? parseFloat(selectedTier.price_incl_tax)
    : (event ? parseFloat(event.price_incl_tax) : 0);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      const extraJson = {};
      if (event.json_schema?.properties) {
        Object.keys(event.json_schema.properties).forEach(key => {
          if (data[`extra_${key}`] !== undefined) {
            extraJson[key] = data[`extra_${key}`];
          }
        });
      }

      const payload = {
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone_number: data.phone_number || '',
        emergency_contact_name: data.emergency_contact_name || '',
        emergency_contact_phone: data.emergency_contact_phone || '',
        quantity: parseInt(data.quantity) || 1,
        donation: donation ? Math.round(parseFloat(donation) * 100) : 0,
      };

      if (Object.keys(extraJson).length) {
        payload.extra_json = extraJson;
      }

      if (selectedTier) {
        payload.extra_json = { ...payload.extra_json, _tier: selectedTier.code };
      }

      const res = await eventService.registerForEvent(id, payload);
      setResult(res);
      showToast.success('Registration successful!');
    } catch (err) {
      if (err.response?.data) {
        const serverErrors = err.response.data;
        if (typeof serverErrors === 'string') {
          showToast.error(serverErrors);
        } else if (serverErrors.detail) {
          showToast.error(serverErrors.detail);
        } else {
          Object.entries(serverErrors).forEach(([field, messages]) => {
            const msg = Array.isArray(messages) ? messages[0] : messages;
            setFormError(field, { type: 'server', message: msg });
          });
        }
      } else {
        showToast.error('Registration failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <Loading text="Loading event..." />;
  if (error) return <Container><Alert variant="error">{error}</Alert></Container>;
  if (!event) return <Container><Alert variant="error">Event not found.</Alert></Container>;

  if (result) {
    return (
      <Container>
        <SuccessCard>
          <Alert variant="success" title="Registration Confirmed">
            You have been registered for {event.title}.
          </Alert>
          {result.reference && (
            <p>Your reference number is: <strong>{result.reference}</strong></p>
          )}
          {isPaid && result.reference && (
            <div style={{ margin: '1.5rem auto', maxWidth: '320px' }}>
              <PayNowQR
                amount={unitPrice * (parseInt(result.quantity) || 1)}
                referenceId={result.reference}
                donation={donation ? parseFloat(donation) : 0}
              />
            </div>
          )}
          <p>A confirmation email has been sent to your email address.</p>
          <Link to="/events"><Button style={{ marginTop: '1rem' }}>Back to Events</Button></Link>
        </SuccessCard>
      </Container>
    );
  }

  const jsonProps = event.json_schema?.properties || {};
  const jsonRequired = event.json_schema?.required || [];

  return (
    <Container>
      <EventCard>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <EventTitle>{event.title}</EventTitle>
          {event.is_full && <Badge variant="danger">Full</Badge>}
        </div>
        <EventMeta>
          {event.start_date && <MetaItem><Calendar size={16} />{formatDate(event.start_date)}</MetaItem>}
          {event.end_date && <MetaItem>to {formatDate(event.end_date)}</MetaItem>}
          {event.location && <MetaItem><MapPin size={16} />{event.location}</MetaItem>}
          {event.max_participants && (
            <MetaItem>
              <Users size={16} />
              {event.max_participants - (event.participant_count || 0)} spot(s) remaining
            </MetaItem>
          )}
        </EventMeta>
        {event.description && <Description>{event.description}</Description>}
        <Price>
          {unitPrice > 0 ? `$${unitPrice.toFixed(2)} per person` : 'Free'}
        </Price>
      </EventCard>

      {!event.is_full && (
        <EventCard>
          <SectionTitle>Registration</SectionTitle>
          <Form onSubmit={handleSubmit(onSubmit)}>
            <FormGroup>
              <Label htmlFor="first_name">First Name *</Label>
              <Input id="first_name" hasError={errors.first_name}
                {...register('first_name', { required: 'First name is required' })} />
              {errors.first_name && <ErrorMessage>{errors.first_name.message}</ErrorMessage>}
            </FormGroup>

            <FormGroup>
              <Label htmlFor="last_name">Last Name *</Label>
              <Input id="last_name" hasError={errors.last_name}
                {...register('last_name', { required: 'Last name is required' })} />
              {errors.last_name && <ErrorMessage>{errors.last_name.message}</ErrorMessage>}
            </FormGroup>

            <FormGroup>
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" hasError={errors.email}
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' }
                })} />
              {errors.email && <ErrorMessage>{errors.email.message}</ErrorMessage>}
            </FormGroup>

            <FormGroup>
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input id="phone_number" type="tel" {...register('phone_number')} />
            </FormGroup>

            <FormGroup>
              <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
              <Input id="emergency_contact_name" {...register('emergency_contact_name')} />
            </FormGroup>

            <FormGroup>
              <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
              <Input id="emergency_contact_phone" type="tel" {...register('emergency_contact_phone')} />
            </FormGroup>

            <FormGroup>
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" type="number" min="1" defaultValue="1"
                {...register('quantity', { min: { value: 1, message: 'At least 1' } })} />
              {errors.quantity && <ErrorMessage>{errors.quantity.message}</ErrorMessage>}
            </FormGroup>

            {event.price_tiers?.length > 0 && (
              <FormGroup>
                <Label>Price Tier *</Label>
                <Select
                  value={selectedTier?.code || ''}
                  onChange={e => {
                    const tier = event.price_tiers.find(t => t.code === e.target.value);
                    setSelectedTier(tier);
                  }}
                >
                  {event.price_tiers.map(tier => (
                    <option key={tier.code} value={tier.code}>
                      {tier.name} — ${parseFloat(tier.price_incl_tax).toFixed(2)}
                    </option>
                  ))}
                </Select>
              </FormGroup>
            )}

            {Object.entries(jsonProps).map(([key, schema]) => {
              const isRequired = jsonRequired.includes(key);
              const fieldName = `extra_${key}`;

              if (schema.type === 'boolean') {
                return (
                  <FormGroup key={key}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="checkbox" {...register(fieldName)} />
                      {schema.title || key}
                    </label>
                  </FormGroup>
                );
              }

              if (schema.enum) {
                return (
                  <FormGroup key={key}>
                    <Label htmlFor={fieldName}>{schema.title || key}{isRequired ? ' *' : ''}</Label>
                    <Select id={fieldName} hasError={errors[fieldName]}
                      {...register(fieldName, isRequired ? { required: `${schema.title || key} is required` } : {})}>
                      <option value="">Select...</option>
                      {schema.enum.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </Select>
                    {errors[fieldName] && <ErrorMessage>{errors[fieldName].message}</ErrorMessage>}
                  </FormGroup>
                );
              }

              return (
                <FormGroup key={key}>
                  <Label htmlFor={fieldName}>{schema.title || key}{isRequired ? ' *' : ''}</Label>
                  <Input id={fieldName} hasError={errors[fieldName]}
                    placeholder={schema.description || ''}
                    {...register(fieldName, isRequired ? { required: `${schema.title || key} is required` } : {})} />
                  {errors[fieldName] && <ErrorMessage>{errors[fieldName].message}</ErrorMessage>}
                </FormGroup>
              );
            })}

            {isPaid && (
              <FormGroup>
                <Label htmlFor="donation">Optional Donation ($)</Label>
                <Input id="donation" type="number" step="0.01" min="0"
                  placeholder="0.00"
                  value={donation}
                  onChange={e => setDonation(e.target.value)} />
              </FormGroup>
            )}

            <Button type="submit" disabled={isSubmitting} style={{ marginTop: '0.5rem' }}>
              {isSubmitting ? 'Registering...' : 'Register'}
            </Button>
          </Form>
        </EventCard>
      )}
    </Container>
  );
};

export default EventDetail;
