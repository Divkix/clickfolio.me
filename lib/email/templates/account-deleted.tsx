import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface AccountDeletedEmailProps {
  email: string;
}

/**
 * Email template sent after successful account deletion
 * Confirms the deletion and provides support contact information
 */
export function AccountDeletedEmail({ email }: AccountDeletedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your webresume.now account has been deleted</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Account Deleted</Heading>

          <Section style={section}>
            <Text style={text}>Hi,</Text>
            <Text style={text}>
              Your webresume.now account associated with <strong>{email}</strong> has been
              permanently deleted.
            </Text>
            <Text style={text}>All your data has been removed, including:</Text>
            <ul style={list}>
              <li style={listItem}>Your profile information</li>
              <li style={listItem}>All uploaded resume files</li>
              <li style={listItem}>Your published portfolio page</li>
              <li style={listItem}>All associated account data</li>
            </ul>
            <Text style={text}>
              This action cannot be undone. If you wish to use webresume.now again in the future,
              you will need to create a new account.
            </Text>
          </Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              If you did not request this deletion, please contact us immediately at{" "}
              <a href="mailto:support@webresume.now" style={link}>
                support@webresume.now
              </a>
            </Text>
            <Text style={footerText}>Thank you for using webresume.now.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Styles
const main = {
  backgroundColor: "#f8fafc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 20px",
  maxWidth: "560px",
  borderRadius: "8px",
  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
};

const heading = {
  color: "#0f172a",
  fontSize: "24px",
  fontWeight: "600" as const,
  textAlign: "center" as const,
  margin: "0 0 24px 0",
};

const section = {
  padding: "0 20px",
};

const text = {
  color: "#334155",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "16px 0",
};

const list = {
  color: "#334155",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "16px 0",
  paddingLeft: "24px",
};

const listItem = {
  margin: "8px 0",
};

const hr = {
  borderColor: "#e2e8f0",
  margin: "32px 0",
};

const footer = {
  padding: "0 20px",
};

const footerText = {
  color: "#64748b",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "8px 0",
};

const link = {
  color: "#4f46e5",
  textDecoration: "underline",
};
