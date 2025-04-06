import React from 'react';
import {
  Html,
  Tailwind,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Hr,
} from '@react-email/components';
import { config } from '@/lib/config';

export const SupportTicketEmail = ({
  ticketId,
  customerEmail,
  subject,
  category,
  message,
  dateReceived,
}) => {
  return (
    <Html>
      <Tailwind>
        <Head />
        <Preview>New support ticket #{ticketId}</Preview>
        <Body className="bg-gray-100 font-sans py-[40px]">
          <Container className="bg-white rounded-[8px] mx-auto p-[20px] max-w-[600px]">
            <Section>
              <Heading className="text-[24px] font-bold text-gray-800 m-0">
                New Support Ticket Received
              </Heading>
            </Section>
            
            <Hr className="border-gray-200 my-[20px]" />
            
            <Section>
              <Heading className="text-[18px] font-bold text-gray-800 m-0">
                Ticket Details
              </Heading>
              
              <Section className="bg-gray-50 p-[16px] rounded-[8px] my-[16px]">
                <Text className="text-[14px] text-gray-700 m-0">
                  <strong>Ticket ID:</strong> {ticketId}
                </Text>
                <Text className="text-[14px] text-gray-700 m-0">
                  <strong>Date Received:</strong> {dateReceived}
                </Text>
                <Text className="text-[14px] text-gray-700 m-0">
                  <strong>Assigned Department:</strong> {category}
                </Text>
              </Section>
              
              <Heading className="text-[18px] font-bold text-gray-800 mt-[24px] mb-[8px]">
                Customer Information
              </Heading>
              <Text className="text-[14px] text-gray-700 m-0">
                <strong>Email:</strong> {customerEmail}
              </Text>
              
              <Heading className="text-[18px] font-bold text-gray-800 mt-[24px] mb-[8px]">
                Message Content
              </Heading>
              <Section className="bg-blue-50 p-[16px] rounded-[8px] border-l-[4px] border-blue-400">
                <Text className="text-[14px] text-gray-700 m-0">
                  <strong>Subject:</strong> {subject}
                </Text>
                <Text className="text-[14px] text-gray-700 mt-[12px]">
                  {message}
                </Text>
              </Section>
            </Section>
            
            <Hr className="border-gray-200 my-[20px]" />
            
            <Hr className="border-gray-200 my-[20px]" />
            
            <Section>
              <Text className="text-[12px] text-gray-500 m-0">
                This is an automated message from the Customer Support System. Please do not reply directly to this email.
              </Text>
              <Text className="text-[12px] text-gray-500 m-0">
                &copy; {new Date().getFullYear()} {config.appName}. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default SupportTicketEmail; 