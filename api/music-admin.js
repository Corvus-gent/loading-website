import { connected, redis } from './_redis.js';
import { getSession } from './_session.js';
import { loadTracks, suggestions, suggestion, validId, GENRES, ORIGINS, resolveLink, sameTrack, today, revision } from './_music-store.js';
const SAVE = `if redis.call('GET',KEYS[1])~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); if ARGV[3]~='' then redis.call('HDEL',KEYS[2],ARGV[3]) end; return 1`;
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if(!['GET','POST'].includes(req.method)) return res.status(405).json({error:'method_not_allowed'});
  if(!connected()) return res.status(503).json({error:'storage_unavailable'});
  try {
    const session=await getSession(req);
    if(!session) return res.status(401).json({error:'login_required'});
    if(session.email!=='gabriel@corvus.gent') return res.status(403).json({error:'forbidden'});
    if(req.method==='POST' && !ORIGINS.includes(req.headers.origin || '')) return res.status(403).json({error:'forbidden'});
    const catalog=await loadTracks();
    if(req.method==='GET') return res.status(200).json({tracks:catalog.tracks,revision:catalog.revision,suggestions:await suggestions()});
    const body=req.body || {};
    if(body.revision!==catalog.revision) return res.status(409).json({error:'conflict'});
    let tracks=catalog.tracks, dismiss='';
    const index=tracks.findIndex(t=>t.id===body.id);
    if(body.action==='order') {
      if(!Array.isArray(body.ids) || body.ids.length!==tracks.length || new Set(body.ids).size!==tracks.length || body.ids.some(id=>!validId(id) || !tracks.some(t=>t.id===id))) return res.status(400).json({error:'invalid_order'});
      const map=new Map(tracks.map(t=>[t.id,t])); tracks=body.ids.map(id=>map.get(id));
    } else if(body.action==='update') {
      if(index<0 || !GENRES.includes(body.genre) || typeof body.note!=='string' || body.note.length>1000 || (body.title!==undefined && (typeof body.title!=='string' || !body.title.trim() || body.title.length>180)) || (body.artist!==undefined && (typeof body.artist!=='string' || body.artist.length>180))) return res.status(400).json({error:'bad_request'});
      tracks[index]={...tracks[index],genre:body.genre,note:body.note,title:body.title?.trim() || tracks[index].title,artist:body.artist?.trim() ?? tracks[index].artist};
      if(body.link) {
        const linked=await resolveLink(body.link);
        const duplicate=tracks.find(t=>t.id!==body.id && ((linked.spotifyId && linked.spotifyId===t.spotifyId) || (linked.appleId && linked.appleId===t.appleId)));
        if(duplicate) return res.status(409).json({error:'already_listed'});
        for(const key of ['spotifyId','appleId','appleUrl']) if(linked[key]) tracks[index][key]=linked[key];
        tracks[index].needsReview=false;
      }
    } else if(body.action==='remove') {
      if(index<0) return res.status(400).json({error:'unknown_track'});
      tracks=tracks.filter(t=>t.id!==body.id);
    } else if(body.action==='add' || body.action==='promote') {
      if(!GENRES.includes(body.genre) || !Number.isInteger(body.position) || body.position<1 || body.position>tracks.length+1) return res.status(400).json({error:'bad_request'});
      let track;
      if(body.action==='add') track=await resolveLink(body.url);
      else {
        if(!validId(body.id)) return res.status(400).json({error:'bad_request'});
        const raw=await redis(['HGET','music:sugg',body.id]);
        if(!raw) return res.status(404).json({error:'unknown_track'});
        track=suggestion(body.id,raw); dismiss=body.id;
      }
      if(tracks.some(t=>sameTrack(t,track))) return res.status(409).json({error:'already_listed'});
      if(tracks.length>=2000) return res.status(400).json({error:'box_full'});
      tracks.splice(body.position-1,0,{...track,genre:body.genre,added:today()});
    } else if(body.action==='dismiss') {
      if(!validId(body.id)) return res.status(400).json({error:'bad_request'});
      dismiss=body.id;
    } else return res.status(400).json({error:'bad_action'});
    const raw=JSON.stringify(tracks);
    const saved=await redis(['EVAL',SAVE,'2','music:tracks','music:sugg',catalog.raw,raw,dismiss]);
    if(!Number(saved)) return res.status(409).json({error:'conflict'});
    return res.status(200).json({tracks,revision:revision(raw),suggestions:await suggestions()});
  } catch(error) {return res.status(error.status || 500).json({error:error.status?error.message:'storage_error'});}
}
