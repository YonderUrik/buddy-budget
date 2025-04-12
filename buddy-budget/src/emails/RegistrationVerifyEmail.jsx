import * as React from 'react';
import {
   Body,
   Container,
   Head,
   Heading,
   Html,
   Preview,
   Section,
   Text,
   Tailwind,
   Hr,
} from '@react-email/components';
import { config } from '@/lib/config';

export const VerificationEmail = ({ verificationCode }) => {
   return (
      <Html>
         <Head />
         <Preview>Your verification code is: {verificationCode}</Preview>
         <Tailwind>
            <Body className="bg-gray-100 font-sans py-[40px]">
               <Container className="bg-white rounded-[8px] mx-auto p-[20px] max-w-[600px]">
                  <Section>
                     <Heading className="text-[24px] font-bold text-gray-800 mt-[20px] mb-[16px]">
                        Verify your email address
                     </Heading>
                     <Text className="text-[16px] text-gray-600 mb-[24px]">
                        Thanks for signing up! Please use the verification code below to complete your registration.
                     </Text>

                     <Section className="bg-gray-50 rounded-[8px] py-[20px] px-[24px] text-center my-[24px]">
                        <Text className="text-[32px] font-bold tracking-[4px] text-gray-800 m-0">
                           {verificationCode}
                        </Text>
                     </Section>

                     <Text className="text-[16px] text-gray-600 mb-[24px]">
                        This code will expire in 1 hour. If you didn't request this verification, you can safely ignore this email.
                     </Text>

                  </Section>

                  <Hr className="border-gray-200 my-[24px]" />

                  <Section>
                     <Text className="text-[12px] text-gray-500 m-0">
                        © {new Date().getFullYear()} {config.appName}. All rights reserved.
                     </Text>
                  </Section>
               </Container>
            </Body>
         </Tailwind>
      </Html>
   );
};

export default VerificationEmail;