# NKRN Q4 2026 Major Update

Branch: `tygerpoort-q4-2026`
Baseline: `tygerpoort-v1-maintenance` @ `6adfa448f951f03f75ed5ee7a23be7ef0e00178d`

## Core objective

Deliver the Q4 Tygerpoort update without breaking existing IT, Logistics, authentication, permissions, venue booking, task, work-plan, job-card or notification workflows.

## Q4 modules

1. IT support
2. Logistiek
3. Funksieversorging (replacement name for Dameskomitee)
4. Shared AI workflow layer
5. Administration / permissions

## Non-negotiable data rule

The original Dameskomitee/Funksieversorging source is authoritative. No existing relevant field, record, quantity, category, note, date, responsibility, stock/equipment value or relationship may be dropped during the redesign.

The Q4 implementation must map the original source field-by-field before any migration or replacement schema is applied.

## Funksieversorging scope

Funksieversorging covers function/event preparation and the operational resources used for functions, including where present in the original source:

- funksies en geleenthede
- dekor en estetika
- tafeldoeke en linne
- tafeldekking
- eetgerei
- breekware
- voorraad en hoeveelhede
- uitreiking / toekenning van items
- terugontvangs
- verantwoordelike persone
- notas en spesiale vereistes
- datums, venues and function scheduling

The user-facing module name is **Funksieversorging**. Historical database identifiers may remain temporarily where changing them would create migration risk, but all new UI terminology must use Funksieversorging.

## UX principles

### Ordinary users

- Afrikaans-first UI.
- Start with the task the user wants to complete, not the database structure.
- Use guided forms with progressive disclosure.
- Hide manager-only operational fields.
- Reuse known user, venue and request information instead of asking users to re-enter it.
- Clear confirmation and status tracking after submission.
- Minimise free-text where a reliable structured choice exists.

### Admin / management users

- One operational overview per module.
- Clear queues for new, active, waiting and completed work.
- Search, filters and status controls must be visible and fast.
- Preserve access to all underlying data and history.
- Avoid duplicate capture between requests, tasks, work plans and job cards.
- Make responsibility, due dates, follow-up and next action obvious.

## Existing Logistics foundation to preserve

The current API already contains:

- ModulePermissions
- LogisticsDepartments
- LogisticsWorkers
- LogisticsTasks
- LogisticsWorkPlanItems
- LogisticsJobCards
- LogisticsJobCardItems
- LogisticsSettings
- LogisticsRequests
- request locations
- request equipment
- request maintenance items
- venue bookings / availability
- request-to-task conversion

Q4 should extend these contracts where suitable rather than duplicating equivalent concepts.

## Afrikaans terminology baseline

| Current / English | Q4 Afrikaans |
| --- | --- |
| Logistics | Logistiek |
| Dameskomitee | Funksieversorging |
| Request | Versoek |
| Requests | Versoeke |
| New | Nuut |
| Active | Aktief |
| Completed | Afgehandel |
| Status | Status |
| Priority | Prioriteit |
| Venue | Lokaal |
| Equipment | Toerusting |
| Maintenance | Instandhouding |
| Notes | Notas |
| Submit | Dien in |
| Cancel | Kanselleer |
| Save | Stoor |

Internal API enum/string compatibility must be assessed before changing persisted values. UI labels may be translated without immediately changing stored values.

## AI workflow principles

AI is a shared service layer, not a separate decorative module. Q4 should prepare for AI-assisted:

- request classification
- suggested priority
- suggested department / responsible person
- duplicate detection
- request summaries
- next-action suggestions
- admin insights and trend summaries

AI suggestions must not silently overwrite authoritative operational data.

## Delivery sequence

1. Inventory current frontend/backend contracts.
2. Map original Dameskomitee source data completely.
3. Add shared Afrikaans terminology / UI primitives.
4. Simplify ordinary-user Logistiek flow.
5. Simplify management Logistiek flow.
6. Implement Funksieversorging data model and UX with non-destructive migration.
7. Add AI workflow service boundaries.
8. Regression test IT, authentication, permissions, Logistiek and venue booking.
9. Run migration verification against a backup / test database.
10. Only then prepare production deployment.

## Deployment rule

No Q4 work is deployed directly to `portal.tygies.co.za` until regression testing and data-migration verification are complete.
