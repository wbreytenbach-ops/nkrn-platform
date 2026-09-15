"use client";
import { useState } from "react";
import type { LogisticsTask, LogisticsWorker, LogisticsDepartment } from "./LogisticsManagementDashboard";
import { displayLabel } from "./labels";
const api = process.env.NEXT_PUBLIC_API_URL;
const field = "mt-1 w-full rounded-xl border border-white/15 bg-zinc-900 p-3 text-white";
export default function LogisticsTaskEditor({ tasks, workers, departments, refresh }: { tasks: LogisticsTask[]; workers: LogisticsWorker[]; departments: LogisticsDepartment[]; refresh: () => void }) {
    const [task, setTask] = useState<LogisticsTask | null>(null);
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const [department, setDepartment] = useState<LogisticsDepartment | null>(null);
    async function save(path: string, body: unknown, method = "PUT") {
        setBusy(true); setMessage("");
        try { const response = await fetch(`${api}/api/${path}`,{method, headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("token")}`},body:JSON.stringify(body)}); if (!response.ok) { const data = await response.json(); throw new Error(data.message || "Stoor het misluk."); } setMessage("Veranderinge gestoor."); setTask(null); setDepartment(null); refresh(); }
        catch (e) { setMessage(e instanceof Error ? e.message : "Stoor het misluk."); } finally { setBusy(false); }
    }
    const textFields = [["title","Titel"],["background","Agtergrond"],["responsibleText","Verantwoordelikheidsnota"],["nextAction","Volgende aksie"],["contractorName","Kontrakteur"],["approvalStatus","Goedkeuringsinligting"],["dueDateNote","Sperdatumnota"],["notes","Bestuurdersnotas"]] as const;
    const dates = [["dueDate","Sperdatum"],["lastFollowUp","Laaste opvolg"],["nextFollowUp","Volgende opvolg"],["completedDate","Afgehandel op"]] as const;
    return <section id="taakbestuur" className="nkrn-panel mb-8 p-6"><h2 className="text-2xl font-semibold">Taak- en afdelingsbestuur</h2><p className="mt-2 text-sm text-zinc-300">Hertoeken take, volg kwotasies op en hou goedkeurings en sperdatums by.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2"><label>Kies ’n taak<select className={field} value={task?.taskID ?? ""} onChange={e => setTask(tasks.find(t => t.taskID === Number(e.target.value)) ?? null)}><option value="">Kies taak…</option>{tasks.map(t => <option key={t.taskID} value={t.taskID}>#{t.taskID} · {t.title}</option>)}</select></label><label>Kies ’n afdeling<select className={field} value={department?.departmentID ?? ""} onChange={e => setDepartment(departments.find(d => d.departmentID === Number(e.target.value)) ?? null)}><option value="">Kies afdeling…</option>{departments.map(d => <option key={d.departmentID} value={d.departmentID}>{d.departmentName}</option>)}</select></label></div>
        <button className="q4-nav mt-3" onClick={() => setDepartment({departmentID:0,departmentName:"",isActive:true,sortOrder:0})}>+ Nuwe afdeling</button>
        {message && <p role="status" className="mt-4 text-[#e7b42b]">{message}</p>}
        {department && <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={e => {e.preventDefault(); void save(`LogisticsDepartments${department.departmentID ? `/${department.departmentID}` : ""}`,department,department.departmentID ? "PUT":"POST");}}><label>Afdelingsnaam<input required className={field} value={department.departmentName} onChange={e => setDepartment({...department,departmentName:e.target.value})} /></label><label>Volgorde<input type="number" className={field} value={department.sortOrder ?? 0} onChange={e => setDepartment({...department,sortOrder:Number(e.target.value)})} /></label><label><input type="checkbox" checked={department.isActive ?? true} onChange={e => setDepartment({...department,isActive:e.target.checked})} /> Aktief</label><button disabled={busy} className="q4-nav">Stoor afdeling</button></form>}
        {task && <form className="mt-6" onSubmit={e => {e.preventDefault(); void save(`LogisticsTasks/${task.taskID}`,task);}}><div className="grid gap-4 sm:grid-cols-2">{textFields.map(([key,label]) => <label key={key}>{label}<textarea required={key === "title"} className={field} value={task[key] ?? ""} onChange={e => setTask({...task,[key]:e.target.value})} /></label>)}
        <label>Verantwoordelike werker<select className={field} value={task.responsibleWorkerID ?? ""} onChange={e => setTask({...task,responsibleWorkerID:e.target.value ? Number(e.target.value):null})}><option value="">Nie toegeken nie</option>{workers.filter(w => w.isActive || w.workerID === task.responsibleWorkerID).map(w => <option key={w.workerID} value={w.workerID}>{w.firstName} {w.lastName}</option>)}</select></label>
        <label>Afdeling<select className={field} value={task.departmentID ?? ""} onChange={e => setTask({...task,departmentID:e.target.value ? Number(e.target.value):null})}><option value="">Geen afdeling</option>{departments.map(d => <option key={d.departmentID} value={d.departmentID}>{d.departmentName}</option>)}</select></label>
        <label>Prioriteit<select className={field} value={task.priority} onChange={e => setTask({...task,priority:e.target.value})}>{["P1","P2","P3","P4"].map(p => <option key={p}>{p}</option>)}</select></label>
        <label>Status<select className={field} value={task.status} onChange={e => setTask({...task,status:e.target.value})}>{Array.from(new Set([task.status,"Nog nie begin","In Proses","Staan oor","Afgehandel"])).map(s => <option key={s} value={s}>{displayLabel(s)}</option>)}</select></label>
        {dates.map(([key,label]) => <label key={key}>{label}<input type="date" className={field} value={task[key]?.slice(0,10) ?? ""} onChange={e => setTask({...task,[key]:e.target.value || null})} /></label>)}
        <label>Begroting (R)<input type="number" min="0" step="0.01" className={field} value={task.budgetAmount ?? ""} onChange={e => setTask({...task,budgetAmount:e.target.value ? Number(e.target.value):null})} /></label>
        </div><div className="mt-4 flex flex-wrap gap-5">{([["quoteRequired","Kwotasie benodig"],["quoteReceived","Kwotasie ontvang"],["includeOnJobCard","Sluit by werkkaart in"]] as const).map(([key,label]) => <label key={key}><input type="checkbox" checked={task[key]} onChange={e => setTask({...task,[key]:e.target.checked})} /> {label}</label>)}</div><p className="mt-4 text-sm text-zinc-300">Bestaande werkplantoewysings word afsonderlik onder Werkplan gewysig.</p><button disabled={busy} className="q4-nav mt-4">Stoor taak</button></form>}
    </section>;
}
