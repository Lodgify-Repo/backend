CREATE TYPE "AgentCredentialType" AS ENUM ('CAC', 'SCUML', 'ESVARBON_NIESV', 'STATE_PERMIT');

ALTER TABLE "User"
ADD COLUMN "privacyPolicyAcceptedAt" TIMESTAMP(3),
ADD COLUMN "dataProcessingConsentAt" TIMESTAMP(3),
ADD COLUMN "privacyPolicyVersion" TEXT;

ALTER TABLE "AgentProfile"
ADD COLUMN "credentialType" "AgentCredentialType",
ADD COLUMN "credentialNumber" TEXT;
