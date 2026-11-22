import { randomUUID } from 'node:crypto';
import { connected, redis } from '../../api/_redis.js';
import { runBoatRace } from './boat.js';
import { networkId } from './quota.js';
import { TOKEN } from '../../public/hackersbay/assets/intros.js';
import { cleanText } from '../../public/hackersbay/assets/persona.js';
import { prepareScout, raceScore, rankRaceCandidates, SCOUTS } from '../../public/hackersbay/assets/race-model.js';
import attendees from '../../public/hackersbay/assets/attendees.json' with { type: 'json' };

const leaderboard = 'hackersbay:v1:{race}:leaderboard';
const raceTotals = 'hackersbay:v1:{race}:activity';
const countedRace = id => 'hackersbay:v1:{race}:counted:' + id;
const recordRace = `
  if not redis.call('SET',KEYS[1],'1','NX','EX',86400) then return 0 end
  return redis.call('HINCRBY',KEYS[2],'races',1)
`;

export async function readRaceActivity() {
  if (!connected()) return null;
  const [races, feathers] = await redis(['HMGET', raceTotals, 'races', 'feathers']);
  return { races: Number(races || 0), feathers: Number(feathers || 0) };
}
const ticket = id => 'hackersbay:v1:{race}:feather:' + id;
const token = id => typeof id === 'string' && TOKEN.test(id);

function demoRanks() {
  return Object.entries(SCOUTS).map(([type, scout]) => {
    const { rows } = prepareScout(type,attendees);
    const picks = rankRaceCandidates(type,rows);
    return { name:scout.name, type, mode:'demo', ...raceScore(rows,picks,scout.demoMs) };
  }).sort((a,b) => b.score-a.score);
}

export async function readRaceBoard() {
  if (!connected()) return { mode:'demo', leaders:demoRanks() };
  try {
    const raw = await redis(['ZREVRANGE',leaderboard,0,19,'WITHSCORES']);
    const leaders = [];
    for (let i=0; i<raw.length; i+=2) leaders.push({ ...JSON.parse(raw[i]), score:Number(raw[i+1]) });
    return { mode:'shared', leaders };
  } catch {
    return { mode:'demo', leaders:demoRanks() };
  }
}

export async function handleRace(req, res) {
  const { scout, raceId } = req.body || {};
  if (!Object.hasOwn(SCOUTS,scout) || !token(raceId)) {
    return res.status(400).json({ error: 'Invalid scout or race ID.' });
  }
  const { rows } = prepareScout(scout,attendees);
  const account = networkId(req);
  const start = Date.now();
  let result;
  try { result = await runBoatRace(scout,rows,rankRaceCandidates,account,raceId); }
  catch { result = { reason:'Boat.dev did not return a result.' }; }
  const mode = result.picks ? 'boat' : 'demo';
  const elapsed = mode === 'boat' ? Date.now() - start : SCOUTS[scout].demoMs;
  const picks = result.picks || rankRaceCandidates(scout,rows);
  const scored = raceScore(rows,picks,elapsed);
  let receipt;
  if (connected()) {
    try {
      receipt = randomUUID();
      await redis(['SET',ticket(receipt),JSON.stringify({ account, type:scout, mode, score:scored.score }),'EX',900]);
    } catch { receipt = undefined; }
    await redis(['EVAL', recordRace, 2, countedRace(raceId), raceTotals]).catch(() => {});
  }
  return res.status(200).json({ mode, picks, elapsed, ...scored, receipt, reason:result.reason });
}

export async function postFeather(req,res) {
  const { receipt } = req.body || {};
  if (!token(receipt)) return res.status(400).json({ error:'Finish a race before posting.' });
  if (!connected()) return res.status(503).json({ error:'The shared leaderboard is unavailable.' });
  try {
    const key = ticket(receipt);
    const raw = await redis(['GET',key]);
    const entry = raw && JSON.parse(raw);
    if (!entry || entry.account !== networkId(req)) return res.status(404).json({error:'This race ticket expired.'});
    const name = cleanText(req.body.name,48) || SCOUTS[entry.type].name;
    const member = JSON.stringify({name,type:entry.type,mode:entry.mode});
    const script = `
      if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end
      redis.call('ZADD',KEYS[2],'GT',ARGV[2],ARGV[3])
      redis.call('ZREMRANGEBYRANK',KEYS[2],0,-101)
      redis.call('DEL',KEYS[1])
      redis.call('HINCRBY',KEYS[3],'feathers',1)
      return 1
    `;
    const saved = await redis(['EVAL',script,3,key,leaderboard,raceTotals,raw,entry.score,member]);
    if (Number(saved) !== 1) return res.status(404).json({error:'This race ticket was already used.'});
    return res.status(200).json({name,score:entry.score});
  } catch {
    return res.status(503).json({error:'The shared leaderboard is unavailable.'});
  }
}
