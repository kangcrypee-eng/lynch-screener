import { useState, useCallback, useEffect } from 'react';
import { api } from './api.js';

// ─── 상수 ───
const SECTORS = ['All Sectors','Technology','Healthcare','Consumer Cyclical','Industrials','Communication Services','Financial Services','Energy','Basic Materials'];
const TABS = [
  { id: 'screener', label: '🔍 스크리너', desc: '고성장주 발굴' },
  { id: 'portfolio', label: '💼 포트폴리오', desc: '보유종목 관리' },
  { id: 'history', label: '📈 히스토리', desc: '주간 추이' },
  { id: 'signals', label: '🚨 매도시그널', desc: '경고 알림' },
];

const STATUS_COLORS = {
  excellent:'#10B981',optimal:'#10B981',good:'#10B981',undiscovered:'#10B981',buying:'#10B981',high_growth:'#10B981',
  moderate:'#F59E0B',fair:'#F59E0B',mixed:'#F59E0B',watched:'#F59E0B',growth_sector:'#F59E0B',turnaround:'#F97316',
  high:'#EF4444',expensive:'#EF4444',weak:'#EF4444',selling:'#EF4444',crowded:'#EF4444',negative:'#EF4444',
  low:'#94A3B8',neutral:'#94A3B8',other:'#94A3B8',unknown:'#64748B',
};

// ─── 공통 컴포넌트 ───
function Stars({n}){return <span style={{letterSpacing:2}}>{[1,2,3,4,5].map(i=><span key={i} style={{color:i<=n?'#F59E0B':'#2D3748',fontSize:13}}>★</span>)}</span>}

function Badge({label,value,status}){
  const c=STATUS_COLORS[status]||'#64748B';
  return <span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:5,fontSize:10,fontWeight:600,background:`${c}12`,border:`1px solid ${c}22`,color:c}}><span style={{fontSize:6}}>●</span>{label}: {value}</span>
}

function Btn({children,onClick,disabled,variant='primary',size='md'}){
  const styles={
    primary:{bg:'linear-gradient(135deg,#F59E0B,#D97706)',color:'#0B0F1A',border:'none'},
    secondary:{bg:'rgba(255,255,255,0.04)',color:'#94A3B8',border:'1px solid rgba(255,255,255,0.08)'},
    danger:{bg:'rgba(239,68,68,0.12)',color:'#F87171',border:'1px solid rgba(239,68,68,0.2)'},
    success:{bg:'rgba(16,185,129,0.12)',color:'#10B981',border:'1px solid rgba(16,185,129,0.2)'},
  };
  const s=styles[variant];
  const pad=size==='sm'?'5px 12px':'8px 20px';
  return <button onClick={onClick} disabled={disabled} style={{background:s.bg,color:s.color,border:s.border,padding:pad,borderRadius:7,fontSize:size==='sm'?11:13,fontWeight:700,cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.5:1,transition:'all 0.2s'}}>{children}</button>
}

function Input({value,onChange,placeholder,onKeyDown,style={}}){
  return <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} onKeyDown={onKeyDown}
    style={{background:'#111827',border:'1px solid rgba(255,255,255,0.06)',color:'#E2E8F0',padding:'7px 12px',borderRadius:7,fontSize:12,outline:'none',...style}} />
}

function formatCap(v){if(!v)return'N/A';if(v>=1e12)return`$${(v/1e12).toFixed(1)}T`;if(v>=1e9)return`$${(v/1e9).toFixed(1)}B`;return`$${(v/1e6).toFixed(0)}M`}

// ─── 스크리너 카드 ───
function StockCard({stock,rank,onBuy,comparison}){
  const [open,setOpen]=useState(false);
  const b=stock.breakdown||{};
  const rc=rank===0?'#F59E0B':rank===1?'#94A3B8':rank===2?'#CD7F32':'#4B5563';
  const isNew=comparison?.newEntries?.includes(stock.symbol);

  return(
    <div onClick={()=>setOpen(!open)} style={{
      background:rank<3?`linear-gradient(135deg,${rc}0D,transparent)`:'rgba(255,255,255,0.012)',
      border:`1px solid ${rank<3?`${rc}28`:'rgba(255,255,255,0.05)'}`,
      borderRadius:13,padding:'14px 18px',cursor:'pointer',transition:'all 0.2s',position:'relative',
    }} onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,0.2)';}} onMouseLeave={e=>{e.currentTarget.style.transform='none';e.currentTarget.style.boxShadow='none';}}>
      {isNew&&<span style={{position:'absolute',top:8,right:12,fontSize:9,fontWeight:700,color:'#10B981',background:'rgba(16,185,129,0.12)',padding:'2px 8px',borderRadius:10,border:'1px solid rgba(16,185,129,0.2)'}}>🆕 신규</span>}

      <div style={{display:'flex',gap:11}}>
        <div style={{width:38,height:38,borderRadius:9,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:rank<3?17:14,color:rc,border:`2px solid ${rc}30`,background:'rgba(0,0,0,0.2)',fontFamily:"'Playfair Display',serif"}}>{rank+1}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:3}}>
            <span style={{fontWeight:800,fontSize:15,color:'#F1F5F9',fontFamily:"'Playfair Display',serif"}}>{stock.symbol}</span>
            <span style={{color:'#64748B',fontSize:11,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{stock.companyName}</span>
            {stock.price&&<span style={{fontWeight:700,fontSize:14,color:'#E2E8F0'}}>${stock.price.toFixed(2)}</span>}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
            <Stars n={stock.stars}/><span style={{fontSize:10,color:'#475569'}}>{stock.score}/100</span>
            <span style={{padding:'1px 7px',borderRadius:14,fontSize:9,fontWeight:600,background:'rgba(99,102,241,0.1)',color:'#818CF8'}}>{b.sector}</span>
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
            {b.epsGrowth&&<Badge label="EPS" value={b.epsGrowth} status={b.epsGrowthStatus}/>}
            {b.peg&&<Badge label="PEG" value={b.peg} status={b.pegStatus}/>}
            {b.debtEquity&&<Badge label="D/E" value={b.debtEquity} status={b.debtStatus}/>}
            <Badge label="연속" value={b.consecutiveGrowth||'N/A'} status={b.consistencyStatus}/>
            {b.revenueGrowth&&<Badge label="매출↑" value={b.revenueGrowth} status={b.revenueStatus}/>}
            {b.institutionPct&&<Badge label="기관" value={b.institutionPct} status={b.institutionStatus}/>}
            <Badge label="내부자" value={`${b.insiderBuys||0}B/${b.insiderSells||0}S`} status={b.insiderStatus}/>
          </div>

          {open&&(
            <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid rgba(255,255,255,0.04)',animation:'fadeIn 0.2s ease'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'5px 16px',fontSize:11,marginBottom:10}}>
                <div><span style={{color:'#64748B'}}>시가총액:</span> <span style={{color:'#CBD5E1'}}>{formatCap(stock.marketCap)}</span></div>
                <div><span style={{color:'#64748B'}}>PER:</span> <span style={{color:'#CBD5E1'}}>{stock.pe?.toFixed(1)||'N/A'}</span></div>
                <div><span style={{color:'#64748B'}}>Forward PE:</span> <span style={{color:'#CBD5E1'}}>{stock.forwardPE?.toFixed(1)||'N/A'}</span></div>
                <div><span style={{color:'#64748B'}}>52주:</span> <span style={{color:'#CBD5E1'}}>${stock.yearLow?.toFixed(0)||'?'}~${stock.yearHigh?.toFixed(0)||'?'}</span></div>
                <div><span style={{color:'#64748B'}}>산업:</span> <span style={{color:'#CBD5E1'}}>{b.industry||'N/A'}</span></div>
                <div><span style={{color:'#64748B'}}>시장:</span> <span style={{color:'#CBD5E1'}}>{b.marketStatus||'N/A'}</span></div>
              </div>
              <Btn variant="success" size="sm" onClick={e=>{e.stopPropagation();onBuy(stock);}}>💰 매수 기록</Btn>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 스크리너 탭 ───
function ScreenerTab(){
  const [stocks,setStocks]=useState([]);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState(null);
  const [sector,setSector]=useState('All Sectors');
  const [sortBy,setSortBy]=useState('score');
  const [comparison,setComparison]=useState(null);
  const [ticker,setTicker]=useState('');
  const [single,setSingle]=useState(null);
  const [singleLoading,setSingleLoading]=useState(false);
  const [buyModal,setBuyModal]=useState(null);
  const [buyShares,setBuyShares]=useState('');

  const run=useCallback(async(save=false)=>{
    setLoading(true);setError(null);setStocks([]);
    try{
      const d=await api.screener(sector,save);
      setStocks(d.stocks||[]);
      setComparison(d.comparison);
    }catch(e){setError(e.message);}
    finally{setLoading(false);}
  },[sector]);

  const analyzeSingle=async()=>{
    if(!ticker.trim())return;
    setSingleLoading(true);setSingle(null);
    try{const d=await api.analyze(ticker.trim().toUpperCase());setSingle(d);}
    catch(e){setSingle({error:e.message});}
    finally{setSingleLoading(false);}
  };

  const handleBuy=async()=>{
    if(!buyModal||!buyShares)return;
    try{await api.buy(buyModal.symbol,Number(buyShares),buyModal.price);setBuyModal(null);setBuyShares('');alert(`${buyModal.symbol} ${buyShares}주 매수 기록 완료!`);}
    catch(e){alert('오류: '+e.message);}
  };

  const sorted=[...stocks].sort((a,b)=>{
    if(sortBy==='score')return b.score-a.score;
    if(sortBy==='peg')return(parseFloat(a.breakdown?.peg)||999)-(parseFloat(b.breakdown?.peg)||999);
    if(sortBy==='epsGrowth')return(parseFloat(b.breakdown?.epsGrowth)||0)-(parseFloat(a.breakdown?.epsGrowth)||0);
    if(sortBy==='institution')return(parseFloat(a.breakdown?.institutionPct)||100)-(parseFloat(b.breakdown?.institutionPct)||100);
    return 0;
  });

  return(
    <div>
      {/* 개별 분석 */}
      <div style={{display:'flex',gap:6,marginBottom:12,padding:'10px 14px',background:'rgba(255,255,255,0.015)',borderRadius:9,border:'1px solid rgba(255,255,255,0.04)'}}>
        <span style={{color:'#64748B',fontSize:11,alignSelf:'center',whiteSpace:'nowrap'}}>개별 분석:</span>
        <Input value={ticker} onChange={setTicker} placeholder="NVDA" onKeyDown={e=>e.key==='Enter'&&analyzeSingle()} style={{flex:1}}/>
        <Btn variant="secondary" size="sm" onClick={analyzeSingle}>{singleLoading?'...':'분석'}</Btn>
      </div>
      {single&&!single.error&&<div style={{marginBottom:12}}><StockCard stock={single} rank={-1} onBuy={setBuyModal} comparison={null}/></div>}

      {/* 컨트롤 */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginBottom:12}}>
        <select value={sector} onChange={e=>setSector(e.target.value)} style={{background:'#111827',border:'1px solid rgba(255,255,255,0.06)',color:'#E2E8F0',padding:'7px 28px 7px 10px',borderRadius:7,fontSize:11,fontWeight:600,cursor:'pointer',outline:'none',appearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%2394A3B8' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 8px center'}}>
          {SECTORS.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{background:'#111827',border:'1px solid rgba(255,255,255,0.06)',color:'#E2E8F0',padding:'7px 28px 7px 10px',borderRadius:7,fontSize:11,fontWeight:600,cursor:'pointer',outline:'none',appearance:'none',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%2394A3B8' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 8px center'}}>
          <option value="score">Lynch Score</option><option value="peg">PEG↑</option><option value="epsGrowth">EPS↑</option><option value="institution">기관↓</option>
        </select>
        <div style={{marginLeft:'auto',display:'flex',gap:6}}>
          <Btn onClick={()=>run(false)} disabled={loading}>{loading?'분석중...':'🔍 스크리닝'}</Btn>
          <Btn variant="success" onClick={()=>run(true)} disabled={loading} size="sm">💾 저장</Btn>
        </div>
      </div>

      {/* 비교 요약 */}
      {comparison&&(comparison.newEntries?.length>0||comparison.dropped?.length>0)&&(
        <div style={{padding:'10px 14px',borderRadius:9,background:'rgba(255,255,255,0.015)',border:'1px solid rgba(255,255,255,0.04)',marginBottom:10,fontSize:11}}>
          <span style={{color:'#64748B',fontWeight:600}}>vs 지난주: </span>
          {comparison.newEntries?.length>0&&<span style={{color:'#10B981'}}>🟢 신규 {comparison.newEntries.join(', ')} </span>}
          {comparison.dropped?.length>0&&<span style={{color:'#EF4444'}}>🔴 퇴출 {comparison.dropped.join(', ')} </span>}
          {comparison.maintained?.length>0&&<span style={{color:'#94A3B8'}}>⚪ 유지 {comparison.maintained.length}개</span>}
        </div>
      )}

      {/* 결과 */}
      {loading&&<div style={{textAlign:'center',padding:'50px 0'}}><p style={{color:'#64748B',fontSize:13}}>린치 8가지 기준으로 분석 중...</p></div>}
      {error&&<div style={{padding:'14px',borderRadius:9,background:'rgba(239,68,68,0.07)',color:'#F87171',fontSize:12,textAlign:'center'}}>⚠️ {error}</div>}
      {!loading&&!stocks.length&&!error&&<div style={{textAlign:'center',padding:'50px 0'}}><div style={{fontSize:36,marginBottom:10}}>📊</div><p style={{color:'#475569',fontSize:13}}>스크리닝 버튼으로 고성장주를 검색하세요</p><p style={{color:'#334155',fontSize:11,marginTop:6}}>💾 저장 버튼: 이번 주 스냅샷으로 기록</p></div>}

      <div style={{display:'flex',flexDirection:'column',gap:7}}>
        {sorted.map((s,i)=><div key={s.symbol} style={{animation:`slideUp 0.3s ease ${i*0.04}s both`}}><StockCard stock={s} rank={i} onBuy={setBuyModal} comparison={comparison}/></div>)}
      </div>

      {/* 매수 모달 */}
      {buyModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setBuyModal(null)}>
          <div style={{background:'#1E293B',borderRadius:14,padding:'24px',width:320,border:'1px solid rgba(255,255,255,0.1)'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:16,fontWeight:800,color:'#F1F5F9',marginBottom:4}}>{buyModal.symbol} 매수</h3>
            <p style={{fontSize:12,color:'#64748B',marginBottom:14}}>현재가: ${buyModal.price?.toFixed(2)||'N/A'}</p>
            <Input value={buyShares} onChange={setBuyShares} placeholder="매수 수량" style={{width:'100%',marginBottom:10}} onKeyDown={e=>e.key==='Enter'&&handleBuy()}/>
            <div style={{display:'flex',gap:8}}>
              <Btn variant="success" onClick={handleBuy}>매수 기록</Btn>
              <Btn variant="secondary" onClick={()=>setBuyModal(null)}>취소</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 포트폴리오 탭 ───
function PortfolioTab(){
  const [portfolio,setPortfolio]=useState(null);
  const [loading,setLoading]=useState(false);
  const [sellModal,setSellModal]=useState(null);
  const [sellShares,setSellShares]=useState('');

  const load=async()=>{setLoading(true);try{setPortfolio(await api.getPortfolio());}catch{}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);

  const handleSell=async()=>{
    if(!sellModal||!sellShares)return;
    try{await api.sell(sellModal.symbol,Number(sellShares),sellModal.currentPrice||0);setSellModal(null);setSellShares('');load();}
    catch(e){alert(e.message);}
  };

  if(loading)return<p style={{color:'#64748B',textAlign:'center',padding:40}}>포트폴리오 로딩중...</p>;
  if(!portfolio||!portfolio.holdings?.length)return<div style={{textAlign:'center',padding:'50px 0'}}><div style={{fontSize:36,marginBottom:10}}>💼</div><p style={{color:'#475569',fontSize:13}}>보유 종목이 없습니다</p><p style={{color:'#334155',fontSize:11,marginTop:6}}>스크리너에서 종목을 매수해 보세요</p></div>;

  const totalInvested=portfolio.holdings.reduce((s,h)=>s+(h.avgPrice*h.shares),0);
  const totalCurrent=portfolio.holdings.reduce((s,h)=>s+((h.currentPrice||h.avgPrice)*h.shares),0);
  const totalPnL=totalCurrent-totalInvested;
  const pnlPct=totalInvested>0?((totalPnL/totalInvested)*100):0;

  return(
    <div>
      {/* 요약 */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:14}}>
        <div style={{padding:'12px',borderRadius:10,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.04)',textAlign:'center'}}>
          <div style={{fontSize:10,color:'#64748B',marginBottom:4}}>투자금</div>
          <div style={{fontSize:16,fontWeight:800,color:'#E2E8F0'}}>${totalInvested.toFixed(0)}</div>
        </div>
        <div style={{padding:'12px',borderRadius:10,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.04)',textAlign:'center'}}>
          <div style={{fontSize:10,color:'#64748B',marginBottom:4}}>현재가치</div>
          <div style={{fontSize:16,fontWeight:800,color:'#E2E8F0'}}>${totalCurrent.toFixed(0)}</div>
        </div>
        <div style={{padding:'12px',borderRadius:10,background:totalPnL>=0?'rgba(16,185,129,0.06)':'rgba(239,68,68,0.06)',border:`1px solid ${totalPnL>=0?'rgba(16,185,129,0.15)':'rgba(239,68,68,0.15)'}`,textAlign:'center'}}>
          <div style={{fontSize:10,color:'#64748B',marginBottom:4}}>손익</div>
          <div style={{fontSize:16,fontWeight:800,color:totalPnL>=0?'#10B981':'#EF4444'}}>{totalPnL>=0?'+':''}${totalPnL.toFixed(0)} ({pnlPct.toFixed(1)}%)</div>
        </div>
      </div>

      {/* 보유 종목 */}
      <div style={{display:'flex',flexDirection:'column',gap:7}}>
        {portfolio.holdings.map(h=>{
          const pnl=((h.currentPrice||h.avgPrice)-h.avgPrice)*h.shares;
          const pnlP=h.avgPrice>0?((h.currentPrice||h.avgPrice)-h.avgPrice)/h.avgPrice*100:0;
          const signals=portfolio.sellSignals?.[h.symbol]||[];
          return(
            <div key={h.symbol} style={{padding:'14px 16px',borderRadius:11,background:'rgba(255,255,255,0.012)',border:`1px solid ${signals.some(s=>s.severity==='high')?'rgba(239,68,68,0.2)':'rgba(255,255,255,0.05)'}`,}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                <span style={{fontWeight:800,fontSize:15,color:'#F1F5F9',fontFamily:"'Playfair Display',serif"}}>{h.symbol}</span>
                <span style={{color:'#64748B',fontSize:11}}>{h.shares}주 · 평균 ${h.avgPrice?.toFixed(2)}</span>
                <span style={{marginLeft:'auto',fontWeight:700,fontSize:14,color:pnl>=0?'#10B981':'#EF4444'}}>
                  {pnl>=0?'+':''}${pnl.toFixed(0)} ({pnlP.toFixed(1)}%)
                </span>
              </div>
              {h.currentBreakdown&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:3,marginBottom:6}}>
                  <Badge label="Score" value={`${h.currentScore}/100`} status={h.currentScore>=60?'good':h.currentScore>=40?'moderate':'weak'}/>
                  {h.currentBreakdown.peg&&<Badge label="PEG" value={h.currentBreakdown.peg} status={h.currentBreakdown.pegStatus}/>}
                  {h.currentBreakdown.epsGrowth&&<Badge label="EPS" value={h.currentBreakdown.epsGrowth} status={h.currentBreakdown.epsGrowthStatus}/>}
                </div>
              )}
              {signals.length>0&&(
                <div style={{marginBottom:6}}>
                  {signals.map((s,i)=>(
                    <div key={i} style={{fontSize:11,padding:'3px 8px',borderRadius:5,marginBottom:3,
                      background:s.severity==='high'?'rgba(239,68,68,0.08)':s.severity==='medium'?'rgba(245,158,11,0.08)':'rgba(148,163,184,0.08)',
                      color:s.severity==='high'?'#F87171':s.severity==='medium'?'#FBBF24':'#94A3B8',
                      border:`1px solid ${s.severity==='high'?'rgba(239,68,68,0.15)':s.severity==='medium'?'rgba(245,158,11,0.15)':'rgba(148,163,184,0.1)'}`,
                    }}>
                      {s.severity==='high'?'🔴':s.severity==='medium'?'🟡':'🔵'} {s.reason}
                    </div>
                  ))}
                </div>
              )}
              <Btn variant="danger" size="sm" onClick={()=>setSellModal(h)}>매도</Btn>
            </div>
          );
        })}
      </div>

      {/* 거래 내역 */}
      {portfolio.transactions?.length>0&&(
        <div style={{marginTop:16}}>
          <h3 style={{fontSize:12,fontWeight:700,color:'#64748B',marginBottom:8}}>최근 거래</h3>
          {portfolio.transactions.slice(-10).reverse().map((t,i)=>(
            <div key={i} style={{fontSize:11,color:'#94A3B8',padding:'4px 0',borderBottom:'1px solid rgba(255,255,255,0.03)'}}>
              <span style={{color:t.type==='buy'?'#10B981':'#EF4444',fontWeight:600}}>{t.type==='buy'?'매수':'매도'}</span> {t.symbol} {t.shares}주 @${t.price?.toFixed(2)} <span style={{color:'#475569'}}>{new Date(t.date).toLocaleDateString('ko-KR')}</span>
            </div>
          ))}
        </div>
      )}

      {/* 매도 모달 */}
      {sellModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}} onClick={()=>setSellModal(null)}>
          <div style={{background:'#1E293B',borderRadius:14,padding:'24px',width:320,border:'1px solid rgba(255,255,255,0.1)'}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:16,fontWeight:800,color:'#F1F5F9',marginBottom:4}}>{sellModal.symbol} 매도</h3>
            <p style={{fontSize:12,color:'#64748B',marginBottom:14}}>보유: {sellModal.shares}주</p>
            <Input value={sellShares} onChange={setSellShares} placeholder="매도 수량" style={{width:'100%',marginBottom:10}} onKeyDown={e=>e.key==='Enter'&&handleSell()}/>
            <div style={{display:'flex',gap:8}}><Btn variant="danger" onClick={handleSell}>매도 기록</Btn><Btn variant="secondary" onClick={()=>setSellModal(null)}>취소</Btn></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 히스토리 탭 ───
function HistoryTab(){
  const [snaps,setSnaps]=useState([]);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    setLoading(true);
    api.snapshots().then(d=>setSnaps(d.snapshots||[])).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  if(loading)return<p style={{color:'#64748B',textAlign:'center',padding:40}}>히스토리 로딩중...</p>;
  if(!snaps.length)return<div style={{textAlign:'center',padding:'50px 0'}}><div style={{fontSize:36,marginBottom:10}}>📈</div><p style={{color:'#475569',fontSize:13}}>저장된 스냅샷이 없습니다</p><p style={{color:'#334155',fontSize:11,marginTop:6}}>스크리너에서 💾 저장 버튼을 눌러 주간 기록을 시작하세요</p></div>;

  // 종목별 스코어 추이 추출
  const allSymbols=new Set();
  snaps.forEach(s=>s.stocks.forEach(st=>allSymbols.add(st.symbol)));
  const symbolTrends={};
  allSymbols.forEach(sym=>{
    symbolTrends[sym]=snaps.map(s=>{
      const st=s.stocks.find(x=>x.symbol===sym);
      return{date:new Date(s.timestamp).toLocaleDateString('ko-KR',{month:'short',day:'numeric'}),score:st?.score||null,price:st?.price||null};
    });
  });

  // 가장 최근 스냅샷의 상위 종목
  const latest=snaps[snaps.length-1];
  const topSymbols=latest.stocks.slice(0,10).map(s=>s.symbol);

  return(
    <div>
      <h3 style={{fontSize:13,fontWeight:700,color:'#94A3B8',marginBottom:10}}>📅 {snaps.length}주간 기록 (최근 → 과거)</h3>
      
      {/* 상위 종목 스코어 추이 */}
      <div style={{marginBottom:16}}>
        <h4 style={{fontSize:11,color:'#64748B',marginBottom:8}}>Top 10 스코어 추이</h4>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
            <thead>
              <tr>
                <th style={{textAlign:'left',padding:'6px 8px',color:'#64748B',borderBottom:'1px solid rgba(255,255,255,0.06)'}}>종목</th>
                {snaps.map((s,i)=><th key={i} style={{padding:'6px 6px',color:'#64748B',borderBottom:'1px solid rgba(255,255,255,0.06)',whiteSpace:'nowrap'}}>{new Date(s.timestamp).toLocaleDateString('ko-KR',{month:'short',day:'numeric'})}</th>)}
              </tr>
            </thead>
            <tbody>
              {topSymbols.map(sym=>(
                <tr key={sym}>
                  <td style={{padding:'5px 8px',fontWeight:700,color:'#E2E8F0'}}>{sym}</td>
                  {snaps.map((s,i)=>{
                    const st=s.stocks.find(x=>x.symbol===sym);
                    const sc=st?.score;
                    const color=sc>=60?'#10B981':sc>=40?'#F59E0B':sc?'#EF4444':'#2D3748';
                    return<td key={i} style={{padding:'5px 6px',textAlign:'center',color,fontWeight:600}}>{sc||'—'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 주간 스냅샷 상세 */}
      {[...snaps].reverse().map((snap,idx)=>(
        <div key={idx} style={{marginBottom:10,padding:'12px 14px',borderRadius:10,background:'rgba(255,255,255,0.012)',border:'1px solid rgba(255,255,255,0.04)'}}>
          <div style={{fontSize:12,fontWeight:700,color:'#94A3B8',marginBottom:6}}>
            📅 {new Date(snap.timestamp).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'})}
            <span style={{color:'#475569',fontWeight:400,marginLeft:8}}>{snap.weekKey}</span>
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
            {snap.stocks.slice(0,10).map((s,i)=>(
              <span key={s.symbol} style={{padding:'3px 9px',borderRadius:6,fontSize:10,fontWeight:600,
                background:i<3?'rgba(245,158,11,0.1)':'rgba(255,255,255,0.03)',
                color:i<3?'#F59E0B':'#94A3B8',
                border:`1px solid ${i<3?'rgba(245,158,11,0.15)':'rgba(255,255,255,0.04)'}`,
              }}>
                #{i+1} {s.symbol} ({s.score})
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── 매도시그널 탭 ───
function SignalsTab(){
  const [portfolio,setPortfolio]=useState(null);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    setLoading(true);
    api.getPortfolio().then(setPortfolio).catch(()=>{}).finally(()=>setLoading(false));
  },[]);

  if(loading)return<p style={{color:'#64748B',textAlign:'center',padding:40}}>매도시그널 분석중...</p>;
  if(!portfolio?.holdings?.length)return<div style={{textAlign:'center',padding:'50px 0'}}><div style={{fontSize:36,marginBottom:10}}>🚨</div><p style={{color:'#475569',fontSize:13}}>보유 종목이 없습니다</p></div>;

  const allSignals=[];
  Object.entries(portfolio.sellSignals||{}).forEach(([sym,sigs])=>{
    sigs.forEach(s=>allSignals.push({symbol:sym,...s}));
  });
  allSignals.sort((a,b)=>{const o={high:0,medium:1,low:2};return(o[a.severity]||3)-(o[b.severity]||3);});

  const highCount=allSignals.filter(s=>s.severity==='high').length;
  const medCount=allSignals.filter(s=>s.severity==='medium').length;

  return(
    <div>
      {/* 요약 */}
      <div style={{display:'flex',gap:8,marginBottom:14}}>
        <div style={{flex:1,padding:'12px',borderRadius:10,background:highCount>0?'rgba(239,68,68,0.06)':'rgba(16,185,129,0.06)',border:`1px solid ${highCount>0?'rgba(239,68,68,0.15)':'rgba(16,185,129,0.15)'}`,textAlign:'center'}}>
          <div style={{fontSize:24,marginBottom:2}}>{highCount>0?'🔴':'✅'}</div>
          <div style={{fontSize:20,fontWeight:800,color:highCount>0?'#EF4444':'#10B981'}}>{highCount}</div>
          <div style={{fontSize:10,color:'#64748B'}}>매도 신호</div>
        </div>
        <div style={{flex:1,padding:'12px',borderRadius:10,background:'rgba(245,158,11,0.06)',border:'1px solid rgba(245,158,11,0.15)',textAlign:'center'}}>
          <div style={{fontSize:24,marginBottom:2}}>🟡</div>
          <div style={{fontSize:20,fontWeight:800,color:'#F59E0B'}}>{medCount}</div>
          <div style={{fontSize:10,color:'#64748B'}}>주의 신호</div>
        </div>
        <div style={{flex:1,padding:'12px',borderRadius:10,background:'rgba(255,255,255,0.02)',border:'1px solid rgba(255,255,255,0.04)',textAlign:'center'}}>
          <div style={{fontSize:24,marginBottom:2}}>💼</div>
          <div style={{fontSize:20,fontWeight:800,color:'#E2E8F0'}}>{portfolio.holdings.length}</div>
          <div style={{fontSize:10,color:'#64748B'}}>보유 종목</div>
        </div>
      </div>

      {allSignals.length===0?(
        <div style={{textAlign:'center',padding:'40px 0'}}>
          <div style={{fontSize:36,marginBottom:10}}>✅</div>
          <p style={{color:'#10B981',fontSize:14,fontWeight:600}}>매도 시그널 없음</p>
          <p style={{color:'#64748B',fontSize:12,marginTop:4}}>모든 보유 종목이 린치 기준을 유지하고 있습니다</p>
        </div>
      ):(
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {allSignals.map((s,i)=>(
            <div key={i} style={{
              padding:'12px 16px',borderRadius:10,
              background:s.severity==='high'?'rgba(239,68,68,0.06)':s.severity==='medium'?'rgba(245,158,11,0.06)':'rgba(148,163,184,0.04)',
              border:`1px solid ${s.severity==='high'?'rgba(239,68,68,0.15)':s.severity==='medium'?'rgba(245,158,11,0.15)':'rgba(148,163,184,0.08)'}`,
            }}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:14}}>{s.severity==='high'?'🔴':s.severity==='medium'?'🟡':'🔵'}</span>
                <span style={{fontWeight:800,fontSize:14,color:'#F1F5F9'}}>{s.symbol}</span>
                <span style={{fontSize:10,fontWeight:600,padding:'2px 8px',borderRadius:10,
                  background:s.type==='sell'?'rgba(239,68,68,0.12)':'rgba(245,158,11,0.12)',
                  color:s.type==='sell'?'#F87171':'#FBBF24',
                }}>{s.type==='sell'?'매도 권고':'주의'}</span>
              </div>
              <p style={{fontSize:12,color:'#94A3B8',marginTop:4}}>{s.reason}</p>
            </div>
          ))}
        </div>
      )}

      <div style={{marginTop:16,padding:'10px 14px',borderRadius:9,background:'rgba(255,255,255,0.012)',border:'1px solid rgba(255,255,255,0.03)'}}>
        <p style={{color:'#475569',fontSize:10,lineHeight:1.6,textAlign:'center'}}>
          린치 매도 기준: PEG {'>'} 2.0 | EPS 음전환 | D/E {'>'} 1.5 | 3주 연속 스코어 하락 | 매출 역성장 | 내부자 순매도 | 기관 과밀(80%+)
        </p>
      </div>
    </div>
  );
}

// ─── 메인 앱 ───
export default function App(){
  const [tab,setTab]=useState('screener');

  return(
    <div style={{minHeight:'100vh',background:'#0B0F1A',color:'#E2E8F0',fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=DM+Sans:wght@400;500;600;700;800&display=swap');
        @keyframes fadeIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;margin:0;padding:0}body{background:#0B0F1A}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#1E293B;border-radius:2px}
      `}</style>

      {/* 헤더 */}
      <header style={{background:'linear-gradient(180deg,rgba(245,158,11,0.06) 0%,transparent 100%)',borderBottom:'1px solid rgba(255,255,255,0.04)',padding:'22px 16px 14px'}}>
        <div style={{maxWidth:860,margin:'0 auto'}}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{fontSize:22}}>🦁</span>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:900,background:'linear-gradient(135deg,#F59E0B,#F97316)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Lynch Fast Growers</h1>
          </div>
          <p style={{color:'#64748B',fontSize:11,marginTop:2,marginLeft:36}}>피터 린치 고성장주 8가지 기준 · 주간 추적 · 매도시그널</p>
        </div>
      </header>

      {/* 탭 네비게이션 */}
      <div style={{maxWidth:860,margin:'0 auto',padding:'10px 16px 0'}}>
        <div style={{display:'flex',gap:4,overflowX:'auto'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:'8px 14px',borderRadius:'8px 8px 0 0',border:'none',cursor:'pointer',
              fontSize:12,fontWeight:tab===t.id?700:500,whiteSpace:'nowrap',transition:'all 0.2s',
              background:tab===t.id?'rgba(245,158,11,0.08)':'transparent',
              color:tab===t.id?'#F59E0B':'#64748B',
              borderBottom:tab===t.id?'2px solid #F59E0B':'2px solid transparent',
            }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 탭 컨텐츠 */}
      <main style={{maxWidth:860,margin:'0 auto',padding:'14px 16px 32px',animation:'fadeIn 0.2s ease'}}>
        {tab==='screener'&&<ScreenerTab/>}
        {tab==='portfolio'&&<PortfolioTab/>}
        {tab==='history'&&<HistoryTab/>}
        {tab==='signals'&&<SignalsTab/>}
      </main>

      <div style={{maxWidth:860,margin:'0 auto',padding:'0 16px 20px'}}>
        <p style={{color:'#334155',fontSize:9,textAlign:'center',lineHeight:1.6}}>
          ⚠️ 투자 권유가 아닌 참고 자료입니다. 최종 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.
        </p>
      </div>
    </div>
  );
}
