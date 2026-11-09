import {interviewCard} from '../_og/model.js';
import {renderCard} from '../_og/render.js';
import og from '../_og/handler.js';
export const card=row=>renderCard(interviewCard(row));
export default function share(req,res){const n=req.query.interviewPage||req.query.interviewCard;return og({...req,query:{kind:'interview',n:String(n),...(req.query.interviewPage?{ogPage:'1'}:{})}},res);}
