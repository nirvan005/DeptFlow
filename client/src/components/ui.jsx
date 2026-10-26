import { Search, ArrowUpRight, Inbox, AlertCircle, LoaderCircle, ChevronRight } from 'lucide-react';
import { cloneElement, useId } from 'react';
import { Link } from 'react-router-dom';
import { label, initials, recordPath, formatDate } from '../lib/api';
export function Badge({value}) {return <span className={`badge ${['APPROVED','ALLOCATED','PUBLISHED'].includes(value) ? 'success' : value === 'REJECTED' ? 'danger' : value?.startsWith('PENDING') ? 'warning' : value === 'UG' ? 'purple' : value === 'PG' ? 'blue' : 'neutral'}`}><span className="badge-dot"/>{label(value)}</span>;}
export function Avatar({name,small = false,tone = 0}) {return <span className={`avatar tone-${tone%4} ${small ? 'small' : ''}`}>{initials(name)}</span>;}
export function PageHeading({eyebrow,title,description,children}) {return <div className="page-heading"><div><div className="eyebrow">{eyebrow || 'DEPARTMENT WORKSPACE'}</div><h1>{title}</h1>{description && <p>{description}</p>}</div><div className="heading-actions">{children}</div></div>;}
export function Card({children,className = ''}) {return <section className={`card ${className}`}>{children}</section>;}
export function CardHeading({title,description,to,action = 'View all'}) {return <div className="card-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{to && <Link className="text-link" to={to} aria-label={action || `View ${title.toLowerCase()}`}>{action}<ArrowUpRight size={15}/></Link>}</div>;}
export function Empty({title = 'Nothing here just yet',description = 'Your records will appear here when there’s something to show.',children}) {return <div className="empty"><div className="empty-icon"><Inbox size={25}/></div><h3>{title}</h3><p>{description}</p>{children}</div>;}
export function State({resource,children}) {
  if (resource.loading) return <div className="loading" role="status"><LoaderCircle className="spin" size={24}/><span>Loading your workspace…</span></div>;
  if (resource.error) return <Card><div className="empty"><AlertCircle size={28}/><h3>We couldn’t load this page</h3><p>{resource.error.message}</p><button className="button secondary" onClick={resource.retry}>Try again</button></div></Card>;
  return children(resource.data);
}
export function SearchInput({value,onChange,placeholder = 'Search…'}) {return <div className="search-input"><Search size={17}/><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)}/>{value && <button aria-label="Clear search" onClick={() => onChange('')}>×</button>}</div>;}
export function SelectFilter({value,onChange,options,placeholder,label:ariaLabel}) {return <select aria-label={ariaLabel || placeholder} value={value} onChange={e => onChange(e.target.value)}><option value="">{placeholder}</option>{options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? label(o)}</option>)}</select>;}
export function Field({label:caption,name,error,children,hint}) {
  const id = useId(),invalid = Boolean(error?.fields?.[name]);
  return <label className="field" htmlFor={id}><span id={`${id}-label`}>{caption}</span>{cloneElement(children,{id,'aria-labelledby':`${id}-label`,'aria-invalid':invalid || undefined,'aria-describedby':[hint && `${id}-hint`,invalid && `${id}-error`].filter(Boolean).join(' ') || undefined})}{hint && <small id={`${id}-hint`}>{hint}</small>}{invalid && <small id={`${id}-error`} className="field-error">{error.fields[name]}</small>}</label>;
}
export function FormError({error}) {return error ? <div className="error-banner" role="alert"><AlertCircle size={17}/><span>{error.message}</span></div> : null;}
export function Submit({busy,children = 'Save changes'}) {return <button type="submit" className="button primary" disabled={busy}>{busy && <LoaderCircle className="spin" size={16}/ >}{busy ? 'Saving…' : children}</button>;}
export function Tabs({tabs,value,onChange}) {return <div className="tabs" role="group" aria-label="View options">{tabs.map(t => <button className={value === t.value ? 'active' : ''} key={t.value} onClick={() => onChange(t.value)}>{t.label}{t.count !== undefined && <span>{t.count}</span>}</button>)}</div>;}
export function RecordList({rows,showStudent = true}) {
  if (!rows.length) return <Empty title="You’re all caught up" description="There are no requests to display in this view."/>;
  return <div className="record-list">{rows.map((r,index) => <Link className="record-row" key={`${r.kind}-${r.id}`} to={recordPath(r.kind,r.id)}><span className={`record-icon ${r.kind === 'project' ? 'mint' : 'lavender'}`}>{r.kind === 'project' ? 'P' : 'A'}</span><div className="record-copy"><strong>{r.title}</strong><span>{showStudent ? `${r.student_name} · ` : ''}{r.kind === 'project' ? 'Project application' : label(r.category || 'ACADEMIC_EVENT')}{r.date ? ` · ${formatDate(r.date)}` : ''}</span></div><Badge value={r.status}/><ChevronRight size={17} className="muted"/></Link>)}</div>;
}
export function BackLink({to,children}) {return <Link className="back-link" to={to}>← {children}</Link>;}
