import { WizardProgress } from "@clickfolio/ui";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 720 }}>{children}</div>
);

export const UploadStep = () => (
  <Frame>
    <WizardProgress currentStep={1} totalSteps={5} progress={20} hasUploadStep />
  </Frame>
);

export const ChooseHandle = () => (
  <Frame>
    <WizardProgress currentStep={2} totalSteps={5} progress={40} hasUploadStep />
  </Frame>
);

export const ReviewContent = () => (
  <Frame>
    <WizardProgress currentStep={2} totalSteps={4} progress={50} />
  </Frame>
);

export const SelectTheme = () => (
  <Frame>
    <WizardProgress currentStep={4} totalSteps={4} progress={100} />
  </Frame>
);
