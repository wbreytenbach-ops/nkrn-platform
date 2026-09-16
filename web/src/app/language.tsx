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
    { en: "Funksieversorging", af: "Funksieversorging" },
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
    { en: "of", af: "van" },
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

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a case-insensitive phrase matcher. The DOM contains both straight
 * and curly punctuation depending on which page produced the text, so the
 * matcher accepts both forms while keeping word boundaries intact.
 */
function phrasePattern(value: string): RegExp {
    const source = normalizeKey(value);
    let pattern = "";

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];

        if (/\s/.test(character)) {
            pattern += "\\s+";
            while (index + 1 < source.length && /\s/.test(source[index + 1])) {
                index += 1;
            }
            continue;
        }

        if (character === "'") {
            pattern += "[’‘']";
            continue;
        }

        if (character === '"') {
            pattern += '[“”"]';
            continue;
        }

        if (character === "." && source.slice(index, index + 3) === "...") {
            pattern += "(?:\\.\\.\\.|…)";
            index += 2;
            continue;
        }

        if (character === "-") {
            pattern += "[-\\u2012\\u2013\\u2014]";
            continue;
        }

        pattern += escapeRegExp(character);
    }

    // Prefix/suffix groups preserve punctuation immediately before a phrase
    // when String.replace invokes the callback.
    return new RegExp(`(^|[^\\p{L}\\p{N}])(${pattern})(?=$|[^\\p{L}\\p{N}])`, "giu");
}

type CompiledTranslation = {
    pattern: RegExp;
    target: string;
};

function compilePartialTranslations(sourceLanguage: Language): CompiledTranslation[] {
    const entries = sourceLanguage === "en"
        ? allTranslationEntries.map((entry) => ({ source: entry.en, target: entry.af }))
        : allTranslationEntries.map((entry) => ({ source: entry.af, target: entry.en }));

    const seen = new Set<string>();
    return entries
        .filter(({ source, target }) => {
            const key = `${normalizeKey(source)}\u0000${target}`;
            if (!source.trim() || normalizeKey(source) === normalizeKey(target) || seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        })
        .sort((left, right) => normalizeKey(right.source).length - normalizeKey(left.source).length)
        .map(({ source, target }) => ({ pattern: phrasePattern(source), target }));
}

const partialEnglishToAfrikaans = compilePartialTranslations("en");
const partialAfrikaansToEnglish = compilePartialTranslations("af");

/** Translate one complete text value while retaining its surrounding whitespace. */
export function translateText(value: string, language: Language): string {
    const key = normalizeKey(value);
    if (!key) return value;

    const exactTranslated = (language === "af" ? englishToAfrikaans : afrikaansToEnglish).get(key);
    if (exactTranslated !== undefined) {
        const leading = value.match(/^\s*/)?.[0] ?? "";
        const trailing = value.match(/\s*$/)?.[0] ?? "";
        return `${leading}${exactTranslated}${trailing}`;
    }

    const partialTranslations = language === "af"
        ? partialEnglishToAfrikaans
        : partialAfrikaansToEnglish;

    let translatedValue = value;
    for (const { pattern, target } of partialTranslations) {
        translatedValue = translatedValue.replace(pattern, (_match, prefix: string) => `${prefix}${target}`);
    }

    return translatedValue;
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

    const elements = document.querySelectorAll<HTMLElement>("[placeholder], [aria-label], [title]");
    for (const element of elements) {
        if (shouldIgnore(element)) continue;
        for (const attribute of ["placeholder", "aria-label", "title"] as const) {
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
