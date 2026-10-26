import { NavLink, Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { LayoutDashboard, ClipboardList, Layers3, CircleCheck, Users, GraduationCap, BookOpen, LogOut, Menu, X, ChevronDown, ArrowUpRight, Sparkles } from 'lucide-react';
import { useApp, useData } from '../context/AppContext';
import { Avatar } from './ui';
import { api, label } from '../lib/api';
export function Logo() {return <div className="brand"><span className="brand-mark"><Layers3 size={24} strokeWidth={2.4}/></span><span>Dept<span className="brand-light">Flow</span><small>DEPARTMENT WORKSPACE</small></span></div>;}
export default function Layout() {
  const {user,setUser,notify} = useApp(), navigate = useNavigate(), location = useLocation();
  const [open,setOpen] = useState(false);
  const [mobile,setMobile] = useState(() => window.matchMedia('(max-width:780px)').matches);
  const sidebarRef = useRef(null),menuRef = useRef(null);
  const dashboard = useData('/dashboard');
  useEffect(() => {setOpen(false);},[location.pathname]);
  useEffect(() => {
    const query = window.matchMedia('(max-width:780px)');
    const update = () => {setMobile(query.matches);if (!query.matches) setOpen(false);};
    query.addEventListener('change',update);return () => query.removeEventListener('change',update);
  },[]);
  useEffect(() => {
    if (!open || !mobile) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow='hidden';
    const controls = () => [...sidebarRef.current.querySelectorAll('a[href],button')].filter(el => el.getClientRects().length);
    controls()[0]?.focus();
    const keydown = e => {
      if (e.key === 'Escape') {e.preventDefault();setOpen(false);}
      if (e.key === 'Tab') {
        const items = controls(),first=items[0],last=items.at(-1);
        if (e.shiftKey && document.activeElement === first) {e.preventDefault();last?.focus();}
        else if (!e.shiftKey && document.activeElement === last) {e.preventDefault();first?.focus();}
      }
    };
    document.addEventListener('keydown',keydown);
    return () => {document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',keydown);menuRef.current?.focus();};
  },[open,mobile]);
  const nav = [{to:'/',icon:LayoutDashboard,name:'Overview'},{to:'/activities',icon:ClipboardList,name:'Activities'},{to:'/projects',icon:Layers3,name:'Projects'},...(user.role !== 'STUDENT' ? [{to:'/reviews',icon:CircleCheck,name:'Review queue',count:dashboard.data?.summary[0].value},{to:'/students',icon:Users,name:user.role === 'HOD' ? 'Students directory' : 'My students'}] : []),...(user.role === 'HOD' ? [{to:'/faculty',icon:GraduationCap,name:'Faculty overview'}] : []),{to:'/academics',icon:BookOpen,name:'Academic hub'}];
  async function logout() {try {await api('/auth/logout',{method:'POST'});setUser(null);navigate('/login');} catch(e) {notify(e.message);}}
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to main content</a>{open && <button className="sidebar-overlay" tabIndex={-1} aria-label="Close navigation" onClick={() => setOpen(false)}/>}
    <aside ref={sidebarRef} id="department-navigation" inert={mobile && !open} role={mobile && open ? 'dialog' : undefined} aria-modal={mobile && open ? true : undefined} aria-label="Department navigation" className={`sidebar ${open ? 'open' : ''}`}><Link to="/" className="brand-link"><Logo/></Link><button className="mobile-close icon-button" onClick={() => setOpen(false)} aria-label="Close navigation"><X/></button><div className="department-label"><span className="department-icon"><GraduationCap size={19}/></span><div>Computer Science<small>Department portal</small></div><ChevronDown size={14}/></div><div className="nav-label">WORKSPACE</div><nav aria-label="Workspace">{nav.map(({to,icon:Icon,name,count}) => <NavLink end={to === '/'} key={to} to={to} className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}><Icon size={19}/><span>{name}</span>{Number(count)>0 && <span className="nav-count">{count}</span>}</NavLink>)}</nav>
    <div className="sidebar-bottom"><div className="sidebar-note"><Sparkles size={20}/><strong>Ideas to impact.</strong><p>A connected space for your next academic milestone.</p><Link to="/projects">Explore projects <ArrowUpRight size={14}/></Link></div><div className="sidebar-footer"><span className="live-dot"/>Department workspace<span>v1.0</span></div></div></aside>
    <div className="main-shell" inert={mobile && open}><header className="topbar"><div className="topbar-left"><button ref={menuRef} className="mobile-menu icon-button" onClick={() => setOpen(true)} aria-label="Open navigation" aria-expanded={open} aria-controls="department-navigation"><Menu/></button><span className="breadcrumb">Workspace <span>/</span> <strong>{nav.find(n => n.to !== '/' && location.pathname.startsWith(n.to))?.name || (location.pathname === '/' ? 'Overview' : 'Details')}</strong></span></div><div className="topbar-right"><span className="academic-pill"><span className="live-dot"/>Academic workspace</span><div className="topbar-divider"/>{user.role === 'STUDENT' ? <Link to={`/students/${user.id}`} className="user-info"><Avatar name={user.name} small/><div><strong>{user.name}</strong><small>{label(user.role)} · {user.programme}</small></div></Link> : <div className="user-info"><Avatar name={user.name} small/><div><strong>{user.name}</strong><small>{label(user.role)}</small></div></div>}<button className="icon-button logout" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={18}/></button></div></header><main key={user.id} id="main-content" tabIndex={-1}><Outlet/></main><footer className="main-footer"><span>DeptFlow · Built for a connected department.</span><span>Learn. Collaborate. Grow.</span></footer></div>
  </div>;
}
