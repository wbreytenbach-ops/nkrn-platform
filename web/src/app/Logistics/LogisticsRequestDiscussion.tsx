"use client";

import { useState } from "react";
import { useLanguage } from "../language";

type Location = { locationID: number | null; locationText: string | null; isPrimary: boolean };
type Equipment = { equipmentTypeID: number; quantity: number | null; notes: string | null };
type Maintenance = { maintenanceTypeID: number; actionType: string; notes: string | null };
type RequestDetails = { title: string; description: string | null; requestType: string; activityCategory: string | null; activityDate: string | null; startTime: string | null; endTime: string | null; cleanupNextDay: boolean | null; locations: Location[]; equipment: Equipment[]; maintenanceItems: Maintenance[] };
type Comment = { commentID: number; body: string; author: string; createdAt: string };
type References = { locations: {locationID: number; locationName: string}[]; equipment: {equipmentTypeID: number; equipmentName: string}[]; maintenance: {maintenanceTypeID: number; maintenanceName: string}[] };
const api = process.env.NEXT_PUBLIC_API_URL;
const field = "nkrn-input w-full rounded-xl border border-white/15 bg-zinc-900 p-3 text-white";
const headers = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` });

export default function LogisticsRequestDiscussion({ requestID, canEdit = false, onSaved }: { requestID: number; canEdit?: boolean; onSaved?: () => void }) {
    const { language } = useLanguage();
    const tr = (en: string, af: string) => language === "af" ? af : en;
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [request, setRequest] = useState<RequestDetails | null>(null);
    const [references, setReferences] = useState<References>({locations: [], equipment: [], maintenance: []});
    const [comments, setComments] = useState<Comment[]>([]);
    const [body, setBody] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    async function load() {
        setBusy(true); setError("");
        try {
            const responses = await Promise.all([
                fetch(`${api}/api/LogisticsRequests/${requestID}`, {headers: headers(), cache: "no-store"}),
                fetch(`${api}/api/LogisticsRequests/${requestID}/comments`, {headers: headers(), cache: "no-store"}),
                fetch(`${api}/api/LogisticsRequests/reference-data`, {headers: headers(), cache: "no-store"})
            ]);
            if (responses.some(r => !r.ok)) throw new Error(tr("Unable to load request details.", "Versoekbesonderhede kon nie gelaai word nie."));
            setRequest(await responses[0].json()); setComments(await responses[1].json()); setReferences(await responses[2].json()); setOpen(true);
        } catch (e) {setError(e instanceof Error ? e.message : tr("Loading failed.", "Laai het misluk."));}
        finally {setBusy(false);}
    }
    async function save(comment: boolean) {
        if (!request || busy) return;
        setBusy(true); setError("");
        try {
            const response = await fetch(`${api}/api/LogisticsRequests/${requestID}${comment ? "/comments" : ""}`, {
                method: comment ? "POST" : "PUT", headers: headers(), body: JSON.stringify(comment ? {body: body.trim()} : {
                    ...request, activityDate: request.activityDate?.slice(0,10) || null,
                    startTime: request.startTime ? `${request.startTime.slice(0,5)}:00` : null,
                    endTime: request.endTime ? `${request.endTime.slice(0,5)}:00` : null
                })
            });
            if (!response.ok) throw new Error(tr("Unable to save. Check the fields and try again.", "Kon nie stoor nie. Gaan die velde na en probeer weer."));
            setBody(""); setEditing(false); await load(); onSaved?.();
        } catch(e) {setError(e instanceof Error ? e.message : tr("Save failed.", "Stoor het misluk."));}
        finally {setBusy(false);}
    }
    return <section className="mt-4 rounded-xl border border-white/10 p-4">
        <button type="button" disabled={busy} className="q4-nav" onClick={() => open ? setOpen(false) : void load()}>{open ? tr("Close discussion", "Sluit bespreking") : tr("Details & comments", "Besonderhede en kommentaar")}</button>
        {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}
        {open && request && <div className="mt-4 space-y-4">
            {canEdit && <button type="button" disabled={busy} className="q4-nav" onClick={() => setEditing(!editing)}>{editing ? tr("Cancel editing", "Kanselleer wysiging") : tr("Edit request", "Wysig versoek")}</button>}
            {editing && <form className="space-y-4" onSubmit={e => {e.preventDefault(); void save(false);}}>
                <label className="block">{tr("Title", "Titel")}<input required maxLength={200} className={field} value={request.title} onChange={e => setRequest({...request,title:e.target.value})}/></label>
                <label className="block">{tr("Description", "Beskrywing")}<textarea required className={field} value={request.description ?? ""} onChange={e => setRequest({...request,description:e.target.value})}/></label>
                <div className="grid gap-4 sm:grid-cols-2">
                    <label>{tr("Request type", "Soort versoek")}<select className={field} value={request.requestType} onChange={e => setRequest({...request,requestType:e.target.value})}>{[["Event",tr("Event","Funksie")],["Maintenance",tr("Maintenance","Instandhouding")],["General",tr("General","Algemeen")]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                    <label>{tr("Category", "Kategorie")}<input className={field} value={request.activityCategory ?? ""} onChange={e => setRequest({...request,activityCategory:e.target.value || null})}/></label>
                    <label>{tr("Date", "Datum")}<input type="date" className={field} value={request.activityDate?.slice(0,10) ?? ""} onChange={e => setRequest({...request,activityDate:e.target.value || null})}/></label>
                    <label>{tr("Start time", "Begintyd")}<input type="time" className={field} value={request.startTime?.slice(0,5) ?? ""} onChange={e => setRequest({...request,startTime:e.target.value || null})}/></label>
                    <label>{tr("End time", "Eindtyd")}<input type="time" className={field} value={request.endTime?.slice(0,5) ?? ""} onChange={e => setRequest({...request,endTime:e.target.value || null})}/></label>
                </div>
                <label className="block"><input type="checkbox" checked={request.cleanupNextDay ?? false} onChange={e=>setRequest({...request,cleanupNextDay:e.target.checked})}/> {tr("Clean up the next day", "Maak die volgende dag skoon")}</label>
                <fieldset><legend>{tr("Locations", "Liggings")}</legend>{request.locations.map((item,index)=><div key={index} className="mt-2 flex gap-2"><select aria-label={tr("Location","Ligging")} className={field} value={item.locationID ?? ""} onChange={e=>setRequest({...request,locations:request.locations.map((v,i)=>i===index?{...v,locationID:e.target.value?Number(e.target.value):null}:v)})}><option value="">{tr("Other location","Ander ligging")}</option>{references.locations.map(l=><option value={l.locationID} key={l.locationID}>{l.locationName}</option>)}</select><input aria-label={tr("Location details","Liggingbesonderhede")} className={field} value={item.locationText ?? ""} onChange={e=>setRequest({...request,locations:request.locations.map((v,i)=>i===index?{...v,locationText:e.target.value}:v)})}/><button type="button" onClick={()=>setRequest({...request,locations:request.locations.filter((_,i)=>i!==index)})}>{tr("Remove","Verwyder")}</button></div>)}<button type="button" className="q4-nav mt-2" onClick={()=>setRequest({...request,locations:[...request.locations,{locationID:null,locationText:"",isPrimary:request.locations.length===0}]})}>{tr("Add location","Voeg ligging by")}</button></fieldset>
                <fieldset><legend>{tr("Equipment", "Toerusting")}</legend>{request.equipment.map((item,index)=><div key={index} className="mt-2 grid gap-2 sm:grid-cols-3"><select className={field} aria-label={tr("Equipment","Toerusting")} value={item.equipmentTypeID} onChange={e=>setRequest({...request,equipment:request.equipment.map((v,i)=>i===index?{...v,equipmentTypeID:Number(e.target.value)}:v)})}>{references.equipment.map(v=><option key={v.equipmentTypeID} value={v.equipmentTypeID}>{v.equipmentName}</option>)}</select><input aria-label={tr("Quantity","Hoeveelheid")} type="number" min={1} className={field} value={item.quantity ?? ""} onChange={e=>setRequest({...request,equipment:request.equipment.map((v,i)=>i===index?{...v,quantity:e.target.value?Number(e.target.value):null}:v)})}/><input aria-label={tr("Notes","Notas")} className={field} value={item.notes ?? ""} onChange={e=>setRequest({...request,equipment:request.equipment.map((v,i)=>i===index?{...v,notes:e.target.value}:v)})}/><button type="button" onClick={()=>setRequest({...request,equipment:request.equipment.filter((_,i)=>i!==index)})}>{tr("Remove","Verwyder")}</button></div>)}<button type="button" className="q4-nav mt-2" disabled={!references.equipment.length} onClick={()=>setRequest({...request,equipment:[...request.equipment,{equipmentTypeID:references.equipment[0].equipmentTypeID,quantity:1,notes:null}]})}>{tr("Add equipment","Voeg toerusting by")}</button></fieldset>
                <fieldset><legend>{tr("Maintenance", "Instandhouding")}</legend>{request.maintenanceItems.map((item,index)=><div key={index} className="mt-2 grid gap-2 sm:grid-cols-3"><select className={field} aria-label={tr("Maintenance","Instandhouding")} value={item.maintenanceTypeID} onChange={e=>setRequest({...request,maintenanceItems:request.maintenanceItems.map((v,i)=>i===index?{...v,maintenanceTypeID:Number(e.target.value)}:v)})}>{references.maintenance.map(v=><option key={v.maintenanceTypeID} value={v.maintenanceTypeID}>{v.maintenanceName}</option>)}</select><select className={field} aria-label={tr("Action","Aksie")} value={item.actionType} onChange={e=>setRequest({...request,maintenanceItems:request.maintenanceItems.map((v,i)=>i===index?{...v,actionType:e.target.value}:v)})}>{[["Repair",tr("Repair","Herstel")],["Replace",tr("Replace","Vervang")],["Unsure",tr("Unsure","Onseker")]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select><input aria-label={tr("Notes","Notas")} className={field} value={item.notes ?? ""} onChange={e=>setRequest({...request,maintenanceItems:request.maintenanceItems.map((v,i)=>i===index?{...v,notes:e.target.value}:v)})}/><button type="button" onClick={()=>setRequest({...request,maintenanceItems:request.maintenanceItems.filter((_,i)=>i!==index)})}>{tr("Remove","Verwyder")}</button></div>)}<button type="button" className="q4-nav mt-2" disabled={!references.maintenance.length} onClick={()=>setRequest({...request,maintenanceItems:[...request.maintenanceItems,{maintenanceTypeID:references.maintenance[0].maintenanceTypeID,actionType:"Unsure",notes:null}]})}>{tr("Add maintenance","Voeg instandhouding by")}</button></fieldset>
                <p className="text-sm text-zinc-400">{tr("Existing job cards retain their original snapshot. Review linked tasks and allocations when changing work details.","Bestaande werkkaarte behou hul oorspronklike besonderhede. Hersien gekoppelde take en toewysings wanneer werkbesonderhede verander.")}</p>
                <button disabled={busy} type="submit" className="q4-nav">{tr("Save request", "Stoor versoek")}</button>
            </form>}
            <h3 className="font-semibold">{tr("Comments", "Kommentaar")}</h3>
            {comments.map(c => <article key={c.commentID} className="rounded-lg border border-white/10 p-3"><p className="text-sm text-zinc-400">{c.author} · {new Date(c.createdAt).toLocaleString(language === "af" ? "af-ZA" : "en-ZA")}</p><p className="whitespace-pre-wrap">{c.body}</p></article>)}
            {!comments.length && <p>{tr("No comments yet.", "Nog geen kommentaar nie.")}</p>}
            <form onSubmit={e=>{e.preventDefault(); void save(true);}}><label>{tr("Add comment", "Voeg kommentaar by")}<textarea required maxLength={4000} className={field} value={body} onChange={e=>setBody(e.target.value)}/></label><p className="mt-2 text-sm text-zinc-400">{tr("Visible to the requester and Logistics managers.","Sigbaar vir die versoeker en Logistics-bestuurders.")}</p><button type="submit" disabled={busy || !body.trim()} className="q4-nav mt-2">{tr("Post comment", "Plaas kommentaar")}</button></form>
        </div>}
    </section>;
}
