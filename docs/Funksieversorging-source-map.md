# Funksieversorging source map

## Verified source

The staff workflow is based on the verified Google Form:

**Dameskomitee: Bespreking van voorraad**

Form ID:

`1UNIE48rAW6xA4UwEfmzXwYo70XlJ5SAOO4rHjBq5dKk`

The form PDF was reviewed on 14 September 2026.

## NKRN simplification rules

NKRN preserves the meaningful operational data while removing Google Forms-specific repetition.

Removed from staff input because NKRN already knows or derives it:

- email
- name and surname
- repeated "Wil u nog items byvoeg?" branching
- repeated category navigation
- repeated quantities for attendance-based eating items

Preserved:

- date stock is required
- function
- venue
- other venue when relevant
- attendance
- all verified tablecloth inventory choices and recorded stock
- all verified eating/crockery choices and recorded stock
- all verified serving-stock choices and recorded stock
- optional other item
- optional additional note
- return / breakage undertaking

For eating/crockery selections, requested quantity is derived from attendance because the source form states that the quantity is determined by the number of people attending.

## Requester identity

Requester identity is server-derived from the authenticated JWT user. The client does not choose the requester.

## Notification routing

`Funksieversorging:NotificationEmail` controls the module notification recipient.

The initial configured address is the verified source coordinator address:

`kultuur@tygies.co.za`

Email sending is disabled in the Development environment unless explicitly enabled.

The request is persisted even when the email notification fails.

## Stock semantics

Recorded stock is displayed as guidance only.

NKRN does not claim to reserve stock. Requests that exceed recorded stock may still be submitted for administrator review.
