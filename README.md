# NKRN

NKRN is 'n modulêre skoolbedryfsplatform wat ontwerp is om operasionele "workflows" en alledaagse admin vir die onderwyser in een sentrale stelsel te bring.

## Huidige Modules

### IT
- Personeel IT requests
- Request assignment
- Prioriteite and statuses
- Technician and admin dashboards
- Comments and request history
- Email notifications
- Google Calendar integration
- User administration

### Logistiek
- Personeel logistieke requests
- Maintenance requests
- Logistieke werkers
- Take
- Daily work planning
- Job cards
- Lokale en venues
- Venue booking foundation
- Management dashboard

## Architecture

NKRN bestaan tans uit :

- Web: Next.js, React and TypeScript
- API: ASP.NET Core
- Database: Microsoft SQL Server
- Authentication: JWT and role-based access control

Repo struktuur:

NKRN/
- web/ - Next.js frontend
- api/ - ASP.NET Core API
- README.md

## AI Integration

AI integration word tans ondersoek as 'n ondersteunende laag vir capabilities soos:
- IT request classification
- Voorgestelde prioriteite en categories
- Troubleshooting voorstellings
- Natural-language logistics request extraction
- Structured JSON output
- Organisational knowledge retrieval
- Operational summaries and insights

NKRN bly verantwoordelik vir authentication, permissions, business rules, approvals en persistence.

## Development Status

NKRN is tans onder aktiewe development en word in 'n werklike skoolbedryfsomgewing getoets.

## Configuration

Production credentials en environment-specific configuration word doelbewus van hierdie repository uitgesluit.

Gebruik .env.example en local configuration files wanneer 'n development environment opgestel word.
