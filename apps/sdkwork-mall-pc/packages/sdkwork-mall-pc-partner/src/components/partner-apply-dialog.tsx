import {
  Modal,
  ModalBody,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from "@sdkwork/ui-pc-react";

import type { SdkworkPartnerApplicationDraft, SdkworkPartnerProgram } from "@sdkwork/mall-partner-service";

import type { SdkworkPartnerIntlValue } from "../partner-intl.ts";
import { SdkworkPartnerApplyForm } from "./partner-apply-form.tsx";

export interface SdkworkPartnerApplyDialogProps {
  readonly initialInviteCode?: string;
  readonly intl: SdkworkPartnerIntlValue;
  readonly isOpen: boolean;
  readonly isSubmitting: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (draft: SdkworkPartnerApplicationDraft) => Promise<boolean>;
  readonly program: SdkworkPartnerProgram;
}

/** Application form as a modal, so the join journey never sits in page flow. */
export function SdkworkPartnerApplyDialog({
  initialInviteCode,
  intl,
  isOpen,
  isSubmitting,
  onClose,
  onSubmit,
  program,
}: SdkworkPartnerApplyDialogProps) {
  const { copy } = intl;
  return (
    <Modal
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open={isOpen}
    >
      <ModalContent align="top" size="lg">
        <ModalHeader>
          <ModalTitle>{copy.apply.title}</ModalTitle>
          <ModalDescription>{copy.apply.description}</ModalDescription>
        </ModalHeader>
        <ModalBody>
          <SdkworkPartnerApplyForm
            initialInviteCode={initialInviteCode}
            intl={intl}
            isSubmitting={isSubmitting}
            onClose={onClose}
            onSubmit={onSubmit}
            program={program}
          />
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
