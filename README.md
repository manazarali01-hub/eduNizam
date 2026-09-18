# EduNizam – AI School Assistant

EduNizam is a modular school-management PWA designed for small and growing schools.

## Current modules
- Dashboard
- Students
- Attendance
- Fees
- Results
- Notices / AI Assistant
- Settings

## Architecture
- Frontend: HTML, CSS, JavaScript
- Hosting target: GitHub Pages
- Local MVP storage: browser localStorage
- AI: secure API backend to be connected separately (never expose API keys in browser code)

## Roadmap
The project is intentionally modular so new features can be added without rebuilding the whole app.


## Premium Past Papers Module
The Past Papers feature is designed as a scalable exam-prep library for Pakistan SSC/HSSC learners.

### Features
- Matric (9th, 10th) and Intermediate (11th, 12th)
- National board catalog with region/board/class/subject/year/session filters
- Resource types: past papers, model papers, rubrics, syllabi, official portals
- Source trust levels: official, verified, community
- Universal search
- Saved papers / favorites
- Recently opened papers
- Missing-paper request queue
- AI Solve handoff into the EduNizam assistant
- Offline PWA caching for the module shell
- Import-ready JSON schema for large paper datasets

### Data quality rule
A paper should only be marked `official` when the URL is hosted by the relevant examination body or its official learning-material portal. Third-party archives must use `verified` or `community` status after link/content checks.

### Bulk import
Use `past-paper-import.schema.json` as the contract for future paper batches. This keeps thousands of records independent from the UI code.
