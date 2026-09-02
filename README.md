# NKRN

NKRN is a modular school operations platform designed to bring operational workflows into one central system.

## Current Modules

### IT
- Staff IT requests
- Request assignment
- Priorities and statuses
- Technician and admin dashboards
- Comments and request history
- Email notifications
- Google Calendar integration
- User administration

### Logistics
- Staff logistics requests
- Maintenance requests
- Logistics workers
- Tasks
- Daily work planning
- Job cards
- Locations and venues
- Venue booking foundation
- Management dashboard

## Architecture

NKRN currently consists of:

- Web: Next.js, React and TypeScript
- API: ASP.NET Core
- Database: Microsoft SQL Server
- Authentication: JWT and role-based access control

Repository structure:

NKRN/
- web/ - Next.js frontend
- api/ - ASP.NET Core API
- README.md

## AI Integration

AI integration is currently being explored as an assistive layer for capabilities such as:

- IT request classification
- Suggested priorities and categories
- Troubleshooting recommendations
- Natural-language logistics request extraction
- Structured JSON output
- Organisational knowledge retrieval
- Operational summaries and insights

NKRN remains responsible for authentication, permissions, business rules, approvals and persistence.

## Development Status

NKRN is currently under active development and is being piloted in a real school operating environment.

## Configuration

Production credentials and environment-specific configuration are deliberately excluded from this repository.

Use .env.example and local configuration files when setting up a development environment.