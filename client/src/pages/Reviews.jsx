import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CircleCheck } from 'lucide-react';
import { useData, useApp } from '../context/AppContext';
import { PageHeading, State, Card, SearchInput, SelectFilter, RecordList, Empty } from '../components/ui';
export default function Reviews() {
  const resource = useData('/reviews'),{user} = useApp(),[params] = useSearchParams();
  const [q,setQ] = useState(''),[type,setType] = useState(''),[programme,setProgramme] = useState('');
  return <><PageHeading eyebrow="A LITTLE GUIDANCE GOES A LONG WAY" title="Your review queue" description={user.role === 'HOD' ? 'Faculty-reviewed requests ready for your final decision.' : 'The activities and project applications waiting for your guidance.'}/><State resource={resource}>{data => {
    const rows = data.filter(r => (!q || `${r.title} ${r.student_name}`.toLowerCase().includes(q.toLowerCase())) && (!type || r.kind === type) && (!programme || r.programme === programme) && (!params.get('faculty_id') || (r.kind === 'activity' ? r.advisor_id : r.guide_id) === Number(params.get('faculty_id'))));
    return <><div className="info-strip"><CircleCheck size={19}/><span><strong>{data.length} {data.length === 1 ? 'request needs' : 'requests need'} your attention.</strong> Open a request to review the details and leave your decision.</span></div><Card><div className="list-toolbar"><SearchInput value={q} onChange={setQ} placeholder="Search your review queue…"/><div className="filter-group"><SelectFilter value={type} onChange={setType} options={[{value:'activity',label:'Activities'},{value:'project',label:'Project applications'}]} placeholder="All request types"/><SelectFilter value={programme} onChange={setProgramme} options={['UG','PG']} placeholder="UG & PG"/></div></div>{rows.length ? <RecordList rows={rows}/> : <Empty title="A clear queue. A good feeling." description="No requests match this view. New requests will appear here when they reach your review stage."/>}</Card></>;
  }}</State></>;
}
