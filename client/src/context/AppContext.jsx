import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
const Context = createContext(null);
export function AppProvider({children}) {
  const [user,setUser] = useState(null), [booting,setBooting] = useState(true), [version,setVersion] = useState(0), [toast,setToast] = useState('');
  useEffect(() => {api('/auth/me').then(setUser).catch(() => {}).finally(() => setBooting(false));},[]);
  useEffect(() => {
    const expired = () => setUser(null);
    window.addEventListener('deptflow:session-expired',expired);
    return () => window.removeEventListener('deptflow:session-expired',expired);
  },[]);
  useEffect(() => {if (!toast) return; const timer = setTimeout(() => setToast(''),4500); return () => clearTimeout(timer);},[toast]);
  const refresh = useCallback(() => setVersion(v => v+1),[]);
  const notify = useCallback(message => setToast(message),[]);
  return <Context.Provider value={{user,setUser,booting,version,refresh,notify}}>{children}{toast && <div className="toast" role="status"><span className="toast-check">✓</span>{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}>×</button></div>}</Context.Provider>;
}
export const useApp = () => useContext(Context);
export function useData(path) {
  const {version} = useApp();
  const [state,setState] = useState({data:null,loading:true,error:null});
  const [retry,setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setState(s => ({...s,loading:true,error:null}));
    api(path).then(data => active && setState({data,loading:false,error:null})).catch(error => active && setState({data:null,loading:false,error}));
    return () => {active = false;};
  },[path,version,retry]);
  return {...state,retry:() => setRetry(r => r+1)};
}
