import {rank, points, publicSoldier, dayKey, weekKey, RANKS,TIERS,activeTier} from '../../js/army/domain.js';
export function armyPublic(store) {
  async function build() {
    const revision = await store.run(['GET',store.key('revision')]) || '0';
    const users = (await store.all()).filter(s=>s.status!=='deleting');
    const today = dayKey(store.now()), week = weekKey(store.now());
    const [weeklyRows,sent,mailStatus,winner] = await Promise.all([
      store.run(['ZRANGE',store.key('week:'+week),0,-1,'WITHSCORES']),
      store.run(['GET',store.key('mail-count:'+new Date(store.now()).toISOString().slice(0,10))]),
      store.get('mail-status'),store.get('winner:'+week),
    ]);
    const weekly = new Map();for(let i=0;i<weeklyRows.length;i+=2)weekly.set(weeklyRows[i],Math.max(0,Number(weeklyRows[i+1])));
    const named = users.filter(s=>s.verifiedAt&&s.username);
    const entry = s => ({username:s.verifiedAt&&!s.hidden?s.username||null:null,rank:rank(s),tier:activeTier(s,store.now()),points:points(s),recruits:s.recruits||0,weekRecruits:weekly.get(s.id)||0});
    const rankDistribution=Object.fromEntries([...RANKS.map(([name])=>[name,0]),['imperator',0]]);
    const countries={};for(const user of users){rankDistribution[rank(user)]++;if(user.country)countries[user.country]=(countries[user.country]||0)+1;}
    const top = (score) => named.filter(s=>!s.hidden).sort((a,b)=>score(b)-score(a)||a.username.localeCompare(b.username)).slice(0,25).map(entry);
    const treeUsers = [...users].sort((a,b)=>(b.recruits||0)-(a.recruits||0)||a.created.localeCompare(b.created)).slice(0,120);
    const treeIDs = new Map(treeUsers.map((u,i)=>[u.id,'s'+i]));
    let subscriptions=0;
    const subKeys=users.flatMap(u=>['daily','weekly'].map(kind=>store.key('sub:'+u.id+':'+kind)));
    for(let i=0;i<subKeys.length;i+=500){const values=await store.run(['MGET',...subKeys.slice(i,i+500)]);subscriptions+=values.filter(v=>v&&JSON.parse(v).confirmed).length;}
    const result={updated:new Date(store.now()).toISOString(),soldiers:named.length,anonymous:users.length-named.length,
      atGate:users.filter(s=>s.applied&&['unconfirmed','waiting','later'].includes(s.status)).length,
      approved:users.filter(s=>s.status==='approved').length,paid:users.filter(s=>s.paid).length,
      recruits:users.reduce((n,s)=>n+(s.recruits||0),0),recruitedToday:users.filter(s=>s.qualifiedAt&&dayKey(Date.parse(s.qualifiedAt))===today).length,
      subscribers:subscriptions,mailsToday:Number(sent||0),leaderboard:top(points),weekly:top(s=>weekly.get(s.id)||0),
      recruiters:top(s=>s.recruits||0),ranks:rankDistribution,countries:Object.entries(countries).map(([code,count])=>({code,count})),
      soldierOfWeek:winner?entry(users.find(s=>s.id===winner.uid)||{created:today,feathers:[]}):null,
      tree:treeUsers.map(s=>({key:treeIDs.get(s.id),username:s.verifiedAt&&!s.hidden?s.username||null:null,rank:rank(s),parent:treeIDs.get(s.parent)||null})),treeTotal:users.length,
      remindersWaiting:mailStatus?.waiting||0};
    result.tiers=Object.fromEntries(TIERS.map(t=>[t,users.filter(s=>activeTier(s,store.now())===t).length]));
    result.mrr=Math.round(users.filter(s=>activeTier(s,store.now())&&s.membership?.currency==='USD'&&!['senator','consul'].includes(s.membership.tier)).reduce((n,s)=>n+s.membership.amount/(s.membership.interval==='year'?12:1),0));
    result.coffees=Math.max(0,Number(await store.run(['GET',store.key('bmc:coffees')]))||0)+Math.max(0,Number(process.env.COFFEE_BASELINE)||0);
    await store.run(['EVAL',"if (redis.call('GET',KEYS[1]) or '0')==ARGV[1] then redis.call('SET',KEYS[2],ARGV[2],'EX',30);return 1 end return 0",2,store.key('revision'),store.key('public'),revision,JSON.stringify(result)]);
    return result;
  }
  async function summary(){return await store.get('public') || build();}
  return {build,summary};
}
