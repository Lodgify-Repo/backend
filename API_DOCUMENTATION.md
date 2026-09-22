# API Endpoints Documentation

## 1. Authentication (`/auth`)

### POST `/auth/register`
**Description:** The system creates a new user account.
**Payload:** Send a `RegisterDto` JSON object in the request body.
**Returns:** The system returns the newly created user data.

### POST `/auth/login`
**Description:** The system authenticates a user with an email and a password.
**Payload:** Send a `LoginDto` JSON object in the request body.
**Returns:** The system returns an `access_token` and user data. The system also sets an HTTP-only cookie that contains a `refresh_token`.

### POST `/auth/refresh`
**Description:** The system generates a new access token for the user.
**Payload:** The request body is empty. The request must include the `refresh_token` HTTP-only cookie.
**Returns:** The system returns a new `access_token` and user data.

### POST `/auth/logout`
**Description:** The system logs out the authenticated user. The system removes the refresh token from the database.
**Payload:** The request body is empty. The request must include a valid `access_token` in the authorization header.
**Returns:** The system returns a success message. The system clears the `refresh_token` HTTP-only cookie.

### GET `/auth/google`
**Description:** The system starts the Google OAuth login flow.
**Payload:** The request body is empty.
**Returns:** The system redirects the user to the Google authentication page.

### GET `/auth/google/callback`
**Description:** The system handles the callback from the Google OAuth service.
**Payload:** The request body is empty.
**Returns:** The system redirects the user to the frontend application. The redirect URL contains an `access_token`. The system sets an HTTP-only cookie that contains a `refresh_token`.

### POST `/auth/forgot-password`
**Description:** The system requests a password reset link for a user.
**Payload:** Send a `ResetPasswordDto` JSON object in the request body.
**Returns:** The system returns a success message. The system sends an email to the user with the reset link.

### POST `/auth/reset-password`
**Description:** The system sets a new password for the user.
**Payload:** Send a `NewPasswordDto` JSON object in the request body.
**Returns:** The system returns a success message.

### GET `/auth/profile`
**Description:** The system gets the profile data of the authenticated user.
**Payload:** The request body is empty.
**Returns:** The system returns the user data that belongs to the current access token.

## 2. Users (`/users`)
*Note: All endpoints in this section require a valid `access_token`.*

### GET `/users/capabilities`
**Description:** The system gets the active capabilities and personas for the current user.
**Payload:** The request body is empty.
**Returns:** The system returns a list of capabilities and personas.

### POST `/users/onboarding`
**Description:** The system completes the initial onboarding steps for the user.
**Payload:** Send a `CompleteOnboardingDto` JSON object in the request body.
**Returns:** The system returns the updated user data.

### POST `/users/personas/owner`
**Description:** The system activates a property owner profile for the user.
**Payload:** Send an `ActivateOwnerProfileDto` JSON object in the request body.
**Returns:** The system returns the activated owner profile data.

### POST `/users/personas/agent`
**Description:** The system activates a property agent profile for the user.
**Payload:** Send an `ActivateAgentProfileDto` JSON object in the request body.
**Returns:** The system returns the activated agent profile data.

### GET `/users/me`
**Description:** The system gets the full profile data for the current user.
**Payload:** The request body is empty.
**Returns:** The system returns the user profile object.

### PATCH `/users/me`
**Description:** The system updates the profile data for the current user.
**Payload:** Send an `UpdateProfileDto` JSON object in the request body.
**Returns:** The system returns the updated user profile object.

### DELETE `/users/me`
**Description:** The system deletes the account of the current user.
**Payload:** The request body is empty.
**Returns:** The system returns a success confirmation.

### POST `/users/sub-accounts/invite`
**Description:** The system sends an invitation to a sub-account. A sub-account is a manager or an agent.
**Requirement:** The user must have the `OWNER` capability.
**Payload:** Send an `InviteSubAccountDto` JSON object in the request body.
**Returns:** The system returns the invitation data.

### GET `/users/sub-accounts`
**Description:** The system lists all sub-accounts that belong to the owner.
**Requirement:** The user must have the `OWNER` capability.
**Payload:** The request body is empty.
**Returns:** The system returns an array of sub-account objects.

### POST `/users/sub-accounts/accept`
**Description:** The system accepts an invitation for a user to become a sub-account.
**Payload:** Send an `AcceptSubAccountDto` JSON object in the request body.
**Returns:** The system returns the accepted sub-account data.

### PATCH `/users/sub-accounts/:id/status`
**Description:** The system changes the status of a specific sub-account. The system makes the sub-account active or inactive.
**Requirement:** The user must have the `OWNER` capability.
**Payload:** Send a JSON object with an `isActive` boolean value in the request body.
**Returns:** The system returns the updated sub-account data.

### DELETE `/users/sub-accounts/:id`
**Description:** The system removes a sub-account from the organization.
**Requirement:** The user must have the `OWNER` capability.
**Payload:** The request body is empty.
**Returns:** The system returns a success confirmation.

## 3. Properties (`/properties`)
*Note: All endpoints in this section require a valid `access_token`.*

### POST `/properties`
**Description:** The system creates a new property. This property can be a hotel, a shortlet, a rental, or a sale property.
**Requirement:** The user must have the `OWNER` capability.
**Payload:** Send a `CreatePropertyDto` JSON object in the request body.
**Returns:** The system returns the new property object.

### GET `/properties/portfolio`
**Description:** The system gets the combined property portfolio for the owner.
**Requirement:** The user must have the `OWNER` capability.
**Payload:** The request body is empty.
**Returns:** The system returns a portfolio object. The portfolio object contains an array of properties.

### GET `/properties/assigned`
**Description:** The system gets a list of properties that belong to the current user.
**Payload:** The request body is empty.
**Returns:** The system returns an array of assigned properties.

### POST `/properties/:id/assignments`
**Description:** The system assigns a branch manager or an agent to a specific property.
**Requirement:** The user must have the `OWNER` capability.
**Payload:** Send an `AssignPropertyStaffDto` JSON object in the request body.
**Returns:** The system returns the assignment data.

### GET `/properties/:id/assignments`
**Description:** The system lists all managers and agents that operate a specific property.
**Requirement:** The user must have the `OWNER` capability.
**Payload:** The request body is empty.
**Returns:** The system returns an array of assignment objects.

### DELETE `/properties/:id/assignments/:assignmentId`
**Description:** The system removes an assignment of a manager or an agent from a property.
**Requirement:** The user must have the `OWNER` capability.
**Payload:** The request body is empty.
**Returns:** The system returns a success confirmation.

### POST `/properties/:id/authorize-agent`
**Description:** The system gives authorization to an external agent to manage a property.
**Requirement:** The user must have the `OWNER` capability.
**Payload:** Send an `AuthorizeAgentDto` JSON object in the request body.
**Returns:** The system returns the authorization data.

### PATCH `/properties/authorizations/:authId/revoke`
**Description:** The system revokes an authorization for an external agent.
**Requirement:** The user must have the `OWNER` capability.
**Payload:** The request body is empty.
**Returns:** The system returns the updated authorization data.

### GET `/properties/agent/assignments`
**Description:** The system gets a list of properties that the current agent manages.
**Requirement:** The user must have the `AGENT` capability.
**Payload:** The request body is empty.
**Returns:** The system returns an array of assigned properties.

### PATCH `/properties/agent/authorizations/:authId/respond`
**Description:** The system accepts or rejects a request for authorization.
**Requirement:** The user must have the `AGENT` capability.
**Payload:** Send a `RespondAuthorizationDto` JSON object in the request body.
**Returns:** The system returns the updated authorization data.

## 4. Admin (`/admin`)
*Note: All endpoints in this section require a valid `access_token`. The user must also have an `ADMIN` or `SUPER_ADMIN` role.*

### GET `/admin/users`
**Description:** The system gets a list of all users in the system.
**Payload:** The request body is empty.
**Returns:** The system returns an array of user objects.

### PATCH `/admin/users/:id/status`
**Description:** The system updates the status of a specific user.
**Payload:** Send an `UpdateUserStatusDto` JSON object in the request body.
**Returns:** The system returns the updated user object.

### POST `/admin/api-keys`
**Description:** The system creates a new server-to-server API key.
**Payload:** Send a `CreateApiKeyDto` JSON object in the request body.
**Returns:** The system returns the new API key data.

### GET `/admin/api-keys`
**Description:** The system lists all generated API keys.
**Query Parameters:** You can send an optional `tenantId` string in the URL.
**Returns:** The system returns an array of API key objects.

### DELETE `/admin/api-keys/:id`
**Description:** The system revokes an existing API key.
**Payload:** The request body is empty.
**Returns:** The system returns a success confirmation.

### GET `/admin/logs`
**Description:** The system gets the audit logs.
**Query Parameters:** Send a `SystemLogsQueryDto` object in the URL.
**Returns:** The system returns an array of log entries.

### DELETE `/admin/logs`
**Description:** The system clears the audit logs.
**Payload:** Send a `ClearLogsDto` JSON object in the request body.
**Returns:** The system returns a success confirmation.

## 5. Application (`/`)

### GET `/`
**Description:** The system checks if the application runs correctly.
**Payload:** The request body is empty.
**Returns:** The system returns a welcome string.
