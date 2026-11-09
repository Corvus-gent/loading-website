// A registry match or an owner approval is necessary, but never sufficient.
export const RULE_VERSION=2;
export const COMPOUND_FIRST_USE='2026-11-07T00:00:00-08:00';
export function eligibility(row){
 const reasons=[];
 if(row.original_by_gabe!==true)reasons.push('Confirm this is Gabe’s original post.');
 if(!['original','self_thread'].includes(row.post_kind))reasons.push('Replies, reposts and unverified quotes do not count.');
 if(row.native_video!==true||row.media_type!=='video')reasons.push('A native video is required; images, GIFs and carousels do not count.');
 const date=Date.parse(row.posted_at);if(!Number.isFinite(date)||date<Date.parse(COMPOUND_FIRST_USE))reasons.push('Confirm a posting date on or after 7 Nov 2026.');
 if(!row.registry_match&&!row.manual_approved)reasons.push('Match a Compound export slug or approve this video.');
 if(row.compound_excluded===true)reasons.push('Excluded by the owner.');
 return{eligible:reasons.length===0,reasons};
}
