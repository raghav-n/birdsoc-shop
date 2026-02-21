import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Card } from '../styles/GlobalStyles';
import { miscService } from '../services/misc';
import SafeHtml from '../components/SafeHtml';
import Loading from '../components/Loading';

const FAQContainer = styled.div`
  max-width: 800px;
  margin: 2rem auto;
  padding: 0 1rem;
`;

const FAQHeader = styled.div`
  text-align: center;
  margin-bottom: 2rem;
`;

const FAQTitle = styled.h1`
  font-size: 2rem;
  color: var(--dark);
  margin-bottom: 0.5rem;
`;

const FAQItem = styled(Card)`
  padding: 0;
  margin-bottom: 1rem;
  overflow: hidden;

  &:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
`;

const FAQQuestion = styled.button`
  width: 100%;
  text-align: left;
  padding: 1.25rem 1.5rem;
  background: #f8f9fa;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  color: var(--dark);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s ease;

  &:hover {
    background: #f0f1f2;
  }
`;

const Arrow = styled.span`
  transition: transform 0.2s ease;
  transform: ${props => props.$open ? 'rotate(180deg)' : 'rotate(0)'};
  font-size: 0.8rem;
  color: #666;
`;

const FAQAnswer = styled.div`
  padding: ${props => props.$open ? '1.25rem 1.5rem' : '0 1.5rem'};
  max-height: ${props => props.$open ? '500px' : '0'};
  overflow: hidden;
  transition: all 0.3s ease;
  line-height: 1.6;
  color: var(--dark);
`;

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);
  const [faqItems, setFaqItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFAQ = async () => {
      try {
        const data = await miscService.getFAQ();
        setFaqItems(data);
      } catch {
        setFaqItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchFAQ();
  }, []);

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  if (loading) {
    return (
      <FAQContainer>
        <Loading text="Loading FAQ..." />
      </FAQContainer>
    );
  }

  return (
    <FAQContainer>
      <FAQHeader>
        <FAQTitle>Frequently Asked Questions</FAQTitle>
      </FAQHeader>

      {faqItems.map((item, index) => (
        <FAQItem key={item.id}>
          <FAQQuestion onClick={() => toggle(index)}>
            {item.question}
            <Arrow $open={openIndex === index}>&#9660;</Arrow>
          </FAQQuestion>
          <FAQAnswer $open={openIndex === index}>
            <SafeHtml html={item.answer} />
          </FAQAnswer>
        </FAQItem>
      ))}
    </FAQContainer>
  );
};

export default FAQ;
