"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import { itTranslations } from "./it-labels";

export type Language = "en" | "af";

type TranslationEntry = {
    en: string;
    af: string;
};

/**
 * The portal is Afrikaans-first, while English remains available everywhere.
 *
 * The existing pages contain a mixture of hard-coded English and Afrikaans
 * labels. Keeping the shared vocabulary here means a language change also
 * covers pages that were added later (and avoids changing API/database values).
 */
const translations: readonly TranslationEntry[] = [
    { en: "Optional work assignment", af: "Opsionele werktoewysing" },
    { en: "Use this when the request should appear on a job card. You can also complete the request directly here.", af: "Gebruik dit wanneer die versoek op ’n werkkaart moet verskyn. Jy kan die versoek ook direk hier afhandel." },
    { en: "Assign work", af: "Ken werk toe" },
    { en: "High / Critical", af: "Hoog / Kritiek" },
    // Shared shell and navigation
    { en: "Language", af: "Taal" },
    { en: "English", af: "Engels" },
    { en: "Afrikaans", af: "Afrikaans" },
    { en: "Home", af: "Tuis" },
    { en: "NKRN Home", af: "NKRN Tuis" },
    { en: "NKRN modules", af: "NKRN-modules" },
    { en: "Modules", af: "Modules" },
    { en: "Back", af: "Terug" },
    { en: "Go Back", af: "Gaan terug" },
    { en: "Log Out", af: "Meld af" },
    { en: "Logout", af: "Meld af" },
    { en: "Close", af: "Sluit" },
    { en: "Cancel", af: "Kanselleer" },
    { en: "Save", af: "Stoor" },
    { en: "Save Changes", af: "Stoor veranderinge" },
    { en: "Saving...", af: "Besig om te stoor..." },
    { en: "Refresh", af: "Verfris" },
    { en: "Search", af: "Soek" },
    { en: "Search requests...", af: "Soek versoeke..." },
    { en: "Submit", af: "Dien in" },
    { en: "Submitting...", af: "Besig om in te dien..." },
    { en: "Loading", af: "Laai" },
    { en: "Loading...", af: "Laai..." },
    { en: "Loading...", af: "Laai…" },
    { en: "Please wait", af: "Wag asseblief" },
    { en: "Available", af: "Beskikbaar" },
    { en: "Available now", af: "Nou beskikbaar" },
    { en: "Active", af: "Aktief" },
    { en: "Inactive", af: "Onaktief" },
    { en: "Live", af: "Aktief" },
    { en: "Coming Soon", af: "Binnekort beskikbaar" },
    { en: "Open", af: "Oop" },
    { en: "New", af: "Nuut" },
    { en: "All", af: "Alles" },
    { en: "requests", af: "versoeke" },
    { en: "technicians", af: "tegnici" },
    { en: "administrators", af: "administrateurs" },
    { en: "workers", af: "werkers" },
    { en: "items", af: "items" },
    { en: "item", af: "item" },
    { en: "task", af: "taak" },
    { en: "tasks", af: "take" },
    { en: "request(s)", af: "versoek(e)" },
    { en: "requests ·", af: "versoeke ·" },
    { en: "technicians ·", af: "tegnici ·" },
    { en: "administrators ·", af: "administrateurs ·" },
    { en: "Actions", af: "Aksies" },
    { en: "ID", af: "ID" },
    { en: "Name", af: "Naam" },
    { en: "Type", af: "Tipe" },
    { en: "Status", af: "Status" },
    { en: "Date", af: "Datum" },
    { en: "Location", af: "Ligging" },
    { en: "Start", af: "Begin" },
    { en: "Finish", af: "Einde" },
    { en: "Today", af: "Vandag" },
    { en: "View all", af: "Wys alles" },
    { en: "Edit", af: "Wysig" },
    { en: "Remove", af: "Deaktiveer" },
    { en: "Export CSV", af: "Voer CSV uit" },
    { en: "Voer CSV uit", af: "Voer CSV uit" },
    { en: "Error", af: "Fout" },
    { en: "Unknown", af: "Onbekend" },
    { en: "Unassigned", af: "Nie toegeken nie" },
    { en: "Not scheduled", af: "Nog nie beplan nie" },
    { en: "No description supplied.", af: "Geen beskrywing verskaf nie." },
    { en: "No results.", af: "Geen resultate nie." },
    { en: "No items found.", af: "Geen items gevind nie." },
    { en: "No active requests.", af: "Geen aktiewe versoeke nie." },

    // Login
    { en: "School Operations Platform", af: "Skoolbedryfsplatform" },
    { en: "Secure access", af: "Veilige toegang" },
    { en: "One secure workspace", af: "Een veilige werkruimte" },
    { en: "School operations, connected.", af: "Skoolbedrywighede, gekoppel." },
    { en: "School operations,", af: "Skoolbedrywighede," },
    { en: "connected.", af: "gekoppel." },
    { en: "IT Desk", af: "IT-ondersteuning" },
    { en: "Logistics", af: "Logistiek" },
    { en: "Access", af: "Toegang" },
    { en: "Role-based workspace", af: "Werkruimte volgens rol" },
    { en: "Authorised Access", af: "Gemagtigde toegang" },
    { en: "Sign in", af: "Meld aan" },
    { en: "Use your Tygerpoort account to enter the school operations workspace.", af: "Gebruik jou Tygerpoort-rekening om die skoolbedryfswerkruimte te betree." },
    { en: "Tygerpoort email address", af: "Tygerpoort-e-posadres" },
    { en: "Please enter your Tygerpoort email address.", af: "Voer asseblief jou Tygerpoort-e-posadres in." },
    { en: "Please use your @tygies.co.za email address.", af: "Gebruik asseblief jou @tygies.co.za-e-posadres." },
    { en: "Signing in...", af: "Besig om aan te meld..." },
    { en: "Continue", af: "Gaan voort" },
    { en: "Unable to sign in.", af: "Kon nie aanmeld nie." },
    { en: "Access is restricted to authorised Tygerpoort users. Your available modules are determined by your account permissions.", af: "Toegang is beperk tot gemagtigde Tygerpoort-gebruikers. Jou beskikbare modules word deur jou rekeningtoestemmings bepaal." },
    { en: "Secure school operations", af: "Veilige skoolbedrywighede" },
    { en: "Laerskool Tygerpoort", af: "Laerskool Tygerpoort" },
    { en: "Laerskool Tygerpoort · IT Report", af: "Laerskool Tygerpoort · IT-verslag" },
    { en: "Laerskool Tygerpoort · IT Report · Administrator", af: "Laerskool Tygerpoort · IT-verslag · Administrateur" },
    { en: "Signed in", af: "Aangemeld" },

    // Home and module cards
    { en: "Unified School Workspace", af: "Geïntegreerde skoolwerkruimte" },
    { en: "One platform.", af: "Een platform." },
    { en: "Every operation.", af: "Elke operasie." },
    { en: "Platform Status", af: "Platformstatus" },
    { en: "Active modules", af: "Aktiewe modules" },
    { en: "Operational", af: "Operasioneel" },
    { en: "NKRN Workspace", af: "NKRN-werkruimte" },
    { en: "IT Help (Report)", af: "IT-hulp (verslag)" },
    { en: "IT Report", af: "IT-verslag" },
    { en: "Support & Systems", af: "Ondersteuning en stelsels" },
    { en: "Operations", af: "Bedrywighede" },
    { en: "Mobility", af: "Mobiliteit" },
    { en: "Academic", af: "Akademies" },
    { en: "Events", af: "Geleenthede" },
    { en: "Venues", af: "Lokale" },
    { en: "Facilities", af: "Fasiliteite" },
    { en: "Coordination", af: "Koördinering" },
    { en: "Transport", af: "Vervoer" },
    { en: "Curriculum", af: "Kurrikulum" },
    { en: "Event Support", af: "Funksieversorging" },
    { en: "Logistics", af: "Logistiek" },
    { en: "Logistics module", af: "Logistiekmodule" },
    { en: "Logistics is ready for operational work.", af: "Logistiek is gereed vir operasionele werk." },
    { en: "IT Desk and Logistics are live. Additional modules will appear here as they are released.", af: "IT-ondersteuning en Logistiek is aktief. Verdere modules sal hier verskyn soos dit vrygestel word." },
    { en: "Log support requests, track incidents, manage assignments and administer technical support.", af: "Teken ondersteuningsversoeke aan, volg insidente, bestuur toewysings en administreer tegniese ondersteuning." },
    { en: "Coordinate operational requests, resources, facilities and day-to-day school logistics.", af: "Koördineer operasionele versoeke, hulpbronne, fasiliteite en daaglikse skoollogistiek." },
    { en: "Manage transport requests, vehicle planning, bookings and school movement requirements.", af: "Bestuur vervoerversoeke, voertuigbeplanning, besprekings en skoolvervoervereistes." },
    { en: "Centralise curriculum tools, planning resources, academic workflows and teaching support.", af: "Sentreer kurrikulumhulpmiddels, beplanningshulpbronne, akademiese werkvloeie en onderrigondersteuning." },
    { en: "Coordinate venue availability, bookings and shared-space scheduling across the school.", af: "Koördineer lokaalbeskikbaarheid, besprekings en gedeelde-ruimte-skedulering regdeur die skool." },
    { en: "Plan events, responsibilities, resources, communications and operational requirements.", af: "Beplan geleenthede, verantwoordelikhede, hulpbronne, kommunikasie en operasionele vereistes." },
    { en: "Open full IT Desk", af: "Maak volledige IT-ondersteuning oop" },
    { en: "Open Logistics", af: "Maak Logistiek oop" },
    { en: "Loading workspace...", af: "Werkruimte laai..." },
    { en: "Unable to read logged-in user.", af: "Kon nie die aangemelde gebruiker lees nie." },
    { en: "Access your authorised school services from one central workspace, including technical support and future operational modules.", af: "Kry toegang tot jou gemagtigde skooldienste vanuit een sentrale werkruimte, insluitend tegniese ondersteuning en toekomstige operasionele modules." },
    { en: "IT Desk and Logistics are live. Additional NKRN modules will be enabled here as they are developed.", af: "IT-ondersteuning en Logistiek is aktief. Verdere NKRN-modules sal hier geaktiveer word soos dit ontwikkel word." },
    { en: "IT Desk · Logistics", af: "IT-ondersteuning · Logistiek" },
    { en: "IT Desk and Logistics are live. Additional modules will appear here as they are released.", af: "IT-ondersteuning en Logistiek is aktief. Verdere modules sal hier verskyn soos dit vrygestel word." },
    { en: "Laerskool Tygerpoort's secure school operations platform for IT support, logistics and administration.", af: "Laerskool Tygerpoort se veilige skoolbedryfsplatform vir IT-ondersteuning, logistiek en administrasie." },

    // FINAL RELEASE: Home + Event Support
    // Complete-phrase translations only. No arbitrary word substitution.
    { en: "Main navigation", af: "Hoofnavigasie" },
    { en: "Your school. Your workspace.", af: "Jou skool. Jou werksruimte." },
    { en: "Every day's work,", af: "Elke dag se werk," },
    { en: "in one place.", af: "op een plek." },
    { en: "Welcome,", af: "Welkom," },
    { en: ". Choose a module to get started.", af: ". Kies ’n module om aan die gang te kom." },
    { en: "3 active modules · 2 future modules", af: "3 aktiewe modules · 2 toekomstige modules" },
    { en: "In operation", af: "In werking" },
    { en: "Support", af: "Ondersteuning" },
    { en: "School operations", af: "Skoolbedryf" },
    { en: "Event preparation", af: "Funksievoorbereiding" },
    { en: "Future module", af: "Toekomstige module" },
    { en: "Report technical problems and track your support requests.", af: "Meld tegniese probleme aan en volg jou ondersteuningsversoeke." },
    { en: "Requests, activities, maintenance, venues and the daily work plan.", af: "Versoeke, aktiwiteite, instandhouding, lokale en die daaglikse werkplan." },
    { en: "Prepare events: catering, table setting and supplies.", af: "Berei funksies voor: versorging, tafeldekking en benodigdhede." },
    { en: "Transport and travel planning.", af: "Vervoer en reisbeplanning." },
    { en: "Curriculum and teaching planning.", af: "Kurrikulum en onderrigbeplanning." },
    { en: "Open →", af: "Maak oop →" },
    { en: "Future modules", af: "Toekomstige modules" },
    { en: "Staff member", af: "Personeellid" },
    { en: "Administrator", af: "Administrateur" },
    { en: "Technician", af: "Tegnikus" },

    // Event Support - navigation and page shell
    { en: "Event Support", af: "Funksieversorging" },
    { en: "NKRN · In operation", af: "NKRN · In werking" },
    { en: "Arrange supplies for an event quickly and simply. NKRN uses your profile automatically.", af: "Reël voorraad vir ’n funksie vinnig en eenvoudig. NKRN gebruik jou profiel outomaties." },
    { en: "Supplies must be requested at least three working days before the event. Borrowed items must be cleaned and returned, and damage or breakages must be reported.", af: "Voorraad moet minstens drie werksdae voor die funksie aangevra word. Geleende items moet skoongemaak en terugbesorg word, en skade of breuke moet aangemeld word." },
    { en: "Event", af: "Funksie" },
    { en: "Supplies", af: "Voorraad" },
    { en: "Confirm", af: "Bevestig" },
    { en: "Step 1", af: "Stap 1" },
    { en: "Step 2", af: "Stap 2" },
    { en: "Step 3", af: "Stap 3" },
    { en: "Event details", af: "Funksiebesonderhede" },
    { en: "We only ask for what NKRN does not already know about you.", af: "Ons vra net wat NKRN nie reeds van jou weet nie." },
    { en: "Date required", af: "Datum benodig" },
    { en: "Venue", af: "Lokaal" },
    { en: "Choose a venue", af: "Kies ’n lokaal" },
    { en: "e.g. Grade 7 farewell", af: "bv. Graad 7-afskeid" },
    { en: "Number of people", af: "Aantal persone" },
    { en: "e.g. 120", af: "bv. 120" },
    { en: "Other venue", af: "Ander lokaal" },
    { en: "Specify the venue", af: "Spesifiseer die lokaal" },
    { en: "This date is within three working days. The request can still be submitted for administrative confirmation.", af: "Hierdie datum is binne drie werksdae. Die versoek kan steeds ingedien word vir administratiewe bevestiging." },
    { en: "What do you need?", af: "Wat benodig jy?" },
    { en: "Choose a section. Only those supplies are shown on screen.", af: "Kies ’n afdeling. Net daardie voorraad word op die skerm gewys." },
    { en: "Tablecloths", af: "Tafeldoeke" },
    { en: "Tablecloths & decor", af: "Tafeldoeke & versiering" },
    { en: "Tableware", af: "Eetgerei" },
    { en: "Crockery & cutlery", af: "Breekware & eetgerei" },
    { en: "Serving", af: "Opdien" },
    { en: "Serving supplies", af: "Opdieningsvoorraad" },
    { en: "Other item", af: "Ander item" },
    { en: "No supplies selected yet.", af: "Nog geen voorraad gekies nie." },
    { en: "More than the recorded stock for one or more items.", af: "Meer as aangetekende voorraad by een of meer items." },
    { en: "Review request", af: "Kontroleer versoek" },
    { en: "Review only the information that will be sent.", af: "Kontroleer net die inligting wat gestuur gaan word." },
    { en: "Submitted by", af: "Ingedien deur" },
    { en: "Profile", af: "Profiel" },
    { en: "Name and email are automatically linked to the request.", af: "Naam en e-pos word outomaties aan die versoek gekoppel." },
    { en: "Selected supplies", af: "Gekose voorraad" },
    { en: "Anything else? (optional)", af: "Enigiets anders? (opsioneel)" },
    { en: "Only if there is something the administrator should know.", af: "Slegs indien daar iets is wat die administrateur moet weet." },
    { en: "I confirm that borrowed supplies will be cleaned and returned as agreed, and that any damage or breakages will be reported.", af: "Ek bevestig dat die geleende voorraad skoongemaak en volgens afspraak terugbesorg sal word, en dat enige skade of breuke aangemeld sal word." },
    { en: "Submit request", af: "Dien versoek in" },
    { en: "Submitting…", af: "Besig om in te dien…" },
    { en: "History", af: "Geskiedenis" },
    { en: "Hide", af: "Versteek" },
    { en: "Show", af: "Wys" },
    { en: "No requests yet.", af: "Nog geen versoeke nie." },
    { en: "Module administration", af: "Module-administrasie" },
    { en: "All Event Support requests", af: "Alle Funksieversorging-versoeke" },
    { en: "No requests to show.", af: "Geen versoeke om te wys nie." },
    { en: "Laerskool Tygerpoort · Event Support", af: "Laerskool Tygerpoort · Funksieversorging" },
    { en: "Quantity will be confirmed", af: "Hoeveelheid word bevestig" },
    { en: "Quantity is automatically determined by the number of people attending the event.", af: "Hoeveelheid word outomaties bepaal deur die persone wat die funksie bywoon." },
    { en: "Submitted within three working days.", af: "Binne drie werksdae ingedien." },
    { en: "Notification:", af: "Kennisgewing:" },
    { en: "Needed", af: "Benodig" },
    { en: "Recorded", af: "Aangeteken" },
    { en: "People", af: "Persone" },
    { en: "In review", af: "Word hanteer" },
    { en: "Not approved", af: "Nie goedgekeur nie" },

    // Event Support validation / feedback
    { en: "Please complete the date, event, venue and number of people.", af: "Voltooi asseblief die datum, funksie, lokaal en aantal persone." },
    { en: "Please specify the other venue.", af: "Spesifiseer asseblief die ander lokaal." },
    { en: "Select at least one supply item.", af: "Kies minstens een voorraaditem." },
    { en: "Please confirm the return conditions.", af: "Bevestig asseblief die terugbesorgingsvoorwaardes." },
    { en: "The request could not be submitted.", af: "Versoek kon nie ingedien word nie." },

    // Event Support venues
    { en: "Hall", af: "Saal" },
    { en: "Panthera (upper lounge)", af: "Panthera (losie bo)" },
    { en: "Panthera (lower level)", af: "Panthera (onder)" },
    { en: "Classrooms", af: "Klaskamers" },
    { en: "Staff room", af: "Personeelkamer" },
    { en: "Other", af: "Ander" },

    // Event Support stock items
    { en: "Black tablecloths", af: "Swart tafeldoeke" },
    { en: "Tygerpoort tablecloths", af: "Tygerpoort tafeldoeke" },
    { en: "Black stretch tablecloths (marketing)", af: "Swart spantafeldoeke (bemarking)" },
    { en: "Red-and-white striped tablecloths (marketing)", af: "Rooi-en-wit gestreepte tafeldoeke (bemarking)" },
    { en: "Large plates - grey", af: "Groot borde - grys" },
    { en: "Small plates - grey", af: "Kleinbordjies - grys" },
    { en: "Soup/dessert bowls - grey", af: "Sop-/poedingbakkies - grys" },
    { en: "Large plates - white", af: "Groot borde - wit" },
    { en: "Small plates - white", af: "Kleinbordjies - wit" },
    { en: "Soup/dessert bowls - white", af: "Sop-/poedingbakkies - wit" },
    { en: "Glasses - gin", af: "Glase - gin" },
    { en: "Glasses - soft drink", af: "Glase - koeldrank" },
    { en: "Glasses - wine", af: "Glase - wyn" },
    { en: "Saucers - white", af: "Pierings - wit" },
    { en: "Cups - white", af: "Koppies - wit" },
    { en: "Coffee mugs - white", af: "Koffiebekers - wit" },
    { en: "Coffee mugs with crest - white", af: "Koffiebekers met wapen - wit" },
    { en: "Coffee mugs - grey", af: "Koffiebekers - grys" },
    { en: "Knives - silver", af: "Messe - silwer" },
    { en: "Forks - silver", af: "Vurke - silwer" },
    { en: "Dessert spoons - silver", af: "Nagereglepels - silwer" },
    { en: "Teaspoons - silver", af: "Teelepels - silwer" },
    { en: "Cups - without crest", af: "Bekers - sonder wapen" },
    { en: "Large flasks - hot", af: "Drukflesse groot - warm" },
    { en: "Small flasks - hot", af: "Drukflesse klein - warm" },
    { en: "Wooden boards - serving", af: "Houtborde - uitpak" },
    { en: "Serving dishes - silver", af: "Opskepbakke - silwer" },
    { en: "Serving dishes - white", af: "Opskepbakke - wit" },
    { en: "Serving spoons - silver", af: "Opskeplepels - silwer" },
    { en: "Sugar bowls - white", af: "Suikerpotte - wit" },
    { en: "Kettles - steel", af: "Teeketels - staal" },
    { en: "Urn - hot", af: "Urn - warm" },
    { en: "Urn - cold", af: "Urn - koud" },
    { en: "Hot trays", af: "Warmskinkborde / hot trays" },
    { en: "Ice buckets / ice trays", af: "Yshouers / ysbakke" },
    { en: "Flower pots (school use only)", af: "Blompotte (slegs vir skoolgebruik)" },
    // IT requests, Admin and Tech
    { en: "IT Request", af: "IT-versoek" },
    { en: "IT support", af: "IT-ondersteuning" },
    { en: "Helpdesk", af: "IT-ondersteuning" },
    { en: "Requests", af: "Versoeke" },
    { en: "My Requests", af: "My versoeke" },
    { en: "Support Requests", af: "Ondersteuningsversoeke" },
    { en: "IT Requests", af: "IT-versoeke" },
    { en: "Total Requests", af: "Totale versoeke" },
    { en: "Resolved requests", af: "Afgehandelde versoeke" },
    { en: "Completed requests", af: "Afgehandelde versoeke" },
    { en: "All helpdesk requests", af: "Alle IT-ondersteuningsversoeke" },
    { en: "Pending IT Desk", af: "Wag op IT-ondersteuning" },
    { en: "Awaiting attention", af: "Wag op aandag" },
    { en: "Currently being handled", af: "Word tans hanteer" },
    { en: "In Progress", af: "Besig" },
    { en: "Logged", af: "Aangemeld" },
    { en: "Busy", af: "Besig" },
    { en: "Done", af: "Afgehandel" },
    { en: "Completed", af: "Afgehandel" },
    { en: "Welcome", af: "Welkom" },
    { en: "Welcome,", af: "Welkom," },
    { en: "Tell the IT team what you need assistance with.", af: "Vertel die IT-span waarmee jy hulp benodig." },
    { en: "View the status of requests you have submitted.", af: "Volg die status van jou ingediende versoeke." },
    { en: "Submit a Request", af: "Dien 'n versoek in" },
    { en: "Submit Request", af: "Dien versoek in" },
    { en: "Submit a technical support request.", af: "Dien 'n tegniese ondersteuningsversoek in." },
    { en: "New Request", af: "Nuwe versoek" },
    { en: "Request title", af: "Versoektitel" },
    { en: "Title", af: "Titel" },
    { en: "Describe the problem", af: "Beskryf die probleem" },
    { en: "Description", af: "Beskrywing" },
    { en: "Category", af: "Kategorie" },
    { en: "Categories", af: "Kategorieë" },
    { en: "Priority", af: "Prioriteit" },
    { en: "Low", af: "Laag" },
    { en: "Medium", af: "Medium" },
    { en: "High", af: "Hoog" },
    { en: "Critical", af: "Kritiek" },
    { en: "History", af: "Geskiedenis" },
    { en: "No requests logged yet.", af: "Nog geen versoeke aangemeld nie." },
    { en: "No requests match the current filters.", af: "Geen versoeke pas by die gekose filters nie." },
    { en: "Select a request to view, assign and update it.", af: "Kies 'n versoek om dit te bekyk, toe te wys of op te dateer." },
    { en: "Manage Request", af: "Bestuur versoek" },
    { en: "Request ID", af: "Versoeknommer" },
    { en: "Requester", af: "Versoeker" },
    { en: "Request for", af: "Versoek vir" },
    { en: "Myself", af: "Myself" },
    { en: "Logged by", af: "Aangemeld deur" },
    { en: "Submitted by", af: "Ingedien deur" },
    { en: "Submitted By", af: "Ingedien deur" },
    { en: "Assigned To", af: "Toegewys aan" },
    { en: "Assigned to", af: "Toegewys aan" },
    { en: "Assigned Technician", af: "Toegewysde tegnikus" },
    { en: "Currently Assigned To", af: "Tans toegewys aan" },
    { en: "Assign to", af: "Ken toe aan" },
    { en: "Technician", af: "Tegnikus" },
    { en: "Technicians", af: "Tegnici" },
    { en: "Admin", af: "Administrasie" },
    { en: "Administration", af: "Administrasie" },
    { en: "Administrator", af: "Administrateur" },
    { en: "Administrators", af: "Administrateurs" },
    { en: "Staff Member", af: "Personeellid" },
    { en: "User", af: "Personeellid" },
    { en: "First Name", af: "Voornaam" },
    { en: "First name", af: "Voornaam" },
    { en: "Last Name", af: "Van" },
    { en: "Last name", af: "Van" },
    { en: "Email", af: "E-pos" },
    { en: "Email address", af: "E-posadres" },
    { en: "User Email", af: "Gebruiker se e-posadres" },
    { en: "Requester email address", af: "Versoeker se e-posadres" },
    { en: "User ID", af: "Gebruikersnommer" },
    { en: "User Name", af: "Gebruiker se naam" },
    { en: "Role", af: "Rol" },
    { en: "Actions", af: "Aksies" },
    { en: "Comments", af: "Kommentaar" },
    { en: "Internal Comments", af: "Interne kommentaar" },
    { en: "Comments & Progress", af: "Kommentaar en vordering" },
    { en: "Communication", af: "Kommunikasie" },
    { en: "Add Comment", af: "Voeg kommentaar by" },
    { en: "Add progress comment", af: "Voeg 'n vorderingsnota by" },
    { en: "Add an internal comment...", af: "Voeg interne kommentaar by..." },
    { en: "Enter a progress update...", af: "Voeg 'n vorderingsnota by..." },
    { en: "Add Comment", af: "Voeg kommentaar by" },
    { en: "No comments yet.", af: "Nog geen kommentaar nie." },
    { en: "No comments have been added to this request yet.", af: "Daar is nog geen kommentaar op hierdie versoek nie." },
    { en: "Mark Done", af: "Merk as afgehandel" },
    { en: "Created", af: "Aangemeld op" },
    { en: "Created Date", af: "Aanmelddatum" },
    { en: "Completed Date", af: "Afhandelingsdatum" },
    { en: "Scheduled", af: "Beplan" },
    { en: "Scheduled Start", af: "Beplande begintyd" },
    { en: "Scheduled End", af: "Beplande eindtyd" },
    { en: "Scheduled start", af: "Beplande begintyd" },
    { en: "Scheduled end", af: "Beplande eindtyd" },
    { en: "No appointment scheduled", af: "Geen afspraak beplan nie" },
    { en: "Google Calendar", af: "Google Kalender" },
    { en: "Google Calendar event connected", af: "Google Kalender-afspraak gekoppel" },
    { en: "Google Calendar Event ID", af: "Google Kalender-afspraaknommer" },
    { en: "Calendar event linked", af: "Kalenderafspraak gekoppel" },
    { en: "Calendar appointments", af: "Kalenderafsprake" },
    { en: "Quick Actions", af: "Vinnige aksies" },
    { en: "Hide Done Requests", af: "Versteek afgehandelde versoeke" },
    { en: "Show Done Requests", af: "Wys afgehandelde versoeke" },
    { en: "Hide Users", af: "Versteek gebruikers" },
    { en: "Show Users", af: "Wys gebruikers" },
    { en: "User Administration", af: "Gebruikersadministrasie" },
    { en: "Add NKRN User", af: "Voeg NKRN-gebruiker by" },
    { en: "+ Add User", af: "+ Voeg gebruiker by" },
    { en: "Cancel Add User", af: "Kanselleer nuwe gebruiker" },
    { en: "Create User", af: "Skep gebruiker" },
    { en: "Creating User...", af: "Gebruiker word geskep..." },
    { en: "Adding...", af: "Besig om by te voeg..." },
    { en: "Removing...", af: "Besig om te deaktiveer..." },
    { en: "Uncategorised", af: "Geen kategorie" },
    { en: "Unable to load requesters. Refresh the page to try again.", af: "Gebruikers kon nie gelaai word nie. Verfris die bladsy om weer te probeer." },
    { en: "Loading requesters...", af: "Gebruikers laai..." },
    { en: "Request submitted for", af: "Versoek ingedien vir" },
    { en: "Please select an active requester.", af: "Kies asseblief 'n aktiewe gebruiker." },
    { en: "Only admins may log requests for another person.", af: "Slegs administrateurs mag versoeke namens iemand anders indien." },
    { en: "Check the request details and select an active requester with a valid email address.", af: "Gaan die versoekbesonderhede na en kies 'n aktiewe gebruiker met 'n geldige e-posadres." },
    { en: "The selected person will receive request emails and see the request in their history. You remain recorded as the person who logged it.", af: "Die gekose persoon ontvang die versoek se e-posse en sien dit in hul geskiedenis. Jy bly aangeteken as die persoon wat dit aangemeld het." },
    { en: "Please select a category before submitting the request.", af: "Kies 'n kategorie voordat jy die versoek indien." },
    { en: "Please describe what is happening. You may also include a suggested due date or other important information here.", af: "Beskryf wat gebeur. Jy kan ook 'n voorgestelde sperdatum of ander belangrike inligting hier byvoeg." },
    { en: "You can include a preferred completion date, deadline, or other important information in the description.", af: "Jy kan 'n voorkeurdatum, sperdatum of ander belangrike inligting by die beskrywing insluit." },
    { en: "If your request needs to be completed by a particular date, please mention the date in the description above.", af: "As jou versoek teen 'n bepaalde datum voltooi moet word, noem asseblief die datum in die beskrywing hierbo." },
    { en: "Your request will be reviewed by the IT team. An administrator or technician will determine the appropriate category and priority.", af: "Die IT-span sal jou versoek hersien. 'n Administrateur of tegnikus sal die toepaslike kategorie en prioriteit bepaal." },
    { en: "Category:", af: "Kategorie:" },
    { en: "Priority:", af: "Prioriteit:" },
    { en: "Request #", af: "Versoek #" },
    { en: "Request submitted successfully.", af: "Jou versoek is ingedien." },
    { en: "Something went wrong submitting your request.", af: "Jou versoek kon nie ingedien word nie. Probeer asseblief weer." },
    { en: "Unable to load request categories.", af: "Die versoekkategorieë kon nie gelaai word nie." },
    { en: "Unable to load your requests.", af: "Jou versoeke kon nie gelaai word nie." },
    { en: "No categories available", af: "Geen kategorieë beskikbaar nie" },
    { en: "Loading categories...", af: "Kategorieë laai..." },
    { en: "Loading your account...", af: "Jou rekening laai..." },
    { en: "Unable to restore logged-in user.", af: "Kon nie die aangemelde gebruiker herstel nie." },
    { en: "Something went wrong while updating the request.", af: "Die versoek kon nie opgedateer word nie. Probeer asseblief weer." },
    { en: "Unable to add the comment.", af: "Die kommentaar kon nie bygevoeg word nie." },
    { en: "Unable to load the technician dashboard.", af: "Die tegnikusportaal kon nie gelaai word nie." },
    { en: "Unable to load the IT Desk data.", af: "Die IT-inligting kon nie gelaai word nie." },
    { en: "Failed to load requests.", af: "Die versoeke kon nie gelaai word nie." },
    { en: "Failed to add comment.", af: "Die kommentaar kon nie bygevoeg word nie." },
    { en: "Failed to add user.", af: "Die gebruiker kon nie bygevoeg word nie." },
    { en: "Failed to update request.", af: "Die versoek kon nie opgedateer word nie." },
    { en: "Failed to update user.", af: "Die gebruiker kon nie opgedateer word nie." },
    { en: "Failed to remove user.", af: "Die gebruiker kon nie gedeaktiveer word nie." },
    { en: "A user with this email address already exists.", af: "Daar is reeds 'n gebruiker met hierdie e-posadres." },
    { en: "The action could not be completed. Please try again.", af: "Die aksie kon nie voltooi word nie. Probeer asseblief weer." },
    { en: "The action could not be completed. Refresh the page and try again. Contact IT support if the problem continues.", af: "Die aksie kon nie voltooi word nie. Verfris die bladsy en probeer weer. Kontak IT-ondersteuning indien dit voortduur." },
    { en: "Loading Administrator Dashboard…", af: "Administrasieportaal laai…" },
    { en: "Loading technician dashboard…", af: "Tegnikusportaal laai…" },
    { en: "Loading comments…", af: "Kommentaar laai…" },
    { en: "System Overview", af: "Stelseloorsig" },
    { en: "IT Desk Control Centre", af: "IT-beheersentrum" },
    { en: "IT Technician Dashboard", af: "IT-tegnikusportaal" },
    { en: "High-priority requests", af: "Hoëprioriteitsversoeke" },
    { en: "Logged by: user ID", af: "Aangemeld deur: gebruikersnommer" },
    { en: "Logged by: name", af: "Aangemeld deur: naam" },
    { en: "Logged by: email address", af: "Aangemeld deur: e-posadres" },
    { en: "Invalid date", af: "Ongeldige datum" },
    { en: "Invalid user role.", af: "Ongeldige gebruikersrol." },
    { en: "First name, last name and email address are required.", af: "Voornaam, van en e-posadres is verpligtend." },
    { en: "Only @tygies.co.za email addresses are allowed.", af: "Slegs @tygies.co.za-e-posadresse word toegelaat." },
    { en: "The scheduled end time must be after the scheduled start time.", af: "Die beplande eindtyd moet ná die begintyd wees." },
    { en: "There are no requests to export.", af: "Daar is geen versoeke om uit te voer nie." },
    { en: "No active requests.", af: "Geen aktiewe versoeke nie." },
    { en: "Logged in as", af: "Aangemeld as" },
    { en: "Manage requests, assignments and scheduled support.", af: "Bestuur versoeke, toewysings en geskeduleerde ondersteuning." },
    { en: "Manage and resolve IT support requests.", af: "Bestuur en los IT-ondersteuningsversoeke op." },
    { en: "Create a new active NKRN account using the staff member's @tygies.co.za email address.", af: "Skep 'n nuwe aktiewe NKRN-rekening met die personeellid se @tygies.co.za-e-posadres." },
    { en: "Showing", af: "Wys" },
    { en: "total users", af: "totale gebruikers" },
    { en: "Comment added successfully.", af: "Kommentaar is bygevoeg." },
    { en: "Failed to fetch", af: "Die verbinding het misluk. Probeer asseblief weer." },
    { en: "NetworkError when attempting to fetch resource.", af: "Die verbinding het misluk. Probeer asseblief weer." },
    { en: "Hardware", af: "Hardeware" },
    { en: "Software", af: "Sagteware" },
    { en: "Network", af: "Netwerk" },
    { en: "Internet", af: "Internet" },
    { en: "Printer", af: "Drukker" },
    { en: "Printing", af: "Drukwerk" },
    { en: "Other", af: "Ander" },
    { en: "e.g. Projector not displaying", af: "bv. Die projektor wys geen beeld nie" },
    { en: "(Admin)", af: "(Administrateur)" },
    { en: "Laerskool Tygerpoort · IT Desk", af: "Laerskool Tygerpoort · IT-verslag" },
    { en: "Laerskool Tygerpoort · IT Desk · Administrator", af: "Laerskool Tygerpoort · IT-verslag · Administrateur" },
    { en: "Laerskool Tygerpoort · Secure school operations workspace", af: "Laerskool Tygerpoort · Veilige skoolbedryfswerkruimte" },
    { en: "Laerskool Tygerpoort Logo", af: "Laerskool Tygerpoort-logo" },

    // Logistics control centre
    { en: "Loading dashboard...", af: "Dashboard laai..." },
    { en: "Loading dashboard…", af: "Dashboard laai…" },
    { en: "Access restricted", af: "Toegang beperk" },
    { en: "Logistics access required", af: "Logistiektoegang word vereis" },
    { en: "Your NKRN account does not currently have permission to open the Logistics module.", af: "Jou NKRN-rekening het tans nie toestemming om die Logistiekmodule oop te maak nie." },
    { en: "Logistics Control Centre", af: "Logistiekbeheersentrum" },
    { en: "Track operational work, priorities and daily execution.", af: "Volg operasionele werk, prioriteite en daaglikse uitvoering." },
    { en: "Admin Dashboard", af: "Administrasiedashboard" },
    { en: "Daily Work Plan", af: "Daaglikse werkplan" },
    { en: "item(s)", af: "item(s)" },
    { en: "No work-plan items are scheduled for today yet.", af: "Geen werkplanitems is nog vir vandag geskeduleer nie." },
    { en: "Job Cards", af: "Werkskaarte" },
    { en: "Daily job card", af: "Daaglikse werkskaart" },
    { en: "Generate the consolidated work card for a selected date.", af: "Genereer die gekonsolideerde werkskaart vir 'n gekose datum." },
    { en: "generated", af: "gegenereer" },
    { en: "Job-card date", af: "Werkskaartdatum" },
    { en: "already exists for", af: "bestaan reeds vir" },
    { en: "No Logistics job card has been generated yet.", af: "Geen Logistiek-werkskaart is nog gegenereer nie." },
    { en: "Latest job card", af: "Nuutste werkskaart" },
    { en: "Send Job Card", af: "Stuur werkskaart" },
    { en: "Logistics Team", af: "Logistiekspan" },
    { en: "Worker Management", af: "Werkerbestuur" },
    { en: "worker(s)", af: "werker(s)" },
    { en: "+ Add Worker", af: "+ Voeg werker by" },
    { en: "No Logistics workers have been configured yet. Add the team members who should receive daily work cards.", af: "Geen Logistiek-werkers is nog opgestel nie. Voeg die spanlede by wat daaglikse werkskaarte moet ontvang." },
    { en: "No Logistics workers have been configured yet. Add the grounds and cleaning staff here so they can be assigned to Daily Work Plan items.", af: "Geen Logistiek-werkers is nog opgestel nie. Voeg die terrein- en skoonmaakpersoneel hier by sodat hulle aan daaglikse werkplanitems toegewys kan word." },
    { en: "No Logistics workers have been configured yet. You can still schedule this item as unassigned.", af: "Geen Logistiek-werkers is nog opgestel nie. Jy kan steeds hierdie item as nie-toegeken skeduleer." },
    { en: "Workers do not need an NKRN login account. They can be assigned directly to Daily Work Plan items.", af: "Werkers het nie 'n NKRN-aanmeldrekening nodig nie. Hulle kan direk aan daaglikse werkplanitems toegewys word." },
    { en: "Worker", af: "Werker" },
    { en: "Contact", af: "Kontak" },
    { en: "Tasks & Maintenance", af: "Take en instandhouding" },
    { en: "Operational Task Register", af: "Operasionele taakregister" },
    { en: "Showing", af: "Wys" },
    { en: "tasks", af: "take" },
    { en: "All departments", af: "Alle departemente" },
    { en: "All priorities", af: "Alle prioriteite" },
    { en: "P1 · Critical", af: "P1 · Kritiek" },
    { en: "P2 · Urgent", af: "P2 · Dringend" },
    { en: "P3 · Planned", af: "P3 · Beplan" },
    { en: "P4 · Improvement", af: "P4 · Verbetering" },
    { en: "Open tasks", af: "Oop take" },
    { en: "All statuses", af: "Alle statusse" },
    { en: "Not Started", af: "Nog nie begin" },
    { en: "In Progress", af: "In Proses" },
    { en: "Overdue", af: "Staan oor" },
    { en: "Completed", af: "Afgehandel" },
    { en: "Task", af: "Taak" },
    { en: "Task ID", af: "Taaknommer" },
    { en: "Department", af: "Departement" },
    { en: "Responsible", af: "Verantwoordelik" },
    { en: "Deadline", af: "Sperdatum" },
    { en: "Next Action", af: "Volgende aksie" },
    { en: "Next Follow Up", af: "Volgende opvolg" },
    { en: "Add to Plan", af: "Voeg by plan" },
    { en: "No tasks match the current filters.", af: "Geen take pas by die huidige filters nie." },
    { en: "Edit Worker", af: "Wysig werker" },
    { en: "Add Worker", af: "Voeg werker by" },
    { en: "Workers do not need an NKRN login account to receive work-card emails.", af: "Werkers het nie 'n NKRN-aanmeldrekening nodig om werkskaart-e-posse te ontvang nie." },
    { en: "First Name *", af: "Voornaam *" },
    { en: "Worker Type", af: "Werkertipe" },
    { en: "Grounds", af: "Terrein" },
    { en: "Cleaning", af: "Skoonmaak" },
    { en: "Email Address", af: "E-posadres" },
    { en: "Active worker", af: "Aktiewe werker" },
    { en: "Inactive workers remain in history but cannot be assigned to new work.", af: "Onaktiewe werkers bly in die geskiedenis, maar kan nie aan nuwe werk toegewys word nie." },
    { en: "Work area", af: "Werksarea" },
    { en: "Optional materials, tools or stock", af: "Opsionele materiale, gereedskap of voorraad" },
    { en: "Instructions for the daily job card", af: "Instruksies vir die daaglikse werkskaart" },
    { en: "Adding...", af: "Besig om by te voeg..." },
    { en: "Add to Daily Work Plan", af: "Voeg by daaglikse werkplan" },
    { en: "Generate Job Card", af: "Genereer werkskaart" },
    { en: "All Tasks", af: "Alle take" },
    { en: "Imported + new", af: "Ingevoer en nuut" },
    { en: "Needs attention", af: "Benodig aandag" },
    { en: "Critical + urgent", af: "Kritiek en dringend" },
    { en: "Currently active", af: "Tans aktief" },
    { en: "Needs an owner", af: "Benodig 'n verantwoordelike persoon" },
    { en: "Already Generated", af: "Reeds gegenereer" },
    { en: "Approval Status", af: "Goedkeuringsstatus" },
    { en: "Archived", af: "Geargiveer" },
    { en: "Background", af: "Agtergrond" },
    { en: "Budget Amount", af: "Begrotingsbedrag" },
    { en: "Contractor", af: "Kontrakteur" },
    { en: "Deactivate", af: "Deaktiveer" },
    { en: "Deactivating…", af: "Besig om te deaktiveer…" },
    { en: "Due Date Note", af: "Sperdatumnota" },
    { en: "Last Follow Up", af: "Laaste opvolg" },
    { en: "Maintenance", af: "Instandhouding" },
    { en: "No area", af: "Geen area" },
    { en: "No mobile number", af: "Geen selfoonnommer" },
    { en: "Notes", af: "Notas" },
    { en: "Optional", af: "Opsioneel" },
    { en: "P1 / P2", af: "P1 / P2" },
    { en: "Quote Received", af: "Kwitansie ontvang" },
    { en: "Quote Required", af: "Kwitansie benodig" },
    { en: "Recipient", af: "Ontvanger" },
    { en: "Requested By", af: "Versoek deur" },
    { en: "Requested Date", af: "Versoekdatum" },
    { en: "Search tasks…", af: "Soek take…" },
    { en: "Select a job-card date first.", af: "Kies eers 'n werkskaartdatum." },
    { en: "Select a work date before adding the task to the Daily Work Plan.", af: "Kies 'n werkdatum voordat die taak by die daaglikse werkplan gevoeg word." },
    { en: "Sending…", af: "Besig om te stuur…" },
    { en: "Sent", af: "Gestuur" },
    { en: "There are no visible Logistics tasks to export.", af: "Daar is geen sigbare Logistiektake om uit te voer nie." },
    { en: "Updated", af: "Opgedateer" },
    { en: "Yes", af: "Ja" },
    { en: "Department:", af: "Departement:" },
    { en: "Current responsible:", af: "Huidige verantwoordelike:" },
    { en: "Area", af: "Area" },
    { en: "Manager Note", af: "Bestuurdernota" },
    { en: "Manager Notes", af: "Bestuurdernotas" },
    { en: "Materials Required", af: "Benodigde materiale" },
    { en: "Mobile Number", af: "Selfoonnommer" },
    { en: "Schedule Task #", af: "Skeduleertaak #" },
    { en: "Work Date", af: "Werkdatum" },
    { en: "Work Description", af: "Werkbeskrywing" },
    { en: "Worker #", af: "Werker #" },
    { en: "total", af: "totaal" },
    { en: "A work-plan description is required.", af: "'n Werkplanbeskrywing word vereis." },
    { en: "A worker first name is required.", af: "'n Werker se voornaam word vereis." },
    { en: "Unable to add this task to the Daily Work Plan.", af: "Kon nie hierdie taak by die daaglikse werkplan voeg nie." },
    { en: "Unable to add this worker.", af: "Kon nie hierdie werker byvoeg nie." },
    { en: "Unable to deactivate this worker.", af: "Kon nie hierdie werker deaktiveer nie." },
    { en: "Unable to deactivate this Logistics worker.", af: "Kon nie hierdie Logistiek-werker deaktiveer nie." },
    { en: "Unable to generate the Logistics job card.", af: "Kon nie die Logistiek-werkskaart genereer nie." },
    { en: "Unable to load the Logistics dashboard.", af: "Kon nie die Logistiekdashboard laai nie." },
    { en: "Unable to save this Logistics worker.", af: "Kon nie hierdie Logistiek-werker stoor nie." },
    { en: "Unable to send the Logistics job card.", af: "Kon nie die Logistiek-werkskaart stuur nie." },
    { en: "Unable to update this worker.", af: "Kon nie hierdie werker opdateer nie." },
    { en: "Your Logistics access is view-only. Manage permission is required to deactivate workers.", af: "Jou Logistiektoegang is slegs-lees. Bestuurstoestemming word vereis om werkers te deaktiveer." },
    { en: "Your Logistics access is view-only. Manage permission is required to generate job cards.", af: "Jou Logistiektoegang is slegs-lees. Bestuurstoestemming word vereis om werkskaarte te genereer." },
    { en: "Your Logistics access is view-only. Manage permission is required to manage workers.", af: "Jou Logistiektoegang is slegs-lees. Bestuurstoestemming word vereis om werkers te bestuur." },
    { en: "Your Logistics access is view-only. Manage permission is required to schedule work.", af: "Jou Logistiektoegang is slegs-lees. Bestuurstoestemming word vereis om werk te skeduleer." },
    { en: "Your Logistics access is view-only. Manage permission is required to send job cards.", af: "Jou Logistiektoegang is slegs-lees. Bestuurstoestemming word vereis om werkskaarte te stuur." },

    // Logistics staff request inbox
    { en: "Staff Requests", af: "Personeelversoeke" },
    { en: "Logistics Request Inbox", af: "Logistiekversoek-inkassie" },
    { en: "Review staff submissions before turning approved work into operational tasks.", af: "Hersien personeelindienings voordat goedgekeurde werk in operasionele take omskep word." },
    { en: "Open requests", af: "Oop versoeke" },
    { en: "Under Review", af: "Onder hersiening" },
    { en: "Needs Information", af: "Benodig inligting" },
    { en: "Approved", af: "Goedgekeur" },
    { en: "Converted", af: "Omskep" },
    { en: "Declined", af: "Afgewys" },
    { en: "Cancelled", af: "Gekanselleer" },
    { en: "All requests", af: "Alle versoeke" },
    { en: "Refresh Requests", af: "Verfris versoeke" },
    { en: "Loading Logistics requests...", af: "Logistiekversoeke laai..." },
    { en: "No Logistics requests match the current filter.", af: "Geen Logistiekversoeke pas by die huidige filter nie." },
    { en: "Submitted", af: "Ingedien" },
    { en: "Action", af: "Aksie" },
    { en: "Review", af: "Hersien" },
    { en: "Submitted by", af: "Ingedien deur" },
    { en: "Logistics Request #", af: "Logistiekversoek #" },
    { en: "Equipment", af: "Toerusting" },
    { en: "Request Status", af: "Versoekstatus" },
    { en: "Save Review", af: "Stoor hersiening" },
    { en: "Converting...", af: "Besig om te omskep..." },
    { en: "Approve & Convert to Task", af: "Keur goed en omskep na taak" },
    { en: "Convert to Operational Task", af: "Omskep na operasionele taak" },
    { en: "This creates a Logistics task and links this request to it in one transaction.", af: "Dit skep 'n Logistiektaak en koppel hierdie versoek in een transaksie daaraan." },
    { en: "Due Date", af: "Sperdatum" },
    { en: "Include this task when generating job cards", af: "Sluit hierdie taak in wanneer werkskaarte gegenereer word" },
    { en: "Activity Date", af: "Aktiwiteitsdatum" },
    { en: "Current Status", af: "Huidige status" },
    { en: "No location supplied", af: "Geen ligging verskaf nie" },
    { en: "Optional review notes", af: "Opsionele hersieningsnotas" },
    { en: "Review and complete the approved Logistics request.", af: "Hersien en voltooi die goedgekeurde Logistiekversoek." },
    { en: "Assess and complete the requested maintenance.", af: "Beoordeel en voltooi die aangevraagde instandhouding." },
    { en: "Time", af: "Tyd" },
    { en: "Unable to convert this request to a task.", af: "Kon nie hierdie versoek na 'n taak omskep nie." },
    { en: "Unable to load Logistics requests.", af: "Kon nie Logistiekversoeke laai nie." },
    { en: "Unable to save the request review.", af: "Kon nie die versoekhersiening stoor nie." },
    { en: "Your account does not have permission to manage Logistics requests.", af: "Jou rekening het nie toestemming om Logistiekversoeke te bestuur nie." },

    // Logistics staff portal and venue requests
    { en: "Loading your Logistics portal...", af: "Jou Logistiekportaal laai..." },
    { en: "Loading your Logistics portal…", af: "Jou Logistiekportaal laai…" },
    { en: "Staff Logistics Portal", af: "Personeel-Logistiekportaal" },
    { en: "Welcome,", af: "Welkom," },
    { en: "Request assistance, check venues and track progress.", af: "Versoek hulp, kyk na lokale en volg vordering." },
    { en: "Request assistance", af: "Versoek hulp" },
    { en: "Laerskool Tygerpoort", af: "Laerskool Tygerpoort" },
    { en: "Laerskool Tygerpoort · Logistics", af: "Laerskool Tygerpoort · Logistiek" },
    { en: "Venue Bookings", af: "Lokaalbesprekings" },
    { en: "Logistics Service Desk", af: "Logistiekdienssentrum" },
    { en: "What can the Logistics team help you with?", af: "Waarmee kan die Logistiekspan jou help?" },
    { en: "Submit one short request and NKRN will keep the request, venue information and progress together.", af: "Dien een kort versoek in en NKRN hou die versoek, lokaalbesonderhede en vordering saam." },
    { en: "+ Request Logistics Assistance", af: "+ Versoek Logistiekhulp" },
    { en: "+ New Request", af: "+ Nuwe versoek" },
    { en: "My Logistics Requests", af: "My Logistiekversoeke" },
    { en: "New Logistics Request", af: "Nuwe Logistiekversoek" },
    { en: "NKRN · Logistics", af: "NKRN · Logistiek" },
    { en: "Event & Venue", af: "Geleentheid en lokaal" },
    { en: "Event support", af: "Geleentheidsondersteuning" },
    { en: "Venue, tables, chairs, gazebos and other setup.", af: "Lokaal, tafels, stoele, gazebo's en ander opstelling." },
    { en: "Report a problem", af: "Rapporteer 'n probleem" },
    { en: "Repair, replacement, furniture or facility issues.", af: "Herstel-, vervangings-, meubel- of fasiliteitsprobleme." },
    { en: "General", af: "Algemeen" },
    { en: "Other assistance", af: "Ander hulp" },
    { en: "Anything that does not fit around categories.", af: "Enigiets wat nie by die kategorieë pas nie." },
    { en: "Active requests", af: "Aktiewe versoeke" },
    { en: "You have no active Logistics requests.", af: "Jy het geen aktiewe Logistiekversoeke nie." },
    { en: "Facilities", af: "Fasiliteite" },
    { en: "Upcoming venue bookings", af: "Komende lokaalbesprekings" },
    { en: "Request history", af: "Versoekgeskiedenis" },
    { en: "Cancel request", af: "Kanselleer versoek" },
    { en: "Venue Availability", af: "Lokaalbeskikbaarheid" },
    { en: "Upcoming bookings", af: "Komende besprekings" },
    { en: "Teachers can see confirmed and pending venue use before submitting an event request.", af: "Onderwysers kan bevestigde en hangende lokaalgebruik sien voordat 'n geleentheidsversoek ingedien word." },
    { en: "No venue bookings are currently recorded.", af: "Geen lokaalbesprekings is tans aangeteken nie." },
    { en: "No Logistics requests submitted yet.", af: "Nog geen Logistiekversoeke ingedien nie." },
    { en: "No upcoming venue bookings are recorded.", af: "Geen komende lokaalbesprekings is aangeteken nie." },
    { en: "Select a confirmed NKRN location to see its bookings. The detailed campus SVG can later plug into these same Location IDs.", af: "Kies 'n bevestigde NKRN-ligging om die besprekings te sien. Die gedetailleerde kampus-SVG kan later aan dieselfde Ligging-ID's gekoppel word." },
    { en: "Locations & venues", af: "Ligging en lokale" },
    { en: "Bookable venue", af: "Bespreekbare lokaal" },
    { en: "School location", af: "Skoolligging" },
    { en: "Selected Location", af: "Gekose ligging" },
    { en: "No upcoming bookings.", af: "Geen komende besprekings nie." },
    { en: "Request this venue", af: "Versoek hierdie lokaal" },
    { en: "Report an issue here", af: "Rapporteer 'n probleem hier" },
    { en: "Select a location on the left to view its details.", af: "Kies 'n ligging aan die linkerkant om die besonderhede te sien." },
    { en: "How can we help?", af: "Hoe kan ons help?" },
    { en: "Request Type", af: "Versoektipe" },
    { en: "Activity Category", af: "Aktiwiteitskategorie" },
    { en: "Short Title", af: "Kort titel" },
    { en: "Select a location...", af: "Kies 'n ligging..." },
    { en: "Venue availability", af: "Lokaalbeskikbaarheid" },
    { en: "Check the selected venue before submitting.", af: "Kontroleer die gekose lokaal voordat jy indien." },
    { en: "Checking...", af: "Kontroleer tans..." },
    { en: "Check availability", af: "Kontroleer beskikbaarheid" },
    { en: "Cleanup is required the following morning", af: "Opruiming word die volgende oggend vereis" },
    { en: "Equipment Required", af: "Toerusting benodig" },
    { en: "What needs attention?", af: "Wat benodig aandag?" },
    { en: "Select an item...", af: "Kies 'n item..." },
    { en: "What is required?", af: "Wat word benodig?" },
    { en: "Submitted as", af: "Ingedien as" },
    { en: "Submitting...", af: "Besig om in te dien..." },
    { en: "Submit Logistics Request", af: "Dien Logistiekversoek in" },
    { en: "Event / Venue", af: "Geleentheid / lokaal" },
    { en: "Event date, start time and end time are required.", af: "Geleentheidsdatum, begintyd en eindtyd word vereis." },
    { en: "Event", af: "Geleentheid" },
    { en: "General Logistics", af: "Algemene Logistiek" },
    { en: "No location", af: "Geen ligging" },
    { en: "Not sure", af: "Nie seker nie" },
    { en: "Unsure", af: "Onseker" },
    { en: "Or type a classroom / area not listed above", af: "Of tik 'n klaskamer / area wat nie hierbo gelys is nie" },
    { en: "Overview", af: "Oorsig" },
    { en: "Please enter a short request title.", af: "Voer asseblief 'n kort versoektitel in." },
    { en: "Please select what needs attention.", af: "Kies asseblief wat aandag benodig." },
    { en: "Repair / Maintenance", af: "Herstel / instandhouding" },
    { en: "Repair", af: "Herstel" },
    { en: "Replace", af: "Vervang" },
    { en: "School Map", af: "Skoolkaart" },
    { en: "Select a venue, date, start time and end time first.", af: "Kies eers 'n lokaal, datum, begintyd en eindtyd." },
    { en: "The event end time must be after the start time.", af: "Die geleentheid se eindtyd moet ná die begintyd wees." },
    { en: "This venue is already booked during the selected time.", af: "Hierdie lokaal is reeds gedurende die gekose tyd bespreek." },
    { en: "Unable to cancel this request.", af: "Kon nie hierdie versoek kanselleer nie." },
    { en: "Unable to check venue availability.", af: "Kon nie lokaalbeskikbaarheid nagaan nie." },
    { en: "Unable to load Logistics.", af: "Kon nie Logistiek laai nie." },
    { en: "Unable to open Logistics.", af: "Kon nie Logistiek oopmaak nie." },
    { en: "Unable to submit this Logistics request.", af: "Kon nie hierdie Logistiekversoek indien nie." },
    { en: "Venue is available for this time.", af: "Die lokaal is vir hierdie tyd beskikbaar." },
    { en: "What assistance do you need?", af: "Watter hulp benodig jy?" },
    { en: "Select a location…", af: "Kies 'n ligging…" },
    { en: "Or type a classroom / area not listed above", af: "Of tik 'n klaskamer / area wat nie hierbo gelys is nie" },
    { en: "Add the important details. Keep it short and clear.", af: "Voeg die belangrike besonderhede by. Hou dit kort en duidelik." },
    { en: "Back to NKRN", af: "Terug na NKRN" },
    { en: "Your workspace is opening…", af: "Jou werkruimte word oopgemaak…" },

    { en: "Sending / confirmation required", af: "Besig om te stuur / bevestiging nodig" },
    { en: "Failed - review and try again", af: "Misluk - hersien en probeer weer" },
    // NKRN FINAL PREMIUM LOGISTICS COPY
    { en: "NKRN \u00b7 Logistics", af: "NKRN \u00b7 Logistiek" },
    { en: "Laerskool Tygerpoort \u00b7 Logistics", af: "Laerskool Tygerpoort \u00b7 Logistiek" },
    { en: "Your Logistics portal is loading...", af: "Jou Logistics-portaal laai\u2026" },
    { en: "Your workspace is opening...", af: "Jou werkruimte word oopgemaak\u2026" },
    { en: "Staff portal", af: "Personeelportaal" },
    { en: "Welcome,", af: "Welkom," },
    { en: ". Request assistance, check venues and track progress.", af: ". Versoek hulp, kontroleer lokale en volg vordering." },
    { en: "Home", af: "Tuis" },
    { en: "Log out", af: "Meld af" },
    { en: "Overview", af: "Oorsig" },
    { en: "My requests", af: "My versoeke" },
    { en: "Venue bookings", af: "Lokaalbesprekings" },
    { en: "School map", af: "Skoolkaart" },
    { en: "Logistics: requests and feedback", af: "Logistiek: Versoeke en terugvoer" },
    { en: "How can the Logistics team help you?", af: "Waarmee kan die Logistics-span jou help?" },
    { en: "Submit one short request and NKRN will keep the request, venue information and progress together.", af: "Dien een kort versoek in. NKRN hou die versoek, lokaal-inligting en vordering bymekaar." },
    { en: "New request", af: "Nuwe versoek" },
    { en: "Request support", af: "Versoek ondersteuning" },
    { en: "Event / Activity", af: "Funksie / Aktiwiteit" },
    { en: "Event support", af: "Funksieondersteuning" },
    { en: "Venues, tables, chairs, gazebos and other setup.", af: "Lokale, tafels, stoele, gazebo\u2019s en ander opstelling." },
    { en: "Maintenance", af: "Instandhouding" },
    { en: "Report a problem", af: "Meld \u2019n probleem aan" },
    { en: "Repair, replacement, furniture or facility issues.", af: "Herstel, vervanging, meubels of fasiliteitsprobleme." },
    { en: "General", af: "Algemeen" },
    { en: "Other support", af: "Ander ondersteuning" },
    { en: "Any other operational support.", af: "Enige ander bedryfsondersteuning." },
    { en: "Active requests", af: "Aktiewe versoeke" },
    { en: "You have no active Logistics requests.", af: "Jy het geen aktiewe Logistics-versoeke nie." },
    { en: "Facilities", af: "Fasiliteite" },
    { en: "Upcoming venue bookings", af: "Komende lokaalbesprekings" },
    { en: "See all", af: "Sien alles" },
    { en: "No upcoming venue bookings.", af: "Geen komende lokaalbesprekings nie." },
    { en: "My Logistics requests", af: "My Logistics-versoeke" },
    { en: "Request history", af: "Versoekgeskiedenis" },
    { en: "Logistics team", af: "Logistics-span" },
    { en: "Cancel request", af: "Kanselleer versoek" },
    { en: "No Logistics requests have been submitted yet.", af: "Nog geen Logistics-versoeke ingedien nie." },
    { en: "Venue availability", af: "Lokaalbeskikbaarheid" },
    { en: "Upcoming bookings", af: "Komende besprekings" },
    { en: "Teachers can see confirmed and pending venue use before submitting an event request.", af: "Onderwysers kan bevestigde en hangende lokaalgebruik sien voordat \u2019n geleentheidsversoek ingedien word." },
    { en: "No venue bookings recorded.", af: "Geen lokaalbesprekings aangeteken nie." },
    { en: "Locations and venues", af: "Ligging en lokale" },
    { en: "Select a confirmed NKRN location to see its bookings. The detailed campus SVG can later plug into these same Location IDs.", af: "Kies \u2019n bevestigde NKRN-ligging om die besprekings te sien. Die gedetailleerde kampus-SVG kan later aan dieselfde Ligging-ID\u2019s gekoppel word." },
    { en: "Bookable venue", af: "Bespreekbare lokaal" },
    { en: "School location", af: "Skoolligging" },
    { en: "Selected location", af: "Gekose ligging" },
    { en: "No upcoming bookings.", af: "Geen komende besprekings nie." },
    { en: "Request this venue", af: "Versoek hierdie lokaal" },
    { en: "Report an issue here", af: "Meld \u2019n probleem hier aan" },
    { en: "Choose a location on the left to see details.", af: "Kies \u2019n ligging links om besonderhede te sien." },
    { en: "New Logistics request", af: "Nuwe Logistics-versoek" },
    { en: "How can we help?", af: "Hoe kan ons help?" },
    { en: "Request steps", af: "Versoekstappe" },
    { en: "Request type", af: "Soort versoek" },
    { en: "Details", af: "Besonderhede" },
    { en: "Confirm", af: "Bevestig" },
    { en: "How can Logistics help?", af: "Waarmee kan Logistics help?" },
    { en: "Venue, time and equipment", af: "Lokaal, tyd en toerusting" },
    { en: "Something needs to be repaired or replaced", af: "Iets moet herstel of vervang word" },
    { en: "Any other logistics support", af: "Enige ander logistieke ondersteuning" },
    { en: "Event or activity details", af: "Funksie- of aktiwiteitsbesonderhede" },
    { en: "What needs attention?", af: "Wat benodig aandag?" },
    { en: "What do you need?", af: "Wat benodig jy?" },
    { en: "Your name, email, submission date, internal status and priority are handled automatically by NKRN.", af: "Jou naam, e-pos, datum van indiening, interne status en prioriteit word outomaties deur NKRN hanteer." },
    { en: "Activity category", af: "Aktiwiteitskategorie" },
    { en: "What are you arranging and what should Logistics know?", af: "Wat re\u00ebl jy en wat moet Logistics weet?" },
    { en: "What is wrong or what needs to be done?", af: "Wat is fout of wat moet gedoen word?" },
    { en: "e.g. Grade 5 parent evening. We need the hall ready before 17:30.", af: "bv. Graad 5-oueraand. Ons benodig die saal gereed voor 17:30." },
    { en: "e.g. The window in Grade 5A does not close and needs to be checked.", af: "bv. Die venster in Graad 5A sluit nie en moet nagegaan word." },
    { en: "Briefly describe what you need.", af: "Beskryf kortliks wat jy benodig." },
    { en: "Venue / location", af: "Lokaal / ligging" },
    { en: "(if applicable)", af: "(indien van toepassing)" },
    { en: "Select a location...", af: "Kies \u2019n ligging\u2026" },
    { en: "Or type a classroom / area not listed above", af: "Of tik \u2019n klaskamer / gebied wat nie op die lys is nie" },
    { en: "Date", af: "Datum" },
    { en: "Start time", af: "Begintyd" },
    { en: "End time", af: "Eindtyd" },
    { en: "NKRN can check the venue against existing bookings.", af: "NKRN kan die lokaal teen bestaande besprekings kontroleer." },
    { en: "Checking...", af: "Besig om te kontroleer\u2026" },
    { en: "Check", af: "Kontroleer" },
    { en: "Cleanup is required the next morning", af: "Opruiming word die volgende oggend benodig" },
    { en: "Required equipment", af: "Benodigde toerusting" },
    { en: "(optional)", af: "(opsioneel)" },
    { en: "Select an item...", af: "Kies \u2019n item\u2026" },
    { en: "What should happen?", af: "Wat moet gebeur?" },
    { en: "Repair", af: "Herstel" },
    { en: "Replace", af: "Vervang" },
    { en: "Unsure", af: "Onseker" },
    { en: "Review request", af: "Kontroleer versoek" },
    { en: "Review your request", af: "Kontroleer jou versoek" },
    { en: "Location:", af: "Ligging:" },
    { en: "Category:", af: "Kategorie:" },
    { en: "When:", af: "Wanneer:" },
    { en: "Cleanup next morning:", af: "Opruiming volgende oggend:" },
    { en: "Yes", af: "Ja" },
    { en: "No", af: "Nee" },
    { en: "Equipment:", af: "Toerusting:" },
    { en: "Attention:", af: "Aandag:" },
    { en: "Not selected", af: "Nie gekies nie" },
    { en: "Submitted by", af: "Ingedien deur" },
    { en: "NKRN automatically links your identity and submission time. The Logistics team determines internal priority, status and assignment.", af: "NKRN koppel jou identiteit en die indieningstyd outomaties. Die Logistics-span bepaal interne prioriteit, status en toewysing." },
    { en: "Edit", af: "Wysig" },
    { en: "Submitting...", af: "Besig om in te dien\u2026" },
    { en: "Submit Logistics request", af: "Dien Logistics-versoek in" },
    { en: "Select a venue, date, start time and end time first.", af: "Kies eers \u2019n lokaal, datum, begintyd en eindtyd." },
    { en: "Venue availability could not be checked.", af: "Lokaalbeskikbaarheid kon nie nagegaan word nie." },
    { en: "The venue is available for this time.", af: "Die lokaal is beskikbaar vir hierdie tyd." },
    { en: "The venue is already booked for this time.", af: "Die lokaal is reeds vir hierdie tyd bespreek." },
    { en: "Briefly describe what is wrong or what needs attention.", af: "Beskryf kortliks wat fout is of wat aandag benodig." },
    { en: "Briefly describe the event or activity and what is needed.", af: "Beskryf kortliks die funksie of aktiwiteit en wat benodig word." },
    { en: "Briefly describe how Logistics can help.", af: "Beskryf kortliks waarmee Logistics kan help." },
    { en: "Enter the activity date, start and end time.", af: "Vul die aktiwiteitsdatum, begin- en eindtyd in." },
    { en: "The end time must be after the start time.", af: "Die eindtyd moet n\u00e1 die begintyd wees." },
    { en: "Select what needs attention.", af: "Kies wat aandag benodig." },
    { en: "The Logistics request could not be submitted.", af: "Die Logistics-versoek kon nie ingedien word nie." },
    { en: "No location", af: "Geen ligging" },
    { en: "No location supplied", af: "Geen ligging verskaf nie" },
    { en: "Unassigned", af: "Nie toegeken nie" },
    { en: "Staff Requests", af: "Personeelversoeke" },
    { en: "Logistics Request Inbox", af: "Logistiekversoek-inkassie" },
    { en: "Review staff submissions before turning approved work into operational tasks.", af: "Hersien personeelindienings voordat goedgekeurde werk in operasionele take omskep word." },
    { en: "Open requests", af: "Oop versoeke" },
    { en: "Loading Logistics requests...", af: "Logistiekversoeke laai..." },
    { en: "No Logistics requests match the current filter.", af: "Geen Logistiekversoeke pas by die huidige filter nie." },
    { en: "All requests", af: "Alle versoeke" },
    { en: "Refresh Requests", af: "Verfris versoeke" },
    { en: "Review", af: "Hersien" },
    { en: "Manager notes", af: "Bestuursnotas" },
    { en: "Optional review notes", af: "Opsionele hersieningsnotas" },
    { en: "Assign work", af: "Ken werk toe" },
    { en: "Optional work assignment", af: "Opsionele werktoewysing" },
    { en: "Work plan", af: "Werkplan" },
    { en: "Job cards", af: "Werkskaarte" },
    { en: "Workers", af: "Werkers" },
    { en: "Tasks", af: "Take" },
    { en: "Daily work plan", af: "Daaglikse werkplan" },
    { en: "Generate job card", af: "Genereer werkkaart" },
    { en: "Send job card", af: "Stuur werkkaart" },
    { en: "Job card history", af: "Werkkaartgeskiedenis" },
    { en: "Worker management", af: "Werkerbestuur" },
    { en: "Add worker", af: "Voeg werker by" },
    { en: "Edit worker", af: "Wysig werker" },
    { en: "Save worker", af: "Stoor werker" },
    { en: "Deactivate", af: "Deaktiveer" },
    { en: "Search tasks...", af: "Soek take..." },
    { en: "Department", af: "Departement" },
    { en: "Priority", af: "Prioriteit" },
    { en: "Responsible", af: "Verantwoordelik" },
    { en: "Due date", af: "Sperdatum" },
    { en: "Next action", af: "Volgende aksie" },
    { en: "Materials required", af: "Benodigde materiaal" },
    { en: "Manager note", af: "Bestuursnota" },
    { en: "Include on job card", af: "Sluit op werkkaart in" },
    { en: "Planned start", af: "Beplande begin" },
    { en: "Planned end", af: "Beplande einde" },
    { en: "Area", af: "Gebied" },
    { en: "Task description", af: "Taakbeskrywing" },
    { en: "Save changes", af: "Stoor veranderinge" },
    { en: "Close", af: "Sluit" },
    { en: "Loading...", af: "Laai..." },
    { en: "Loading Logistics...", af: "Logistiek laai..." },
    { en: "Back to NKRN", af: "Terug na NKRN" },
    // NKRN RELEASE FINAL EXACT COPY
    { en: "Submit one short request. NKRN keeps the details, venue information and progress in one place.", af: "Dien een kort versoek in. NKRN hou die besonderhede, lokaal-inligting en vordering op een plek." },
    { en: "Request support", af: "Versoek ondersteuning" },
    { en: "Event / Activity", af: "Funksie / Aktiwiteit" },
    { en: "Event support", af: "Funksieondersteuning" },
    { en: "Venues, tables, chairs, gazebos and other setup.", af: "Lokale, tafels, stoele, gazebo\u2019s en ander opstelling." },
    { en: "Maintenance", af: "Instandhouding" },
    { en: "Report a problem", af: "Meld \u2019n probleem aan" },
    { en: "Repair, replacement, furniture or facility issues.", af: "Herstel, vervanging, meubels of fasiliteitsprobleme." },
    { en: "General", af: "Algemeen" },
    { en: "Other support", af: "Ander ondersteuning" },
    { en: "Any other operational support.", af: "Enige ander bedryfsondersteuning." },
    { en: "See all", af: "Sien alles" },
    { en: "No upcoming venue bookings.", af: "Geen komende lokaalbesprekings nie." },
    { en: "You have no active Logistics requests.", af: "Jy het geen aktiewe Logistics-versoeke nie." },
    { en: "Logistics: requests and feedback", af: "Logistiek: Versoeke en terugvoer" },
    { en: "How can the Logistics team help you?", af: "Waarmee kan die Logistics-span jou help?" },
    { en: "New request", af: "Nuwe versoek" },
    { en: "My Requests", af: "My versoeke" },
    { en: "Active requests", af: "Aktiewe versoeke" },
    { en: "Facilities", af: "Fasiliteite" },
    { en: "Upcoming venue bookings", af: "Komende lokaalbesprekings" },
    { en: "Request history", af: "Versoekgeskiedenis" },
    { en: "Venue bookings", af: "Lokaalbesprekings" },
    { en: "School map", af: "Skoolkaart" },
    { en: "Overview", af: "Oorsig" },
    { en: "Staff portal", af: "Personeelportaal" },
    { en: "Log out", af: "Meld af" },
    { en: "Cancel request", af: "Kanselleer versoek" },
    { en: "Venue availability", af: "Lokaalbeskikbaarheid" },
    { en: "Upcoming bookings", af: "Komende besprekings" },
    { en: "Locations and venues", af: "Ligging en lokale" },
    { en: "Selected location", af: "Gekose ligging" },
    { en: "Bookable venue", af: "Bespreekbare lokaal" },
    { en: "School location", af: "Skoolligging" },
    { en: "New Logistics request", af: "Nuwe Logistics-versoek" },
    { en: "How can we help?", af: "Hoe kan ons help?" },
    { en: "Request type", af: "Soort versoek" },
    { en: "Details", af: "Besonderhede" },
    { en: "How can Logistics help?", af: "Waarmee kan Logistics help?" },
    { en: "Venue, time and equipment", af: "Lokaal, tyd en toerusting" },
    { en: "Something needs to be repaired or replaced", af: "Iets moet herstel of vervang word" },
    { en: "Any other logistics support", af: "Enige ander logistieke ondersteuning" },
    { en: "Event or activity details", af: "Funksie- of aktiwiteitsbesonderhede" },
    { en: "What needs attention?", af: "Wat benodig aandag?" },
    { en: "What do you need?", af: "Wat benodig jy?" },
    { en: "Activity category", af: "Aktiwiteitskategorie" },
    { en: "What are you arranging and what should Logistics know?", af: "Wat re\u00ebl jy en wat moet Logistics weet?" },
    { en: "What is wrong or what needs to be done?", af: "Wat is fout of wat moet gedoen word?" },
    { en: "Briefly describe what you need.", af: "Beskryf kortliks wat jy benodig." },
    { en: "Venue / location", af: "Lokaal / ligging" },
    { en: "Select a location...", af: "Kies \u2019n ligging\u2026" },
    { en: "Or type a classroom / area not listed above", af: "Of tik \u2019n klaskamer / gebied wat nie op die lys is nie" },
    { en: "Start time", af: "Begintyd" },
    { en: "End time", af: "Eindtyd" },
    { en: "Cleanup is required the next morning", af: "Opruiming word die volgende oggend benodig" },
    { en: "Required equipment", af: "Benodigde toerusting" },
    { en: "Select an item...", af: "Kies \u2019n item\u2026" },
    { en: "What should happen?", af: "Wat moet gebeur?" },
    { en: "Review request", af: "Kontroleer versoek" },
    { en: "Review your request", af: "Kontroleer jou versoek" },
    { en: "Cleanup next morning:", af: "Opruiming volgende oggend:" },
    { en: "Equipment:", af: "Toerusting:" },
    { en: "Attention:", af: "Aandag:" },
    { en: "Not selected", af: "Nie gekies nie" },
    { en: "Submitted by", af: "Ingedien deur" },
    { en: "Submit Logistics request", af: "Dien Logistics-versoek in" },
    { en: "Staff Requests", af: "Personeelversoeke" },
    { en: "Logistics Request Inbox", af: "Logistiekversoek-inkassie" },
    { en: "Open requests", af: "Oop versoeke" },
    { en: "All requests", af: "Alle versoeke" },
    { en: "Refresh Requests", af: "Verfris versoeke" },
    { en: "Manager notes", af: "Bestuursnotas" },
    { en: "Optional review notes", af: "Opsionele hersieningsnotas" },
    { en: "Assign work", af: "Ken werk toe" },
    { en: "Optional work assignment", af: "Opsionele werktoewysing" },
    { en: "Work plan", af: "Werkplan" },
    { en: "Job cards", af: "Werkskaarte" },
    { en: "Workers", af: "Werkers" },
    { en: "Tasks", af: "Take" },
    { en: "Daily work plan", af: "Daaglikse werkplan" },
    { en: "Generate job card", af: "Genereer werkkaart" },
    { en: "Send job card", af: "Stuur werkkaart" },
    { en: "Job card history", af: "Werkkaartgeskiedenis" },
    { en: "Worker management", af: "Werkerbestuur" },
    { en: "Add worker", af: "Voeg werker by" },
    { en: "Edit worker", af: "Wysig werker" },
    { en: "Save worker", af: "Stoor werker" },
    { en: "Search tasks...", af: "Soek take..." },
    { en: "Department", af: "Departement" },
    { en: "Responsible", af: "Verantwoordelik" },
    { en: "Due date", af: "Sperdatum" },
    { en: "Next action", af: "Volgende aksie" },
    { en: "Materials required", af: "Benodigde materiaal" },
    { en: "Manager note", af: "Bestuursnota" },
    { en: "Include on job card", af: "Sluit op werkkaart in" },
    { en: "Planned start", af: "Beplande begin" },
    { en: "Planned end", af: "Beplande einde" },
    { en: "Area", af: "Gebied" },
    { en: "Task description", af: "Taakbeskrywing" },
    { en: "Administrator", af: "Administrateur" },
    { en: "IT Control Centre", af: "IT-beheersentrum" },
    { en: "User management", af: "Gebruikersbestuur" },
    { en: "Users", af: "Gebruikers" },
    { en: "Add user", af: "Voeg gebruiker by" },
    { en: "New user", af: "Nuwe gebruiker" },
    { en: "Cancel new user", af: "Kanselleer nuwe gebruiker" },
    { en: "First name", af: "Voornaam" },
    { en: "Last name", af: "Van" },
    { en: "Email address", af: "E-posadres" },
    { en: "Role", af: "Rol" },
    { en: "Staff member", af: "Personeellid" },
    { en: "Technician", af: "Tegnikus" },
    { en: "Technicians", af: "Tegnici" },
    { en: "Administrators", af: "Administrateurs" },
    { en: "Edit user", af: "Wysig gebruiker" },
    { en: "Save user", af: "Stoor gebruiker" },
    { en: "Deactivate user", af: "Deaktiveer gebruiker" },
    { en: "All IT requests", af: "Alle IT-versoeke" },
    { en: "Show completed", af: "Wys afgehandel" },
    { en: "Hide completed", af: "Versteek afgehandel" },
    { en: "Export all IT requests", af: "Voer alle IT-versoeke uit" },
    { en: "Assigned to", af: "Toegeken aan" },
    { en: "Submitted for", af: "Ingedien vir" },
    { en: "Created by", af: "Geskep deur" },
    { en: "Category", af: "Kategorie" },
    { en: "Comments", af: "Kommentaar" },
    { en: "Add comment", af: "Voeg kommentaar by" },
    { en: "Type your comment", af: "Tik jou kommentaar" },
    { en: "Schedule", af: "Skedule" },
    { en: "Scheduled start", af: "Beplande begin" },
    { en: "Scheduled end", af: "Beplande einde" },
    { en: "Not scheduled yet", af: "Nog nie beplan nie" },
    { en: "Invalid date", af: "Ongeldige datum" },
    { en: "There are no requests to export.", af: "Daar is geen versoeke om uit te voer nie." },
    { en: "First name, last name and email address are required.", af: "Voornaam, van en e-posadres is verpligtend." },
    { en: "Only @tygies.co.za email addresses are allowed.", af: "Slegs @tygies.co.za-e-posadresse word toegelaat." },
    { en: "Invalid user role.", af: "Ongeldige gebruikersrol." },
    { en: "You cannot deactivate your own account.", af: "Jy kan nie jou eie rekening deaktiveer nie." },
    { en: "Enter your comment first.", af: "Tik eers jou kommentaar in." },
    { en: "All IT requests have been exported.", af: "Alle IT-versoeke is uitgevoer." },
    { en: "IT information could not be loaded.", af: "Die IT-inligting kon nie gelaai word nie." },
    { en: "The requests could not be loaded.", af: "Die versoeke kon nie gelaai word nie." },
    { en: "The user could not be added.", af: "Die gebruiker kon nie bygevoeg word nie." },
    { en: "The user could not be deactivated.", af: "Die gebruiker kon nie gedeaktiveer word nie." },
    { en: "The comment could not be added.", af: "Die kommentaar kon nie bygevoeg word nie." },
    { en: "Laerskool Tygerpoort \u00b7 IT Report \u00b7 Administrator", af: "Laerskool Tygerpoort \u00b7 IT Report \u00b7 Administrateur" },
    { en: "Technician Portal", af: "Tegnikusportaal" },
    { en: "Technician dashboard", af: "Tegnikusportaal" },
    { en: "The technician portal could not be loaded.", af: "Die tegnikusportaal kon nie gelaai word nie." },
    { en: "Search requests...", af: "Soek versoeke..." },
    { en: "All statuses", af: "Alle statusse" },
    { en: "All priorities", af: "Alle prioriteite" },
    { en: "Request details", af: "Versoekbesonderhede" },
    { en: "Save request", af: "Stoor versoek" },
    { en: "Saving...", af: "Besig om te stoor..." },
    { en: "Comment", af: "Kommentaar" },
    { en: "Add Comment", af: "Voeg kommentaar by" },
    { en: "Loading comments...", af: "Kommentaar laai..." },
    { en: "No comments yet.", af: "Nog geen kommentaar nie." },
    { en: "Unknown", af: "Onbekend" },
    { en: "Unassigned", af: "Nie toegeken nie" },
    { en: "The request could not be updated. Please try again.", af: "Die versoek kon nie opgedateer word nie. Probeer asseblief weer." },
    { en: "The comment could not be added.", af: "Die kommentaar kon nie bygevoeg word nie." },
    { en: "AI Help", af: "AI Hulp" },
    { en: "AI assistant", af: "AI-assistent" },
    { en: "Describe the problem", af: "Beskryf die probleem" },
    { en: "Describe your IT problem", af: "Beskryf jou IT-probleem" },
    { en: "Tell AI what is happening", af: "Vertel vir AI wat gebeur" },
    { en: "What is happening?", af: "Wat gebeur?" },
    { en: "Ask AI", af: "Vra AI" },
    { en: "Get AI help", af: "Kry AI-hulp" },
    { en: "Analyse", af: "Ontleed" },
    { en: "Analyze", af: "Ontleed" },
    { en: "Analysing...", af: "Besig om te ontleed..." },
    { en: "Analyzing...", af: "Besig om te ontleed..." },
    { en: "Thinking...", af: "Dink..." },
    { en: "Suggested fix", af: "Voorgestelde oplossing" },
    { en: "Suggested category", af: "Voorgestelde kategorie" },
    { en: "Suggested priority", af: "Voorgestelde prioriteit" },
    { en: "Suggested technician", af: "Voorgestelde tegnikus" },
    { en: "AI recommendation", af: "AI-aanbeveling" },
    { en: "Try this first", af: "Probeer dit eers" },
    { en: "Create request", af: "Skep versoek" },
    { en: "Use suggestion", af: "Gebruik voorstel" },
    { en: "Clear", af: "Maak skoon" },
    { en: "Start again", af: "Begin weer" },
    { en: "AI Help is unavailable right now.", af: "AI Hulp is tans nie beskikbaar nie." },
    { en: "Unable to get AI help.", af: "Kon nie AI-hulp kry nie." },
    { en: "You can still submit the request manually.", af: "Jy kan steeds die versoek handmatig indien." },
    { en: "AI suggestions are advisory. You remain in control of the request.", af: "AI-voorstelle is adviserend. Jy bly in beheer van die versoek." },
];

function normalizeKey(value: string): string {
    return value
        .replace(/[’‘]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/…/g, "...")
        .replace(/[\u2012\u2013\u2014]/g, "-")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase("en-ZA");
}

const englishToAfrikaans = new Map<string, string>();
const afrikaansToEnglish = new Map<string, string>();
const allTranslationEntries = [...translations, ...itTranslations];

for (const entry of allTranslationEntries) {
    englishToAfrikaans.set(normalizeKey(entry.en), entry.af);
    afrikaansToEnglish.set(normalizeKey(entry.af), entry.en);
}

/** Translate one complete UI text value while retaining its surrounding whitespace.
 *
 * NKRN deliberately uses exact-string translation rather than automatic word or
 * phrase substitution. Translating fragments inside arbitrary sentences can
 * produce grammatically incorrect Afrikaans/English and makes the interface feel
 * machine-translated.
 *
 * Dynamic UI sentences should be authored as complete language-specific templates
 * at the component level.
 */
function translateDynamicText(value: string, language: Language): string {
    const leading = value.match(/^\s*/)?.[0] ?? "";
    const trailing = value.match(/\s*$/)?.[0] ?? "";
    const core = value.trim();

    if (!core) return value;

    const apply = (translated: string) => `${leading}${translated}${trailing}`;

    if (language === "en") {
        let match = core.match(/^Versoek #(\d+) is suksesvol ingedien\.$/i);
        if (match) return apply(`Request #${match[1]} was submitted successfully.`);

        match = core.match(/^(\d+) item gekies\.$/i);
        if (match) return apply(`${match[1]} item selected.`);

        match = core.match(/^(\d+) items gekies\.$/i);
        if (match) return apply(`${match[1]} items selected.`);

        match = core.match(/^(\d+) beskikbaar$/i);
        if (match) return apply(`${match[1]} available`);

        match = core.match(/^(\d+) benodig$/i);
        if (match) return apply(`${match[1]} needed`);

        match = core.match(/^(\d+) benodig ·$/i);
        if (match) return apply(`${match[1]} needed ·`);

        match = core.match(/^·\s*(\d+) aangeteken$/i);
        if (match) return apply(`· ${match[1]} recorded`);

        match = core.match(/^(\d+) aangeteken$/i);
        if (match) return apply(`${match[1]} recorded`);

        match = core.match(/^(\d+) persone$/i);
        if (match) return apply(`${match[1]} people`);
    } else {
        let match = core.match(/^Request #(\d+) was submitted successfully\.$/i);
        if (match) return apply(`Versoek #${match[1]} is suksesvol ingedien.`);

        match = core.match(/^(\d+) item selected\.$/i);
        if (match) return apply(`${match[1]} item gekies.`);

        match = core.match(/^(\d+) items selected\.$/i);
        if (match) return apply(`${match[1]} items gekies.`);

        match = core.match(/^(\d+) available$/i);
        if (match) return apply(`${match[1]} beskikbaar`);

        match = core.match(/^(\d+) needed$/i);
        if (match) return apply(`${match[1]} benodig`);

        match = core.match(/^(\d+) needed ·$/i);
        if (match) return apply(`${match[1]} benodig ·`);

        match = core.match(/^·\s*(\d+) recorded$/i);
        if (match) return apply(`· ${match[1]} aangeteken`);

        match = core.match(/^(\d+) recorded$/i);
        if (match) return apply(`${match[1]} aangeteken`);

        match = core.match(/^(\d+) people$/i);
        if (match) return apply(`${match[1]} persone`);
    }

    return value;
}
function escapeKnownPhrase(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function knownPhrasePattern(value: string): RegExp {
    const source = normalizeKey(value);
    let pattern = "";

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];

        if (/\s/.test(character)) {
            pattern += "\\s+";

            while (
                index + 1 < source.length &&
                /\s/.test(source[index + 1])
            ) {
                index += 1;
            }

            continue;
        }

        if (character === "'") {
            pattern += "[\u2019\u2018']";
            continue;
        }

        if (character === '"') {
            pattern += '[\u201c\u201d"]';
            continue;
        }

        if (
            character === "." &&
            source.slice(index, index + 3) === "..."
        ) {
            pattern += "(?:\\.\\.\\.|\\u2026)";
            index += 2;
            continue;
        }

        if (character === "-") {
            pattern += "[-\\u2012\\u2013\\u2014]";
            continue;
        }

        pattern += escapeKnownPhrase(character);
    }

    return new RegExp(
        `(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`,
        "giu"
    );
}

type KnownPhrase = {
    pattern: RegExp;
    target: string;
};

function compileKnownPhrases(
    sourceLanguage: Language
): KnownPhrase[] {
    const entries =
        sourceLanguage === "en"
            ? allTranslationEntries.map((entry) => ({
                  source: entry.en,
                  target: entry.af,
              }))
            : allTranslationEntries.map((entry) => ({
                  source: entry.af,
                  target: entry.en,
              }));

    const seen = new Set<string>();

    return entries
        .filter(({ source, target }) => {
            const normalized = normalizeKey(source);
            if (!normalized) return false;
            if (normalized === normalizeKey(target)) return false;

            const words = normalized
                .split(/\s+/)
                .filter(Boolean);

            const safeSingleWord =
                words.length === 1 &&
                normalized.length >= 4;

            const safePhrase =
                words.length >= 2;

            if (!safeSingleWord && !safePhrase) {
                return false;
            }

            const key = `${normalized}\u0000${target}`;

            if (seen.has(key)) {
                return false;
            }

            seen.add(key);
            return true;
        })
        .sort(
            (left, right) =>
                normalizeKey(right.source).length -
                normalizeKey(left.source).length
        )
        .map(({ source, target }) => ({
            pattern: knownPhrasePattern(source),
            target,
        }));
}

const knownEnglishToAfrikaans =
    compileKnownPhrases("en");

const knownAfrikaansToEnglish =
    compileKnownPhrases("af");

function translateKnownPhrases(
    value: string,
    language: Language
): string {
    void language;
    return value;
}
void knownEnglishToAfrikaans;
void knownAfrikaansToEnglish;
void translateKnownPhrases;

// NKRN PLATFORM FINAL I18N BEGIN
const platformFinalTranslations = [
    { en: "Home", af: "Tuis" },
    { en: "Back", af: "Terug" },
    { en: "Close", af: "Sluit" },
    { en: "Cancel", af: "Kanselleer" },
    { en: "Save", af: "Stoor" },
    { en: "Save changes", af: "Stoor veranderinge" },
    { en: "Edit", af: "Wysig" },
    { en: "Delete", af: "Verwyder" },
    { en: "Deactivate", af: "Deaktiveer" },
    { en: "Refresh", af: "Verfris" },
    { en: "Continue", af: "Gaan voort" },
    { en: "Confirm", af: "Bevestig" },
    { en: "Review", af: "Hersien" },
    { en: "Submit", af: "Dien in" },
    { en: "Search", af: "Soek" },
    { en: "Show", af: "Wys" },
    { en: "Hide", af: "Versteek" },
    { en: "All", af: "Alles" },
    { en: "None", af: "Geen" },
    { en: "Optional", af: "Opsioneel" },
    { en: "Required", af: "Verpligtend" },
    { en: "Yes", af: "Ja" },
    { en: "No", af: "Nee" },
    { en: "Loading...", af: "Laai..." },
    { en: "Loading\u2026", af: "Laai\u2026" },
    { en: "Saving...", af: "Besig om te stoor..." },
    { en: "Saving\u2026", af: "Besig om te stoor\u2026" },
    { en: "Submitting...", af: "Besig om in te dien..." },
    { en: "Submitting\u2026", af: "Besig om in te dien\u2026" },
    { en: "Log out", af: "Meld af" },
    { en: "Signed in", af: "Aangemeld" },
    { en: "English", af: "Engels" },
    { en: "Afrikaans", af: "Afrikaans" },
    { en: "Language", af: "Taal" },
    { en: "Name", af: "Naam" },
    { en: "First name", af: "Voornaam" },
    { en: "Last name", af: "Van" },
    { en: "Email", af: "E-pos" },
    { en: "Email address", af: "E-posadres" },
    { en: "Role", af: "Rol" },
    { en: "Actions", af: "Aksies" },
    { en: "Status", af: "Status" },
    { en: "Priority", af: "Prioriteit" },
    { en: "Category", af: "Kategorie" },
    { en: "Date", af: "Datum" },
    { en: "Time", af: "Tyd" },
    { en: "Description", af: "Beskrywing" },
    { en: "Title", af: "Titel" },
    { en: "Comments", af: "Kommentaar" },
    { en: "Comment", af: "Kommentaar" },
    { en: "User", af: "Gebruiker" },
    { en: "Users", af: "Gebruikers" },
    { en: "Unknown", af: "Onbekend" },
    { en: "Unassigned", af: "Nie toegeken nie" },
    { en: "Logged", af: "Aangemeld" },
    { en: "Busy", af: "Besig" },
    { en: "Done", af: "Afgehandel" },
    { en: "Completed", af: "Afgehandel" },
    { en: "Low", af: "Laag" },
    { en: "Medium", af: "Medium" },
    { en: "High", af: "Hoog" },
    { en: "Critical", af: "Kritiek" },
    { en: "Pending", af: "Hangende" },
    { en: "Open", af: "Oop" },
    { en: "Request", af: "Versoek" },
    { en: "Requests", af: "Versoeke" },
    { en: "requests", af: "versoeke" },
    { en: "Technician", af: "Tegnikus" },
    { en: "Technicians", af: "Tegnici" },
    { en: "technicians", af: "tegnici" },
    { en: "Administrator", af: "Administrateur" },
    { en: "Administrators", af: "Administrateurs" },
    { en: "administrators", af: "administrateurs" },
    { en: "Staff member", af: "Personeellid" },
    { en: "Staff", af: "Personeel" },
    { en: "Showing", af: "Wys" },
    { en: "of", af: "van" },
    { en: "total users", af: "totale gebruikers" },
    { en: "request", af: "versoek" },
    { en: "comment", af: "kommentaar" },
    { en: "comments", af: "kommentaar" },
    { en: "Request #", af: "Versoek #" },
    { en: "User #", af: "Gebruiker #" },
    { en: "Your school. Your workspace.", af: "Jou skool. Jou werksruimte." },
    { en: "Every day's work, in one place.", af: "Elke dag se werk, op een plek." },
    { en: "Choose a module to get started.", af: "Kies \u2019n module om aan die gang te kom." },
    { en: "3 active modules \u00b7 2 future modules", af: "3 aktiewe modules \u00b7 2 toekomstige modules" },
    { en: "Active modules", af: "Aktiewe modules" },
    { en: "Future modules", af: "Toekomstige modules" },
    { en: "In operation", af: "In werking" },
    { en: "Coming soon", af: "Binnekort" },
    { en: "Open module", af: "Maak oop" },
    { en: "Support", af: "Ondersteuning" },
    { en: "School operations", af: "Skoolbedryf" },
    { en: "Future module", af: "Toekomstige module" },
    { en: "Event Support", af: "Funksieversorging" },
    { en: "Transport", af: "Vervoer" },
    { en: "Curriculum", af: "Kurrikulum" },
    { en: "Technical support requests and request tracking.", af: "Meld tegniese probleme aan en volg jou ondersteuningsversoeke." },
    { en: "Requests, activities, maintenance, venues and the daily work plan.", af: "Versoeke, aktiwiteite, instandhouding, lokale en die daaglikse werkplan." },
    { en: "Prepare events: catering, table setup and supplies.", af: "Berei funksies voor: versorging, tafeldekking en benodigdhede." },
    { en: "Transport and travel planning.", af: "Vervoer en reisbeplanning." },
    { en: "Curriculum and teaching planning.", af: "Kurrikulum en onderrigbeplanning." },
    { en: "Workspace loading...", af: "Werksruimte laai..." },
    { en: "Workspace loading\u2026", af: "Werksruimte laai\u2026" },
    { en: "School operations platform", af: "Skoolbedryfsplatform" },
    { en: "Welcome to NKRN", af: "Welkom by NKRN" },
    { en: "Sign in", af: "Meld aan" },
    { en: "Continue to NKRN", af: "Gaan voort na NKRN" },
    { en: "Staff email", af: "Personeel-e-pos" },
    { en: "Enter your email address", af: "Voer jou e-posadres in" },
    { en: "Use your @tygies.co.za email address.", af: "Gebruik jou @tygies.co.za-e-posadres." },
    { en: "Signing in...", af: "Besig om aan te meld..." },
    { en: "Signing in\u2026", af: "Besig om aan te meld\u2026" },
    { en: "Unable to sign in.", af: "Kon nie aanmeld nie." },
    { en: "IT Request", af: "IT-versoek" },
    { en: "IT requests", af: "IT-versoeke" },
    { en: "IT Requests", af: "IT-versoeke" },
    { en: "IT support", af: "IT-ondersteuning" },
    { en: "Technician portal", af: "Tegnikusportaal" },
    { en: "Administration", af: "Administrasie" },
    { en: "My requests", af: "My versoeke" },
    { en: "Submit a technical support request.", af: "Dien \u2019n tegniese ondersteuningsversoek in." },
    { en: "Your account is loading...", af: "Jou rekening laai\u2026" },
    { en: "Your account is loading\u2026", af: "Jou rekening laai\u2026" },
    { en: "Your requests could not be loaded.", af: "Jou versoeke kon nie gelaai word nie." },
    { en: "The request categories could not be loaded.", af: "Die versoekkategorie\u00eb kon nie gelaai word nie." },
    { en: "Choose a category before submitting the request.", af: "Kies \u2019n kategorie voordat jy die versoek indien." },
    { en: "Please select an active requester.", af: "Kies asseblief \u2019n aktiewe versoeker." },
    { en: "Request submitted successfully.", af: "Versoek suksesvol ingedien." },
    { en: "Request submitted for", af: "Versoek ingedien vir" },
    { en: "Only admins may log requests for another person.", af: "Slegs administrateurs mag versoeke namens \u2019n ander persoon aanmeld." },
    { en: "Check the request details and select an active requester with a valid email address.", af: "Kontroleer die versoekbesonderhede en kies \u2019n aktiewe versoeker met \u2019n geldige e-posadres." },
    { en: "Something went wrong submitting your request.", af: "Iets het verkeerd geloop met die indiening van jou versoek." },
    { en: "Awaiting IT support", af: "Wag op IT-ondersteuning" },
    { en: "Pending IT Desk", af: "Wag op IT-ondersteuning" },
    { en: "Requester", af: "Versoeker" },
    { en: "Logged by", af: "Aangemeld deur" },
    { en: "Submitted for", af: "Ingedien vir" },
    { en: "Created by", af: "Geskep deur" },
    { en: "Submitted", af: "Ingedien" },
    { en: "Submitted on", af: "Aangemeld op" },
    { en: "Assigned to", af: "Toegewys aan" },
    { en: "No category", af: "Geen kategorie" },
    { en: "No active requests.", af: "Geen aktiewe versoeke nie." },
    { en: "Show completed requests", af: "Wys afgehandelde versoeke" },
    { en: "Hide completed requests", af: "Versteek afgehandelde versoeke" },
    { en: "Administration portal is loading...", af: "Administrasieportaal laai\u2026" },
    { en: "Administration portal is loading\u2026", af: "Administrasieportaal laai\u2026" },
    { en: "IT Control Centre", af: "IT-beheersentrum" },
    { en: "Awaiting attention", af: "Wag op aandag" },
    { en: "Currently being handled", af: "Word tans hanteer" },
    { en: "Completed requests", af: "Afgehandelde versoeke" },
    { en: "High-priority requests", af: "Ho\u00ebprioriteitsversoeke" },
    { en: "Scheduled", af: "Beplan" },
    { en: "Calendar appointments", af: "Kalenderafsprake" },
    { en: "System overview", af: "Stelseloorsig" },
    { en: "Add user", af: "Voeg gebruiker by" },
    { en: "+ Add user", af: "+ Voeg gebruiker by" },
    { en: "Cancel new user", af: "Kanselleer nuwe gebruiker" },
    { en: "Show users", af: "Wys gebruikers" },
    { en: "Hide users", af: "Versteek gebruikers" },
    { en: "User administration", af: "Gebruikersadministrasie" },
    { en: "Add NKRN user", af: "Voeg NKRN-gebruiker by" },
    { en: "Create a new active NKRN account using the staff member's @tygies.co.za email address.", af: "Skep \u2019n nuwe aktiewe NKRN-rekening met die personeellid se @tygies.co.za-e-posadres." },
    { en: "Create user", af: "Skep gebruiker" },
    { en: "Creating user...", af: "Gebruiker word geskep\u2026" },
    { en: "Creating user\u2026", af: "Gebruiker word geskep\u2026" },
    { en: "Save user", af: "Stoor gebruiker" },
    { en: "Edit user", af: "Wysig gebruiker" },
    { en: "Deactivate user", af: "Deaktiveer gebruiker" },
    { en: "Deactivating...", af: "Besig om te deaktiveer\u2026" },
    { en: "Deactivating\u2026", af: "Besig om te deaktiveer\u2026" },
    { en: "Export CSV", af: "Voer CSV uit" },
    { en: "Export all IT requests", af: "Voer alle IT-versoeke uit" },
    { en: "All IT requests have been exported.", af: "Alle IT-versoeke is uitgevoer." },
    { en: "There are no requests to export.", af: "Daar is geen versoeke om uit te voer nie." },
    { en: "First name, last name and email address are required.", af: "Voornaam, van en e-posadres is verpligtend." },
    { en: "Only @tygies.co.za email addresses are allowed.", af: "Slegs @tygies.co.za-e-posadresse word toegelaat." },
    { en: "Invalid user role.", af: "Ongeldige gebruikersrol." },
    { en: "You do not have permission to add users.", af: "Jy het nie toestemming om gebruikers by te voeg nie." },
    { en: "You do not have permission to manage users.", af: "Jy het nie toestemming om gebruikers te bestuur nie." },
    { en: "You do not have permission to deactivate users.", af: "Jy het nie toestemming om gebruikers te deaktiveer nie." },
    { en: "A user with this email address already exists.", af: "Daar is reeds \u2019n gebruiker met hierdie e-posadres." },
    { en: "The user could not be added.", af: "Die gebruiker kon nie bygevoeg word nie." },
    { en: "The user could not be updated.", af: "Die gebruiker kon nie opgedateer word nie." },
    { en: "The user could not be deactivated.", af: "Die gebruiker kon nie gedeaktiveer word nie." },
    { en: "You cannot deactivate your own account.", af: "Jy kan nie jou eie rekening deaktiveer nie." },
    { en: "Do you want to deactivate this account?", af: "Wil jy hierdie rekening deaktiveer?" },
    { en: "The user will no longer be able to sign in.", af: "Die gebruiker sal nie meer kan aanmeld nie." },
    { en: "The IT information could not be loaded.", af: "Die IT-inligting kon nie gelaai word nie." },
    { en: "The requests could not be loaded.", af: "Die versoeke kon nie gelaai word nie." },
    { en: "Manage request", af: "Bestuur versoek" },
    { en: "Assign to", af: "Ken toe aan" },
    { en: "Scheduled start", af: "Beplande begintyd" },
    { en: "Scheduled end", af: "Beplande eindtyd" },
    { en: "Not scheduled yet", af: "Nog nie beplan nie" },
    { en: "Invalid date", af: "Ongeldige datum" },
    { en: "No appointment scheduled", af: "Geen afspraak beplan nie" },
    { en: "Calendar appointment linked", af: "Kalenderafspraak gekoppel" },
    { en: "Google Calendar appointment linked", af: "Google Calendar-afspraak gekoppel" },
    { en: "The planned end time must be after the start time.", af: "Die beplande eindtyd moet n\u00e1 die begintyd wees." },
    { en: "You do not have permission to update this request.", af: "Jy het nie toestemming om hierdie versoek op te dateer nie." },
    { en: "The request could not be updated.", af: "Die versoek kon nie opgedateer word nie." },
    { en: "The request could not be updated. Please try again.", af: "Die versoek kon nie opgedateer word nie. Probeer asseblief weer." },
    { en: "Communication", af: "Kommunikasie" },
    { en: "Comments and progress", af: "Kommentaar en vordering" },
    { en: "There are no comments on this request yet.", af: "Daar is nog geen kommentaar op hierdie versoek nie." },
    { en: "Add a progress note", af: "Voeg \u2019n vorderingsnota by" },
    { en: "Add a progress note...", af: "Voeg \u2019n vorderingsnota by\u2026" },
    { en: "Add a progress note\u2026", af: "Voeg \u2019n vorderingsnota by\u2026" },
    { en: "Adding...", af: "Besig om by te voeg\u2026" },
    { en: "Adding\u2026", af: "Besig om by te voeg\u2026" },
    { en: "Add comment", af: "Voeg kommentaar by" },
    { en: "Enter your comment first.", af: "Tik eers jou kommentaar in." },
    { en: "The comment could not be added.", af: "Die kommentaar kon nie bygevoeg word nie." },
    { en: "Laerskool Tygerpoort \u00b7 IT Report \u00b7 Administrator", af: "Laerskool Tygerpoort \u00b7 IT Report \u00b7 Administrateur" },
    { en: "requests \u00b7", af: "versoeke \u00b7" },
    { en: "technicians \u00b7", af: "tegnici \u00b7" },
    { en: "administrators \u00b7", af: "administrateurs \u00b7" },
    { en: "Technician Portal", af: "Tegnikusportaal" },
    { en: "Technician dashboard", af: "Tegnikusportaal" },
    { en: "The technician portal could not be loaded.", af: "Die tegnikusportaal kon nie gelaai word nie." },
    { en: "Search requests...", af: "Soek versoeke..." },
    { en: "Search requests\u2026", af: "Soek versoeke\u2026" },
    { en: "All statuses", af: "Alle statusse" },
    { en: "All priorities", af: "Alle prioriteite" },
    { en: "Request details", af: "Versoekbesonderhede" },
    { en: "Save request", af: "Stoor versoek" },
    { en: "Loading comments...", af: "Kommentaar laai..." },
    { en: "Loading comments\u2026", af: "Kommentaar laai\u2026" },
    { en: "No comments yet.", af: "Nog geen kommentaar nie." },
    { en: "The comment could not be added.", af: "Die kommentaar kon nie bygevoeg word nie." },
    { en: "Total requests", af: "Totale versoeke" },
    { en: "Logged requests", af: "Aangemelde versoeke" },
    { en: "Busy requests", af: "Besige versoeke" },
    { en: "Completed requests", af: "Afgehandelde versoeke" },
    { en: "Select a request to view details.", af: "Kies \u2019n versoek om besonderhede te sien." },
    { en: "No requests match the current filters.", af: "Geen versoeke pas by die huidige filters nie." },
    { en: "Logistics", af: "Logistiek" },
    { en: "Staff portal", af: "Personeelportaal" },
    { en: "Your Logistics portal is loading...", af: "Jou Logistics-portaal laai\u2026" },
    { en: "Your Logistics portal is loading\u2026", af: "Jou Logistics-portaal laai\u2026" },
    { en: "Logistics: requests and feedback", af: "Logistiek: Versoeke en terugvoer" },
    { en: "How can the Logistics team help you?", af: "Waarmee kan die Logistics-span jou help?" },
    { en: "What can the Logistics team help you with?", af: "Waarmee kan die Logistics-span jou help?" },
    { en: "Submit one short request. NKRN keeps the details, venue information and progress in one place.", af: "Dien een kort versoek in. NKRN hou die besonderhede, lokaal-inligting en vordering op een plek." },
    { en: "Submit one short request and NKRN will keep the request, venue information and progress together.", af: "Dien een kort versoek in. NKRN hou die versoek, lokaal-inligting en vordering bymekaar." },
    { en: "New request", af: "Nuwe versoek" },
    { en: "+ New request", af: "+ Nuwe versoek" },
    { en: "Request support", af: "Versoek ondersteuning" },
    { en: "+ Request support", af: "+ Versoek ondersteuning" },
    { en: "Event / Activity", af: "Funksie / Aktiwiteit" },
    { en: "Event support", af: "Funksieondersteuning" },
    { en: "Venues, tables, chairs, gazebos and other setup.", af: "Lokale, tafels, stoele, gazebo\u2019s en ander opstelling." },
    { en: "Maintenance", af: "Instandhouding" },
    { en: "Report a problem", af: "Meld \u2019n probleem aan" },
    { en: "Repair, replacement, furniture or facility issues.", af: "Herstel, vervanging, meubels of fasiliteitsprobleme." },
    { en: "General", af: "Algemeen" },
    { en: "Other support", af: "Ander ondersteuning" },
    { en: "Any other operational support.", af: "Enige ander bedryfsondersteuning." },
    { en: "Active requests", af: "Aktiewe versoeke" },
    { en: "You have no active Logistics requests.", af: "Jy het geen aktiewe Logistics-versoeke nie." },
    { en: "Facilities", af: "Fasiliteite" },
    { en: "Upcoming venue bookings", af: "Komende lokaalbesprekings" },
    { en: "See all", af: "Sien alles" },
    { en: "No upcoming venue bookings.", af: "Geen komende lokaalbesprekings nie." },
    { en: "My Logistics requests", af: "My Logistics-versoeke" },
    { en: "Request history", af: "Versoekgeskiedenis" },
    { en: "Logistics team", af: "Logistics-span" },
    { en: "Cancel request", af: "Kanselleer versoek" },
    { en: "No Logistics requests have been submitted yet.", af: "Nog geen Logistics-versoeke ingedien nie." },
    { en: "Venue availability", af: "Lokaalbeskikbaarheid" },
    { en: "Upcoming bookings", af: "Komende besprekings" },
    { en: "No venue bookings recorded.", af: "Geen lokaalbesprekings aangeteken nie." },
    { en: "Locations and venues", af: "Ligging en lokale" },
    { en: "Locations & venues", af: "Ligging en lokale" },
    { en: "Bookable venue", af: "Bespreekbare lokaal" },
    { en: "School location", af: "Skoolligging" },
    { en: "Selected location", af: "Gekose ligging" },
    { en: "No upcoming bookings.", af: "Geen komende besprekings nie." },
    { en: "Request this venue", af: "Versoek hierdie lokaal" },
    { en: "Report an issue here", af: "Meld \u2019n probleem hier aan" },
    { en: "Choose a location on the left to see details.", af: "Kies \u2019n ligging links om besonderhede te sien." },
    { en: "New Logistics request", af: "Nuwe Logistics-versoek" },
    { en: "How can we help?", af: "Hoe kan ons help?" },
    { en: "Request steps", af: "Versoekstappe" },
    { en: "Request type", af: "Soort versoek" },
    { en: "Details", af: "Besonderhede" },
    { en: "How can Logistics help?", af: "Waarmee kan Logistics help?" },
    { en: "Venue, time and equipment", af: "Lokaal, tyd en toerusting" },
    { en: "Something needs to be repaired or replaced", af: "Iets moet herstel of vervang word" },
    { en: "Any other logistics support", af: "Enige ander logistieke ondersteuning" },
    { en: "Event or activity details", af: "Funksie- of aktiwiteitsbesonderhede" },
    { en: "What needs attention?", af: "Wat benodig aandag?" },
    { en: "What do you need?", af: "Wat benodig jy?" },
    { en: "Activity category", af: "Aktiwiteitskategorie" },
    { en: "What are you arranging and what should Logistics know?", af: "Wat re\u00ebl jy en wat moet Logistics weet?" },
    { en: "What is wrong or what needs to be done?", af: "Wat is fout of wat moet gedoen word?" },
    { en: "Briefly describe how Logistics can help.", af: "Beskryf kortliks waarmee Logistics kan help." },
    { en: "Briefly describe what you need.", af: "Beskryf kortliks wat jy benodig." },
    { en: "Venue / location", af: "Lokaal / ligging" },
    { en: "(if applicable)", af: "(indien van toepassing)" },
    { en: "Select a location...", af: "Kies \u2019n ligging\u2026" },
    { en: "Select a location\u2026", af: "Kies \u2019n ligging\u2026" },
    { en: "Or type a classroom / area not listed above", af: "Of tik \u2019n klaskamer / gebied wat nie op die lys is nie" },
    { en: "Start time", af: "Begintyd" },
    { en: "End time", af: "Eindtyd" },
    { en: "NKRN can check the venue against existing bookings.", af: "NKRN kan die lokaal teen bestaande besprekings kontroleer." },
    { en: "Checking...", af: "Besig om te kontroleer\u2026" },
    { en: "Checking\u2026", af: "Besig om te kontroleer\u2026" },
    { en: "Check", af: "Kontroleer" },
    { en: "Cleanup is required the next morning", af: "Opruiming word die volgende oggend benodig" },
    { en: "Required equipment", af: "Benodigde toerusting" },
    { en: "Select an item...", af: "Kies \u2019n item\u2026" },
    { en: "Select an item\u2026", af: "Kies \u2019n item\u2026" },
    { en: "What should happen?", af: "Wat moet gebeur?" },
    { en: "Repair", af: "Herstel" },
    { en: "Replace", af: "Vervang" },
    { en: "Unsure", af: "Onseker" },
    { en: "Review request", af: "Kontroleer versoek" },
    { en: "Review your request", af: "Kontroleer jou versoek" },
    { en: "Location:", af: "Ligging:" },
    { en: "Category:", af: "Kategorie:" },
    { en: "When:", af: "Wanneer:" },
    { en: "Cleanup next morning:", af: "Opruiming volgende oggend:" },
    { en: "Equipment:", af: "Toerusting:" },
    { en: "Attention:", af: "Aandag:" },
    { en: "Not selected", af: "Nie gekies nie" },
    { en: "Submitted by", af: "Ingedien deur" },
    { en: "Submit Logistics request", af: "Dien Logistics-versoek in" },
    { en: "Select a venue, date, start time and end time first.", af: "Kies eers \u2019n lokaal, datum, begintyd en eindtyd." },
    { en: "Venue availability could not be checked.", af: "Lokaalbeskikbaarheid kon nie nagegaan word nie." },
    { en: "The venue is available for this time.", af: "Die lokaal is beskikbaar vir hierdie tyd." },
    { en: "The venue is already booked for this time.", af: "Die lokaal is reeds vir hierdie tyd bespreek." },
    { en: "Enter the activity date, start and end time.", af: "Vul die aktiwiteitsdatum, begin- en eindtyd in." },
    { en: "The end time must be after the start time.", af: "Die eindtyd moet n\u00e1 die begintyd wees." },
    { en: "Select what needs attention.", af: "Kies wat aandag benodig." },
    { en: "The Logistics request could not be submitted.", af: "Die Logistics-versoek kon nie ingedien word nie." },
    { en: "Staff Requests", af: "Personeelversoeke" },
    { en: "Logistics Request Inbox", af: "Logistiekversoek-inkassie" },
    { en: "Review staff submissions before turning approved work into operational tasks.", af: "Hersien personeelindienings voordat goedgekeurde werk in operasionele take omskep word." },
    { en: "Open requests", af: "Oop versoeke" },
    { en: "All requests", af: "Alle versoeke" },
    { en: "Refresh Requests", af: "Verfris versoeke" },
    { en: "Manager notes", af: "Bestuursnotas" },
    { en: "Optional review notes", af: "Opsionele hersieningsnotas" },
    { en: "Assign work", af: "Ken werk toe" },
    { en: "Optional work assignment", af: "Opsionele werktoewysing" },
    { en: "Work plan", af: "Werkplan" },
    { en: "Job cards", af: "Werkskaarte" },
    { en: "Workers", af: "Werkers" },
    { en: "Tasks", af: "Take" },
    { en: "Daily work plan", af: "Daaglikse werkplan" },
    { en: "Generate job card", af: "Genereer werkkaart" },
    { en: "Send job card", af: "Stuur werkkaart" },
    { en: "Job card history", af: "Werkkaartgeskiedenis" },
    { en: "Worker management", af: "Werkerbestuur" },
    { en: "Add worker", af: "Voeg werker by" },
    { en: "Edit worker", af: "Wysig werker" },
    { en: "Save worker", af: "Stoor werker" },
    { en: "Search tasks...", af: "Soek take..." },
    { en: "Department", af: "Departement" },
    { en: "Responsible", af: "Verantwoordelik" },
    { en: "Due date", af: "Sperdatum" },
    { en: "Next action", af: "Volgende aksie" },
    { en: "Materials required", af: "Benodigde materiaal" },
    { en: "Manager note", af: "Bestuursnota" },
    { en: "Include on job card", af: "Sluit op werkkaart in" },
    { en: "Planned start", af: "Beplande begin" },
    { en: "Planned end", af: "Beplande einde" },
    { en: "Area", af: "Gebied" },
    { en: "Task description", af: "Taakbeskrywing" },
    { en: "NKRN \u00b7 In operation", af: "NKRN \u00b7 In werking" },
    { en: "Event support", af: "Funksieversorging" },
    { en: "Arrange supplies for an event quickly and simply. NKRN uses your profile automatically.", af: "Re\u00ebl voorraad vir \u2019n funksie vinnig en eenvoudig. NKRN gebruik jou profiel outomaties." },
    { en: "Supplies must be requested at least three working days before the event. Borrowed items must be cleaned and returned, and damage or breakages must be reported.", af: "Voorraad moet minstens drie werksdae voor die funksie aangevra word. Geleende items moet skoongemaak en terugbesorg word, en skade of breuke moet aangemeld word." },
    { en: "Event", af: "Geleentheid" },
    { en: "Supplies", af: "Voorraad" },
    { en: "Step 1", af: "Stap 1" },
    { en: "Event details", af: "Funksiebesonderhede" },
    { en: "We only ask for what NKRN does not already know about you.", af: "Ons vra net wat NKRN nie reeds van jou weet nie." },
    { en: "Date required", af: "Datum benodig" },
    { en: "Venue", af: "Lokaal" },
    { en: "Choose a venue", af: "Kies \u2019n lokaal" },
    { en: "Hall", af: "Saal" },
    { en: "Panthera (upper lounge)", af: "Panthera (losie bo)" },
    { en: "Panthera (lower level)", af: "Panthera (onder)" },
    { en: "Classrooms", af: "Klaskamers" },
    { en: "Staff room", af: "Personeelkamer" },
    { en: "Other", af: "Ander" },
    { en: "Number of people", af: "Aantal persone" },
    { en: "History", af: "Geskiedenis" },
    { en: "My Requests", af: "My versoeke" },
    { en: "Showing", af: "Wys" },
    { en: "AI Help", af: "AI Hulp" },
    { en: "AI assistant", af: "AI-assistent" },
    { en: "AI Assistant", af: "AI-assistent" },
    { en: "Describe the problem", af: "Beskryf die probleem" },
    { en: "Describe your IT problem", af: "Beskryf jou IT-probleem" },
    { en: "Tell AI what is happening", af: "Vertel vir AI wat gebeur" },
    { en: "What is happening?", af: "Wat gebeur?" },
    { en: "Ask AI", af: "Vra AI" },
    { en: "Get AI help", af: "Kry AI-hulp" },
    { en: "Analyze", af: "Ontleed" },
    { en: "Analyse", af: "Ontleed" },
    { en: "Analyzing...", af: "Besig om te ontleed..." },
    { en: "Analysing...", af: "Besig om te ontleed..." },
    { en: "Thinking...", af: "Dink..." },
    { en: "Thinking\u2026", af: "Dink\u2026" },
    { en: "Suggested fix", af: "Voorgestelde oplossing" },
    { en: "Suggested category", af: "Voorgestelde kategorie" },
    { en: "Suggested priority", af: "Voorgestelde prioriteit" },
    { en: "Suggested technician", af: "Voorgestelde tegnikus" },
    { en: "AI recommendation", af: "AI-aanbeveling" },
    { en: "Try this first", af: "Probeer dit eers" },
    { en: "Create request", af: "Skep versoek" },
    { en: "Use suggestion", af: "Gebruik voorstel" },
    { en: "Clear", af: "Maak skoon" },
    { en: "Start again", af: "Begin weer" },
    { en: "AI Help is unavailable right now.", af: "AI Hulp is tans nie beskikbaar nie." },
    { en: "Unable to get AI help.", af: "Kon nie AI-hulp kry nie." },
    { en: "You can still submit the request manually.", af: "Jy kan steeds die versoek handmatig indien." },
    { en: "AI suggestions are advisory. You remain in control of the request.", af: "AI-voorstelle is adviserend. Jy bly in beheer van die versoek." },
] as const;

const platformFinalEnglishToAfrikaans = new Map<string, string>();
const platformFinalAfrikaansToEnglish = new Map<string, string>();

for (const entry of platformFinalTranslations) {
    platformFinalEnglishToAfrikaans.set(normalizeKey(entry.en), entry.af);
    platformFinalAfrikaansToEnglish.set(normalizeKey(entry.af), entry.en);
}

function withOriginalWhitespace(value: string, translated: string): string {
    const leading = value.match(/^\s*/)?.[0] ?? "";
    const trailing = value.match(/\s*$/)?.[0] ?? "";
    return `${leading}${translated}${trailing}`;
}

function translatePlatformDynamic(value: string, language: Language): string | null {
    const core = value.trim();

    if (language === "en") {
        let match = core.match(/^Gebruiker #(\d+)$/i);
        if (match) return `User #${match[1]}`;

        match = core.match(/^Versoek #(\d+) is gestoor\.$/i);
        if (match) return `Request #${match[1]} was saved.`;

        match = core.match(/^Versoek #(\d+) is opgedateer\.$/i);
        if (match) return `Request #${match[1]} was updated.`;

        match = core.match(/^Versoek #(\d+) is gekanselleer\.$/i);
        if (match) return `Request #${match[1]} was cancelled.`;

        match = core.match(/^Versoek #(\d+) is aan die Logistics-span gestuur\.$/i);
        if (match) return `Request #${match[1]} was sent to the Logistics team.`;

        match = core.match(/^Kommentaar is by versoek #(\d+) gevoeg\.$/i);
        if (match) return `Comment was added to request #${match[1]}.`;

        match = core.match(/^Kommentaar kon nie by versoek #(\d+) gevoeg word nie\.$/i);
        if (match) return `The comment could not be added to request #${match[1]}.`;

        match = core.match(/^(.+?) is bygevoeg\.$/i);
        if (match) return `${match[1]} was added.`;

        match = core.match(/^(.+?) is opgedateer\.$/i);
        if (match) return `${match[1]} was updated.`;

        match = core.match(/^(.+?) is gedeaktiveer\.$/i);
        if (match) return `${match[1]} was deactivated.`;

        match = core.match(/^Welkom,\s+(.+?)\.\s+Kies \u2019n module om aan die gang te kom\.$/i);
        if (match) return `Welcome, ${match[1]}. Choose a module to get started.`;

        match = core.match(/^Reeds bespreek:\s+(.+?)\s+\((.+?)\)\.$/i);
        if (match) return `Already booked: ${match[1]} (${match[2]}).`;

        match = core.match(/^Wil jy (.+?) se rekening deaktiveer\?\s*Die gebruiker sal nie meer kan aanmeld nie\.$/i);
        if (match) return `Do you want to deactivate ${match[1]}'s account? The user will no longer be able to sign in.`;
    } else {
        let match = core.match(/^User #(\d+)$/i);
        if (match) return `Gebruiker #${match[1]}`;

        match = core.match(/^Request #(\d+) was saved\.$/i);
        if (match) return `Versoek #${match[1]} is gestoor.`;

        match = core.match(/^Request #(\d+) was updated\.$/i);
        if (match) return `Versoek #${match[1]} is opgedateer.`;

        match = core.match(/^Request #(\d+) was cancelled\.$/i);
        if (match) return `Versoek #${match[1]} is gekanselleer.`;

        match = core.match(/^Request #(\d+) was sent to the Logistics team\.$/i);
        if (match) return `Versoek #${match[1]} is aan die Logistics-span gestuur.`;

        match = core.match(/^Comment was added to request #(\d+)\.$/i);
        if (match) return `Kommentaar is by versoek #${match[1]} gevoeg.`;

        match = core.match(/^The comment could not be added to request #(\d+)\.$/i);
        if (match) return `Kommentaar kon nie by versoek #${match[1]} gevoeg word nie.`;

        match = core.match(/^(.+?) was added\.$/i);
        if (match) return `${match[1]} is bygevoeg.`;

        match = core.match(/^(.+?) was updated\.$/i);
        if (match) return `${match[1]} is opgedateer.`;

        match = core.match(/^(.+?) was deactivated\.$/i);
        if (match) return `${match[1]} is gedeaktiveer.`;

        match = core.match(/^Welcome,\s+(.+?)\.\s+Choose a module to get started\.$/i);
        if (match) return `Welkom, ${match[1]}. Kies \u2019n module om aan die gang te kom.`;

        match = core.match(/^Already booked:\s+(.+?)\s+\((.+?)\)\.$/i);
        if (match) return `Reeds bespreek: ${match[1]} (${match[2]}).`;

        match = core.match(/^Do you want to deactivate (.+?)'s account\?\s*The user will no longer be able to sign in\.$/i);
        if (match) return `Wil jy ${match[1]} se rekening deaktiveer? Die gebruiker sal nie meer kan aanmeld nie.`;
    }

    return null;
}

function translatePlatformFinalText(value: string, language: Language): string {
    const key = normalizeKey(value);
    if (!key) return value;

    const exact = (
        language === "af"
            ? platformFinalEnglishToAfrikaans
            : platformFinalAfrikaansToEnglish
    ).get(key);

    if (exact !== undefined) {
        return withOriginalWhitespace(value, exact);
    }

    const dynamic = translatePlatformDynamic(value, language);
    if (dynamic !== null) {
        return withOriginalWhitespace(value, dynamic);
    }

    return value;
}
// NKRN PLATFORM FINAL I18N END

export function translateText(value: string, language: Language): string {
    const platformFinal = translatePlatformFinalText(value, language);
    if (platformFinal !== value) {
        return platformFinal;
    }
    const key = normalizeKey(value);
    if (!key) return value;

    const translationMap =
        language === "af"
            ? englishToAfrikaans
            : afrikaansToEnglish;

    const exactTranslated = translationMap.get(key);

    // If the complete value is not explicitly translated, leave it untouched.
    // This is intentional: an untranslated sentence is safer than a malformed
    // sentence produced by partial word replacement.
    if (exactTranslated === undefined) {
        const dynamicTranslated =
        translateDynamicText(value, language);

    if (dynamicTranslated !== value) {
        return dynamicTranslated;
    }

    return value;
    }

    const leadingWhitespace = value.match(/^\s*/)?.[0] ?? "";
    const trailingWhitespace = value.match(/\s*$/)?.[0] ?? "";

    return `${leadingWhitespace}${exactTranslated}${trailingWhitespace}`;
}
function shouldIgnore(element: Element | null): boolean {
    if (!element) return true;
    if (element.closest("[data-nkrn-i18n-ignore]")) return true;
    return ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(element.tagName);
}

function translateDocument(language: Language): void {
    if (typeof document === "undefined" || !document.body) return;

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    let current: Node | null = walker.nextNode();
    while (current) {
        textNodes.push(current as Text);
        current = walker.nextNode();
    }

    for (const node of textNodes) {
        if (shouldIgnore(node.parentElement)) continue;
        const original = node.nodeValue ?? "";
        const translated = translateText(original, language);
        if (translated !== original) node.nodeValue = translated;
    }

    const elements = document.querySelectorAll<HTMLElement>("[placeholder], [aria-label], [title], [alt]");
    for (const element of elements) {
        if (shouldIgnore(element)) continue;
        for (const attribute of ["placeholder", "aria-label", "title", "alt"] as const) {
            const value = element.getAttribute(attribute);
            if (!value) continue;
            const translated = translateText(value, language);
            if (translated !== value) element.setAttribute(attribute, translated);
        }
    }
}

type LanguageContextValue = {
    language: Language;
    setLanguage: (language: Language) => void;
    t: (value: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const STORAGE_KEY = "nkrn-language";

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>("af");
    const applyingRef = useRef(false);
    const selectedLanguageRef = useRef<Language | null>(null);

    useEffect(() => {
        let storedLanguage: Language | null = null;
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (stored === "en" || stored === "af") storedLanguage = stored;
        } catch {
            // The default Afrikaans-first experience still works if storage is blocked.
        }
        selectedLanguageRef.current = storedLanguage;

        if (storedLanguage) {
            // Defer the state update until after hydration, while still allowing the
            // first translation effect to use the stored value immediately.
            const timer = window.setTimeout(() => {
                if (selectedLanguageRef.current === storedLanguage) {
                    setLanguageState(storedLanguage);
                }
            }, 0);
            return () => window.clearTimeout(timer);
        }

        return undefined;
    }, []);

    useEffect(() => {
        const selectedLanguage = selectedLanguageRef.current ?? language;
        if (typeof document === "undefined" || !document.body) return;

        document.documentElement.lang = selectedLanguage;
        try {
            window.localStorage.setItem(STORAGE_KEY, selectedLanguage);
            document.cookie = `${STORAGE_KEY}=${selectedLanguage}; path=/; max-age=31536000; SameSite=Lax`;
        } catch {
            // Translation does not depend on persistence being available.
        }

        const observerRef: { current: MutationObserver | null } = { current: null };
        const apply = () => {
            if (applyingRef.current) return;
            applyingRef.current = true;
            observerRef.current?.disconnect();
            translateDocument(selectedLanguage);
            applyingRef.current = false;
            observerRef.current?.observe(document.body, {
                subtree: true,
                childList: true,
                characterData: true,
                attributes: true,
                attributeFilter: ["placeholder", "aria-label", "title"],
            });
        };

        apply();
        const observer = new MutationObserver(() => apply());
        observerRef.current = observer;
        observer.observe(document.body, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
            attributeFilter: ["placeholder", "aria-label", "title"],
        });

        return () => observer.disconnect();
    }, [language]);

    const setLanguage = useCallback((nextLanguage: Language) => {
        selectedLanguageRef.current = nextLanguage;
        setLanguageState(nextLanguage);
    }, []);

    const value = useMemo<LanguageContextValue>(
        () => ({ language, setLanguage, t: (text) => translateText(text, language) }),
        [language, setLanguage],
    );

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
    const context = useContext(LanguageContext);
    if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
    return context;
}
