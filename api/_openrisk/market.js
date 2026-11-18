const sectors = [
  ['XLC','Communication Services','Media & Entertainment'],
  ['XLY','Consumer Discretionary','E Commerce & Retail'],
  ['XLP','Consumer Staples','Agritech & Foodtech'],
  ['XLE','Energy','Energy'],
  ['XLF','Financials','Fintech'],
  ['XLV','Health Care','Healthtech'],
  ['XLI','Industrials','Robotics'],
  ['XLB','Materials','Circular Economy'],
  ['XLRE','Real Estate','Real Estate Tech'],
  ['XLK','Technology','Hardware & Semiconductors'],
  ['XLU','Utilities','Climate Tech'],
];
const benchmark=['SPY','S&P 500 benchmark'];
const money=value=>Number(String(value || '').replace(/[$,%+,]/g,''));
const endpoint='https://api.nasdaq.com/api/quote/';

async function quote([ticker,sector,niche]) {
  const response=await fetch(endpoint+ticker+'/info?assetclass=etf',{
    signal:AbortSignal.timeout(4500),headers:{'User-Agent':'Mozilla/5.0',Accept:'application/json',Referer:'https://www.nasdaq.com/'},
  });
  if (!response.ok) throw Error('Quote unavailable');
  const {data}=await response.json();
  const extended=/pre.?market|after.?hours|post.?market/i.test(data?.marketStatus || '');
  const reading=extended ? [data.secondaryData,data.primaryData].find(row=>/^Closed at /i.test(row?.lastTradeTimestamp || ''))
    : data?.primaryData;
  const price=money(reading?.lastSalePrice), change=money(reading?.percentageChange);
  const asOf=reading?.lastTradeTimestamp?.replace(/^Closed at /i,'');
  if (data?.symbol!==ticker || !price || !reading?.percentageChange?.includes('%') || !Number.isFinite(change) || !asOf) {
    throw Error('Incomplete quote');
  }
  const closed=extended || /^Closed at /i.test(reading.lastTradeTimestamp) || /closed/i.test(data.marketStatus || '');
  return {ticker,sector,niche,price,change,asOf,status:closed?'Latest regular session':data.marketStatus};
}

let cache, pending;
export async function marketSnapshot() {
  if (cache && Date.now()-Date.parse(cache.fetchedAt)<60_000) return cache;
  pending ??= Promise.allSettled([...sectors,benchmark].map(quote)).then(results=>{
    const quotes=results.slice(0,-1).flatMap(row=>row.status==='fulfilled'?[row.value]:[]).sort((a,b)=>b.change-a.change);
    if (!quotes.length) {
      if (cache) return {...cache,stale:true};
      throw Error('No sector quotes available');
    }
    if (quotes.length<sectors.length && cache?.quotes.length===sectors.length) return {...cache,stale:true};
    cache={quotes,total:sectors.length,benchmark:results.at(-1).value || null,fetchedAt:new Date().toISOString(),stale:false};
    return cache;
  }).finally(()=>{ pending=null; });
  return pending;
}
