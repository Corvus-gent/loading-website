// One rule: Gabe's original post, with its own native video. No date/slug gate.
export const RULE_VERSION=3;
export function classification(row){
 const post_type=row.post_type||(row.post_kind==='self_thread'?'reply':row.post_kind)||'unknown';
 return{post_type,media_type:row.media_type||'unknown'};
}
export function eligibility(row){
 const {post_type,media_type}=classification(row),reasons=[];
 if(row.original_by_gabe!==true)reasons.push('Confirm that Gabe is the author.');
 if(post_type!=='original')reasons.push('Replies, reposts and quote posts do not count.');
 if(media_type!=='video')reasons.push('The post itself must contain a native video.');
 return{eligible:reasons.length===0,reasons};
}
