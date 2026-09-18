import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from './supabase';
import './styles.css';
import { Trophy, Heart, Gauge, LogOut, Shield, Plus, Trash2, Check, X, Sparkles } from 'lucide-react';

function App() {
  const [session,setSession] = useState(null);
  const [profile,setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => setSession(data.session));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_e,s) => setSession(s));
    return () => subscription.unsubscribe();
  },[]);

  useEffect(() => {
    if (!session?.user) return setProfile(null);
    supabase.from('profiles').select('*').eq('id',session.user.id).single()
      .then(({data}) => setProfile(data || null));
  },[session]);

  if (!session) return <Auth />;
  return <Layout profile={profile}><Routes>
    <Route path="/" element={<Home profile={profile}/>}/>
    <Route path="/dashboard" element={<Dashboard profile={profile}/>}/>
    <Route path="/scores" element={<Scores/>}/>
    <Route path="/charities" element={<Charities/>}/>
    <Route path="/draws" element={<Draws/>}/>
    <Route path="/admin" element={<Admin/>}/>
    <Route path="*" element={<Home profile={profile}/>}/>
  </Routes></Layout>;
}

function Auth(){
  const [mode,setMode]=useState('login'), [email,setEmail]=useState(''), [password,setPassword]=useState(''), [name,setName]=useState(''), [msg,setMsg]=useState('');
  const submit=async e=>{
    e.preventDefault(); setMsg('');
    if(mode==='login'){
      const {error}=await supabase.auth.signInWithPassword({email,password}); if(error)setMsg(error.message);
    } else {
      const {error}=await supabase.auth.signUp({email,password,options:{data:{full_name:name}}});
      setMsg(error ? error.message : 'Account created. If email confirmation is enabled, confirm your email then sign in.');
    }
  };
  return <div className="auth"><div className="auth-card">
    <div className="eyebrow">DIGITAL.HEROES</div><h1>Play a round.<br/><span>Back a cause.</span></h1>
    <p>Golf performance, community rewards and charitable impact in one place.</p>
    <form onSubmit={submit}>
      {mode==='signup'&&<input placeholder="Full name" value={name} onChange={e=>setName(e.target.value)} required/>}
      <input type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} required/>
      <input type="password" placeholder="Password (6+ characters)" value={password} onChange={e=>setPassword(e.target.value)} minLength="6" required/>
      <button className="primary">{mode==='login'?'Sign in':'Create account'}</button>
    </form>
    {msg&&<div className="notice">{msg}</div>}
    <button className="link" onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'Create a new account':'I already have an account'}</button>
  </div></div>
}

function Layout({children,profile}){
 const navigate=useNavigate();
 const logout=async()=>{await supabase.auth.signOut();navigate('/')};
 return <div className="app"><header><NavLink to="/" className="brand">DH<span>•</span></NavLink>
 <nav><NavLink to="/dashboard">Dashboard</NavLink><NavLink to="/scores">Scores</NavLink><NavLink to="/charities">Charities</NavLink><NavLink to="/draws">Draws</NavLink>{profile?.role==='admin'&&<NavLink to="/admin"><Shield size={15}/> Admin</NavLink>}</nav>
 <button className="icon-btn" title="Sign out" onClick={logout}><LogOut size={17}/></button></header><main>{children}</main></div>
}

function Home({profile}){
 return <div className="hero"><section className="hero-copy"><div className="eyebrow">YOUR GAME. THEIR FUTURE.</div><h1>Every score can<br/><span>do more.</span></h1><p>Enter your latest Stableford scores, join the monthly draw and direct part of your subscription to a charity you choose.</p>
 <div className="actions"><NavLink className="primary" to="/dashboard">Open dashboard</NavLink><NavLink className="secondary" to="/charities">Explore charities</NavLink></div></section>
 <section className="impact-grid"><Stat icon={<Trophy/>} value="3" label="Monthly prize tiers"/><Stat icon={<Heart/>} value="10%" label="Minimum charity share"/><Stat icon={<Gauge/>} value="1–45" label="Stableford range"/></section></div>
}
function Stat({icon,value,label}){return <div className="stat">{icon}<strong>{value}</strong><small>{label}</small></div>}

async function getSubscription(){
 const {data:{user}}=await supabase.auth.getUser(); if(!user)return null;
 return (await supabase.from('subscriptions').select('*').eq('user_id',user.id).maybeSingle()).data;
}

function Dashboard(){
 const [sub,setSub]=useState(null),[charity,setCharity]=useState(null),[scores,setScores]=useState([]),[draws,setDraws]=useState([]);
 useEffect(()=>{load()},[]);
 async function load(){
   const {data:{user}}=await supabase.auth.getUser();
   const s=await getSubscription();setSub(s);
   const sc=await supabase.from('scores').select('*').eq('user_id',user.id).order('played_on',{ascending:false});setScores(sc.data||[]);
   if(s?.charity_id){const c=await supabase.from('charities').select('*').eq('id',s.charity_id).single();setCharity(c.data)}
   const d=await supabase.from('draws').select('*').eq('status','published').order('draw_date',{ascending:false}).limit(3);setDraws(d.data||[]);
 }
 return <><div className="page-head"><div><div className="eyebrow">MEMBER SPACE</div><h2>Your dashboard</h2></div><div className={`pill ${sub?.status==='active'?'ok':''}`}>{sub?.status||'inactive'}</div></div>
 <div className="cards four"><Card title="Subscription" value={sub?.status==='active'?'Active':'Not active'} sub={sub?.renewal_date?`Renews ${sub.renewal_date}`:'Choose a plan to participate'}/><Card title="Latest score" value={scores[0]?.stableford ?? '—'} sub={scores[0]?.played_on||'No score yet'}/><Card title="Charity share" value={sub?.charity_percent?`${sub.charity_percent}%`:'—'} sub={charity?.name||'Select a charity'}/><Card title="Draws" value={draws.length} sub="Published results"/></div>
 <div className="split"><section className="panel"><h3>Latest scores</h3>{scores.length?<table><tbody>{scores.map(s=><tr key={s.id}><td>{s.played_on}</td><td><b>{s.stableford}</b> pts</td></tr>)}</tbody></table>:<Empty text="Add your first Stableford score."/>}<NavLink className="secondary small" to="/scores">Manage scores</NavLink></section>
 <section className="panel"><h3>Charity impact</h3><div className="charity-card">{charity?<><Heart/><div><b>{charity.name}</b><p>{charity.description}</p></div></>:<><Heart/><div><b>Choose your cause</b><p>At least 10% of your subscription can go to a charity you select.</p></div></>}</div><NavLink className="secondary small" to="/charities">Choose charity</NavLink></section></div>
 <section className="panel"><h3>Participation</h3>{draws.length?draws.map(d=><div className="list-row" key={d.id}><span>{d.title}</span><span>{d.draw_date}</span><b>{d.jackpot_amount||0}</b></div>):<Empty text="No published draws yet."/>}</section></>
}
function Card({title,value,sub}){return <div className="card"><small>{title}</small><strong>{value}</strong><span>{sub}</span></div>}
function Empty({text}){return <p className="muted">{text}</p>}

function Scores(){
 const [scores,setScores]=useState([]),[date,setDate]=useState(''),[value,setValue]=useState(''),[msg,setMsg]=useState('');
 const load=async()=>{const {data:{user}}=await supabase.auth.getUser();const r=await supabase.from('scores').select('*').eq('user_id',user.id).order('played_on',{ascending:false});setScores(r.data||[])};
 useEffect(()=>{load()},[]);
 const save=async e=>{e.preventDefault();setMsg('');const {data:{user}}=await supabase.auth.getUser();
   const {error}=await supabase.from('scores').upsert({user_id:user.id,played_on:date,stableford:Number(value)},{onConflict:'user_id,played_on'});
   if(error)setMsg(error.message);else{setDate('');setValue('');setMsg('Score saved. Only your latest 5 scores are retained.');await trimScores(user.id);load()}
 };
 async function trimScores(uid){const {data}=await supabase.from('scores').select('id').eq('user_id',uid).order('played_on',{ascending:false});if((data||[]).length>5){await supabase.from('scores').delete().in('id',data.slice(5).map(x=>x.id))}}
 const del=async id=>{await supabase.from('scores').delete().eq('id',id);load()};
 return <><div className="page-head"><div><div className="eyebrow">PERFORMANCE</div><h2>Your latest 5 scores</h2></div></div>
 <section className="panel"><form className="inline-form" onSubmit={save}><input type="date" value={date} onChange={e=>setDate(e.target.value)} required/><input type="number" min="1" max="45" placeholder="Stableford 1–45" value={value} onChange={e=>setValue(e.target.value)} required/><button className="primary"><Plus size={16}/> Save score</button></form>{msg&&<div className="notice">{msg}</div>}
 <table><thead><tr><th>Date</th><th>Stableford</th><th></th></tr></thead><tbody>{scores.map(s=><tr key={s.id}><td>{s.played_on}</td><td><b>{s.stableford}</b></td><td><button className="danger icon-btn" onClick={()=>del(s.id)}><Trash2 size={16}/></button></td></tr>)}</tbody></table></section></>
}

function Charities(){
 const [items,setItems]=useState([]),[selected,setSelected]=useState(null),[pct,setPct]=useState(10),[msg,setMsg]=useState('');
 useEffect(()=>{supabase.from('charities').select('*').eq('active',true).order('featured',{ascending:false}).then(({data})=>setItems(data||[]))},[]);
 const choose=async()=>{const {data:{user}}=await supabase.auth.getUser();const {error}=await supabase.from('subscriptions').upsert({user_id:user.id,charity_id:selected,charity_percent:pct,status:'inactive',plan:'monthly'},{onConflict:'user_id'});setMsg(error?.message||'Charity preference saved. Activate a subscription to enter draws.')};
 return <><div className="page-head"><div><div className="eyebrow">GIVE BACK</div><h2>Choose your cause</h2></div></div><div className="charity-grid">{items.map(c=><button className={`charity ${selected===c.id?'selected':''}`} key={c.id} onClick={()=>setSelected(c.id)}><div className="charity-icon"><Heart/></div><h3>{c.name}</h3><p>{c.description}</p><small>{c.location||'Community cause'}</small></button>)}</div>
 <section className="panel choice"><h3>Contribution</h3><p>Minimum 10%. Increase it if you want.</p><input type="range" min="10" max="50" value={pct} onChange={e=>setPct(e.target.value)}/><b>{pct}%</b><button className="primary" disabled={!selected} onClick={choose}>Save charity preference</button>{msg&&<div className="notice">{msg}</div>}</section></>
}

function Draws(){
 const [draws,setDraws]=useState([]);
 useEffect(()=>{supabase.from('draws').select('*').eq('status','published').order('draw_date',{ascending:false}).then(({data})=>setDraws(data||[]))},[]);
 return <><div className="page-head"><div><div className="eyebrow">THE DRAW</div><h2>Monthly rewards</h2></div></div><div className="draw-grid">{draws.map(d=><div className="draw" key={d.id}><Sparkles/><small>{d.draw_date}</small><h3>{d.title}</h3><div className="jackpot">₹{Number(d.jackpot_amount||0).toLocaleString('en-IN')}</div><p>{d.status}</p></div>)}</div>{!draws.length&&<section className="panel"><Empty text="Draws will appear here after an administrator publishes them."/></section>}</>
}

function Admin(){
 const [users,setUsers]=useState([]),[charities,setCharities]=useState([]),[draws,setDraws]=useState([]),[winners,setWinners]=useState([]),[msg,setMsg]=useState('');
 const load=async()=>{setUsers((await supabase.from('profiles').select('*').order('created_at',{ascending:false})).data||[]);setCharities((await supabase.from('charities').select('*')).data||[]);setDraws((await supabase.from('draws').select('*').order('draw_date',{ascending:false})).data||[]);setWinners((await supabase.from('winners').select('*').order('created_at',{ascending:false})).data||[])};
 useEffect(()=>{load()},[]);
 const addCharity=async()=>{const name=prompt('Charity name');if(!name)return;await supabase.from('charities').insert({name,description:'Community charity',active:true});load()};
 const publish=async id=>{await supabase.from('draws').update({status:'published',published_at:new Date().toISOString()}).eq('id',id);load()};
 const verify=async(id,approved)=>{await supabase.from('winners').update({verification_status:approved?'approved':'rejected',payout_status:approved?'pending':'not_eligible'}).eq('id',id);load()};
 return <><div className="page-head"><div><div className="eyebrow">CONTROL ROOM</div><h2>Admin dashboard</h2></div></div><div className="cards three"><Card title="Users" value={users.length} sub="Registered profiles"/><Card title="Charities" value={charities.length} sub="Listed causes"/><Card title="Winners" value={winners.length} sub="Verification queue"/></div>
 <section className="panel"><div className="panel-head"><h3>Charities</h3><button className="secondary small" onClick={addCharity}><Plus size={14}/> Add</button></div>{charities.map(c=><div className="list-row" key={c.id}><span>{c.name}</span><span>{c.active?'Active':'Inactive'}</span></div>)}</section>
 <section className="panel"><h3>Draw management</h3>{draws.map(d=><div className="list-row" key={d.id}><span>{d.title}</span><span>{d.draw_date}</span><button className="secondary small" onClick={()=>publish(d.id)} disabled={d.status==='published'}>{d.status==='published'?'Published':'Publish'}</button></div>)}</section>
 <section className="panel"><h3>Winner verification</h3>{winners.length?winners.map(w=><div className="list-row" key={w.id}><span>{w.id.slice(0,8)}…</span><span>{w.verification_status}</span><span>{w.payout_status}</span><button className="secondary small" onClick={()=>verify(w.id,true)}><Check size={14}/></button><button className="danger small" onClick={()=>verify(w.id,false)}><X size={14}/></button></div>):<Empty text="No winners awaiting verification."/>}</section>
 </>;
}

function AppGuard(){ return <App/> }
createRoot(document.getElementById('root')).render(<BrowserRouter><AppGuard/></BrowserRouter>);
