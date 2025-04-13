import * as React from 'react';
import {
   Body,
   Button,
   Container,
   Head,
   Heading,
   Html,
   Link,
   Preview,
   Section,
   Text,
   Tailwind,
} from '@react-email/components';
import { config } from '@/lib/config';

export const PasswordResetEmail = ({ resetLink }) => {
   return (
      <Html>
         <Head />
         <Preview>Reset your password</Preview>
         <Tailwind>
            <Body className="bg-gray-100 font-sans py-[40px]">
               <Container className="bg-white rounded-[8px] mx-auto p-[20px] max-w-[600px]">
                  <Heading className="text-[24px] font-bold text-gray-800 mt-[10px] mb-[24px]">
                     Password Reset Request
                  </Heading>

                  <Text className="text-[16px] text-gray-600 mb-[12px]">
                     We received a request to reset your password. If you didn't make this request, you can safely ignore this email.
                  </Text>

                  <Text className="text-[16px] text-gray-600 mb-[24px]">
                     To reset your password, click the button below:
                  </Text>

                  <Section className="text-center mb-[32px]">
                     <Button
                        href={resetLink}
                        className="bg-blue-600 text-white px-[20px] py-[12px] rounded-[4px] font-medium no-underline text-center box-border"
                     >
                        Reset Password
                     </Button>
                  </Section>

                  <Text className="text-[14px] text-gray-600 mb-[12px]">
                     If the button doesn't work, copy and paste this link into your browser:
                  </Text>

                  <Text className="text-[14px] text-blue-600 mb-[32px] break-all">
                     <Link href={resetLink} className="text-blue-600 no-underline">
                        {resetLink}
                     </Link>
                  </Text>

                  <Text className="text-[14px] text-gray-600 mb-[8px]">
                     This password reset link will expire in 24 hours.
                  </Text>

                  <Text className="text-[14px] text-gray-600 mb-[32px]">
                     If you need any help, please contact our support team.
                  </Text>

                  <Section className="border-t border-gray-200 pt-[16px] text-[12px] text-gray-500">
                     <Text className="m-0">
                        © {new Date().getFullYear()} {config.appName}. All rights reserved.
                     </Text>
                  </Section>
               </Container>
            </Body>
         </Tailwind>
      </Html>
   );
};

export default PasswordResetEmail;