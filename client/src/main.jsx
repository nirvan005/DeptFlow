import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { AppProvider,useApp } from './context/AppContext';
import Layout from './components/Layout';
import { Empty } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Activities,{ActivityForm,RequestDetail} from './pages/Activities';
import Projects,{ProjectForm,ProjectApply} from './pages/Projects';
import Reviews from './pages/Reviews';
import Students,{StudentProfile,Faculty,FacultyPending} from './pages/People';
import Academics,{AcademicDetail,AcademicForm} from './pages/Academics';
import './styles.css';
function Authenticated() {const {user,booting} = useApp();if (booting) return <div className="boot-screen"><span className="boot-mark">D</span><p>Opening your workspace…</p></div>;return user ? <Outlet/> : <Navigate to="/login" replace/>;}
function Role({roles,children}) {const {user} = useApp();return roles.includes(user.role) ? children : <Empty title="This page belongs to another role" description="Head back to your overview to continue."><Link className="button primary" to="/">Go to overview</Link></Empty>;}
function App() {return <BrowserRouter><AppProvider><Routes><Route path="/login" element={<Login/>}/><Route element={<Authenticated/>}><Route element={<Layout/>}><Route index element={<Dashboard/>}/><Route path="activities" element={<Activities/>}/><Route path="activities/new" element={<Role roles={['STUDENT']}><ActivityForm/></Role>}/><Route path="activities/:id" element={<RequestDetail/>}/><Route path="projects" element={<Projects/>}/><Route path="projects/new" element={<Role roles={['FACULTY','HOD']}><ProjectForm/></Role>}/><Route path="projects/:id/edit" element={<Role roles={['FACULTY','HOD']}><ProjectForm/></Role>}/><Route path="projects/:id/apply" element={<Role roles={['STUDENT']}><ProjectApply/></Role>}/><Route path="applications/:id" element={<RequestDetail kind="project"/>}/><Route path="reviews" element={<Role roles={['FACULTY','HOD']}><Reviews/></Role>}/><Route path="students" element={<Role roles={['FACULTY','HOD']}><Students/></Role>}/><Route path="students/:id" element={<StudentProfile/>}/><Route path="faculty" element={<Role roles={['HOD']}><Faculty/></Role>}/><Route path="faculty/:id/pending" element={<Role roles={['HOD']}><FacultyPending/></Role>}/><Route path="academics" element={<Academics/>}/><Route path="academics/new" element={<Role roles={['HOD']}><AcademicForm/></Role>}/><Route path="academics/:id/edit" element={<Role roles={['HOD']}><AcademicForm/></Role>}/><Route path="academics/:id" element={<AcademicDetail/>}/><Route path="*" element={<Empty title="This page has wandered off" description="Your workspace is just a click away."><Link className="button primary" to="/">Back to overview</Link></Empty>}/></Route></Route></Routes></AppProvider></BrowserRouter>;}
createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
